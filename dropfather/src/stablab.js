/* STAB LAB in Dropfather: Tarjei Krogh's chord-stab sounds (the synth engines: classic, analog, modular, FM and
   West Coast), voiced as in STAB LAB (its stRenderGroup for these engines), registered as Dropfather leads.
   Each chord renders once to a buffer and is reused; level is matched per chord. */
(function(root){'use strict';
const data=()=>root.STABLAB_DATA||{sounds:[],lines:[]};
const WAVE={saw:'sawtooth',sq:'square',pulse:'square',tri:'triangle',sine:'sine'};
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
// STAB LAB's engine settings for a sound (its stEngineFor).
function engineOf(s){
 const q=s.patch,classic=s.engine==='classic';
 return {cut:clamp(q.cut??.5,.1,1),res:classic?clamp((q.q-.7)/14,0,.8):q.res||0,attack:Math.min(.08,q.atk??q.attack??.003),decay:clamp(q.dec??q.decay??q.adec??.2,.035,1),
  sustain:q.sus??(q.amp!=null?1-clamp(q.amp,0,.95):.3),release:clamp(q.rel??.12,.02,.7),detune:classic?Math.abs(q.w[0][1]):(q.det||0)*22,drive:q.drive||0,
  waveA:classic?WAVE[q.w[0][0]]||'sawtooth':WAVE[q.w1]||'sine',waveB:classic?WAVE[q.w[1]?.[0]]||'sine':WAVE[q.w2]||'sine'};
}
// One chord: per note its oscillators (or FM pair), a filter with its envelope, drive, amp envelope and a pan
// spread across the chord.
function voice(c,s,notes,gate,vel,dest,t0=0){
 const q=s.patch,e=engineOf(s),release=clamp(e.release,.02,.65),end=t0+gate+release*2+.03,out=c.createGain(),nodes=[];
 out.gain.value=.65/Math.sqrt(Math.max(1,notes.length));out.connect(dest);
 notes.forEach((m,ni)=>{
  const f=440*2**((m-69)/12),amp=c.createGain(),filter=c.createBiquadFilter(),pan=c.createStereoPanner(),attack=Math.min(gate*.25,Math.max(.001,e.attack)),peak=.3*clamp(vel,.1,1),sustain=clamp(e.sustain,.03,.92),base=clamp(150*2**(e.cut*6.5),80,c.sampleRate*.43),fenv=s.engine==='classic'?(q.fenv||0):(q.env||.3)*8;
  filter.type=q.ft==='bp'?'bandpass':'lowpass';filter.Q.value=.7+e.res*13;filter.frequency.setValueAtTime(Math.min(c.sampleRate*.43,base*(1+fenv)),t0);filter.frequency.setTargetAtTime(base,t0+Math.max(.002,q.fatk||0),Math.max(.018,e.decay*.3));
  amp.gain.setValueAtTime(0,t0);amp.gain.linearRampToValueAtTime(peak,t0+attack);amp.gain.setTargetAtTime(peak*sustain,t0+attack,.012+e.decay/3);amp.gain.setTargetAtTime(0,t0+gate,Math.max(.008,release/3));
  pan.pan.value=notes.length>1?(ni/(notes.length-1)-.5)*.45:0;
  let last=filter;if(e.drive>0){const sh=c.createWaveShaper(),curve=new Float32Array(1025),dr=1+e.drive*8;for(let i=0;i<curve.length;i++){const x=i*2/(curve.length-1)-1;curve[i]=Math.tanh(x*dr)/Math.tanh(dr);}sh.curve=curve;sh.oversample='2x';filter.connect(sh);last=sh;}
  last.connect(amp).connect(pan).connect(out);
  const osc=(type,freq,det=0)=>{const o=c.createOscillator();o.type=type;if(type==='square'&&q.pw){const re=new Float32Array(65),im=new Float32Array(65);for(let h=1;h<65;h++){re[h]=Math.sin(2*Math.PI*h*q.pw)/(Math.PI*h);im[h]=(1-Math.cos(2*Math.PI*h*q.pw))/(Math.PI*h);}o.setPeriodicWave(c.createPeriodicWave(re,im));}o.frequency.value=Math.min(freq,c.sampleRate*.42);o.detune.value=det;o.start(t0);o.stop(end);nodes.push(o);return o;};
  if(s.engine==='fm'||s.engine==='wc'){
   const carrier=osc('sine',f*(q.rc||1)),m1=osc('sine',f*(q.r1||2)),g1=c.createGain(),m2=osc('sine',f*(q.r2||1)),g2=c.createGain();
   g1.gain.setValueAtTime((q.i1||1)*f*(q.r1||2),t0);g1.gain.setTargetAtTime((q.i1s||0)*f,t0+.002,Math.max(.01,q.d1||.2));g2.gain.setValueAtTime((q.i2||0)*f*(q.r2||1),t0);g2.gain.setTargetAtTime((q.i2s||0)*f,t0+.002,Math.max(.01,q.d2||.2));
   m1.connect(g1).connect(carrier.frequency);m2.connect(g2).connect(q.alg==='ser'?m1.frequency:carrier.frequency);
   if(s.engine==='wc'&&q.fold){const sh=c.createWaveShaper(),curve=new Float32Array(1025);for(let i=0;i<1025;i++)curve[i]=2/Math.PI*Math.asin(Math.sin((i*2/1024-1)*(1+q.fold*6)*Math.PI/2));sh.curve=curve;carrier.connect(sh).connect(filter);}else carrier.connect(filter);
  }else{
   const waves=s.engine==='classic'?q.w.map(([w,det])=>[WAVE[w]||'sawtooth',det]):[[e.waveA,-e.detune],[e.waveB,e.detune+(q.oct2||0)*100+Math.pow(q.sour||0,1.3)*95]];
   for(const [w,det] of waves){const o=osc(w,f,det),g=c.createGain();g.gain.value=1/Math.sqrt(waves.length);o.connect(g).connect(filter);}
  }
 });
 return {nodes,end};
}
// Rendered chords, shared by every context at the same sample rate; each brought to the same loudness.
const JOBS=new Map(),READY=new Map(),TARGET=.065;
const keyOf=(sr,i,notes,dur,vel)=>[sr,i,notes.join('.'),Math.round(dur*1000),vel].join('|');
function renderChord(sr,s,notes,dur,vel){
 const k=keyOf(sr,s.i,notes,dur,vel);if(JOBS.has(k))return JOBS.get(k);const gate=clamp(dur,.035,4.01),c=new OfflineAudioContext(2,Math.ceil((gate+clamp(engineOf(s).release,.02,.65)*2+.06)*sr),sr);
 voice(c,s,notes,gate,vel/127,c.destination);
 const job=c.startRendering().then(b=>{
  const L=b.getChannelData(0),R=b.getChannelData(1),hop=Math.round(sr*.02);let sum=0,n=0,peak=0;
  for(let a=0;a<L.length;a+=hop){let e=0;for(let i=a;i<Math.min(L.length,a+hop);i++){e+=L[i]*L[i]+R[i]*R[i];peak=Math.max(peak,Math.abs(L[i]),Math.abs(R[i]));}e/=2*hop;if(e>1e-6){sum+=e;n++;}}
  const g=n?Math.min(TARGET/Math.sqrt(sum/n),.95/(peak||1)):1;for(const d of [L,R])for(let i=0;i<d.length;i++)d[i]*=g*Math.min(1,i/32,(d.length-1-i)/64);
  READY.set(k,b);if(READY.size>500){const o=READY.keys().next().value;READY.delete(o);JOBS.delete(o);}return b;});
 JOBS.set(k,job);job.catch(()=>JOBS.delete(k));return job;
}
function create(ctx,dest,s){
 const srcs=new Set(),live=new Set(),offline=typeof OfflineAudioContext!=='undefined'&&ctx instanceof OfflineAudioContext;
 return {
  prepare(list){return Promise.all(list.map(x=>renderChord(ctx.sampleRate,s,x.chord?.length?x.chord:[x.midi],x.duration,x.velocity)));},
  play({midi,chord,time,duration,velocity}){
   const notes=chord?.length?chord:[midi],b=READY.get(keyOf(ctx.sampleRate,s.i,notes,duration,velocity));
   if(b){const src=ctx.createBufferSource(),g=ctx.createGain();g.gain.value=1;src.buffer=b;src.connect(g).connect(dest);src.start(time);srcs.add(src);src.onended=()=>srcs.delete(src);return;}
   // Not rendered yet (a note just drawn while looping): live, quieter as it is not level-matched, and render it for next time.
   const g=ctx.createGain();g.gain.value=.8;g.connect(dest);const v=voice(ctx,s,notes,clamp(duration,.035,4.01),(velocity??100)/127,g,time);live.add(v);
   if(!offline)renderChord(ctx.sampleRate,s,notes,duration,velocity).catch(()=>{});
  },
  dispose(){for(const x of srcs)try{x.stop();}catch(e){}for(const v of live)for(const o of v.nodes)try{o.stop();}catch(e){}srcs.clear();live.clear();}
 };
}
function registerAll(){const L=root.DropLead;if(!L?.register)return;for(const s of data().sounds)L.register('stab'+s.i,{name:'Stab Lab · '+s.name,voicing:'seventh',create:(ctx,dest)=>create(ctx,dest,s)});}
registerAll();
const api={sounds:()=>data().sounds,lines:()=>data().lines,create};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.StabLab=api;
})(typeof globalThis!=='undefined'?globalThis:this);
