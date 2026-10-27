/* Norwegian Beats v46: actual voice construction, waves, filters and envelopes extracted
 from the user-provided archive. Source application and its Voice X are untouched.
 Note Lab adds a monophonic scheduling adapter and independent effects after the voice. */
(function(){'use strict';
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x)),rnd=Math.random,S={bpm:129},LADDER_GAIN=1.25;
function driveCurve(k){const n=1024,c=new Float32Array(n),a=1+k*12,nm=Math.tanh(a);for(let i=0;i<n;i++){const x=i/(n-1)*2-1;c[i]=Math.tanh(a*x)/nm;}return c;}
const WT={saw:'sawtooth',sq:'square',tri:'triangle',sine:'sine'};
/* pulse (with pulse width) and hard sync (Moog Source, Nord Lead), drawn once per setting as band-limited waves */
function waveFor(c,w,sn){
  const pw=Math.round(clamp(sn.pw||.5,.05,.5)*40)/40,sr=Math.round(clamp(sn.syncR||2,1.05,5)*20)/20,key=w==='pulse'?'p'+pw:'s'+sr,M=c._pw||(c._pw={});
  if(M[key])return M[key];
  const N=96,re=new Float32Array(N+1),im=new Float32Array(N+1);
  if(w==='pulse')for(let h=1;h<=N;h++)re[h]=4/(h*Math.PI)*Math.sin(h*Math.PI*pw);
  else{const L=4096,x=new Float32Array(L);for(let i=0;i<L;i++){const ph=(i/L*sr)%1;x[i]=2*ph-1;}
    for(let h=1;h<=N;h++){let a=0,b=0;for(let i=0;i<L;i++){const w2=2*Math.PI*h*i/L;a+=x[i]*Math.cos(w2);b+=x[i]*Math.sin(w2);}re[h]=2*a/L;im[h]=2*b/L;}}
  return M[key]=c.createPeriodicWave(re,im);
}
/* Moog 914 fixed filter bank: eight fixed bands that colour the sound (dB per band) */
const FBANK={warm:[4,3,1,0,-2,-4,-6,-8],hollow:[2,0,-8,-10,-6,2,3,0],nasal:[-4,-2,2,8,9,4,0,-4],'vowel a':[-4,-2,6,9,4,-2,-4,-6],'vowel o':[0,6,9,2,-4,-6,-8,-9],telephone:[-14,-10,-2,4,5,2,-8,-14]};
const FB_F=[125,250,500,1000,1800,2800,4000,5600];
/* distortion that gets harder, not louder: a fuzz curve (slightly uneven, for warmth) with the level measured and taken back */
const FUZZ={};function fuzz(d){const q=Math.round(d*50)/50;if(FUZZ[q])return FUZZ[q];
  const k=1+q*28,b=.12*q,f=x=>Math.tanh(k*(x+b))-Math.tanh(k*b),n=2048,c=new Float32Array(n);let mx=0;
  for(let i=0;i<n;i++){c[i]=f(i/(n-1)*2-1);mx=Math.max(mx,Math.abs(c[i]));}for(let i=0;i<n;i++)c[i]/=mx;
  let si=0,so=0;const N=512;for(let i=0;i<N;i++){const x=.9*Math.tanh(2.5*(2*(i/N)-1))/Math.tanh(2.5),y=c[Math.round((x+1)/2*(n-1))];si+=x*x;so+=y*y;}
  return FUZZ[q]={c,g:Math.sqrt(si/so)};}
/* Rings / Verbos: six sine partials. Each mode is a set of partial ratios and levels (string, mallet, bell, glass, harmonic) */
const MODES={string:{r:[1,2,3,4,5,6],a:[1,.5,.33,.25,.2,.17]},mallet:{r:[1,3.99,9.14,2,6.3,13.1],a:[1,.35,.12,.15,.08,.04]},
  bell:{r:[1,2.76,5.4,8.93,1.5,4.07],a:[1,.6,.4,.22,.3,.2]},glass:{r:[1,2.32,4.25,6.63,9.38,12.1],a:[1,.5,.35,.25,.15,.1]},harmonic:{r:[1,2,3,4,5,6],a:[1,.6,.4,.3,.2,.15]}};
const MODE_N={string:'String',mallet:'Mallet',bell:'Bell',glass:'Glass',harmonic:'Harmonic'};
/* Wavetable (Piston Honda, PPG, Erica Graphic VCO): two waves from a table, morphed by a crossfade that can sweep on every note */
const WTAB=[['Sine',h=>h===1?1:0],['Soft',h=>h%2?1/(h*h):0],['Saw',h=>1/h],['Square',h=>h%2?1/h:0],['Formant A',h=>(h===1?.4:0)+Math.exp(-((h-6)**2)/6)/Math.sqrt(h)],
  ['Formant O',h=>(h===1?.5:0)+Math.exp(-((h-3)**2)/3)/Math.sqrt(h)],['Digital',h=>[1,5,9,13,17,21].includes(h)?1/Math.sqrt(h):0],['Hollow',h=>Math.abs(Math.sin(h*Math.PI*.12))/h],
  ['Organ',h=>[1,2,3,4,6,8,16].includes(h)?.8/Math.sqrt(h):0],['Sync bright',null]];
