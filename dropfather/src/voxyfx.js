/* VOXY MUSIC on Dropfather's audio tracks (Tarjei Krogh's vocal engine, src/vendor/voxy*.js): a track's audio
   goes through VOXY's own graph, as its app builds it (worklet, HRTF doubles, Second Voice, effect space, EQ,
   rooms, limiter and ceiling), offline, in the song's tempo and key. The 32 ms reference delay is removed and
   the level matched to the dry track. Results are kept while the track and settings stay the same. */
(function(root){'use strict';
const V=()=>root.VOXY;let url=null;const mods=new WeakMap(),cache=new Map();
function addModule(ctx){
 if(!mods.has(ctx)){const code=root.document.getElementById('voxyWorklet').textContent;url=url||URL.createObjectURL(new Blob([code],{type:'application/javascript'}));
  mods.set(ctx,ctx.audioWorklet.addModule(url).catch(()=>ctx.audioWorklet.addModule('data:application/javascript;base64,'+btoa(unescape(encodeURIComponent(code))))));}
 return mods.get(ctx);
}
const list=()=>(V()?.presets||[]).map(p=>({id:p.id,name:p.name,group:p.group,description:p.description}));
// VOXY's values() and update() for one preset, in the song's tempo and key.
function settings(id,{bpm,key,scale}){
 const pr=V().presets.find(p=>p.id===id)||V().presets[0],p={...V().defaults,...pr.settings,bpm:Math.round(bpm||112),key:key||0,scale:scale==='major'?'major':'minor'};
 const es={...(V().effects[+p.effectPreset||0]||{}),reps:Math.max(1,Math.min(8,+p.effectRepeats||1)),division:+p.division,decay:.1+.9*p.tail/100};
 const msg={...p,effectSettings:es,active:true};for(const k of ['robot','clarity','harmony','width','delay','tail','warmth','fillLevel','speechLevel','bypassLevel','natural','vocoder'])msg[k]/=100;msg.key=+p.key;msg.division=+p.division;msg.bpm=Math.min(200,Math.max(50,p.bpm));
 return {p,es,msg};
}
async function render(buffer,id,opt){
 const {p,es,msg}=settings(id,opt),sr=buffer.sampleRate,ctx=new OfflineAudioContext(2,buffer.length+Math.round(4*sr),sr);await addModule(ctx);
 const {StereoVocals,EffectSpace}=V(),input=ctx.createGain(),engine=new AudioWorkletNode(ctx,'voxy-processor',{numberOfInputs:3,numberOfOutputs:3,outputChannelCount:[2,1,4],processorOptions:msg});input.connect(engine);
 const eqLow=ctx.createBiquadFilter(),eqPresence=ctx.createBiquadFilter(),eqHigh=ctx.createBiquadFilter();eqLow.type='lowshelf';eqLow.frequency.value=320;eqPresence.type='peaking';eqPresence.Q.value=.5;eqHigh.type='highshelf';eqHigh.frequency.value=3100;
 const stereo=new StereoVocals(ctx);await stereo.calibrate();const second=new StereoVocals(ctx);await second.calibrate();engine.connect(second.input,1,0);const space=new EffectSpace(ctx);engine.connect(space.input,2,0);input.connect(stereo.input);
 const ref=ctx.createDelay(.1);ref.delayTime.value=stereo.latency;engine.connect(ref).connect(eqLow).connect(eqPresence).connect(eqHigh);
 const dry=ctx.createGain(),wet=ctx.createGain(),master=ctx.createGain(),lim=ctx.createDynamicsCompressor();lim.threshold.value=-8;lim.knee.value=10;lim.ratio.value=6;lim.attack.value=.004;lim.release.value=.17;
 const dryRef=ctx.createDelay(.1);dryRef.delayTime.value=stereo.latency;input.connect(dryRef).connect(dry).connect(lim);stereo.sides.connect(lim);second.sides.connect(lim);
 const effectGain=ctx.createGain();space.output.connect(effectGain).connect(lim);eqHigh.connect(wet).connect(lim);
 const conv=ctx.createConvolver(),n=Math.ceil(sr*1.7),ir=ctx.createBuffer(2,n,sr);let seed=123456;for(let c=0;c<2;c++){const a=ir.getChannelData(c);for(let i=0;i<n;i++){seed=(1664525*seed+1013904223)>>>0;const t=i/sr;a[i]=((seed/4294967296)*2-1)*Math.exp(-t*4.2)*(i>sr*.025?1:0);}}conv.buffer=ir;
 const effectConv=ctx.createConvolver();effectConv.buffer=ir;const effectRoom=ctx.createGain();space.output.connect(effectConv).connect(effectRoom).connect(lim);const roomReturn=ctx.createGain();eqHigh.connect(conv).connect(roomReturn).connect(lim);
 const ceiling=ctx.createWaveShaper(),curve=new Float32Array(4097);for(let i=0;i<curve.length;i++){const x=i*2/(curve.length-1)-1,a=Math.abs(x);curve[i]=Math.sign(x)*(a<=.88?a:.88+.06*(1-Math.exp(-(a-.88)/.06)));}ceiling.curve=curve;ceiling.oversample='2x';lim.connect(master).connect(ceiling).connect(ctx.destination);
 const lift=p.elevator/100,mix=p.mix/100;eqLow.gain.value=-lift*6;eqHigh.gain.value=lift*7;eqPresence.frequency.value=900*Math.pow(4,lift);eqPresence.gain.value=Math.abs(lift)*3;
 dry.gain.value=(1-mix)*p.natural/100;wet.gain.value=mix;roomReturn.gain.value=p.room/100*.38*mix;stereo.configure(p.width/100*p.natural/100,p.timing,p.spread,mix,false);second.configure(p.harmony/100*.8,4,p.secondSpread,mix,false);
 effectGain.gain.value=mix;effectRoom.gain.value=mix*Math.min(.65,(es.room||0)+(es.roomGrowth||0)*.12);space.configure(es);master.gain.value=Math.pow(10,p.output/20);
 const src=ctx.createBufferSource();src.buffer=buffer;src.connect(input);src.start(0);
 const out=await ctx.startRendering(),lat=Math.round(stereo.latency*sr),len=buffer.length+Math.round(3.5*sr),res=new AudioBuffer({numberOfChannels:2,length:len,sampleRate:sr});
 for(let c=0;c<2;c++)res.copyToChannel(out.getChannelData(c).subarray(lat,lat+len),c);
 const rms=b=>{let s=0,k=0;for(let c=0;c<Math.min(2,b.numberOfChannels);c++){const d=b.getChannelData(c);for(let i=0;i<d.length;i+=4){s+=d[i]*d[i];k++;}}return Math.sqrt(s/Math.max(1,k));};
 const g=Math.min(4,rms(buffer)/Math.max(1e-6,rms(res))*Math.sqrt(buffer.length/len));for(let c=0;c<2;c++){const d=res.getChannelData(c);for(let i=0;i<d.length;i++)d[i]*=g;}
 return res;
}
// A track buffer through VOXY: only the part with audio (clips' extent, in seconds) is processed, with its tail.
async function apply(trackBuffer,id,opt,from,to){
 const sr=trackBuffer.sampleRate,a=Math.max(0,Math.floor(from*sr)),b=Math.min(trackBuffer.length,Math.ceil(to*sr));if(b<=a)return trackBuffer;
 const key=[id,opt.bpm,opt.key,opt.scale,opt.sig].join('|');let wet=cache.get(key);
 if(!wet){const part=new AudioBuffer({numberOfChannels:2,length:b-a,sampleRate:sr});for(let c=0;c<2;c++)part.copyToChannel(trackBuffer.getChannelData(Math.min(c,trackBuffer.numberOfChannels-1)).subarray(a,b),c);wet=await render(part,id,opt);cache.set(key,wet);if(cache.size>12)cache.delete(cache.keys().next().value);}
 const out=new AudioBuffer({numberOfChannels:2,length:trackBuffer.length,sampleRate:sr});for(let c=0;c<2;c++){const d=out.getChannelData(c),w=wet.getChannelData(c);for(let i=0;i<w.length&&a+i<d.length;i++)d[a+i]=w[i];}
 return out;
}
const api={list,apply};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.VoxyFX=api;
})(typeof globalThis!=='undefined'?globalThis:this);
