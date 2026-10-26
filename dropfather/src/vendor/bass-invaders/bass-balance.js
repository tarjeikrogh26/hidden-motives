'use strict';
// Measure a fixed reference phrase silently, then apply ONE constant gain to the whole patch.
// The sound's velocity response, accents, transient shape and release remain unchanged.
const levelCache=new Map();
async function balanceSound(target,settings){
 if(!target?.setLevel)return;
 const {preset,sound,osc,slope,filterType,toneGuard,bpm,root,octave}=settings;
 const key=JSON.stringify({preset,sound,osc,slope,filterType,toneGuard,bpm,root,octave});
 if(!levelCache.has(key)){
  const pending=(async()=>{
   const rate=24000,seconds=2.8,c=new OfflineAudioContext(4,rate*seconds,rate),merge=c.createChannelMerger(4),sink=c.createGain(),split=c.createChannelSplitter(2),hp=c.createBiquadFilter(),shelf=c.createBiquadFilter(),weighted=c.createChannelSplitter(2);
   merge.connect(c.destination);sink.connect(split);split.connect(merge,0,0);split.connect(merge,1,1);
   hp.type='highpass';hp.frequency.value=35;hp.Q.value=.5;shelf.type='highshelf';shelf.frequency.value=700;shelf.gain.value=4;sink.connect(hp);hp.connect(shelf);shelf.connect(weighted);weighted.connect(merge,0,2);weighted.connect(merge,1,3);
   const calibration={...settings,volume:65},g=makeGraph(c,sink,calibration);g.compressor.ratio.value=1;
   const v=KroghBass.create(c,g.input,{preset,levelCalibration:true});
   try{
    await v.ready();applySound(v,calibration);
    for(const [time,offset,duration]of [[0,0,.18],[.33,0,.32],[.8,7,.14],[1.05,0,.26],[1.45,3,.18],[1.8,0,.38]])v.play({time:time+.05,midi:octave+root+offset,duration,velocity:100});
    const b=await c.startRendering();let energy=0,peak=0;
    for(let ch=0;ch<4;ch++){const a=b.getChannelData(ch);for(const x of a){if(!Number.isFinite(x))throw Error('Invalid calibration signal');if(ch<2)peak=Math.max(peak,Math.abs(x));else energy+=x*x;}}
    const rms=Math.sqrt(energy/(2*b.length));if(rms<1e-7)throw Error('Silent calibration signal');
    return Math.min(64,.045/rms,.28/Math.max(peak,1e-7));
   }finally{v.dispose();}
  })();
  levelCache.set(key,pending);pending.catch(()=>levelCache.delete(key));
  if(levelCache.size>96)levelCache.delete(levelCache.keys().next().value);
 }
 try{target.setLevel(await levelCache.get(key));}catch(e){console.warn('Preset level calibration unavailable; using measured preset trim.',e.message);}
}