function wtWave(c,i){const M=c._wt||(c._wt={});if(M[i])return M[i];i=clamp(i|0,0,WTAB.length-1);
  if(!WTAB[i][1])return M[i]=waveFor(c,'sync',{syncR:3.4});
  const N=96,re=new Float32Array(N+1),im=new Float32Array(N+1);for(let h=1;h<=N;h++)im[h]=WTAB[i][1](h);return M[i]=c.createPeriodicWave(re,im);}
let FOLD_C=null;const foldCurve=()=>FOLD_C||(FOLD_C=(()=>{const n=4096,a=new Float32Array(n);for(let i=0;i<n;i++){const x=i/(n-1)*2-1;a[i]=Math.sin(x*Math.PI/2/.2);}return a;})());
/* ---------- the synth: Analog (Moog-style), Modular (MS-20 / DAF-style) and FM (TX81Z-style) ----------
   One voice design for every track. Bass and Lead play one voice that stays on (glide, legato); Chords and Strings get
   a fresh voice per note. Few controls on the outside: cutoff, resonance, sour, unison, glide, reverb.
   Sour = the oscillators tuned off against each other (DAF, Conny Plank); Unison = extra copies spread around the note. */
const ENG=sn=>sn.eng||'an';
const voiceSig=(sn,c,poly)=>{const ws=[sn.w1,sn.w2,sn.w3,sn.w4,sn.w5];return[ENG(sn),...ws.map(w=>w||''),sn.m1w||'',sn.alg||'',sn.slope,!poly&&c&&c._lad?'L':'B',
  ws.includes('pulse')?Math.round((sn.pw||.5)*40):'',ws.includes('sync')?Math.round((sn.syncR||2)*20):'',sn.noise>0?'N'+Math.round((sn.noiseC==null?.6:sn.noiseC)*20):'',sn.fbank||'',ENG(sn)==='mod'||sn.lfo>0?'F':'',sn.dist>0?'D':'',sn.foldPost?'FP'+sn.foldPost:'',sn.up>0?'U':'',sn.ft||'',sn.fsh?'B':'',sn.lofi>0?'C'+(poly?Math.round(sn.lofi*10):''):'',sn.tr>0?'T':'',sn.vib>0?'V':'',ENG(sn)==='vec'?'v'+[sn.va,sn.vb,sn.vc,sn.vd].join('.')+'x'+Math.round((sn.vx||0)*20)+'y'+Math.round((sn.vy||0)*20)+(sn.vseq?'q':''):'',ENG(sn)==='wt'?'w'+(sn.wa|0)+'.'+(sn.wb|0):'',poly&&sn.lowcut>0?'S':''].join('|');};
