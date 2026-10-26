/* Dropfather DSP: build-up, pre-drop and drop rendered offline around the original song.
   All times are in seconds. "src" is the original song, "out" is the rendered result. */
(function(root){'use strict';
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const mtof=m=>440*2**((m-69)/12);

const STYLES={
 house:{name:'House lift',buildBars:8,gapBeats:1,dropBars:16,
  build:{hp:.45,riser:.35,pitch:0,roll:'clap',rollAmt:.45,stutter:0,verb:.35,swell:.2},
  pre:{throw:.5,delaysy:8,throwLen:1,reverse:.4},
  drop:{kick:.75,bassPattern:'offbeat',bassPreset:'pal:house:5:1',bassOct:'low',bass:.6,follow:true,pump:.35,impact:.35,replaceBass:false,lift:.3,song:.9}},
 festival:{name:'Festival',buildBars:16,gapBeats:4,dropBars:16,
  build:{hp:.85,riser:.8,pitch:.8,roll:'snare',rollAmt:.85,stutter:.75,verb:.6,swell:.5},
  pre:{throw:.6,delaysy:61,throwLen:2,reverse:.8},
  drop:{kick:.9,bassPattern:'roll16',bassPreset:'pal:edm:1:1',bassOct:'low',bass:.65,follow:true,pump:.7,impact:.9,replaceBass:true,lift:.6,song:.8}},
 techno:{name:'Techno tunnel',buildBars:8,gapBeats:2,dropBars:16,
  build:{hp:.7,riser:.6,pitch:0,roll:'kick',rollAmt:.7,stutter:0,verb:.5,swell:.3},
  pre:{throw:.7,delaysy:98,throwLen:1,reverse:.3},
  drop:{kick:.95,bassPattern:'gallop',bassPreset:'pal:motor:3:1',bassOct:'low',bass:.7,follow:false,pump:.55,impact:.6,replaceBass:true,lift:.2,song:.85}},
 takeoff:{name:'Take-off',buildBars:8,gapBeats:1,dropBars:16,
  build:{hp:.65,riser:.55,pitch:.6,roll:'snare',rollAmt:.6,stutter:.5,verb:.45,swell:.35},
  pre:{throw:.45,delaysy:30,throwLen:1,reverse:.6},
  drop:{kick:.85,bassPattern:'roll16',bassPreset:'pal:edm:0:1',bassOct:'low',bass:.6,follow:false,pump:.5,impact:.7,replaceBass:true,lift:.4,song:.85}},
 ebm:{name:'EBM motor',buildBars:4,gapBeats:2,dropBars:16,
  build:{hp:.55,riser:.3,pitch:.3,roll:'snare',rollAmt:.7,stutter:.25,verb:.25,swell:.2},
  pre:{throw:.35,delaysy:179,throwLen:.5,reverse:.2},
  drop:{kick:.9,bassPattern:'invaders',bassPreset:'pal:ebm:3:1',bassOct:'low',bass:.7,follow:true,pump:.3,impact:.5,replaceBass:true,lift:.3,song:.85}}
};

// 16 steps per bar. Each entry: [step, length in steps, interval in semitones].
const PATTERNS={
 offbeat:{name:'Offbeat (house)',steps:[[2,1.6,0],[6,1.6,0],[10,1.6,0],[14,1.6,0]]},
 roll16:{name:'Rolling 16ths',steps:[1,2,3,5,6,7,9,10,11,13,14,15].map(s=>[s,.75,0])},
 gallop:{name:'Gallop (techno)',steps:[[2,.8,0],[3,.8,0],[6,.8,0],[7,.8,0],[10,.8,0],[11,.8,0],[14,.8,0],[15,.8,0]]},
 octave8:{name:'Octave motor',steps:[0,2,4,6,8,10,12,14].map((s,i)=>[s,1.5,i%2?12:0])},
 sub:{name:'Sub hold',steps:[[0,15.6,0]]},
 mono4:{name:'Monotone 1/4',steps:[[0,3.2,0],[4,3.2,0],[8,3.2,0],[12,3.2,0]]},
 invaders:{name:'Bass Invaders riff',steps:null}
};
const ROLLS={snare:'Snare roll',clap:'Clap roll',kick:'Kick roll',off:'Off'};

function defaultPlan(){return {bpm:120,offset:0,dropBar:16,mode:'replace',root:9,seed:1,...JSON.parse(JSON.stringify(STYLES.takeoff)),style:'takeoff'};}

function timeline(plan,duration){
 const beat=60/plan.bpm,bar=beat*4,D=plan.offset+plan.dropBar*bar,buildLen=plan.buildBars*bar;
 const gap=Math.min(plan.gapBeats*beat,Math.max(0,buildLen-beat)),buildSrc=D-buildLen,shift=plan.mode==='insert'?buildLen:0;
 const buildOut=plan.mode==='insert'?D:buildSrc,dropOut=D+shift,dropEndSrc=Math.min(duration,D+plan.dropBars*bar);
 return {beat,bar,D,buildSrc,buildOut,gap,gapOut:dropOut-gap,dropOut,dropEndSrc,dropEndOut:dropEndSrc+shift,shift,outDuration:duration+shift};
}
// Map an output time back to the song (for bass lookup and A/B).
function outToSrc(tl,t){if(tl.shift&&t>=tl.buildOut&&t<tl.dropOut)return tl.buildSrc+(t-tl.buildOut);return t>=tl.dropOut?t-tl.shift:t;}

function rng(seed){let s=(seed>>>0)||1;return()=>{s^=s<<13;s^=s>>>17;s^=s<<5;return(s>>>0)/4294967296;};}
function noiseBuffer(ctx,seconds=4,seed=7){const r=rng(seed),b=ctx.createBuffer(2,Math.round(ctx.sampleRate*seconds),ctx.sampleRate);for(let c=0;c<2;c++){const d=b.getChannelData(c);for(let i=0;i<d.length;i++)d[i]=r()*2-1;}return b;}
function impulse(ctx,seconds,decay,seed=3,bright=1){const r=rng(seed),sr=ctx.sampleRate,b=ctx.createBuffer(2,Math.round(sr*seconds),sr),k=Math.exp(-2*Math.PI*(bright>.5?400:900)/sr);for(let c=0;c<2;c++){const d=b.getChannelData(c);let lp=0;for(let i=0;i<d.length;i++){const n=r()*2-1;lp=k*lp+(1-k)*n;const hp=bright>.5?n-lp:lp;d[i]=hp*Math.pow(1-i/d.length,decay)*(i<sr*.004?i/(sr*.004):1);}}return b;}

// Loudness of the song around the drop: generated layers follow it, like SoundMatch in ARP.
function songLevel(buffer,t0,t1){const sr=buffer.sampleRate,a=Math.max(0,Math.floor(t0*sr)),b=Math.min(buffer.length,Math.floor(t1*sr));let s=0,n=0;for(let c=0;c<buffer.numberOfChannels;c++){const d=buffer.getChannelData(c);for(let i=a;i<b;i+=4){s+=d[i]*d[i];n++;}}return Math.sqrt(s/(n||1));}

function shaper(ctx,amount){const ws=ctx.createWaveShaper(),n=2048,c=new Float32Array(n),k=1+amount*8;for(let i=0;i<n;i++){const x=i/(n-1)*2-1;c[i]=Math.tanh(k*x)/Math.tanh(k);}ws.curve=c;ws.oversample='2x';return ws;}

// Reverse reverb "suck" into the drop, pre-rendered from the drop's first beat.
async function reverseSwell(buffer,start,length,irSeconds=2.4){
 const sr=buffer.sampleRate,len=Math.round((length+irSeconds)*sr),ctx=new OfflineAudioContext(2,len,sr),src=ctx.createBufferSource(),conv=ctx.createConvolver();
 conv.normalize=true;conv.buffer=impulse(ctx,irSeconds,2.2,11,1);src.buffer=buffer;src.connect(conv).connect(ctx.destination);src.start(0,start,length);
 const rendered=await ctx.startRendering();for(let c=0;c<2;c++)rendered.getChannelData(c).reverse();return rendered;
}

function kickVoice(ctx,dest,t,vel,noise){
 const o=ctx.createOscillator(),g=ctx.createGain();
 o.frequency.setValueAtTime(165,t);o.frequency.exponentialRampToValueAtTime(54,t+.06);o.frequency.exponentialRampToValueAtTime(43,t+.32);
 g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(vel,t+.002);g.gain.setTargetAtTime(0,t+.05,.1);
 o.connect(g).connect(dest);o.start(t);o.stop(t+.7);
 const n=ctx.createBufferSource(),hp=ctx.createBiquadFilter(),ng=ctx.createGain();n.buffer=noise;hp.type='highpass';hp.frequency.value=1800;
 ng.gain.setValueAtTime(vel*.35,t);ng.gain.setTargetAtTime(0,t+.002,.006);n.connect(hp).connect(ng).connect(dest);n.start(t,.5,.05);
}
function snareVoice(ctx,dest,t,vel,noise,type){
 const n=ctx.createBufferSource(),f=ctx.createBiquadFilter(),g=ctx.createGain();n.buffer=noise;
 if(type==='clap'){f.type='bandpass';f.frequency.value=1250;f.Q.value=1.4;g.gain.setValueAtTime(0,t);for(const d of [0,.011,.022]){g.gain.setValueAtTime(vel,t+d);g.gain.setTargetAtTime(vel*.15,t+d+.001,.004);}g.gain.setTargetAtTime(0,t+.026,.06);}
 else{f.type='highpass';f.frequency.value=900;g.gain.setValueAtTime(vel*.7,t);g.gain.setTargetAtTime(0,t+.003,.045);
  const o=ctx.createOscillator(),og=ctx.createGain();o.type='triangle';o.frequency.setValueAtTime(190,t);o.frequency.exponentialRampToValueAtTime(150,t+.05);og.gain.setValueAtTime(vel*.55,t);og.gain.setTargetAtTime(0,t+.002,.03);o.connect(og).connect(dest);o.start(t);o.stop(t+.25);}
 n.connect(f).connect(g).connect(dest);n.start(t,.1,.35);
}

// Drum hits are rendered once and mixed in JS: hundreds of live nodes make OfflineAudioContext crawl.
const shotCache=new Map();
async function oneShot(sr,type){
 const key=sr+type;if(shotCache.has(key))return shotCache.get(key);
 const c=new OfflineAudioContext(1,Math.round(sr*(type==='kick'?.7:.4)),sr),noise=noiseBuffer(c,1,type.length);
 if(type==='kick')kickVoice(c,c.destination,0,1,noise);else snareVoice(c,c.destination,0,1,noise,type);
 const d=(await c.startRendering()).getChannelData(0);let pk=0;for(const v of d)pk=Math.max(pk,Math.abs(v));if(pk)for(let i=0;i<d.length;i++)d[i]/=pk;
 shotCache.set(key,d);return d;
}
// hits: [time, velocity, playback rate]. Returns one mono buffer covering from..to.
function hitTrack(ctx,from,to,hits,sample){
 const sr=ctx.sampleRate,len=Math.max(1,Math.round((to-from)*sr)),buf=ctx.createBuffer(1,len,sr),out=buf.getChannelData(0);
 for(const [t,vel,rate=1] of hits){const start=(t-from)*sr,first=Math.max(0,Math.ceil(start));
  for(let i=first;i<len;i++){const pos=(i-start)*rate,k=Math.floor(pos);if(k>=sample.length-1)break;const f=pos-k;out[i]+=vel*(sample[k]*(1-f)+sample[k+1]*f);}}
 return buf;
}
// Bass Invaders' 2000 factory sounds, in the same order as the app's browser.
function bassCatalog(){const K=root.KroghBass;return K?K.catalog().filter(p=>p.id.startsWith('pal:')||p.id.startsWith('pal2:')||p.id.startsWith('sample:')):[];}
// The bass riff of a factory sound: the sound's own seed and genre through Bass Invaders' phrase generator. Returns [beat, length, interval, velocity, accent, slideIn, slideOut] over 8 bars.
function invadersRiff(id,bpm){
 const list=bassCatalog(),entry=list.find(p=>p.id===id),genre=entry?.genre||'house',seed=root.BassFactory?.entries(list).find(e=>e.sound===id)?.seed??810001,knobs=root.BassInvadersHost.phraseKnobs();
 const notes=root.BassPatterns.generate({...knobs,genre,riffMode:'auto',seed,bars:8,phraseBars:4});
 return root.BassPatterns.events(notes,{bpm,rootMidi:60,gate:knobs.gate,swing:knobs.swing,rootMap:[0,0],phraseBars:4}).map(e=>[e.time*bpm/60,e.duration*bpm/60,e.pitch-60,e.velocity/127,e.accent,e.slideIn,e.slideOut]);
}
// One Bass Invaders voice through the app's own graph (filter 2, dark echo, 3D space, compressor) and level calibration.
async function invadersBass(ctx,dest,id,settings,notes){
 const H=root.BassInvadersHost,graph=H.makeGraph(ctx,dest,settings),engine=root.KroghBass.create(ctx,graph.input,{preset:id});
 await engine.ready();H.applySound(engine,settings);if(typeof root.balanceSound==='function')await root.balanceSound(engine,structuredClone(settings));
 for(const n of notes)engine.play(n);
 return engine;
}

// Look-ahead peak limiter, only between a and b (seconds into the buffer): the rest of the song stays bit-identical.
function limit(buffer,a,b,ceiling=.944){
 const sr=buffer.sampleRate,n=buffer.length,i0=Math.max(0,Math.floor(a*sr)),i1=Math.min(n,Math.ceil(b*sr)),ch=[0,1].map(c=>buffer.getChannelData(Math.min(c,buffer.numberOfChannels-1)));
 let peak=0;for(const d of ch)for(let i=0;i<n;i++){const v=Math.abs(d[i]);if(v>peak)peak=v;}
 if(i1<=i0)return {peak,reduction:1};
 const g=new Float32Array(i1-i0),rel=1-Math.exp(-1/(.12*sr)),att=1-Math.exp(-1/(.004*sr));let last=1,min=1;
 for(let i=i0;i<i1;i++){const v=Math.max(Math.abs(ch[0][i]),Math.abs(ch[1][i])),want=v>ceiling?ceiling/v:1;last=Math.min(want,last+(1-last)*rel);g[i-i0]=last;}
 // Backwards pass: start turning down a few ms before each peak; end at unity so the edges are seamless.
 let next=1;for(let i=g.length-1;i>=0;i--){next=Math.min(g[i],next+(1-next)*att);g[i]=next;if(next<min)min=next;}
 if(min<1)for(const d of ch)for(let i=i0;i<i1;i++)d[i]*=g[i-i0];
 let after=0;for(const d of ch)for(let i=0;i<n;i++){const v=Math.abs(d[i]);if(v>after)after=v;}
 return {peak:after,reduction:min};
}

// DELAYSY renders the throw on its own (wet only), then gets DELAYSY's auto-level law: weighted energy of the
// echoes matched to the clip they came from, 6 dB under it. Reverse presets can start before the clip, hence the lead.
async function delaysyThrow(buffer,start,len,index,bpm){
 const D=root.Delaysy,preset=D.presets[index]||D.presets[0],q=preset.p,sr=buffer.sampleRate,beat=60/bpm,lead=1.5,tail=Math.min(14,q.reps*q.division*beat*1.2+3.5);
 const ctx=new OfflineAudioContext(2,Math.round((lead+len+tail)*sr),sr),clip=ctx.createBuffer(2,Math.max(1,Math.round(len*sr)),sr),a0=Math.round(start*sr),edge=Math.round(.004*sr);
 for(let c=0;c<2;c++){const d=clip.getChannelData(c),s=buffer.getChannelData(Math.min(c,buffer.numberOfChannels-1));for(let i=0;i<d.length;i++)d[i]=(s[a0+i]||0)*Math.min(1,i/edge,(d.length-1-i)/edge);}
 const eng=D.create(ctx,q,{bpm,dryLevel:0});eng.settle();eng.note(clip,lead);
 const out=await ctx.startRendering(),wet=[0,1].map(c=>out.getChannelData(c));let first=-1,last=-1;
 for(let i=0;i<out.length;i++)if(Math.abs(wet[0][i])>1e-4||Math.abs(wet[1][i])>1e-4){if(first<0)first=i;last=i;}
 const Ec=(D.weightedEnergy(clip.getChannelData(0),sr)+D.weightedEnergy(clip.getChannelData(1),sr))/2,Ew=first<0?0:(D.weightedEnergy(wet[0].subarray(first,last+1),sr)+D.weightedEnergy(wet[1].subarray(first,last+1),sr))/2;
 return {buffer:out,lead,gain:Ew>1e-12&&Ec>1e-12?clamp(Math.sqrt(Ec/Ew)*.5,.12,16):1,preset:preset.name};
}

/* Render the plan. opts: {from,to,original:true,layers:true,lookupBass}. Returns {buffer,tl,events,peak,reduction,from,to}. */
async function render(buffer,plan,opts={}){
 const duration=buffer.duration,tl=timeline(plan,duration),sr=buffer.sampleRate,from=Math.max(0,opts.from??0),to=Math.min(tl.outDuration,opts.to??tl.outDuration);
 const withOriginal=opts.original!==false,withLayers=opts.layers!==false,B=plan.build,P=plan.pre,Dp=plan.drop,beat=tl.beat,bar=tl.bar;
 const swell=withOriginal&&P.reverse>0&&withLayers?await reverseSwell(buffer,tl.D,Math.min(beat,duration-tl.D),2.4):null;
 const ctx=new OfflineAudioContext(2,Math.max(1,Math.round((to-from)*sr)),sr),T=t=>Math.max(0,t-from),noise=noiseBuffer(ctx),events={bass:[],kick:[],roll:[]};
 const r=rng(plan.seed||1);

 // Buses.
 const master=ctx.createGain();master.connect(ctx.destination);
 const verb=ctx.createConvolver();verb.normalize=true;verb.buffer=impulse(ctx,2.8,2.6,5,1);const verbOut=ctx.createGain();verbOut.gain.value=.45;verb.connect(verbOut).connect(master);
 const level=songLevel(buffer,tl.D,Math.min(duration,tl.D+4*bar)),scale=clamp(level/.35,.25,1.2),layerGain=ctx.createGain();layerGain.connect(master);
 const pump=ctx.createGain();pump.connect(master);
 const fade=.006,BASS_TRIM=3,THROW_TRIM=1;

 // Original song, cut into plain / build / drop segments with short crossfades.
 const buildIn=ctx.createGain(),hp=ctx.createBiquadFilter(),swellG=ctx.createGain(),buildVerb=ctx.createGain();
 hp.type='highpass';buildIn.connect(hp).connect(swellG).connect(master);hp.connect(buildVerb).connect(verb);
 const hpEnd=20*2**(B.hp*6.6),bStart=tl.buildOut,bEnd=tl.gapOut;
 hp.frequency.setValueAtTime(20,0);hp.Q.setValueAtTime(.7,0);hp.frequency.setValueAtTime(20,T(bStart));hp.frequency.exponentialRampToValueAtTime(Math.max(21,hpEnd),T(bEnd));hp.Q.setValueAtTime(.7,T(bStart));hp.Q.linearRampToValueAtTime(.7+B.hp*2.5,T(bEnd));
 // The dry level gives way to the reverb wash, so the build grows without eating the master's headroom.
 swellG.gain.setValueAtTime(1,T(bStart));swellG.gain.linearRampToValueAtTime((1+B.swell*.3)/(1+B.verb*.9),T(bEnd));
 buildVerb.gain.setValueAtTime(0,T(bStart));buildVerb.gain.linearRampToValueAtTime(B.verb*.9,T(bEnd));

 const dropIn=ctx.createGain(),lift=ctx.createBiquadFilter();dropIn.gain.value=Dp.song;lift.type='highshelf';lift.frequency.value=5500;lift.gain.value=Dp.lift*4;
 let dropHead=dropIn;if(Dp.replaceBass){for(let i=0;i<2;i++){const f=ctx.createBiquadFilter();f.type='highpass';f.frequency.value=115;f.Q.value=.6;dropHead.connect(f);dropHead=f;}}
 dropHead.connect(lift).connect(pump);

 // preroll: feed the filters silently first, so a high-pass does not overshoot when it starts on heavy sub bass.
 const play=(src0,src1,out0,dest,fadeIn=true,fadeOut=true,gain=1,preroll=0)=>{
  if(!withOriginal||src1-src0<.002)return;const out1=out0+(src1-src0),a=out0-(fadeIn?fade:0),b=out1+(fadeOut?fade:0);if(b<from||a>to)return;
  const s=ctx.createBufferSource(),g=ctx.createGain();s.buffer=buffer;s.connect(g).connect(dest);
  const pre=Math.min(preroll,src0-(out0-a)),start=a-Math.max(0,pre),when=start-from,offset=src0-(out0-start);if(when>=0)s.start(when,Math.max(0,offset));else s.start(0,Math.max(0,offset-when));s.stop(Math.max(0,b-from)+.01);
  if(pre>0)g.gain.setValueAtTime(0,T(start));g.gain.setValueAtTime(fadeIn?0:gain,T(a));if(fadeIn)g.gain.linearRampToValueAtTime(gain,T(out0+fade));if(fadeOut){g.gain.setValueAtTime(gain,T(out1-fade));g.gain.linearRampToValueAtTime(0,T(b));}
 };
 const stutterBeats=Math.round(B.stutter*4),stutterLen=Math.min(stutterBeats*beat,(bEnd-bStart)*.5),stutterOut=bEnd-stutterLen;
 if(plan.mode==='insert')play(0,tl.D,0,master,false,true);else play(0,tl.buildSrc,0,master,false,true);
 play(tl.buildSrc,tl.buildSrc+(stutterOut-bStart),bStart,buildIn,true,true,1,.25);
 if(stutterLen>0){
  // Each beat repeats the first slice faster: 1/4, 1/8, 1/16, 1/32 (the last beats of the build).
  const divs=[1,2,4,8].slice(-Math.round(stutterLen/beat)),slice0=tl.buildSrc+(stutterOut-bStart);let t=stutterOut;
  for(const d of divs){const len=beat/d;for(let k=0;k<d;k++){play(slice0,slice0+len-.003,t,buildIn,true,true,.85+.15*(k/d));t+=len;}}
 }
 play(tl.D,tl.dropEndSrc,tl.dropOut,dropIn,true,true,1,plan.mode==='insert'?0:.25);
 if(tl.dropEndSrc<duration)play(tl.dropEndSrc,duration,tl.dropEndOut,master,true,false);

 // Pump (sidechain feel) on the drop segment and the bass.
 pump.gain.setValueAtTime(1,0);
 if(Dp.pump>0){for(let t=tl.dropOut;t<tl.dropEndOut-1e-6;t+=beat){if(t<from-beat||t>to)continue;pump.gain.setTargetAtTime(1-Dp.pump*.85,T(t),.003);pump.gain.setTargetAtTime(1,T(t+.03),beat*.17);}pump.gain.setTargetAtTime(1,T(tl.dropEndOut),.02);}

 if(withLayers){
  const rootAt=t=>{const pc=Dp.follow&&opts.lookupBass?opts.lookupBass(t):null;return pc==null?plan.root:pc;};
  const toBass=pc=>28+((pc-4+12)%12); // E1..D#2 for the drop; Bass Invaders voices carry the harmonics that small speakers need.

  // Roll: accelerating hits through a rising high-pass, pitched up to +7 semitones.
  if(B.roll!=='off'&&B.rollAmt>0){
   const src=ctx.createBufferSource(),g=ctx.createGain(),rhp=ctx.createBiquadFilter(),send=ctx.createGain(),kick=B.roll==='kick',hits=[];rhp.type='highpass';rhp.frequency.setValueAtTime(kick?30:250,T(bStart));rhp.frequency.exponentialRampToValueAtTime(kick?400:1600,T(bEnd));
   g.gain.value=B.rollAmt*(kick?.45:.4)*scale;g.connect(rhp).connect(layerGain);rhp.connect(send).connect(verb);send.gain.value=.25;
   const len=bEnd-bStart;let t=bStart;
   while(t<bEnd-1e-4){const p=(t-bStart)/len,div=p<.5?1:p<.75?2:p<.875?4:8,vel=.25+.75*p**1.4;hits.push([t,vel,kick?1:2**(p*7/12)]);events.roll.push([t,beat/div*.5,kick?36:38,vel]);t+=beat/div;}
   src.buffer=hitTrack(ctx,from,to,hits,await oneShot(sr,kick?'kick':B.roll));src.connect(g);src.start(0);
  }
  // Noise riser.
  if(B.riser>0){
   const s=ctx.createBufferSource(),bp=ctx.createBiquadFilter(),h=ctx.createBiquadFilter(),g=ctx.createGain(),send=ctx.createGain();s.buffer=noise;s.loop=true;bp.type='bandpass';bp.Q.value=.9;h.type='highpass';h.frequency.value=200;
   bp.frequency.setValueAtTime(300,T(bStart));bp.frequency.exponentialRampToValueAtTime(9000,T(bEnd));g.gain.setValueAtTime(.0001,T(bStart));g.gain.exponentialRampToValueAtTime(B.riser*.8*scale,T(bEnd));g.gain.linearRampToValueAtTime(0,T(bEnd+.03));
   s.connect(bp).connect(h).connect(g).connect(layerGain);g.connect(send).connect(verb);send.gain.value=.4;s.start(T(bStart));s.stop(T(bEnd+.06)+.01);
  }
  // Pitch riser in the song's key.
  if(B.pitch>0){
   const pc=rootAt(Math.max(0,tl.D)),f0=mtof(48+pc),st=B.pitch>.6?24:12,lp=ctx.createBiquadFilter(),g=ctx.createGain();lp.type='lowpass';
   lp.frequency.setValueAtTime(500,T(bStart));lp.frequency.exponentialRampToValueAtTime(7000,T(bEnd));g.gain.setValueAtTime(.0001,T(bStart));g.gain.exponentialRampToValueAtTime(B.pitch*.38*scale,T(bEnd));g.gain.linearRampToValueAtTime(0,T(bEnd+.02));
   lp.connect(g).connect(layerGain);g.connect(verb);
   for(const [type,det,mul,lv] of [['sawtooth',-11,1,.5],['sawtooth',11,1,.5],['square',0,2,.25]]){const o=ctx.createOscillator(),og=ctx.createGain();o.type=type;o.detune.value=det;og.gain.value=lv;o.frequency.setValueAtTime(f0*mul,T(bStart));o.frequency.exponentialRampToValueAtTime(f0*mul*2**(st/12),T(bEnd));o.connect(og).connect(lp);o.start(T(bStart));o.stop(T(bEnd+.05)+.01);}
  }
  // Pre-drop: the last beat(s) of the build thrown into DELAYSY, echoes only, ringing through the gap.
  if(P.throw>0&&withOriginal&&root.Delaysy){
   const len=Math.min(P.throwLen*beat,bEnd-bStart),t0=bEnd-len;
   if(t0>=from-8&&t0<=to){
    const W=await delaysyThrow(buffer,tl.buildSrc+(bEnd-bStart)-len,len,P.delaysy,plan.bpm),s=ctx.createBufferSource(),out=ctx.createGain(),start=t0-W.lead;
    out.gain.setValueAtTime(P.throw*W.gain*THROW_TRIM,0);out.gain.setValueAtTime(P.throw*W.gain*THROW_TRIM,T(tl.dropOut));out.gain.setTargetAtTime(P.throw*W.gain*THROW_TRIM*.3,T(tl.dropOut),beat*.5);
    s.buffer=W.buffer;s.connect(out).connect(master);if(start>=from)s.start(start-from);else s.start(0,from-start);
   }
  }
  if(swell){const s=ctx.createBufferSource(),g=ctx.createGain(),len=clamp(Math.max(tl.gap,2*beat),.2,swell.duration-.05),a=tl.dropOut-len;s.buffer=swell;g.gain.setValueAtTime(0,T(a));g.gain.linearRampToValueAtTime(P.reverse*.9,T(tl.dropOut-.01));g.gain.linearRampToValueAtTime(0,T(tl.dropOut+.004));s.connect(g).connect(layerGain);if(a>=from)s.start(a-from,swell.duration-len);else s.start(0,swell.duration-len+(from-a));s.stop(T(tl.dropOut)+.02);}

  // Drop: impact, kick, bass.
  if(Dp.impact>0&&tl.dropOut>=from&&tl.dropOut<=to){
   const t=T(tl.dropOut),o=ctx.createOscillator(),g=ctx.createGain();o.frequency.setValueAtTime(82,t);o.frequency.exponentialRampToValueAtTime(36,t+1.2);g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(Dp.impact*.85*scale,t+.004);g.gain.setTargetAtTime(0,t+.02,.45);o.connect(g).connect(layerGain);o.start(t);o.stop(t+3);
   const n=ctx.createBufferSource(),h=ctx.createBiquadFilter(),ng=ctx.createGain();n.buffer=noise;h.type='highpass';h.frequency.value=4200;ng.gain.setValueAtTime(Dp.impact*.3*scale,t);ng.gain.setTargetAtTime(0,t+.01,.8);n.connect(h).connect(ng).connect(layerGain);ng.connect(verb);n.start(t,0,3.9);
  }
  if(Dp.kick>0){
   const src=ctx.createBufferSource(),g=ctx.createGain(),sh=shaper(ctx,.25),hits=[];g.gain.value=Dp.kick*.42*scale;
   for(let t=tl.dropOut;t<tl.dropEndOut-1e-6;t+=beat){events.kick.push([t,beat*.25,36,Dp.kick]);hits.push([t,1,1]);}
   src.buffer=hitTrack(ctx,from,to,hits,await oneShot(sr,'kick'));src.connect(sh).connect(g).connect(layerGain);src.start(0);
  }
  if(Dp.bass>0){
   const bus=ctx.createGain(),notes=[],step=beat/4,lift=Dp.bassOct==='mid'?12:0,base=toBass(rootAt(tl.D))+lift;
   // The bass sits behind the pump, scaled to the song like the other layers.
   bus.gain.value=Dp.bass*BASS_TRIM*scale;bus.connect(pump);
   const add=(t,dur,interval,vel,accent,slideIn=false,slideOut=false)=>{if(t>=tl.dropEndOut-1e-6)return;const midi=toBass(rootAt(outToSrc(tl,t)+.02))+lift+interval;dur=Math.min(dur,tl.dropEndOut-t);events.bass.push([t,dur,midi,vel]);if(t>=from&&t<=to)notes.push({midi,time:t-from,duration:dur,velocity:Math.round(clamp(vel,.05,1)*127),accent,slideIn,slideOut});};
   if(Dp.bassPattern==='invaders'&&root.BassPatterns){const riff=invadersRiff(Dp.bassPreset,plan.bpm);for(let loop=0;loop*8<plan.dropBars;loop++)for(const [b0,len,iv,vel,acc,si,so] of riff)add(tl.dropOut+(loop*32+b0)*beat,len*beat,iv,vel,acc,si,so);}
   else{const pat=PATTERNS[Dp.bassPattern]||PATTERNS.offbeat;for(let b=0;b<plan.dropBars;b++)for(const [s,len,iv] of pat.steps){let interval=iv;if(Dp.bassPattern==='octave8'&&b%8===7&&s===14)interval=7;add(tl.dropOut+(b*16+s)*step,len*step,interval,.72+.16*(s%4===2?1:0)+.04*(r()-.5),s%4===2);}}
   if(root.KroghBass&&root.BassInvadersHost&&notes.length){const pc=rootAt(tl.D);await invadersBass(ctx,bus,Dp.bassPreset,root.BassInvadersHost.settingsFor(Dp.bassPreset,{bpm:plan.bpm,root:pc,octave:base-pc}),notes);}
  }
 }
 const out=await ctx.startRendering(),lim=opts.limit===false?{peak:1,reduction:1}:limit(out,T(bStart-fade),T(tl.dropEndOut+1.5));
 return {buffer:out,tl,events,peak:lim.peak,reduction:lim.reduction,from,to};
}

// Whole song: only the build/drop region is rendered; the rest is copied sample for sample from the original.
async function renderSong(buffer,plan,opts={}){
 const tl=timeline(plan,buffer.duration),sr=buffer.sampleRate,len=Math.round(tl.outDuration*sr),ia=Math.max(0,Math.round((tl.buildOut-tl.bar)*sr)),ib=Math.min(len,Math.round((tl.dropEndOut+6)*sr));
 const r=await render(buffer,plan,{...opts,from:ia/sr,to:ib/sr}),out=new AudioBuffer({numberOfChannels:2,length:len,sampleRate:sr}),shift=Math.round(tl.shift*sr),original=opts.original!==false;
 for(let c=0;c<2;c++){const dst=out.getChannelData(c),src=buffer.getChannelData(Math.min(c,buffer.numberOfChannels-1)),part=r.buffer.getChannelData(c).subarray(0,len-ia),end=ia+part.length;
  if(original){dst.set(src.subarray(0,ia),0);if(end<len)dst.set(src.subarray(end-shift,end-shift+(len-end)),end);}
  dst.set(part,ia);}
 return {...r,buffer:out,from:0,to:tl.outDuration};
}

// Variation inside a random style, like the Randomize buttons in the other Krogh apps.
function randomize(plan,seed){
 const r=rng(seed),pick=a=>a[Math.floor(r()*a.length)],j=(v,a=.25)=>clamp(v+(r()*2-1)*a,0,1),base=JSON.parse(JSON.stringify(STYLES[pick(Object.keys(STYLES))]));
 const p={...plan,...base,seed,style:'random'};delete p.name;
 for(const k of ['hp','riser','pitch','rollAmt','verb','swell'])p.build[k]=j(p.build[k]);p.build.stutter=pick([0,0,.25,.5,.75,1]);p.build.roll=pick(['snare','snare','clap','kick']);
 p.pre.throw=j(p.pre.throw);p.pre.reverse=j(p.pre.reverse);p.pre.throwLen=pick([.5,1,1,2]);p.gapBeats=pick([0,1,1,2,4]);
 if(root.Delaysy)p.pre.delaysy=Math.floor(r()*root.Delaysy.presets.length);
 p.drop.bassPattern=pick(Object.keys(PATTERNS));const sounds=bassCatalog();if(sounds.length)p.drop.bassPreset=pick(sounds).id;for(const k of ['pump','impact','lift'])p.drop[k]=j(p.drop[k]);
 return p;
}

// Standard MIDI file (format 1, 480 ppq): Bass, Kick, Roll. Positions from the rendered song's time zero.
function midi(events,bpm){
 const ppq=480,tick=t=>Math.max(0,Math.round(t*bpm/60*ppq)),vlq=n=>{const b=[n&127];while(n>>=7)b.unshift((n&127)|128);return b;},str=s=>[...s].map(c=>c.charCodeAt(0)&127);
 const chunk=(id,data)=>[...str(id),(data.length>>>24)&255,(data.length>>>16)&255,(data.length>>>8)&255,data.length&255,...data];
 const track=(name,list,ch)=>{const ev=[];for(const [t,d,n,v] of list){const vel=clamp(Math.round(v*110),1,127);ev.push([tick(t),0x90|ch,n,vel],[tick(t+d),0x80|ch,n,0]);}ev.sort((a,b)=>a[0]-b[0]||(a[1]&0xf0)-(b[1]&0xf0));let last=0;const data=[0,0xff,3,name.length,...str(name)];for(const [t,s,n,v] of ev){data.push(...vlq(t-last),s,n,v);last=t;}data.push(0,0xff,0x2f,0);return chunk('MTrk',data);};
 const us=Math.round(60e6/bpm),tempoTrack=chunk('MTrk',[0,0xff,0x51,3,(us>>16)&255,(us>>8)&255,us&255,0,0xff,0x58,4,4,2,24,8,0,0xff,0x2f,0]);
 return new Uint8Array([...chunk('MThd',[0,1,0,4,ppq>>8,ppq&255]),...tempoTrack,...track('Dropfather Bass',events.bass,0),...track('Dropfather Kick',events.kick,9),...track('Dropfather Roll',events.roll,9)]);
}

function wav(buffer,t0=0,t1=buffer.duration){
 const sr=buffer.sampleRate,a=Math.max(0,Math.round(t0*sr)),b=Math.min(buffer.length,Math.round(t1*sr)),n=b-a,ch=buffer.numberOfChannels,bytes=3,size=44+n*ch*bytes,out=new DataView(new ArrayBuffer(size)),w=(o,s)=>{for(let i=0;i<s.length;i++)out.setUint8(o+i,s.charCodeAt(i));};
 w(0,'RIFF');out.setUint32(4,size-8,true);w(8,'WAVE');w(12,'fmt ');out.setUint32(16,16,true);out.setUint16(20,1,true);out.setUint16(22,ch,true);out.setUint32(24,sr,true);out.setUint32(28,sr*ch*bytes,true);out.setUint16(32,ch*bytes,true);out.setUint16(34,24,true);w(36,'data');out.setUint32(40,n*ch*bytes,true);
 const data=Array.from({length:ch},(_,c)=>buffer.getChannelData(c));let o=44;
 for(let i=a;i<b;i++)for(let c=0;c<ch;c++){const v=Math.round(clamp(data[c][i],-1,1)*8388607);out.setUint8(o,v&255);out.setUint8(o+1,(v>>8)&255);out.setUint8(o+2,(v>>16)&255);o+=3;}
 return new Uint8Array(out.buffer);
}

const api={STYLES,PATTERNS,ROLLS,bassCatalog,defaultPlan,timeline,outToSrc,render,renderSong,randomize,midi,wav};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.DropDSP=api;
})(typeof globalThis!=='undefined'?globalThis:this);
