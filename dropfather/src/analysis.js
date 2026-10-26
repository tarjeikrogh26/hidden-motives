/* Dropfather analysis: tempo, bar grid, energy map and drop suggestions.
   Harmony and bass come from the AVANTGARDIAN ARP Chordino engine (vendor/). */
(function(root){'use strict';
const SR=22050,HOP=256,N=1024;

function fft(re,im){const n=re.length;for(let i=1,j=0;i<n;i++){let bit=n>>1;for(;j&bit;bit>>=1)j^=bit;j^=bit;if(i<j){[re[i],re[j]]=[re[j],re[i]];[im[i],im[j]]=[im[j],im[i]];}}for(let len=2;len<=n;len<<=1){const a=-2*Math.PI/len,wr0=Math.cos(a),wi0=Math.sin(a);for(let b=0;b<n;b+=len){let wr=1,wi=0;for(let j=0;j<len/2;j++){const p=b+j,q=p+len/2,tr=re[q]*wr-im[q]*wi,ti=re[q]*wi+im[q]*wr;re[q]=re[p]-tr;im[q]=im[p]-ti;re[p]+=tr;im[p]+=ti;const nx=wr*wr0-wi*wi0;wi=wr*wi0+wi*wr0;wr=nx;}}}}

// Frame features at 22050 Hz: spectral-flux onset, full RMS and low band (<150 Hz) RMS.
function features(x){
 const frames=Math.max(1,Math.floor(x.length/HOP)),onset=new Float32Array(frames),rms=new Float32Array(frames),low=new Float32Array(frames),kick=new Float32Array(frames);
 const re=new Float64Array(N),im=new Float64Array(N),win=Float64Array.from({length:N},(_,i)=>.5-.5*Math.cos(2*Math.PI*i/(N-1))),prev=new Float64Array(N/2),prevLin=new Float64Array(N/2),maxBin=Math.round(6000/SR*N),kickBin=Math.round(160/SR*N);
 const k=1-Math.exp(-2*Math.PI*150/SR);let lp=0;
 for(let f=0;f<frames;f++){
  let s=0,l=0;const a=f*HOP;for(let i=a;i<a+HOP;i++){const v=x[i]||0;lp+=k*(v-lp);s+=v*v;l+=lp*lp;}rms[f]=Math.sqrt(s/HOP);low[f]=Math.sqrt(l/HOP);
  for(let i=0;i<N;i++){re[i]=(x[a+i-N/2]||0)*win[i];im[i]=0;}fft(re,im);
  let flux=0,kf=0;for(let b=1;b<maxBin;b++){const lin=Math.hypot(re[b],im[b]),m=Math.log1p(1000*lin),d=m-prev[b];if(d>0)flux+=d;prev[b]=m;if(b<=kickBin){const dl=lin-prevLin[b];if(dl>0)kf+=dl;prevLin[b]=lin;}}onset[f]=flux;kick[f]=kf;
 }
 return {onset,rms,low,kick,fps:SR/HOP,frames};
}

function at(a,pos){const i=Math.floor(pos);if(i<0||i>=a.length-1)return 0;const f=pos-i;return a[i]*(1-f)+a[i+1]*f;}
function normaliseOnset(o,fps){
 // Remove the slow trend so loud sections do not dominate the comb.
 const w=Math.round(fps*.5),out=new Float32Array(o.length);let sum=0;const q=[];
 for(let i=0;i<o.length;i++){q.push(o[i]);sum+=o[i];if(q.length>w)sum-=q.shift();out[i]=Math.max(0,o[i]-sum/q.length);}
 return out;
}
function comb(o,fps,bpm,steps=48){
 const period=60*fps/bpm;let best=-1,phase=0;
 for(let s=0;s<steps;s++){const ph=s*period/steps;let sum=0,n=0;for(let p=ph;p<o.length-1;p+=period){sum+=at(o,p);n++;}const v=n?sum/n:0;if(v>best){best=v;phase=ph;}}
 return {score:best,phase:phase/fps};
}
function tempo(feat){
 const o=normaliseOnset(feat.onset,feat.fps),fps=feat.fps,mean=o.reduce((a,b)=>a+b,0)/o.length;
 const d=Float32Array.from(o,v=>v-mean);let best=-Infinity,bpm=120;
 for(let b=70;b<=180;b+=.5){const lag=60*fps/b;let s=0;const L=Math.min(d.length-lag-1,fps*240);for(let i=0;i<L;i++)s+=d[i]*at(d,i+lag)+.5*d[i]*at(d,i+2*lag);const prior=Math.exp(-.5*(Math.log2(b/122)/.55)**2);if(s*prior>best){best=s*prior;bpm=b;}}
 let fine=comb(o,fps,bpm,24),value=bpm;
 for(let b=bpm-1.5;b<=bpm+1.5;b+=.02){const c=comb(o,fps,b,24);if(c.score>fine.score){fine=c;value=b;}}
 if(Math.abs(value-Math.round(value))<.12)value=Math.round(value);else value=Math.round(value*100)/100;
 // The comb finds the pulse; the kick band decides between the beat and the offbeat.
 let phase=comb(o,fps,value,96).phase;const k=normaliseOnset(feat.kick,fps),half=30/value,kickScore=ph=>{let s=0,n=0;for(let t=ph;t*fps<k.length-1;t+=60/value){s+=at(k,t*fps)+at(k,t*fps+1);n++;}return s/(n||1);};
 if(kickScore(phase+half)>kickScore(phase)*1.1)phase+=half;
 // Flux peaks about one hop before the audible attack.
 return {bpm:value,phase:phase+HOP/SR,onset:o};
}

// The beat phase is reliable; the bar phase is a guess: sections tend to change on bar 1.
function downbeat(feat,bpm,phase){
 const beat=60/bpm,fps=feat.fps,beats=[];
 for(let t=phase;t<feat.frames/fps;t+=beat){const a=Math.floor(t*fps),b=Math.floor((t+beat)*fps);let l=0,r=0,k=0;for(let i=a;i<b&&i<feat.frames;i++){l+=feat.low[i];r+=feat.rms[i];}for(let i=a;i<Math.min(a+4,feat.frames);i++)k+=feat.kick[i];beats.push({l:l/(b-a||1),r:r/(b-a||1),k});}
 const score=[0,0,0,0];
 for(let i=1;i<beats.length;i++){const c=Math.abs(Math.log((beats[i].l+1e-4)/(beats[i-1].l+1e-4)))+.6*Math.abs(Math.log((beats[i].r+1e-4)/(beats[i-1].r+1e-4)));score[i%4]+=c;}
 const k=score.indexOf(Math.max(...score));let offset=phase+k*beat;while(offset-4*beat>=-1e-6)offset-=4*beat;
 return offset;
}

function bars(feat,bpm,offset){
 const bar=240/bpm,fps=feat.fps,dur=feat.frames/fps,out=[];
 for(let t=offset,i=0;t+bar*.5<dur;t+=bar,i++){const a=Math.max(0,Math.floor(t*fps)),b=Math.min(feat.frames,Math.floor((t+bar)*fps));let l=0,r=0;for(let j=a;j<b;j++){l+=feat.low[j]**2;r+=feat.rms[j]**2;}const n=Math.max(1,b-a);out.push({index:i,time:t,low:Math.sqrt(l/n),rms:Math.sqrt(r/n)});}
 const sorted=out.map(b=>b.low).sort((a,b)=>a-b),p75=sorted[Math.floor(sorted.length*.75)]||1,rs=out.map(b=>b.rms).sort((a,b)=>a-b),r75=rs[Math.floor(rs.length*.75)]||1;
 for(const b of out){b.lowN=b.low/p75;b.rmsN=b.rms/r75;b.kind=b.rmsN<.08?'silence':b.lowN<.4?'break':b.lowN>.85?'full':'mid';}
 return out;
}

// A drop candidate is a bar where the low end (kick + bass) comes back after less of it.
function candidates(barList,minBuild=4){
 const out=[];
 for(let i=minBuild;i<barList.length-4;i++){
  const before=barList.slice(i-4,i),after=barList.slice(i,i+4),mb=before.reduce((a,b)=>a+b.lowN,0)/4,ma=after.reduce((a,b)=>a+b.lowN,0)/4,rb=before.reduce((a,b)=>a+b.rmsN,0)/4,ra=after.reduce((a,b)=>a+b.rmsN,0)/4;
  if(ma<.45)continue;
  let score=(ma+.05)/(mb+.05)*Math.sqrt((ra+.05)/(rb+.05));if(i%8===0)score*=1.3;else if(i%4===0)score*=1.12;else score*=.85;
  if(score>1.35)out.push({bar:i,time:barList[i].time,score,strength:Math.min(3,Math.max(1,Math.round(Math.log2(score)*1.6)))});
 }
 out.sort((a,b)=>b.score-a.score);const picked=[];
 for(const c of out){if(picked.every(p=>Math.abs(p.bar-c.bar)>=8))picked.push(c);if(picked.length>=6)break;}
 return picked.sort((a,b)=>a.bar-b.bar);
}

// If nothing looks like a drop, suggest the loudest section start after the first quarter of the song.
function fallbackCandidate(barList){
 let best=null;for(let i=8;i<barList.length-8;i+=4){const v=barList.slice(i,i+8).reduce((a,b)=>a+b.rmsN,0);if(!best||v>best.v)best={bar:i,v};}
 return best?{bar:best.bar,time:barList[best.bar].time,score:1,strength:1,fallback:true}:null;
}

function analyse(mono){
 const feat=features(mono),t=tempo(feat),offset=downbeat(feat,t.bpm,t.phase),list=bars(feat,t.bpm,offset);
 let c=candidates(list);if(!c.length){const f=fallbackCandidate(list);if(f)c=[f];}
 return {feat,bpm:t.bpm,offset,bars:list,candidates:c,duration:mono.length/SR};
}
function regrid(a,bpm,offset){const list=bars(a.feat,bpm,offset);let c=candidates(list);if(!c.length){const f=fallbackCandidate(list);if(f)c=[f];}return {...a,bpm,offset,bars:list,candidates:c};}

// Harmony helpers. Chordino segments are in seconds (finish() is called with bpm 60, offset 0).
function lookup(list,t,key){if(!list||!list.length)return null;let lo=0,hi=list.length-1;while(lo<hi){const m=(lo+hi+1)>>1;if(list[m].start<=t)lo=m;else hi=m-1;}const s=list[lo];return s?s[key]:null;}
function bassAt(h,t){return h?lookup(h.bassSegments,t,'bass'):null;}
function chordAt(h,t){if(!h)return null;let lo=0,hi=h.segments.length-1;while(lo<hi){const m=(lo+hi+1)>>1;if(h.segments[m].start<=t)lo=m;else hi=m-1;}return h.segments[lo]||null;}
function dominantBass(h,t0,t1){if(!h)return null;const w=Array(12).fill(0);for(const s of h.bassSegments){const o=Math.max(0,Math.min(t1,s.end)-Math.max(t0,s.start));if(o>0)w[s.bass]+=o;}const m=Math.max(...w);return m>0?w.indexOf(m):null;}

const api={SR,features,tempo,downbeat,bars,candidates,analyse,regrid,bassAt,chordAt,dominantBass};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.DropAnalysis=api;
})(typeof globalThis!=='undefined'?globalThis:this);