const DCURVE={},dcurve=k=>{const q=Math.round(k*50)/50;return DCURVE[q]||(DCURVE[q]=driveCurve(q));};
function buildVoice(c,sn,dest,poly){
  const eng=ENG(sn),mix=c.createGain(),oscs=[],v={eng,oscs,poly};
  const mk=(w,to)=>{const o=c.createOscillator();if(w==='pulse'||w==='sync')o.setPeriodicWave(waveFor(c,w,sn));else o.type=WT[w]||'sawtooth';const g=c.createGain();o.connect(g);if(to)g.connect(to);oscs.push(o);return[o,g];};
  if(eng==='fm'){
    [v.c1,v.gc1]=mk('sine',mix);[v.c2,v.gc2]=mk('sine',mix);
    [v.m1,v.gm1]=mk(sn.m1w||'sine');v.gm1.gain.value=0;v.gm1.connect(v.c1.frequency);v.gm1.connect(v.c2.frequency);
    [v.m2,v.gm2]=mk('sine');v.gm2.gain.value=0;if(sn.alg==='stack')v.gm2.connect(v.m1.frequency);else{v.gm2.connect(v.c1.frequency);v.gm2.connect(v.c2.frequency);}
  }else if(eng==='vec'){
    /* vector synthesis (Prophet VS, Wavestation): four waves, two slow LFOs move the mix around like a joystick; Wave sequence steps between them in 8ths */
    const W=[sn.va|0,sn.vb!=null?sn.vb:4,sn.vc!=null?sn.vc:6,sn.vd!=null?sn.vd:8];
    v.vo=W.map(w=>{const o=c.createOscillator();o.setPeriodicWave(wtWave(c,w));const g=c.createGain();g.gain.value=.22;o.connect(g);g.connect(mix);oscs.push(o);return[o,g];});
    const lx=c.createOscillator(),ly=c.createOscillator();lx.type=sn.vseq?'square':'sine';ly.type='triangle';lx.frequency.value=sn.vseq?S.bpm/30:.03+(sn.vx!=null?sn.vx:.3)*.6;ly.frequency.value=.02+(sn.vy!=null?sn.vy:.2)*.45;oscs.push(lx,ly);
    const sg=[[1,1],[-1,1],[1,-1],[-1,-1]];v.vo.forEach(([o,g],i)=>{const ax=c.createGain(),ay=c.createGain();ax.gain.value=.2*sg[i][0];ay.gain.value=.2*sg[i][1];lx.connect(ax);ax.connect(g.gain);ly.connect(ay);ay.connect(g.gain);});
  }else if(eng==='wt'){
    const mkw=(i,to)=>{const o=c.createOscillator();o.setPeriodicWave(wtWave(c,i));const g=c.createGain();o.connect(g);g.connect(to);oscs.push(o);return[o,g];};
    [v.wa,v.ga]=mkw(sn.wa||0,mix);[v.wb,v.gb]=mkw(sn.wb!=null?sn.wb:4,mix);[v.wa2,v.ga2]=mkw(sn.wa||0,mix);v.ga2.gain.value=0;
  }else if(eng==='add'){
    /* modal / additive: the partials ring out on their own, the high ones die first */
    v.parts=[];for(let i=0;i<6;i++){const[o,g]=mk('sine',mix);g.gain.value=0;v.parts.push([o,g]);}
  }else if(eng==='wc'){
    /* West Coast (Buchla): a sine or triangle, frequency-modulated, through a wave folder */
    v.fpre=c.createGain();v.fpre.gain.value=.2;const cw=sn.w1==='tri'?'tri':'sine';
    [v.c1,v.gc1]=mk(cw,v.fpre);[v.c2,v.gc2]=mk(cw,v.fpre);
    [v.m1,v.gm1]=mk('sine');v.gm1.gain.value=0;v.gm1.connect(v.c1.frequency);v.gm1.connect(v.c2.frequency);
    v.fold=c.createWaveShaper();v.fold.curve=foldCurve();v.fold.oversample='2x';v.fpre.connect(v.fold);const fo=c.createGain();fo.gain.value=.7;v.fold.connect(fo);fo.connect(mix);
  }else{
    [v.o1,v.g1]=mk(sn.w1,mix);if(sn.w2)[v.o2,v.g2]=mk(sn.w2,mix);if(sn.w3)[v.o3,v.g3]=mk(sn.w3,mix);if(sn.w4)[v.o4,v.g4]=mk(sn.w4,mix);if(sn.w5)[v.o5,v.g5]=mk(sn.w5,mix);
    [v.u1,v.gu1]=mk(sn.w1,mix);[v.u2,v.gu2]=mk(sn.w1,mix);v.gu1.gain.value=0;v.gu2.gain.value=0;
    if(eng==='mod'){v.xm=c.createGain();v.xm.gain.value=0;(v.o2||v.o1).connect(v.xm);v.xm.connect(v.o1.frequency);
      if(v.o2){const rg=c.createGain();rg.gain.value=0;v.o1.connect(rg);v.o2.connect(rg.gain);v.rl=c.createGain();v.rl.gain.value=0;rg.connect(v.rl);v.rl.connect(mix);}}
  }
  [v.so,v.gs]=mk('sine',mix);v.gs.gain.value=0;
  if(sn.up>0&&(eng==='an'||eng==='mod')){[v.oup,v.gup]=mk(sn.w1==='sync'?'saw':sn.w1,mix);v.gup.gain.value=0;}
  if(sn.noise>0){const nb=c._nzB||(c._nzB=(()=>{const n=c.sampleRate*2,bf=c.createBuffer(1,n,c.sampleRate),d=bf.getChannelData(0);for(let i=0;i<n;i++)d[i]=Math.random()*2-1;return bf;})());
    const ns=c.createBufferSource();ns.buffer=nb;ns.loop=true;const nf=c.createBiquadFilter();nf.type='lowpass';nf.frequency.value=600*Math.pow(2,(sn.noiseC==null?.6:sn.noiseC)*5);
    v.gnz=c.createGain();v.gnz.gain.value=0;ns.connect(nf);nf.connect(v.gnz);v.gnz.connect(mix);oscs.push(ns);}
  let src=mix,last;
  /* Lo-fi (Emulator II, SQ-80, Fairlight): the oscillators come out at fewer bits and a lower sample rate, then the analog filter cleans up */
  if(sn.lofi>0){if(!poly&&c._lad){try{v.cr=new AudioWorkletNode(c,'nb-crush',{numberOfInputs:1,numberOfOutputs:1,outputChannelCount:[1]});src.connect(v.cr);src=v.cr;}catch(e){v.cr=null;}}
    if(!v.cr){const w=c.createWaveShaper(),L=Math.pow(2,15-Math.round(sn.lofi*10)),n=4096,cv=new Float32Array(n);for(let i=0;i<n;i++){const x=i/(n-1)*2-1;cv[i]=Math.round(x*L)/L;}w.curve=cv;src.connect(w);src=w;}}
  if(eng==='mod'){v.hp=c.createBiquadFilter();v.hp.type='highpass';v.hp.Q.value=.7;src.connect(v.hp);src=v.hp;}
  if(!poly&&c._lad&&sn.ft!=='bp'){try{v.lad=new AudioWorkletNode(c._powerRaw||c,'nb-ladder',{numberOfInputs:1,numberOfOutputs:1,outputChannelCount:[1]});}catch(e){v.lad=null;}}
  if(v.lad){src.connect(v.lad);const lg=c.createGain();lg.gain.value=LADDER_GAIN;v.lad.connect(lg);last=lg;v.cutP=[v.lad.parameters.get('cutoff')];}
  else{v.f1=c.createBiquadFilter();v.f1.type=sn.ft==='bp'?'bandpass':'lowpass';src.connect(v.f1);last=v.f1;
    if(sn.ft==='bp'){v.bg=c.createGain();v.bg.gain.value=4;v.f1.connect(v.bg);last=v.bg;}
    if(sn.slope===24){v.f2=c.createBiquadFilter();v.f2.type='lowpass';v.f2.Q.value=.6;v.f1.connect(v.f2);last=v.f2;}
    v.cutP=[v.f1.frequency].concat(v.f2?[v.f2.frequency]:[]);}
  /* delayed vibrato for leads: it fades in after the note starts, like a singer or a violin */
  if(sn.vib>0){const P=oscs.filter(o=>o.detune&&o.constructor===OscillatorNode);v.vibO=c.createOscillator();v.vibO.frequency.value=5.3;v.vibG=c.createGain();v.vibG.gain.value=0;v.vibO.connect(v.vibG);for(const o of P)v.vibG.connect(o.detune);oscs.push(v.vibO);}
  if(eng==='mod'||sn.lfo>0){v.lfo=c.createOscillator();v.lfo.type='triangle';v.lfoG=c.createGain();v.lfoG.gain.value=0;v.lfo.connect(v.lfoG);for(const p of v.cutP)v.lfoG.connect(p);oscs.push(v.lfo);
    if(v.fpre){v.lfoF=c.createGain();v.lfoF.gain.value=0;v.lfo.connect(v.lfoF);v.lfoF.connect(v.fpre.gain);}}
  if(sn.foldPost>0){v.foldPre=c.createGain();v.foldPre.gain.value=.12+sn.foldPost*.3;const folder=c.createWaveShaper();folder.curve=foldCurve();folder.oversample='2x';const trim=c.createGain();trim.gain.value=.55;last.connect(v.foldPre);v.foldPre.connect(folder);folder.connect(trim);last=trim;}v.sh=c.createWaveShaper();v.drive=sn.drive;v.sh.curve=dcurve(v.lad?sn.drive*.4:sn.drive);last.connect(v.sh);
  v.vca=c.createGain();v.vca.gain.value=0;let fx=v.sh;
  /* Bode frequency shifter (Moog 1630): every partial moves the same number of Hz, so the sound turns metallic or beats against itself */
  if(sn.fsh&&!poly&&c._lad){try{v.fs=new AudioWorkletNode(c,'nb-fshift',{numberOfInputs:1,numberOfOutputs:1,outputChannelCount:[1]});fx.connect(v.fs);fx=v.fs;}catch(e){v.fs=null;}}
  if(sn.dist>0){const F2=fuzz(sn.dist);v.ds=c.createWaveShaper();v.ds.curve=F2.c;v.ds.oversample='2x';v.dg=c.createGain();v.dg.gain.value=F2.g;v.dist=sn.dist;
    const lp=c.createBiquadFilter();lp.type='lowpass';lp.frequency.value=8000;lp.Q.value=.5;fx.connect(v.ds);v.ds.connect(lp);lp.connect(v.dg);fx=v.dg;}
  if(!poly||sn.lowcut>0){v.ls=c.createBiquadFilter();v.ls.type='lowshelf';v.ls.frequency.value=170;v.ls.gain.value=0;fx.connect(v.ls);fx=v.ls;}
  if(sn.fbank&&FBANK[sn.fbank])FBANK[sn.fbank].forEach((db,i)=>{if(!db)return;const b=c.createBiquadFilter();b.type='peaking';b.frequency.value=FB_F[i];b.Q.value=1.3;b.gain.value=db;fx.connect(b);fx=b;});
  if(sn.postMix>0){
    const filter=c.createBiquadFilter(),dry=c.createGain(),wet=c.createGain(),sum=c.createGain();
    filter.type=sn.postFilter||'lowpass';filter.frequency.value=40*Math.pow(2,clamp(sn.postCut??1,0,1)*8.2);filter.Q.value=.5+(sn.postRes||0)*8;
    dry.gain.value=1-sn.postMix;wet.gain.value=sn.postMix;fx.connect(dry);dry.connect(sum);fx.connect(filter);filter.connect(wet);wet.connect(sum);fx=sum;
  }
  fx.connect(v.vca);v.vca.connect(dest);
  /* attack transient (Roland D-50): a short burst on top of the note, chiff, bow, breath or mallet, outside the filter */
  if(sn.tr>0){const ns=c.createBufferSource();ns.buffer=nzBuf(c);ns.loop=true;v.trF=c.createBiquadFilter();v.trG=c.createGain();v.trG.gain.value=0;ns.connect(v.trF);v.trF.connect(v.trG);v.trG.connect(v.vca);oscs.push(ns);}
  return v;
}
const nzBuf=c=>c._nzB||(c._nzB=(()=>{const n=c.sampleRate*2,bf=c.createBuffer(1,n,c.sampleRate),d=bf.getChannelData(0);for(let i=0;i<n;i++)d[i]=Math.random()*2-1;return bf;})());
const TRT={chiff:{t:'bandpass',f:3000,q:2,pk:.5,a:.002,d:.015},bow:{t:'bandpass',f:1400,q:1.5,pk:.35,a:.04,d:.06},breath:{t:'highpass',f:5000,q:.7,pk:.25,a:.08,d:.15},mallet:{t:'bandpass',f:2400,q:4,pk:.9,a:.001,d:.006}};
/* o: {acc, gin (0 = new note, 1 = slide, 2 = legato), lvl} */
function voiceOn(v,sn0,time,f,o){
  const sn=Object.assign({det:0,cut:.5,res:0,env:0,dec:.3,drive:0,amp:0,sub:0,slope:24},sn0);
  if(v.foldPre&&!o.gin){v.foldPre.gain.cancelScheduledValues(time);v.foldPre.gain.setValueAtTime(.15+(sn.foldPost||0)*.45,time);v.foldPre.gain.setTargetAtTime(.1+(sn.foldPost||0)*.22,time+.002,.05+(sn.dec||.2)*.2);}const acc=o.acc,gin=o.gin,so=sn.sour||0,dw=(sn.drift||0)+so*.5,dr=()=>dw?(rnd()-.5)*dw*10:0;
  if(v.drive!==sn.drive){v.sh.curve=dcurve(v.lad?sn.drive*.4:sn.drive);v.drive=sn.drive;}
  const gl=sn.glide?.01+sn.glide*sn.glide*.3:0;
  const setF=(p,fr)=>{p.cancelScheduledValues(time);if(gin===1||(gl&&!v.poly&&v.on))p.setTargetAtTime(fr,time,gin===1?Math.max(.028,gl):gl);else p.setValueAtTime(fr,time);};
  /* Sour when moving: like a modular where one oscillator's pitch CV runs through a slew: it lags behind on every new note,
     so the line goes sour for a moment each time it moves (DAF, Conny Plank). Fresh chord notes scoop up from a little below. */
  const ms=sn.msour||0,lag=ms>0?.006+ms*ms*.15:0;
  const setFL=(p,fr,amt)=>{if(!lag||gin===1){setF(p,fr);return;}p.cancelScheduledValues(time);if(v.poly||!v.on)p.setValueAtTime(fr*Math.pow(2,-ms*amt*.7/12),time);
    p.setTargetAtTime(fr,time,Math.max(lag*amt,gl&&!v.poly&&v.on?gl:0));};
  /* Sour up high: oscillators that don't track the same, so notes above the line's root get sourer (and below a little too) */
  const ks=sn.ksour&&o.ref?sn.ksour*clamp(12*Math.log2(f/o.ref),-12,24)*3:0;
  if(v.eng==='an'||v.eng==='mod'){
    const dc=sn.det*22,multi=!!(sn.w2||sn.w3),ul=sn.unison!=null?sn.unison*.4:sn.det>.05?Math.min(.4,sn.det*.45):0;
    v.o1.detune.setValueAtTime((sn.oct1||0)*100-dc+dr(),time);
    const sc=Math.pow(so,1.3)*95;
    if(v.o2)v.o2.detune.setValueAtTime(dc+(sn.oct2||0)*100+sc+ks+dr(),time);
    const s2=sn.sour2>0?Math.pow(sn.sour2,1.3)*95:0;
    if(v.o3)v.o3.detune.setValueAtTime((sn.oct3||0)*100+(sn.det3||0)-dc*.5+(s2?-s2*.5:-sc*.65)+dr(),time);
    if(v.o4)v.o4.detune.setValueAtTime((sn.oct4||0)*100+dc*.7+(s2?s2*.5:sc*.4)-ks*.7+dr(),time);
    if(v.oup){v.oup.detune.setValueAtTime(sc*.5+ks*.5+dr(),time);setFL(v.oup.frequency,f*2,.8);v.gup.gain.setValueAtTime((sn.up||0)*.4,time);}
    if(v.o5)v.o5.detune.setValueAtTime((sn.oct5||0)*100-dc*.7-sc*.3+dr(),time);
    v.u1.detune.setValueAtTime((sn.oct1||0)*100-sn.det*30-sc*.2+dr(),time);v.u2.detune.setValueAtTime((sn.oct1||0)*100+sn.det*30+sc*.3+dr(),time);
    v.gu1.gain.setValueAtTime(ul,time);v.gu2.gain.setValueAtTime(ul,time);
    const k=ul?.8:1;
    v.g1.gain.setValueAtTime((sn.l1!=null?sn.l1:multi?.45:.7)*k,time);
    if(v.g2)v.g2.gain.setValueAtTime((sn.l2!=null?sn.l2:.45)*k,time);
    if(v.g3)v.g3.gain.setValueAtTime((sn.l3!=null?sn.l3:.45)*k,time);
    if(v.g4)v.g4.gain.setValueAtTime((sn.l4!=null?sn.l4:.35)*k,time);if(v.g5)v.g5.gain.setValueAtTime((sn.l5!=null?sn.l5:.35)*k,time);
    for(const x of[v.o1,v.o5,v.u1,v.u2])if(x)setF(x.frequency,f);
    if(v.o2)setFL(v.o2.frequency,f,1);if(v.o3)setFL(v.o3.frequency,f,.35);if(v.o4)setFL(v.o4.frequency,f,.65);
    if(v.eng==='mod'){v.xm.gain.setValueAtTime((sn.xm||0)*f*1.5,time);if(v.rl)v.rl.gain.setValueAtTime(sn.ring||0,time);
      v.hp.frequency.setValueAtTime(20*Math.pow(2,(sn.hp||0)*5.3),time);}
  }else if(v.eng==='vec'){const sc=Math.pow(so,1.3)*60;
    v.vo.forEach(([o],i)=>{if(i===1)setFL(o.frequency,f,1);else setF(o.frequency,f);o.detune.setValueAtTime((i%2?1:-1)*(sn.det*14+sc*(i<2?.5:1))+(i===1?ks:0)+dr(),time);});
  }else if(v.eng==='wt'){
    const sc=Math.pow(so,1.3)*95,m=clamp(sn.wmix||0,0,1),k=acc?1.3:1;
    setF(v.wa.frequency,f);setFL(v.wb.frequency,f,1);setFL(v.wa2.frequency,f,.6);
    v.wa.detune.setValueAtTime(-sn.det*15+dr(),time);v.wb.detune.setValueAtTime(sn.det*15+sc+ks+dr(),time);v.wa2.detune.setValueAtTime(sn.det*30-sc*.5+dr(),time);
    v.ga2.gain.setValueAtTime(sn.det>.05?Math.min(.4,sn.det*.5):0,time);
    if(!gin){const pk=clamp(m+(sn.wenv||0)*k,0,1),tc=.02+(sn.wdec!=null?sn.wdec:.3)*.6;
      v.gb.gain.cancelScheduledValues(time);v.gb.gain.setValueAtTime(pk*.7,time);v.gb.gain.setTargetAtTime(m*.7,time+.003,tc);
      v.ga.gain.cancelScheduledValues(time);v.ga.gain.setValueAtTime((1-pk)*.7,time);v.ga.gain.setTargetAtTime((1-m)*.7,time+.003,tc);}
  }else if(v.eng==='add'){
    const M=MODES[sn.mtype]||MODES.string,R=M.r,A=sn.mtype==='harmonic'&&sn.hA?sn.hA:M.a,tl=.3+(sn.bright!=null?sn.bright:.5)*.9,inh=sn.inh||0,sc=Math.pow(so,1.3)*40;
    let sum=0;const am=A.map((a,i)=>{const x=a*Math.pow(tl,i);sum+=x;return x;});
    const tau=.05+Math.pow(sn.mdec!=null?sn.mdec:.5,2)*3,dmp=sn.damp!=null?sn.damp:.5,sus=sn.msus||0,k=acc?1.3:1;
    v.parts.forEach(([o,g],i)=>{const r=R[i]*Math.pow(R[i],inh*.04);
      if(i===1)setFL(o.frequency,f*r,1);else if(i===3)setFL(o.frequency,f*r,.6);else setF(o.frequency,f*r);
      o.detune.setValueAtTime((i%2?sc:-sc*.6)+(i===1?ks:0)+dr(),time);
      if(!gin){const a=am[i]/Math.max(.01,sum)*.9*k;g.gain.cancelScheduledValues(time);g.gain.setValueAtTime(a,time);g.gain.setTargetAtTime(a*sus,time+.003,Math.max(.01,tau/(1+i*dmp*1.5)));}});
    if(v.gnz&&!gin){const ng=v.gnz.gain;ng.cancelScheduledValues(time);ng.setValueAtTime((sn.noise||0)*.7*k,time);ng.setTargetAtTime(0,time+.002,.005+(sn.noiseC!=null?sn.noiseC:.5)*.012);}
  }else if(v.eng==='wc'){
    /* the fold opens on every hit and closes again (the Buchla bongo); FM index has its own envelope */
    const r1=sn.r1||1,two=sn.det>.05||so>.05,fb=.2+(sn.fold||0)*.75;
    const two2=two||ms>0||ks!==0;
    setF(v.c1.frequency,f);setFL(v.c2.frequency,f,1);setF(v.m1.frequency,f*r1);
    v.c1.detune.setValueAtTime(-sn.det*12+dr(),time);v.c2.detune.setValueAtTime(sn.det*12+Math.pow(so,1.3)*80+ks+dr(),time);
    v.gc1.gain.setValueAtTime(two2?.5:1,time);v.gc2.gain.setValueAtTime(two2?.5:0,time);
    if(!gin){const k=acc?1.3:1,gm=v.gm1.gain,fp=v.fpre.gain;
      gm.cancelScheduledValues(time);gm.setValueAtTime((sn.i1||0)*f*r1*k,time);gm.setTargetAtTime((sn.i1s||0)*f*r1,time+.002,Math.max(.01,sn.d1||.15));
      fp.cancelScheduledValues(time);fp.setValueAtTime(Math.min(1,fb+(sn.fenv||0)*.6*k),time);fp.setTargetAtTime(fb,time+.002,.02+(sn.fdec!=null?sn.fdec:.2)*.5);}
    if(v.lfoF)v.lfoF.gain.setValueAtTime((sn.lfo||0)*.35,time);
  }else{
    const r1=sn.r1||1,r2=sn.r2||1,rc=sn.rc||1,two=sn.det>.05||so>.05||ms>0||ks!==0;
    setF(v.c1.frequency,f*rc);setFL(v.c2.frequency,f*rc,1);setF(v.m1.frequency,f*r1);setF(v.m2.frequency,f*r2);
    v.c1.detune.setValueAtTime(-sn.det*12+dr(),time);v.c2.detune.setValueAtTime(sn.det*12+Math.pow(so,1.3)*70+dr()+ks,time);v.m1.detune.setValueAtTime(Math.pow(so,1.3)*35,time);
    v.gc1.gain.setValueAtTime(two?.5:.75,time);v.gc2.gain.setValueAtTime(two?.5:0,time);
    if(!gin){const k=acc?1.3:1,env=(g,i,is,d,fr)=>{g.gain.cancelScheduledValues(time);g.gain.setValueAtTime(i*fr*k,time);g.gain.setTargetAtTime(is*fr,time+.002,Math.max(.01,d));};
      env(v.gm1,sn.i1||0,sn.i1s||0,sn.d1||.2,f*r1);env(v.gm2,sn.i2||0,sn.i2s||0,sn.d2||.1,f*r2);}
  }
  v.gs.gain.setValueAtTime((sn.sub||0)*.55,time);setF(v.so.frequency,f/2);
  if(v.gnz&&v.eng!=='add')v.gnz.gain.setValueAtTime((sn.noise||0)*.3,time);
  if(v.ds&&v.dist!==sn.dist&&sn.dist>0){const F2=fuzz(sn.dist);v.ds.curve=F2.c;v.dg.gain.setValueAtTime(F2.g,time);v.dist=sn.dist;}
  if(v.ls)v.ls.gain.setValueAtTime(-(sn.lowcut||0)*10,time);
  if(v.vibG&&!gin){const g=v.vibG.gain;g.cancelScheduledValues(time);g.setValueAtTime(0,time);g.setTargetAtTime((sn.vib||0)*28,time+.22,.25);}
  if(v.cr){const P=v.cr.parameters,l=sn.lofi||0;P.get('bits').setValueAtTime(16-l*12,time);P.get('down').setValueAtTime(1+l*l*10,time);}
  if(v.fs){const P=v.fs.parameters,x=sn.fsh||0;P.get('shift').setValueAtTime(Math.sign(x)*x*x*300,time);P.get('mix').setValueAtTime(x?.5:0,time);}if(v.lfo)v.lfo.frequency.setValueAtTime(sn.lfoR||1.5,time);
  /* S&H (ARP 2600): a new random filter setting on every note, like sample and hold clocked by the sequencer */
  const base=60*Math.pow(2,sn.cut*7.5)*(sn.sh>0&&!gin?Math.pow(2,(rnd()-.5)*sn.sh*3.5):1);
  if(v.lad){const P=v.lad.parameters;P.get('res').setValueAtTime(Math.min(.97,sn.res*1.05),time);P.get('poles').setValueAtTime(sn.slope===12?2:4,time);P.get('drive').setValueAtTime(1+sn.drive*3,time);}
  else{const Q=.7+sn.res*(sn.slope===24?14:20);v.f1.Q.setValueAtTime(Q,time);if(v.bg)v.bg.gain.setValueAtTime(1.8*Math.sqrt(Q),time);}
  if(v.lfoG)v.lfoG.gain.setValueAtTime((sn.lfo||0)*base*.7,time);
  if(!gin){
    const pk=Math.min(16000,base*(1+sn.env*10*(acc?1.7:1))),tc=.03+sn.dec*.4*(acc?.6:1);
    /* Filter swell (CS-80, Xpander brass): the filter opens over fatk seconds before it falls back */
    if(sn.fatk>0)for(const p of v.cutP){p.cancelScheduledValues(time);p.setValueAtTime(base,time);p.linearRampToValueAtTime(pk,time+sn.fatk);p.setTargetAtTime(base,time+sn.fatk,tc);}
    else for(const p of v.cutP){p.cancelScheduledValues(time);p.setValueAtTime(pk,time);p.setTargetAtTime(base,time+.002,tc);}
    if(v.trG){const T=TRT[sn.trT]||TRT.chiff,g=v.trG.gain,pk2=sn.tr*T.pk*o.lvl*(sn.g||1)*2.2;v.trF.type=T.t;v.trF.frequency.setValueAtTime(T.f,time);v.trF.Q.setValueAtTime(T.q,time);
      g.cancelScheduledValues(time);g.setValueAtTime(0,time);g.linearRampToValueAtTime(pk2,time+T.a);g.setTargetAtTime(0,time+T.a,T.d);}
    const g=v.vca.gain,peak=o.lvl*(acc?1.55:1)*(sn.g||1),at=sn.atk||0;g.cancelScheduledValues(time);g.setTargetAtTime(peak,time,Math.max(.002,at/3));
    if(sn.amp>0)g.setTargetAtTime(peak*(1-sn.amp*.85),time+.012+at,.05+(sn.adec!=null?sn.adec:sn.dec)*.35);
  }
  v.on=true;
}
function voiceOff(v,sn,time){v.vca.gain.setTargetAtTime(0,time,.012+(sn.rel||0)/3);}
async function prepare(c){if(c._nbReady)return c._nbReady;c._nbReady=(async()=>{if(!c.audioWorklet)return false;try{await c.audioWorklet.addModule('nb-ladder.js?v=09');c._lad=true;return true;}catch(e){console.warn('NB46 ladder unavailable; original biquad fallback active',e);return false;}})();return c._nbReady;}
function resolve(P,which,note={},time=0){
 const bank=window.NB46Bank,patch=P.patch||bank?.factory.find(p=>p.id===which)?.patch||bank?.factory[0]?.patch||{};
 const sn={...patch,cut:P.cutoff/100,res:P.resonance/100,det:P.detune/100,sour:(P.sour||0)/100,env:(P.filterEnv??25)/50,dec:(P.decay??25)/100,drive:P.drive/100,atk:.001+P.attack/100*.12,rel:P.release/100,glide:(note.glideFrom!=null?Math.max(24,P.glide):P.glide)/100,sub:(P.subLevel||0)/100};
 const map={ampDecay:['adec',1],pluck:['amp',1],unison:['unison',1],drift:['drift',1],fold:['foldPost',1],filterMotion:['lfo',1],postCut:['postCut',1],postRes:['postRes',1],postMix:['postMix',1],crossMod:['xm',1],ring:['ring',1],osc1Level:['l1',1],osc2Level:['l2',1],osc3Level:['l3',1],fm2:['i2',2],modDecay:['d1',1],tableEnv:['wenv',1],modalDecay:['mdec',1],damping:['damp',1]};
 for(const [id,[key,scale]] of Object.entries(map))if(P[id]!=null)sn[key]=P[id]/100*scale;
 for(let i=1;i<=3;i++)if(P['osc'+i+'Tune']!=null)sn['oct'+i]=P['osc'+i+'Tune'];
 if(P.ratio1!=null)sn.r1=P.ratio1/10;if(P.ratio2!=null)sn.r2=P.ratio2/10;
 if(P.motionRate!=null)sn.lfoR=.05*2**(P.motionRate/100*7);
 const eng=ENG(sn),color=(P.timbre??50)/100,movement=(P.movement||0)/100;
 if(eng==='wc')sn.fold=color;else if(eng==='fm')sn.i1=color*5;else if(eng==='wt')sn.wmix=color;else if(eng==='add')sn.bright=color;else if(eng==='vec'){sn.vx=.1+color*.65;sn.vy=.11+movement*.5;}else sn.pw=.08+color*.42;
 sn.cut=clamp(sn.cut+movement*.075*Math.sin(time*.67),.04,.95);return sn;
}
function single(c,dest,note,P,which,time,previous){
 const sn=resolve(P,which,note,time);
 const v=buildVoice(c,sn,dest,false),freq=440*2**((note.pitch-69+(P.tuning||0)/100)/12),duration=Math.max(.006,note.duration),end=time+duration+(P.envelopeVersion===2?window.AmpEnvelope.seconds(P).release:0),stop=end+.025;
 v.oscs.forEach(o=>{o.start(time);o.stop(stop);});
 const from=note.glideFrom??(P.legato?previous:null),f0=from!=null&&sn.glide>0?440*2**((from-69)/12):freq;
 voiceOn(v,sn,time,f0,{acc:note.velocity>110,gin:0,lvl:.21*(note.velocity/127),ref:220});
 if(f0!==freq)voiceOn(v,sn,time+.001,freq,{acc:false,gin:1,lvl:.21*(note.velocity/127),ref:220});
 if(v.vo){const x=Math.sin(time*(.12+sn.vx*.35)),y=Math.cos(time*(.13+sn.vy*.31));v.vo.forEach(([,g],i)=>{g.gain.cancelScheduledValues(time);g.gain.setValueAtTime((1+(i%2?-x:x))*(1+(i<2?y:-y))*.17,time);});}
 if(P.envelopeVersion===2){window.AmpEnvelope.schedule(v.vca.gain,time,duration,.21*(note.velocity/127)*(note.velocity>110?1.55:1)*(sn.g||1),P);}
 else {const releaseStart=Math.max(time+Math.min(.012,duration*.15),end-Math.min(duration*.72,(sn.rel||0)*.28));voiceOff(v,sn,releaseStart);}
 let cleaned=false;const cleanup=()=>{if(cleaned)return;cleaned=true;for(const node of [v.lad,v.cr,v.fs])if(node)node.port.postMessage({type:'dispose'});try{v.oscs.forEach(o=>o.disconnect());for(const node of Object.values(v))if(node&&typeof node.disconnect==='function')node.disconnect();}catch{}};v.oscs[0].onended=cleanup;
 return {gain:v.vca,oscs:v.oscs,voice:v,end,stop(at){v.oscs.forEach(o=>{try{o.stop(at);}catch{}});setTimeout(cleanup,Math.max(0,at-c.currentTime)*1000+30);}};
}
function play(c,dest,note,P,which,time,previous){
 const layer=P.patch?.layer,blend=Math.min(.75,Math.max(0,(P.sourceBlend??P.patch?.blend??0)/100));
 if(!layer||blend===0)return single(c,dest,note,P,which,time,previous);
 const a=c.createGain(),b=c.createGain();a.gain.value=1-blend;b.gain.value=blend;a.connect(dest);b.connect(dest);
 const primary=single(c,a,note,P,which,time,previous),Q={...window.NB46Bank.knobs(layer),patch:layer,envelopeVersion:2,attack:P.attack,ampDecay:P.ampDecay,sustain:P.sustain,release:P.release,tuning:P.tuning,glide:P.glide,legato:P.legato},secondary=single(c,b,note,Q,which,time,previous);
 // One pitch event, two timbral sources. The common output gate cuts both on the next note.
 const oscs=[...primary.oscs,...secondary.oscs],finish=primary.oscs[0].onended;
 primary.oscs[0].onended=()=>{try{finish?.();}finally{a.disconnect();b.disconnect();}};
 return {gain:primary.gain,oscs,end:Math.max(primary.end,secondary.end),stop(at){primary.stop(at);secondary.stop(at);}};
}
window.NBVoice={prepare,play,resolve};
})();
