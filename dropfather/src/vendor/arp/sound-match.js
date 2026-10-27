/* Match instrument timbre, not the arrangement's pauses or the user's volume fader.
   A short, fixed monophonic phrase is rendered locally for every new sound setting. */
(function(root){'use strict';
const cache=new Map(),pending=new Map();
async function measure(P,which,sampleRate=44100){
 // Measure timbre with a fixed envelope: ADSR must never trigger compensating gain.
 P={...P,attack:1,ampDecay:26,sustain:65,release:0,envelopeVersion:2};
 const key=JSON.stringify([P,which,sampleRate]);if(cache.has(key))return cache.get(key);if(pending.has(key))return pending.get(key);
 const task=(async()=>{const ctx=new OfflineAudioContext(1,Math.ceil(sampleRate*.65),sampleRate);await NBVoice.prepare(ctx);const pool=new VoiceOutput(ctx,ctx.destination);
  for(let i=0;i<4;i++){const note={pitch:[60,64,67,72][i],velocity:94,duration:.1,releaseSeconds:P.envelopeVersion===2?AmpEnvelope.seconds(P).release:0},t=.02+i*.125,entry=pool.create(note,t,true);pool.attach(entry,NBVoice.play(ctx,entry.output,note,P,which,t),true);}
  const buffer=await ctx.startRendering(),data=buffer.getChannelData(0);let energy=0,peak=0,count=0;
  for(let i=Math.floor(.02*sampleRate);i<Math.min(data.length,Math.floor(.52*sampleRate));i++){const x=data[i];if(!Number.isFinite(x))throw Error('Invalid audio level');energy+=x*x;peak=Math.max(peak,Math.abs(x));count++;}
  const rms=Math.sqrt(energy/count);if(rms<.0001)throw Error('Audio level is too low to measure');
  const gain=Math.min(512,Math.max(.025,Math.min(.12/rms,.6/Math.max(.00001,peak)))),result={gain,rms,peak,worklet:!!ctx._lad};
  if(cache.size>=120)cache.delete(cache.keys().next().value);cache.set(key,result);return result;
 })();pending.set(key,task);try{return await task;}finally{pending.delete(key);}
}
root.SoundMatch={measure};
})(typeof window!=='undefined'?window:globalThis);
