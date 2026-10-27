/* Dropfather leads: big polyphonic synth leads for drops (supersaw, big-room stab, pluck, hoover, house organ,
   dub chord, EBM pulse), and the lead bus every lead goes through: drive, low cut, a tone filter the sections
   automate (closed in the build-up, open in the drop), ping-pong delay and reverb.
   A voice plays chords: play({midi,chord:[midi…],time,duration,velocity}). */
(function(root){'use strict';
const PATCHES={
 festival:{n:'Festival supersaw',osc:'saw',voices:7,spread:34,layers:[[12,.32,3]],sub:0,cutoff:2600,env:7000,fdecay:.35,res:1.2,kt:.4,atk:.004,dec:.4,sus:.75,rel:.22,drive:.35,width:1,delay:[.1875,.32,.24],verb:.32,gain:0.87},
 bigroom:{n:'Big room stab',osc:'saw',voices:7,spread:28,layers:[[12,.45,3],[-12,.35,3]],sub:0,cutoff:1400,env:9000,fdecay:.16,res:2.2,kt:.3,atk:.002,dec:.22,sus:.35,rel:.12,drive:.55,width:1,delay:[.1875,.28,.2],verb:.36,gain:0.82},
 trance:{n:'Trance pluck',osc:'saw',voices:5,spread:20,layers:[[12,.25,2]],sub:0,cutoff:700,env:6500,fdecay:.12,res:3,kt:.5,atk:.002,dec:.2,sus:.08,rel:.18,drive:.2,width:.9,delay:[.1875,.42,.34],verb:.38,gain:2.27},
 hoover:{n:'Hoover',osc:'saw',voices:5,spread:55,layers:[[-12,.7,3],[12,.18,2]],sub:.3,cutoff:2200,env:2500,fdecay:.4,res:1,kt:.3,atk:.01,dec:.5,sus:.85,rel:.2,drive:.6,width:1,bend:[-5,.09],delay:[.1875,.2,.14],verb:.28,gain:0.41},
 screech:{n:'Screech lead',osc:'square',voices:3,spread:14,layers:[[12,.35,1]],sub:0,cutoff:1800,env:5200,fdecay:.25,res:6,kt:.6,atk:.003,dec:.3,sus:.7,rel:.12,drive:.7,width:.7,glide:.04,delay:[.1875,.3,.22],verb:.24,gain:0.28},
 house:{n:'House organ stab',osc:'organ',voices:1,spread:0,layers:[],sub:0,cutoff:5200,env:2600,fdecay:.12,res:.8,kt:0,atk:.002,dec:.26,sus:.18,rel:.1,drive:.25,width:.6,delay:[.25,.25,.16],verb:.26,gain:1.22},
 techno:{n:'Techno dub chord',osc:'saw',voices:3,spread:12,layers:[],sub:0,cutoff:900,env:2400,fdecay:.1,res:4,kt:.4,atk:.002,dec:.18,sus:0,rel:.12,drive:.3,width:.8,delay:[.1875,.55,.42],verb:.45,gain:1.89},
 ebm:{n:'EBM pulse',osc:'square',voices:2,spread:9,layers:[[-12,.5,1]],sub:0,cutoff:900,env:3800,fdecay:.09,res:3,kt:.5,atk:.001,dec:.14,sus:.3,rel:.06,drive:.75,width:.5,delay:[.1875,.22,.12],verb:.18,gain:0.55},
 future:{n:'Future bass chord',osc:'saw',voices:5,spread:24,layers:[[12,.3,2]],sub:0,cutoff:3200,env:3000,fdecay:.4,res:1.5,kt:.3,atk:.03,dec:.6,sus:.65,rel:.3,drive:.3,width:1,wobble:[.5,1800],delay:[.25,.3,.2],verb:.42,gain:1.06},
 pad:{n:'Ambient pad',osc:'saw',voices:5,spread:16,layers:[[12,.2,2]],sub:0,cutoff:900,env:700,fdecay:1.2,res:.8,kt:.3,atk:.35,dec:1.2,sus:.8,rel:1.4,drive:.05,width:1,delay:[.375,.35,.22],verb:.65,gain:1.2},
 glass:{n:'Glass pluck',osc:'glass',voices:2,spread:7,layers:[[12,.25,1]],sub:0,cutoff:6000,env:2500,fdecay:.3,res:.7,kt:.2,atk:.002,dec:.6,sus:0,rel:.5,drive:.05,width:.8,delay:[.1875,.45,.35],verb:.55,gain:2.2}
};
// Which chord each patch plays under the melody note.
const VOICING={festival:'triad',bigroom:'stack',trance:'dyad',hoover:'power',screech:'single',house:'seventh',techno:'seventh',ebm:'single',future:'seventh',pad:'seventh',glass:'dyad'};
const mtof=m=>440*2**((m-69)/12);

// Saw and square waves with their own start phase: detuned copies then do not all start in phase (no "zip").
const WAVES=new WeakMap();
function wave(ctx,type,i){
 let m=WAVES.get(ctx);if(!m){m={};WAVES.set(ctx,m);}const key=type+i;if(m[key])return m[key];
 const N=200,re=new Float32Array(N),im=new Float32Array(N),phi=((i*0.618034)%1)*2*Math.PI;
 for(let k=1;k<N;k++){
  let a=0;if(type==='saw')a=1/k;else if(type==='square')a=k%2?1/k:0;else if(type==='organ')a={1:1,2:.55,3:.42,4:.3,6:.2,8:.12}[k]||0;else if(type==='glass')a={1:1,2:.25,3:.45,5:.22,7:.12,9:.06}[k]||0;
  re[k]=a*Math.sin(k*phi);im[k]=a*Math.cos(k*phi);
 }
 return m[key]=ctx.createPeriodicWave(re,im,{disableNormalization:false});
}

// The lead bus: input → drive → low cut → tone (automated per section) → dest, with delay and reverb sends.
function bus(ctx,dest,patch,bpm){
 const p=PATCHES[patch]||{drive:.2,delay:[.1875,.25,.15],verb:.22},input=ctx.createGain(),drive=ctx.createWaveShaper(),lowcut=ctx.createBiquadFilter(),tone=ctx.createBiquadFilter(),out=ctx.createGain();
 const k=1+p.drive*6,curve=new Float32Array(1024);for(let i=0;i<1024;i++){const x=i/511.5-1;curve[i]=Math.tanh(x*k)/Math.tanh(k);}drive.curve=curve;drive.oversample='2x';
 lowcut.type='highpass';lowcut.frequency.value=160;lowcut.Q.value=.6;tone.type='lowpass';tone.frequency.value=20000;tone.Q.value=.8;
 input.connect(drive).connect(lowcut).connect(tone).connect(out).connect(dest);
 // Ping-pong: left at the patch's time, right echoes it; feedback darkened.
 const beat=60/bpm,[div,fb,mix]=p.delay,send=ctx.createGain(),dl=ctx.createDelay(4),dr=ctx.createDelay(4),fbG=ctx.createGain(),dark=ctx.createBiquadFilter(),thin=ctx.createBiquadFilter(),merge=ctx.createChannelMerger(2),dg=ctx.createGain();
 send.gain.value=mix;dl.delayTime.value=div*4*beat;dr.delayTime.value=div*4*beat;fbG.gain.value=fb;dark.type='lowpass';dark.frequency.value=4200;thin.type='highpass';thin.frequency.value=380;dg.gain.value=1;
 tone.connect(send).connect(thin).connect(dl);dl.connect(dark).connect(dr);dr.connect(fbG).connect(dl);dl.connect(merge,0,0);dr.connect(merge,0,1);merge.connect(dg).connect(dest);
 // Reverb: a long, bright hall.
 const vs=ctx.createGain(),conv=ctx.createConvolver(),len=Math.round(ctx.sampleRate*3.2),ir=ctx.createBuffer(2,len,ctx.sampleRate);
 for(let c=0;c<2;c++){const d=ir.getChannelData(c);let lp=0;for(let i=0;i<len;i++){const n=Math.random()*2-1;lp+=.55*(n-lp);d[i]=lp*Math.pow(1-i/len,3.2)*(i<ctx.sampleRate*.012?i/(ctx.sampleRate*.012):1);}}
 conv.buffer=ir;conv.normalize=true;vs.gain.value=p.verb;const vr=ctx.createGain();vr.gain.value=.55;tone.connect(vs).connect(conv).connect(vr).connect(dest);
 return {input,tone,out,delay:send,verb:vs,base:{delay:mix,verb:p.verb}};
}

// One note of a patch on any context (live or offline): stacked, detuned layers → two low-passes → amp.
function synthNote(c,p,midi,time,duration,velocity,dest,glideFrom,live){
 const f0=mtof(midi),end=time+duration+p.rel*4+.05,sum=c.createGain(),f1=c.createBiquadFilter(),f2=c.createBiquadFilter(),amp=c.createGain(),vel=(velocity??100)/127,oscs=[];
 const bendFrom=p.bend?mtof(midi+p.bend[0]):glideFrom!=null&&p.glide?mtof(glideFrom):null;
 const layer=(semis,level,count)=>{
  const n=Math.max(1,count),panL=c.createStereoPanner(),panR=c.createStereoPanner(),mid=c.createGain(),lv=level/Math.sqrt(n),f=f0*2**(semis/12);
  panL.pan.value=-p.width;panR.pan.value=p.width;panL.connect(sum);panR.connect(sum);mid.connect(sum);
  for(let i=0;i<n;i++){
   const o=c.createOscillator(),g=c.createGain(),u=n>1?i/(n-1)*2-1:0;
   o.setPeriodicWave(wave(c,p.osc,i));o.detune.value=Math.sign(u)*Math.abs(u)**1.4*p.spread+(n>1?(i%2?3:-3):0);
   if(bendFrom!=null){o.frequency.setValueAtTime(bendFrom*2**(semis/12),time);o.frequency.exponentialRampToValueAtTime(f,time+(p.bend?p.bend[1]:p.glide));}else o.frequency.value=f;
   g.gain.value=lv*(u===0?1.15:1);o.connect(g).connect(n===1||u===0?mid:(i%2?panR:panL));o.start(time);o.stop(end);oscs.push(o);
  }
 };
 layer(0,1,p.voices);for(const [semis,level,count] of p.layers)layer(semis,level,count);
 if(p.sub){const o=c.createOscillator(),g=c.createGain();o.frequency.value=f0/2;g.gain.value=p.sub;o.connect(g).connect(sum);o.start(time);o.stop(end);oscs.push(o);}
 // Filter: two low-passes (24 dB), keytracked, with an envelope that falls from cutoff+env to cutoff.
 const base=Math.min(18000,p.cutoff*(f0/440)**p.kt),peak=Math.min(19000,base+p.env*(.55+.45*vel));
 for(const fl of [f1,f2]){fl.type='lowpass';fl.Q.value=fl===f1?p.res:.7;fl.frequency.setValueAtTime(peak,time);fl.frequency.setTargetAtTime(base,time+.002,p.fdecay/3);}
 if(p.wobble){const l=c.createOscillator(),lg=c.createGain();l.frequency.value=p.wobble[0]*4;lg.gain.value=p.wobble[1];l.connect(lg).connect(f1.frequency);l.start(time);l.stop(end);oscs.push(l);}
 const top=.22*vel*p.gain,off=time+Math.max(duration,p.atk+.01);
 amp.gain.setValueAtTime(0,time);amp.gain.linearRampToValueAtTime(top,time+p.atk);amp.gain.setTargetAtTime(top*p.sus,time+p.atk,p.dec/3);
 amp.gain.cancelScheduledValues(off);amp.gain.setTargetAtTime(0,off,p.rel/3);
 sum.connect(f1).connect(f2).connect(amp).connect(dest);
 if(live){const v={oscs};live.add(v);oscs[0].onended=()=>{live.delete(v);try{amp.disconnect();}catch(e){}};}
}
// A chord (melody on top): every note gets an equal share of the level.
function synthChord(c,p,notes,melody,time,duration,velocity,dest,glideFrom,live){const g=c.createGain();g.gain.value=1/Math.sqrt(notes.length);g.connect(dest);for(const m of notes)synthNote(c,p,m,time,duration,velocity,g,m===melody?glideFrom:null,live);}

// Rendered chords, shared by every context at the same sample rate: a drop repeats a handful of chords, and a
// buffer per chord replaces dozens of oscillators per hit (offline renders get many times faster).
const JOBS=new Map(),READY=new Map(),LIMIT=600;
const chordKey=(sr,id,p,notes,dur,vel,glide)=>[sr,id,notes.join('.'),Math.round(dur*1000),vel,p.glide?glide:''].join('|');
function renderChord(sr,id,notes,melody,dur,vel,glide){
 const p=PATCHES[id],k=chordKey(sr,id,p,notes,dur,vel,glide);if(JOBS.has(k))return JOBS.get(k);
 const c=new OfflineAudioContext(2,Math.ceil((dur+p.rel*4+.12)*sr),sr);synthChord(c,p,notes,melody,0,dur,vel,c.destination,glide,null);
 const job=c.startRendering().then(b=>{READY.set(k,b);if(READY.size>LIMIT){const old=READY.keys().next().value;READY.delete(old);JOBS.delete(old);}return b;});
 JOBS.set(k,job);job.catch(()=>JOBS.delete(k));return job;
}

// Instruments from outside (Tarjei's other engines: strings, stabs, acid …) register here and then show up as
// leads in Dropfather: register(id, {name, voicing, create(ctx, dest, opts) → {play({midi,chord,time,duration,velocity}), dispose()}}).
const EXT={};
function register(id,def){if(!id||typeof def?.create!=='function')throw Error('DropLead.register(id, {name, create}) needs a create function');EXT[id]=def;VOICING[id]=def.voicing||'single';}
function create(ctx,dest,patch){
 if(EXT[patch]){const v=EXT[patch].create(ctx,dest,{});v.patch=patch;return v;}
 const id=PATCHES[patch]?patch:'festival',p=PATCHES[id],live=new Set(),srcs=new Set(),offline=typeof OfflineAudioContext!=='undefined'&&ctx instanceof OfflineAudioContext;let last=null;
 return {
  patch:id,
  // Render ahead the chords a section will play: [{midi,chord,duration,velocity,glide}].
  prepare(list){return Promise.all(list.map(x=>renderChord(ctx.sampleRate,id,x.chord&&x.chord.length?x.chord:[x.midi],x.midi,x.duration,x.velocity,x.glide)));},
  play({midi,time,duration,velocity,chord}){
   const notes=chord&&chord.length?chord:[midi],glide=last;last=midi;
   const b=READY.get(chordKey(ctx.sampleRate,id,p,notes,duration,velocity,glide));
   if(b){const s=ctx.createBufferSource();s.buffer=b;s.connect(dest);s.start(time);srcs.add(s);s.onended=()=>srcs.delete(s);return;}
   // Not rendered yet (a note just drawn while looping): play it live, and render it for next time.
   synthChord(ctx,p,notes,midi,time,duration,velocity,dest,glide,live);if(!offline)renderChord(ctx.sampleRate,id,notes,midi,duration,velocity,glide).catch(()=>{});
  },
  dispose(){for(const s of srcs)try{s.stop();}catch(e){}srcs.clear();for(const v of live)for(const o of v.oscs)try{o.stop();}catch(e){}live.clear();}
 };
}
const api={PATCHES,VOICING,bus,create,register,list:()=>[...Object.entries(PATCHES).map(([id,p])=>({id,n:p.n})),...Object.entries(EXT).map(([id,d])=>({id,n:d.name||id,ext:true}))]};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.DropLead=api;
})(typeof globalThis!=='undefined'?globalThis:this);
