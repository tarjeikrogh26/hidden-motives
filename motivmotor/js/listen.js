/* Lytting: lyd → noter. Analysemotoren er hentet fra Norwegian Beats (samme forfatter) og bruker
   Spotify Basic Pitch på TensorFlow.js (Apache 2.0, se vendor/). Funksjonene fra «fft» til «guessTempo»
   er kopiert uendret; resten tilpasser resultatet til Motivmotor og legger til stems fra Logic. */
(function (MM) {
  'use strict';
  const NOTE = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const KMAJ = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88], KMIN = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];
  const AN_SR = 22050, AN_HOP = 256, AN_FPS = AN_SR / AN_HOP;
  const QUALS = { M: [0, 4, 7], m: [0, 3, 7], '7': [0, 4, 7, 10], maj7: [0, 4, 7, 11], m7: [0, 3, 7, 10], sus4: [0, 5, 7], sus2: [0, 2, 7], dim: [0, 3, 6], add9: [0, 4, 7, 14], madd9: [0, 3, 7, 14], m9: [0, 3, 7, 10, 14] };
  const QNAME = { M: '', m: 'm', '7': '7', maj7: 'maj7', m7: 'm7', sus4: 'sus4', sus2: 'sus2', dim: 'dim', add9: 'add9', madd9: 'm(add9)', m9: 'm9' };
  const MINOR_SC = [0, 2, 3, 5, 7, 8, 10];
  let LOWENV = null, ENVREF = null, CLKENV = null;

  /* ---------- fra Norwegian Beats ---------- */
  function fft(re,im){
    const n=re.length;
    for(let i=1,j=0;i<n;i++){let bit=n>>1;for(;j&bit;bit>>=1)j^=bit;j^=bit;if(i<j){let t=re[i];re[i]=re[j];re[j]=t;t=im[i];im[i]=im[j];im[j]=t;}}
    for(let len=2;len<=n;len<<=1){const a=-2*Math.PI/len,wr=Math.cos(a),wi=Math.sin(a),h=len>>1;
      for(let i=0;i<n;i+=len){let cr=1,ci=0;for(let j=0;j<h;j++){const k=i+j+h,vr=re[k]*cr-im[k]*ci,vi=re[k]*ci+im[k]*cr;re[k]=re[i+j]-vr;im[k]=im[i+j]-vi;re[i+j]+=vr;im[i+j]+=vi;const t=cr*wr-ci*wi;ci=cr*wi+ci*wr;cr=t;}}}
  }
  const HANN={},hann=N=>HANN[N]||(HANN[N]=Float64Array.from({length:N},(_,i)=>.5-.5*Math.cos(2*Math.PI*i/N)));
  function magSpec(x,st,N){const re=new Float64Array(N),im=new Float64Array(N),w=hann(N);for(let i=0;i<N;i++){const j=st+i;re[i]=j>=0&&j<x.length?x[j]*w[i]:0;}fft(re,im);
    const m=new Float64Array(N/2);for(let i=0;i<N/2;i++)m[i]=Math.hypot(re[i],im[i]);return m;}
  function onsetEnvelope(x){
    const N=1024,nf=Math.max(0,Math.floor((x.length-N)/AN_HOP)+1),env=new Float32Array(nf),low=new Float32Array(nf),clk=new Float32Array(nf),lb=Math.round(120/AN_SR*N),c0=Math.round(1500/AN_SR*N),c1=Math.round(6000/AN_SR*N);let prev=null;
    for(let f=0;f<nf;f++){const m=magSpec(x,f*AN_HOP,N);let s=0,sl=0,sc=0;
      for(let i=1;i<m.length;i++){const v=Math.log1p(1000*m[i]);if(prev){const d=v-prev[i];if(d>0){if(i>=2)s+=d;if(i<=lb)sl+=d;if(i>=c0&&i<=c1)sc+=d;}}m[i]=v;}prev=m;env[f]=s;low[f]=sl;clk[f]=sc;}
    // a kick is a rise in the deep low end and a click at the same moment; a bass note or a hihat has only one of them
    const mz=a=>{let m=0;for(const v of a)m+=v;m/=Math.max(1,a.length);return a.map(v=>v/(m||1));};const ln=mz(low),cn=mz(clk);
    LOWENV=Float32Array.from(ln,(v,i)=>v*Math.min(3,cn[i]));CLKENV=cn;
    const w=Math.round(AN_FPS*.4),ps=new Float64Array(nf+1);for(let i=0;i<nf;i++)ps[i+1]=ps[i]+env[i];
    const out=new Float32Array(nf);let sq=0;
    for(let i=0;i<nf;i++){const a=Math.max(0,i-w),b=Math.min(nf,i+w+1),mu=(ps[b]-ps[a])/(b-a),v=Math.max(0,env[i]-mu);out[i]=v;sq+=v*v;}
    const sd=Math.sqrt(sq/Math.max(1,nf))||1;for(let i=0;i<nf;i++)out[i]/=sd;return out;
  }
  const envTime=f=>(f*AN_HOP+512)/AN_SR;
  function estimateTempo(env){
    const n=env.length,maxLag=Math.min(n-2,Math.ceil(4*60*AN_FPS/68));if(maxLag<10)return 120;
    const ac=new Float32Array(maxLag+2);for(let L=1;L<=maxLag+1;L++){let s=0;for(let i=L;i<n;i++)s+=env[i]*env[i-L];ac[L]=s/(n-L);}
    const at=l=>{const a=Math.floor(l),f=l-a;return a+1<ac.length&&a>=1?ac[a]*(1-f)+ac[a+1]*f:0;};
    let best={s:-1,bpm:120};
    for(let bpm=70;bpm<=180;bpm+=.1){const L=60*AN_FPS/bpm;if(4*L>maxLag)continue;
      const s=(at(L)+.5*at(2*L)+.5*at(4*L)+.25*at(L/2))*Math.exp(-.5*Math.pow(Math.log2(bpm/124)/.55,2));if(s>best.s)best={s,bpm};}
    return best.bpm;
  }
  function trackBeats(env,bpm){
    const n=env.length,P=60*AN_FPS/bpm,sc=new Float32Array(n),bk=new Int32Array(n).fill(-1),tight=250;
    for(let t=0;t<n;t++){let best=-1e9,bi=-1;const lo=Math.max(0,Math.round(t-2*P)),hi=Math.round(t-P/2);
      for(let u=lo;u<=hi;u++){const v=sc[u]-tight*Math.pow(Math.log((t-u)/P),2);if(v>best){best=v;bi=u;}}
      sc[t]=env[t]+(bi>=0?Math.max(0,best):0);bk[t]=bi>=0&&best>0?bi:-1;}
    let t=n-1,mx=-1e9;for(let u=Math.max(0,Math.floor(n-P));u<n;u++)if(sc[u]>mx){mx=sc[u];t=u;}
    const b=[];while(t>=0){b.push(t);t=bk[t];}b.reverse();
    return b.map(envTime);
  }
  function regularBeats(bt,dur){
    if(bt.length<4)return null;
    const ibi=bt.slice(1).map((x,i)=>x-bt[i]).sort((a,b)=>a-b),med=ibi[ibi.length>>1];
    // index every beat on the grid and fit a straight line (a steady tempo, as in almost all electronic music)
    const idx=[0];for(let i=1;i<bt.length;i++)idx.push(idx[i-1]+Math.max(1,Math.round((bt[i]-bt[i-1])/med)));let n=0,sx=0,sy=0,sxx=0,sxy=0;
    idx.forEach((k,i)=>{n++;sx+=k;sy+=bt[i];sxx+=k*k;sxy+=k*bt[i];});
    const slope=(n*sxy-sx*sy)/(n*sxx-sx*sx||1),icpt=(sy-slope*sx)/n;
    const res=Math.sqrt(idx.reduce((a,k,i)=>a+Math.pow(bt[i]-(icpt+slope*k),2),0)/n),steady=res<.035;
    let beats=[];
    if(steady){let t=icpt;while(t-slope>-.05)t-=slope;for(;t<dur+slope;t+=slope)beats.push(t);}
    else{let t=bt[0];while(t-med>-.05)t-=med;let j=0;for(;t<dur+med;t+=med){while(j<bt.length-1&&bt[j]<t-med/2)j++;const near=Math.abs(bt[j]-t)<med*.25?bt[j]:t;beats.push(near);t=near;}}
    let per=steady?slope:med;
    // fine tempo: slide a grid over the whole onset curve and keep the tempo and phase that line up best
    if(steady&&ENVREF){const E=ENVREF,val=t=>{const f=(t*AN_SR-512)/AN_HOP,i=Math.floor(f);if(i<0||i+1>=E.length)return 0;return Math.max(E[i],E[i+1]);};
      let best={s:-1};const b0=60/per;
      for(let bpm=b0-1.2;bpm<=b0+1.2;bpm+=.02){const P=60/bpm;for(let ph=0;ph<P;ph+=P/48){let s=0;for(let t=ph;t<dur;t+=P)s+=val(t);if(s>best.s)best={s,P,ph};}}
      let bpm=60/best.P;const r=Math.round(bpm);if(Math.abs(bpm-r)<.15)bpm=r;per=60/bpm;
      let ph=best.ph;{let bs=-1,bp=ph;for(let d=-per/8;d<=per/8;d+=per/96){let s=0;for(let t=ph+d;t<dur;t+=per)s+=val(t);if(s>bs){bs=s;bp=ph+d;}}ph=bp;}
      beats=[];for(let t=ph;t<dur+per;t+=per)beats.push(t);}
    // kick check: if the low end hits harder half a beat later, the grid sits on the offbeats (open hats) — move it
    return{beats,ibi:per,steady};
  }
  function fixBeatPhase(beats,per,frames,dur,notes){
    // low-end hits that start together with a transcribed bass note belong to the bass, not the kick
    const bassOn=(notes||[]).filter(n=>n.pitchMidi<52&&n.amplitude>=.25).map(n=>n.startTimeSeconds).sort((a,b)=>a-b);
    const nearBass=t=>{let lo=0,hi=bassOn.length-1;while(lo<=hi){const m=(lo+hi)>>1;if(Math.abs(bassOn[m]-t)<=.045)return true;if(bassOn[m]<t)lo=m+1;else hi=m-1;}return false;};
    const lowAt=t=>{if(!LOWENV||nearBass(t))return 0;const f=Math.round((t*AN_SR-512)/AN_HOP);let m=0;for(let k=f-1;k<=f+1;k++)if(k>=0&&k<LOWENV.length)m=Math.max(m,LOWENV[k]);return m;};
    const nf=frames.length,ch=new Array(nf);for(let k=0;k<nf;k++){const f=frames[k],c=new Float32Array(12);for(let j=0;j<88;j++){const v=f[j];if(v>.08)c[(21+j)%12]+=v;}ch[k]=c;}
    const w=Math.max(2,Math.round(per*.45*AN_FPS)),mean=(a,b)=>{const c=new Float32Array(12);let n=0;for(let k=Math.max(0,a);k<Math.min(nf,b);k++){n++;for(let i=0;i<12;i++)c[i]+=ch[k][i];}return norm1(c);};
    const nov=t=>{const k=Math.round(t*AN_FPS);const A2=mean(k-w,k),B=mean(k,k+w);let d=0;for(let i=0;i<12;i++)d+=Math.abs(A2[i]-B[i]);return d;};
    let lo0=0,lo1=0,n0=0,n1=0;for(const t of beats){lo0+=lowAt(t);lo1+=lowAt(t+per/2);n0+=nov(t);n1+=nov(t+per/2);}
    // claps and snares come every other beat (2 and 4): strong even/odd contrast on the right grid, none for offbeat hats
    const clkAt=t=>{if(!CLKENV)return 0;const f=Math.round((t*AN_SR-512)/AN_HOP);let m=0;for(let k=f-1;k<=f+1;k++)if(k>=0&&k<CLKENV.length)m=Math.max(m,CLKENV[k]);return m;};
    const contrast=off=>{let e=0,o=0;beats.forEach((t,i)=>{const v=clkAt(t+off);if(i%2)o+=v;else e+=v;});return Math.abs(e-o)/(e+o||1);};
    const c0=contrast(0),c1=contrast(per/2);
    const s0=1.6*lo0/(lo0+lo1||1)+.6*n0/(n0+n1||1),s1=1.6*lo1/(lo0+lo1||1)+.6*n1/(n0+n1||1);
    if(s1>s0){beats=beats.map(t=>t+per/2).filter(t=>t<dur+per);while(beats[0]-per>-.05)beats.unshift(beats[0]-per);}
    return beats;
  }
  function beatChroma(frames,beats){
    const U=[];
    for(let i=0;i<beats.length-1;i++){const a=Math.max(0,Math.ceil(beats[i]*AN_FPS)),b=Math.min(frames.length,Math.floor(beats[i+1]*AN_FPS));
      const c=new Float32Array(12),bs=new Float32Array(12),hi=new Float32Array(12);let e=0;
      for(let k=a;k<b;k++){const f=frames[k];if(!f)continue;
        for(let j=0;j<88;j++){const v=f[j];if(v<.05)continue;const m=21+j,pc=m%12;e+=v;
          if(m<52)bs[pc]+=v;if(m>=45&&m<86)c[pc]+=v*(m<52?.5:1);if(m>=60)hi[pc]+=v;}}
      const k=Math.max(1,b-a);for(let j=0;j<12;j++){c[j]/=k;bs[j]/=k;hi[j]/=k;}
      U.push({c,b:bs,h:hi,e:e/k});}
    return U;
  }
  function chromaFromNotes(ns,s0,s1){const c=new Float32Array(12),b=new Float32Array(12),h=new Float32Array(12);let e=0;
    for(const n of ns){const ov=Math.min(s1,n.s+n.l)-Math.max(s0,n.s);if(ov<=0)continue;const pc=((n.p%12)+12)%12,w=ov*(n.v||1);e+=w;
      if(n.p<52)b[pc]+=w;if(n.p>=45&&n.p<86)c[pc]+=w*(n.p<52?.5:1);if(n.p>=60)h[pc]+=w;}
    return{c,b,h,e};}
  const norm1=a=>{let s=0;for(const v of a)s+=v;return s>0?Array.from(a,v=>v/s):Array.from(a,()=>0);};
  function keyFromChroma(h){
    const corr=(prof,r)=>{const xs=prof.map((_,i)=>h[(i+r)%12]),mx=xs.reduce((a,b)=>a+b,0)/12,my=prof.reduce((a,b)=>a+b,0)/12;let a=0,b=0,c=0;
      for(let i=0;i<12;i++){a+=(xs[i]-mx)*(prof[i]-my);b+=(xs[i]-mx)**2;c+=(prof[i]-my)**2;}return a/Math.sqrt(b*c||1);};
    let best={root:0,mode:'min',v:-9};for(let r=0;r<12;r++)for(const[mode,prof]of[['maj',KMAJ],['min',KMIN]]){const v=corr(prof,r);if(v>best.v)best={root:r,mode,v};}
    return best;
  }
  function recognizeChords(units,key){
    const mt=key.mode==='maj'?(key.root+9)%12:key.root,dia=MINOR_SC.map(x=>(x+mt)%12);
    const BASEQ=['M','m','sus4','dim'],states=[];for(let r=0;r<12;r++)for(const q of BASEQ)states.push({r,q});states.push({r:-1,q:'N'});
    const emit=units.map(u=>{const c=norm1(u.c),b=norm1(u.b),loud=u.e;
      return states.map(st=>{if(st.q==='N')return loud<1e-4?1:-.3;
        const iv=QUALS[st.q],tones=iv.map(i=>(st.r+i)%12);let s=0;
        for(let pc=0;pc<12;pc++){const k=tones.indexOf(pc);s+=c[pc]*(k===0?1.15:k>=0?1:-.55);}
        s+=.55*b[st.r]+.12*b[tones[2]]+.08*b[tones[1]];
        if(tones.every(t=>dia.includes(t)))s+=.07;if(st.q==='sus4')s-=.07;if(st.q==='dim')s-=.12;return s;});});
    const n=units.length,S2=states.length,V=new Float32Array(S2),bp=[];let prev=emit[0].slice();
    for(let u=1;u<n;u++){const pen=u%2===0?.22:.42,cur=new Float32Array(S2),bk=new Int16Array(S2);let bestPrev=0;for(let j=1;j<S2;j++)if(prev[j]>prev[bestPrev])bestPrev=j;
      for(let j=0;j<S2;j++){const stay=prev[j],jump=prev[bestPrev]-pen;if(stay>=jump){cur[j]=stay+emit[u][j];bk[j]=j;}else{cur[j]=jump+emit[u][j];bk[j]=bestPrev;}}
      bp.push(bk);prev=Array.from(cur);}
    let j=0;for(let k=1;k<S2;k++)if(prev[k]>prev[j])j=k;const path=[j];for(let u=n-2;u>=0;u--){j=bp[u][j];path.push(j);}path.reverse();
    const segs=[];path.forEach((k,u)=>{const L=segs[segs.length-1];if(L&&L.k===k)L.n++;else segs.push({k,u,n:1});});
    return segs.map(g=>{const st=states[g.k];if(st.q==='N')return{s:g.u*8,l:g.n*8,root:-1,q:'N'};
      // what stays through the whole chord (a melody moves, the 7th or 9th of a chord stays): the lower half of the values per pitch
      const c=new Float32Array(12);{const per=[...Array(12)].map(()=>[]);for(let u=g.u;u<g.u+g.n;u++){const cc=norm1(units[u].c);for(let p=0;p<12;p++)per[p].push(cc[p]);}
        for(let p=0;p<12;p++){const v=per[p].sort((x,y)=>x-y);c[p]=v.length>2?v.slice(0,Math.ceil(v.length/2)).reduce((x,y)=>x+y,0)/Math.ceil(v.length/2):v.reduce((x,y)=>x+y,0)/v.length;}}
      const iv=QUALS[st.q],tones=iv.map(i=>(st.r+i)%12),tm=Math.min(...tones.map(t=>c[t])),ext=[2,10,11].map(i=>(st.r+i)%12),others=[...Array(12).keys()].filter(p=>!tones.includes(p)&&!ext.includes(p)),om=others.reduce((a,p)=>a+c[p],0)/others.length;
      const fl=others.map(p=>c[p]).sort((x,y)=>x-y)[others.length>>1]||0,tm2=tm-fl;
      const has=i=>{const v=c[(st.r+i)%12]-fl;return v>.5*tm2&&v>.035;};let q=st.q;
      if(q==='m'){if(has(10))q=has(2)?'m9':'m7';else if(has(2))q='madd9';}
      else if(q==='M'){if(has(11))q='maj7';else if(has(10))q='7';else if(has(2))q='add9';}
      return{s:g.u*8,l:g.n*8,root:st.r,q};});
  }
  function findDownbeat(units1){
    const sc=[0,0,0,0],dist=(a,b)=>{const x=norm1(a),y=norm1(b);let d=0;for(let i=0;i<12;i++)d+=Math.abs(x[i]-y[i]);return d;};
    for(let i=2;i<units1.length-1;i++){const pre={c:new Float32Array(12),b:new Float32Array(12)},post={c:new Float32Array(12),b:new Float32Array(12)};
      for(let p=0;p<12;p++){pre.c[p]=units1[i-2].c[p]+units1[i-1].c[p];post.c[p]=units1[i].c[p]+units1[i+1].c[p];pre.b[p]=units1[i-2].b[p]+units1[i-1].b[p];post.b[p]=units1[i].b[p]+units1[i+1].b[p];}
      sc[i%4]+=dist(pre.c,post.c)+1.3*dist(pre.b,post.b);}
    return sc.indexOf(Math.max(...sc));
  }
  function splitNotes(q,tot,chords){
    const pool=q.filter(n=>n.s>=0&&n.s<tot),sorted=pool.filter(n=>n.p>=45&&n.p<90).sort((a,b)=>a.s-b.s),groups=[];
    for(const n of sorted){const g=groups[groups.length-1];if(g&&n.s-g.s<=1)g.ns.push(n);else groups.push({s:n.s,ns:[n]});}
    const segOf2=s=>chords.findIndex(c=>c.s<=s&&c.s+c.l>s),hitSteps=[];
    const bySeg={};for(const g of groups){if(g.ns.length<2)continue;const k=segOf2(g.s);(bySeg[k]=bySeg[k]||[]).push(g);}
    for(const[k,gs]of Object.entries(bySeg)){const c=chords[+k],tones=c&&c.root>=0?(QUALS[c.q]||QUALS.m).map(i=>(c.root+i)%12):null;
      const freq={};for(const g of gs)for(const p of new Set(g.ns.map(n=>n.p)))freq[p]=(freq[p]||0)+1;
      // the core of the voicing: pitches in most of the hits; notes above the core are melody, chord tones inside it are chord
      const core=Object.keys(freq).filter(p=>freq[p]>=Math.max(2,gs.length*.6)).map(Number).sort((x,y)=>x-y);
      const top=core.length?core[core.length-1]:99,bot=core.length?core[0]:0;
      for(const g of gs){let k2=0;for(const n of g.ns){const held=n.e-n.s>=8&&g.ns.length>=3&&tones&&tones.includes(n.p%12);
        const isCh=core.includes(n.p)||held||(n.p<=top&&n.p>=bot-2&&tones&&tones.includes(n.p%12)&&freq[n.p]>=Math.max(2,gs.length*.3));
        if(isCh){n.ch=true;k2++;}}if(k2>=2)hitSteps.push(g.s);}}
    // melody candidates, delay echoes removed
    let cand=pool.filter(n=>!n.ch&&n.p>=55);const amps=cand.map(n=>n.a).sort((a,b)=>a-b),thr=Math.max(.18,.35*(amps[Math.floor(amps.length*.7)]||0));
    cand=cand.filter(n=>n.a>=thr&&!cand.some(m=>m!==n&&m.p===n.p&&n.s-m.s>=1&&n.s-m.s<=6&&m.a>=n.a*1.45));
    const steps={};for(const n of cand)(steps[n.s]=steps[n.s]||[]).push(n);
    const keys=Object.keys(steps).map(Number).sort((a,b)=>a-b);let prev=null;
    for(const s of keys){const C=steps[s];for(const c of C){const e=c.a+.008*(c.p-60);let best=0;
        if(prev)best=Math.max(...prev.map(p=>p.sc-.22*Math.min(2,Math.abs(c.p-p.p)/12)-(Math.abs(c.p-p.p)>12?.3:0)));c.sc=e+best;}
      prev=C;}
    const mel=[];if(prev){let c=prev.reduce((a,b)=>b.sc>a.sc?b:a);for(let i=keys.length-1;i>=0;i--){const C=steps[keys[i]];
        if(i===keys.length-1){mel.push(c);continue;}
        const nx=mel[mel.length-1];c=C.reduce((a,b)=>{const va=a.sc-.22*Math.min(2,Math.abs(nx.p-a.p)/12)-(Math.abs(nx.p-a.p)>12?.3:0),vb=b.sc-.22*Math.min(2,Math.abs(nx.p-b.p)/12)-(Math.abs(nx.p-b.p)>12?.3:0);return vb>va?b:a;});mel.push(c);}}
    mel.reverse();
    const melOut=mel.map((n,i)=>{const nx=mel[i+1];return{s:n.s,l:clamp(n.e-n.s,1,Math.max(1,(nx?nx.s:tot)-n.s)),p:n.p,v:n.a};});
    const lo={};for(const n of pool.filter(n=>n.p<52)){const c=lo[n.s];if(!c||n.p<c.p)lo[n.s]=n;}
    let bass=Object.values(lo).sort((a,b)=>a.s-b.s);bass=bass.map((n,i)=>{const nx=bass[i+1];return{s:n.s,l:clamp(n.e-n.s,1,Math.max(1,(nx?nx.s:tot)-n.s)),p:n.p,v:n.a};});
    return{mel:melOut,bass,hitSteps};
  }
  function hitPattern(hitSteps,bars,chords){
    const cnt=new Array(16).fill(0);for(const s of hitSteps)cnt[s%16]++;
    const perBar=hitSteps.length/Math.max(1,bars),pat=cnt.map(c=>c>=Math.max(1.5,bars*.3)?1:0);
    return{pat,pad:perBar<1.2||!pat.some(Boolean)};
  }
  function loopLength(chords,bars){
    const at=(b,h)=>{const c=chords.find(c=>c.s<=b*16+h&&c.s+c.l>b*16+h);return c?c.root+':'+c.q:'-';},seq=[...Array(bars).keys()].map(b=>at(b,0)+'/'+at(b,8));
    if(new Set(seq).size<=1)return Math.min(bars,4);
    let best={r:-1,P:Math.min(bars,8)};
    for(const P of[1,2,4,8,16]){if(P>=bars)break;const inner=new Set(seq.slice(0,P)).size;if(inner<2&&P<bars/2)continue;let ok=0,n=0;for(let i=0;i+P<bars;i++){n++;if(seq[i]===seq[i+P])ok++;}const r=n?ok/n:0;if(r>best.r+.04)best={r,P};}
    return best.P;
  }
  function settleMode(key,chords){
    const maj=key.mode==='maj'?key.root:(key.root+3)%12,min=(maj+9)%12;let dMaj=0,dMin=0;
    for(const c of chords){if(c.root===maj&&/^(M|maj7|add9|7)$/.test(c.q))dMaj+=c.l;if(c.root===min&&/^(m|m7|madd9|m9)$/.test(c.q))dMin+=c.l;}
    if(dMin>dMaj*1.1)return{root:min,mode:'min',v:key.v};if(dMaj>dMin*1.1)return{root:maj,mode:'maj',v:key.v};
    const f=chords.find(c=>c.root>=0);if(f&&f.root===min&&/^m/.test(f.q))return{root:min,mode:'min',v:key.v};if(f&&f.root===maj&&!/^m/.test(f.q))return{root:maj,mode:'maj',v:key.v};return key;
  }
  function analyseAudio(x,frames,notes,bpmHint,name,fix){fix=fix||{};
    const env=onsetEnvelope(x),dur=x.length/AN_SR;ENVREF=env;
    let bpm=bpmHint||estimateTempo(env);
    const reg=regularBeats(trackBeats(env,bpm),dur);if(!reg)throw new Error('Couldn’t find a steady beat. Try a part with drums, or type in the tempo.');
    let beats=reg.beats;if(!bpmHint){bpm=60/reg.ibi;const r=Math.round(bpm);if(Math.abs(bpm-r)<.4)bpm=r;else bpm=Math.round(bpm*10)/10;}
    beats=fixBeatPhase(beats,60/bpm,frames,dur,notes);
    if(fix.half){const per=60/bpm;beats=beats.map(t=>t+per/2);while(beats[0]-per>-.05)beats.unshift(beats[0]-per);}
    const b1=beatChroma(frames,beats),db=(findDownbeat(b1)+(fix.bar||0))%4;
    beats=beats.slice(db);const units1=b1.slice(db);
    const bars=Math.floor(units1.length/4);if(bars<2)throw new Error('The piece is too short to find bars. Use at least 10 seconds.');
    const half=[];for(let u=0;u<bars*2;u++){const a=units1[2*u],b=units1[2*u+1],m=k=>Float32Array.from({length:12},(_,i)=>a[k][i]+b[k][i]);half.push({c:m('c'),b:m('b'),h:m('h'),e:a.e+b.e});}
    const tot=new Float32Array(12);for(const u of half)for(let i=0;i<12;i++)tot[i]+=u.c[i]+.6*u.b[i];
    let key=keyFromChroma(Array.from(tot));
    let chords=recognizeChords(half,key);key=settleMode(key,chords);
    const stepOf=t=>{let i=0;while(i<beats.length-2&&beats[i+1]<=t)i++;const f=(t-beats[i])/(beats[i+1]-beats[i]);return i*4+f*4;};
    const q=notes.filter(n=>n.amplitude>=.15&&n.durationSeconds>=.045).map(n=>{const s=Math.round(stepOf(n.startTimeSeconds));return{s,e:Math.max(s+1,Math.round(stepOf(n.startTimeSeconds+n.durationSeconds))),p:n.pitchMidi,a:n.amplitude};});
    const T=bars*16,sp=splitNotes(q,T,chords),hits=hitPattern(sp.hitSteps,bars,chords);
    return{name,bpm,key,bars,chords,mel:sp.mel,bass:sp.bass,hits,loop:loopLength(chords,bars),t0:beats[0],beats,raw:{x,frames,notes,bpm:bpmHint,fix}};
  }
  function guessTempo(on){
    if(on.length<4)return{bpm:120,t0:0};
    let best={sc:-1,bpm:120,ph:0};
    for(let bpm=70;bpm<=180;bpm+=.5){const beat=60/bpm;let x=0,y=0,x4=0,y4=0,w=0;
      for(const o of on){const a=2*Math.PI*o.t/(beat/4),a4=2*Math.PI*o.t/beat;x+=o.w*Math.cos(a);y+=o.w*Math.sin(a);x4+=o.w*Math.cos(a4);y4+=o.w*Math.sin(a4);w+=o.w;}
      const sc=(Math.hypot(x,y)+.6*Math.hypot(x4,y4))/w*(bpm>=90&&bpm<=150?1.06:1);
      if(sc>best.sc)best={sc,bpm,ph:Math.atan2(y4,x4)};}
    const beat=60/best.bpm;let t0=((best.ph/(2*Math.PI))*beat)%beat;if(t0<0)t0+=beat;
    return{bpm:best.bpm,t0};
  }

  /* ---------- Basic Pitch ---------- */
  let bpPromise = null, modelPromise = null;
  function loadScript(src) {
    return new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = src; s.onload = res; s.onerror = () => rej(new Error('Fant ikke ' + src + '. Ligger mappa «vendor» ved siden av appen?'));
      document.head.appendChild(s);
    });
  }
  function base() { return (MM.listenBase || 'vendor/'); }
  async function loadBP() {
    if (window.BP) return window.BP;
    if (!bpPromise) bpPromise = loadScript(base() + 'bp.js').then(() => { if (!window.BP) throw new Error('Notemodellen startet ikke.'); return window.BP; });
    return bpPromise;
  }
  async function loadModel(BP) {
    if (modelPromise) return modelPromise;
    modelPromise = (async () => {
      if (!window.BP_MODEL) await loadScript(base() + 'bpmodel.js');
      const M = window.BP_MODEL, j = M.json, bin = atob(M.w), u = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
      return BP.tf.loadGraphModel(BP.tf.io.fromMemory({ modelTopology: j.modelTopology, weightSpecs: j.weightsManifest.flatMap((x) => x.weights), weightData: u.buffer, format: j.format, generatedBy: j.generatedBy, convertedBy: j.convertedBy }));
    })();
    modelPromise.catch(() => { modelPromise = null; });
    return modelPromise;
  }
  let backendReady = false;
  async function ready() {
    const BP = await loadBP();
    if (!backendReady) {
      try { await BP.tf.setBackend('webgl'); await BP.tf.ready(); } catch (e) { await BP.tf.setBackend('cpu'); await BP.tf.ready(); }
      backendReady = true;
    }
    return BP;
  }

  /* AudioBuffer (hvilken som helst samplefrekvens) → mono 22 050 Hz, med valgfritt utsnitt i sekunder. */
  async function toMono22k(buf, startSec, lenSec) {
    const sr = AN_SR;
    const s0 = Math.max(0, startSec || 0);
    const len = Math.min(buf.duration - s0, lenSec || buf.duration);
    if (len <= 0) throw new Error('Utsnittet er tomt.');
    const OC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    const oc = new OC(1, Math.ceil(len * sr), sr);
    const src = oc.createBufferSource();
    src.buffer = buf; src.connect(oc.destination); src.start(0, s0, len);
    const r = await oc.startRendering();
    return r.getChannelData(0).slice();
  }

  async function transcribe(x, onProgress, label) {
    const BP = await ready();
    const model = loadModel(BP);
    const bp = new BP.BasicPitch(model);
    const fr = [], on = [], co = [];
    await bp.evaluateModel(x, (f, o, c) => { fr.push(...f); on.push(...o); co.push(...c); }, (p) => onProgress && onProgress(p, label));
    const notes = BP.noteFramesToTime(BP.addPitchBendsToNoteEvents(co, BP.outputToNotesPoly(fr, on, 0.5, 0.3, 5)));
    return { frames: fr, notes };
  }

  /* ---------- vokal som lead ---------- */
  /* Basic Pitch deler ofte en sunget tone i flere biter (vibrato, glid). Bitene slås sammen, korte løse toner tas bort,
     og den sterkeste tonen på hvert anslag blir melodien. */
  function vocalLine(q, tot) {
    let ns = q.filter((n) => n.s >= 0 && n.s < tot && n.p >= 45 && n.p <= 96).sort((a, b) => a.s - b.s || b.a - a.a);
    if (!ns.length) return [];
    const amps = ns.map((n) => n.a).sort((a, b) => a - b);
    const thr = Math.max(0.12, 0.3 * (amps[Math.floor(amps.length * 0.6)] || 0));
    ns = ns.filter((n) => n.a >= thr);
    const by = {};
    for (const n of ns) { const c = by[n.s]; if (!c || n.a > c.a) by[n.s] = n; }
    let line = Object.values(by).sort((a, b) => a.s - b.s);
    // slå sammen samme tone når bitene ligger tett
    const merged = [];
    for (const n of line) {
      const L = merged[merged.length - 1];
      if (L && L.p === n.p && n.s - L.e <= 1) { L.e = Math.max(L.e, n.e); L.a = Math.max(L.a, n.a); continue; }
      if (L && Math.abs(L.p - n.p) === 1 && n.s - L.s <= 1 && L.e - L.s <= 1) { L.p = n.a > L.a ? n.p : L.p; L.e = Math.max(L.e, n.e); continue; } // glid
      merged.push(Object.assign({}, n));
    }
    // svært korte toner mellom to like toner er ofte bare overganger
    line = merged.filter((n, i) => {
      const len = n.e - n.s;
      if (len >= 2) return true;
      const pr = merged[i - 1], nx = merged[i + 1];
      if (pr && nx && pr.p === nx.p && Math.abs(n.p - pr.p) <= 2 && n.a < Math.max(pr.a, nx.a)) return false;
      return n.a >= thr * 1.3 || len >= 1;
    });
    return line.map((n, i) => {
      const nx = line[i + 1];
      return { t: n.s, d: clamp(n.e - n.s, 1, Math.max(1, (nx ? nx.s : tot) - n.s)), p: n.p, v: Math.round(clamp(0.45 + n.a * 0.6, 0.4, 1) * 100) / 100 };
    });
  }

  /* ---------- hele analysen ---------- */
  /* opts: { mix, vocal, chords: AudioBuffer (stems må starte samtidig som miksen), start, len (sek), bpm, fix, onProgress }
     Takt og tempo hentes fra miksen (eller kordestemmen). Korder fra kordestemmen hvis den finnes. Lead fra vokalen hvis den finnes. */
  async function analyzeSong(opts) {
    const say = opts.onProgress || (() => {});
    const gridBuf = opts.mix || opts.chords || opts.vocal;
    if (!gridBuf) throw new Error('Velg en lydfil.');
    say(0, 'Leser lyd …');
    const xGrid = await toMono22k(gridBuf, opts.start, opts.len);
    if (xGrid.length < AN_SR * 6) throw new Error('Biten er for kort. Bruk minst 8–10 sekunder.');
    const harmBuf = opts.chords || opts.mix || gridBuf;
    const xHarm = harmBuf === gridBuf ? xGrid : await toMono22k(harmBuf, opts.start, opts.len);
    const cache = opts.cache || {};
    say(0, 'Laster notemodellen …');
    const harm = cache.harm || (cache.harm = await transcribe(xHarm, (p) => say(p * (opts.vocal ? 0.6 : 1), opts.chords ? 'Lytter på kordene …' : 'Lytter …')));
    let A;
    if (!opts.mix && !opts.chords && opts.bpm) {
      // bare vokal: takten kan ikke høres sikkert, bruk oppgitt tempo og legg rutenettet etter tonene
      A = vocalOnly(xHarm, harm, opts.bpm, opts.fix);
    } else {
      // takten høres i miksen; korder, melodi og bass leses fra tonene (fra kordestemmen hvis den finnes)
      A = analyseAudio(xGrid, harm.frames, harm.notes, opts.bpm || 0, 'lyd', opts.fix);
    }
    const res = convert(A);
    res.source = { mix: !!opts.mix, vocal: !!opts.vocal, chords: !!opts.chords };
    if (opts.vocal) {
      const voc = cache.voc || (cache.voc = await transcribe(await toMono22k(opts.vocal, opts.start, opts.len), (p) => say(0.6 + p * 0.4, 'Lytter på vokalen …')));
      const q = quantizeWithBeats(voc.notes, A.beats || null, A.bpm, A.t0);
      res.lead = vocalLine(q, A.bars * 16);
      res.leadFrom = 'vokal-stem';
    }
    res.info = summary(res);
    res.raw = { A };
    return res;
  }

  function quantizeWithBeats(notes, beats, bpm, t0) {
    const per = 60 / bpm;
    const stepOf = beats && beats.length > 2
      ? (t) => { let i = 0; while (i < beats.length - 2 && beats[i + 1] <= t) i++; const f = (t - beats[i]) / (beats[i + 1] - beats[i]); return i * 4 + f * 4; }
      : (t) => (t - (t0 || 0)) / per * 4;
    return notes.filter((n) => n.amplitude >= 0.1 && n.durationSeconds >= 0.04).map((n) => {
      const s = Math.round(stepOf(n.startTimeSeconds));
      return { s, e: Math.max(s + 1, Math.round(stepOf(n.startTimeSeconds + n.durationSeconds))), p: n.pitchMidi, a: n.amplitude };
    });
  }

  function vocalOnly(x, tr, bpm, fix) {
    const g = guessTempo(tr.notes.filter((n) => n.amplitude >= 0.2).map((n) => ({ t: n.startTimeSeconds, w: n.amplitude })));
    const per = 60 / bpm;
    let t0 = g.t0 % per;
    if (fix && fix.half) t0 += per / 2;
    const q = quantizeWithBeats(tr.notes, null, bpm, t0);
    // taktstart: der første tone kommer (rundet til nærmeste slag). Opptakt rettes med «Taktstart ett slag senere».
    const first = q.filter((n) => n.a >= 0.2).reduce((m, n) => Math.min(m, n.s), Infinity);
    // «taktstart ett slag senere» = tonene havner ett slag tidligere i takten
    const sh = (Number.isFinite(first) ? Math.round(first / 4) * 4 : 0) + (fix && fix.bar ? (fix.bar % 4) * 4 : 0);
    for (const n of q) { n.s -= sh; n.e -= sh; }
    const minS = Math.min.apply(null, q.map((n) => n.s).concat([0]));
    const off = Math.floor(minS / 16) * 16;
    for (const n of q) { n.s -= off; n.e -= off; }
    const end = Math.max.apply(null, q.map((n) => n.e).concat([16]));
    const bars = Math.max(1, Math.ceil(end / 16));
    const h = new Array(12).fill(0);
    for (const n of q) h[n.p % 12] += (n.e - n.s) * n.a;
    const key = keyFromChroma(h);
    const mel = vocalLine(q, bars * 16).map((n) => ({ s: n.t, l: n.d, p: n.p, v: n.v }));
    return { name: 'lyd', bpm, key, bars, chords: [], mel, bass: [], hits: { pat: new Array(16).fill(0), pad: true }, loop: bars, t0: t0 + (sh + off) / 4 * per, beats: null, vocalOnly: true };
  }

  /* NB-format → Motivmotor: noter i steg, korder relativt til tonearten. */
  function convert(A) {
    const key = { root: A.key.root, mode: A.key.mode === 'maj' ? 'major' : 'minor' };
    const chords = (A.chords || []).filter((c) => c.root >= 0).map((c) => ({
      t: c.s, len: c.l, chord: absChord(key, c.root, c.q),
    }));
    const lead = (A.mel || []).map((n) => ({ t: n.s, d: n.l, p: n.p, v: Math.round(clamp(n.v === undefined ? 0.8 : 0.45 + n.v * 0.6, 0.4, 1) * 100) / 100 }));
    const bass = (A.bass || []).map((n) => ({ t: n.s, d: n.l, p: n.p, v: 0.8 }));
    return { bpm: A.bpm, key, bars: A.bars, chords, lead, bass, hits: A.hits, loop: A.loop, t0: A.t0, leadFrom: 'miksen' };
  }

  function absChord(key, rootPc, q) {
    const rs = ((rootPc - key.root) % 12 + 12) % 12;
    const sc = MM.theory.MODES[key.mode].steps;
    let deg = 0, best = 99;
    sc.forEach((s, i) => { const d = Math.min(Math.abs(s - rs), 12 - Math.abs(s - rs)); if (d < best || (d === best && s > rs)) { best = d; deg = i; } }); // likt: les som b-trinn
    return { deg, q: q || 'm', rs, iv: (QUALS[q] || QUALS.m).slice() };
  }

  function summary(r) {
    const k = NOTE[r.key.root] + (r.key.mode === 'major' ? ' dur' : ' moll');
    const ch = r.chords.length ? r.chords.map((c) => MM.theory.chordName(r.key, c.chord)).slice(0, 8).join(' – ') : 'ingen tydelige korder';
    const lenBars = r.chords.length ? Math.round(r.chords.reduce((s, c) => s + c.len, 0) / r.chords.length / 16 * 2) / 2 : 0;
    const hitsTxt = r.hits && !r.hits.pad ? 'spilte korder (rytmiske)' : 'holdte korder (strings)';
    const parts = [
      r.bpm + ' BPM', k, r.bars + ' takter',
      'korder: ' + ch + (lenBars ? ' (skifter ca. hver ' + lenBars + '. takt)' : ''),
      hitsTxt, 'melodi fra ' + r.leadFrom + ': ' + r.lead.length + ' toner',
    ];
    const conf = r.lead.length >= 6 && r.bars >= 2 ? (r.source && r.source.vocal ? 0.75 : 0.55) : 0.3;
    return { summary: 'Hørte: ' + parts.join(' · ') + '. Dette er forslag – sjekk og rett i rullen.', confidence: conf };
  }

  MM.listen = {
    QUALS, QNAME, AN_SR, loadBP, ready, toMono22k, transcribe, analyzeSong, vocalLine, quantizeWithBeats, convert, absChord,
    _nb: { analyseAudio, onsetEnvelope, estimateTempo, guessTempo, recognizeChords, splitNotes, hitPattern, keyFromChroma },
  };
})(globalThis.MM = globalThis.MM || {});
