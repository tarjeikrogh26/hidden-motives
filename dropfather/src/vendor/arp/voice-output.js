/* Audition-only audio lifecycle. Pattern data and written MIDI are never retained here. */
(function(root){'use strict';
class VoiceOutput {
 constructor(context,destination){this.context=context;this.destination=destination;this.voices=new Set();this.reset();}
 reset(){
  const now=this.context.currentTime;
  // Disconnect the entire old graph, including FX tails and not-yet-started notes.
  if(this.bus){this.bus.gain.cancelScheduledValues(now);this.bus.gain.setValueAtTime(0,now);this.bus.disconnect();}
  for(const entry of this.voices)this.dispose(entry,now);
  this.voices.clear();this.bus=this.context.createGain();this.bus.connect(this.destination);
 }
 cancelFrom(time){
  for(const entry of this.voices){
   if(entry.start>=time-.000001)this.dispose(entry,this.context.currentTime);
   else if(entry.end>time)this.dispose(entry,time);
  }
 }
 dispose(entry,time){
  entry.output.gain.cancelScheduledValues(time);entry.output.gain.setValueAtTime(0,time);
  entry.end=Math.min(entry.end,time);
  if(entry.voice?.stop)entry.voice.stop(time+.005);
  else for(const oscillator of entry.voice?.oscs||[]){try{oscillator.stop(time+.005);}catch{}}
 }
 create(note,time,mono=true){
  mono=true;
  const output=this.context.createGain(),duration=Math.max(.006,note.duration);
  const entry={output,start:time,end:time+duration+Math.max(0,Math.min(5,note.releaseSeconds||0)),pitch:note.pitch,voice:null};
  output.connect(this.bus);
  if(mono){
   // Use AUDIO time, never the lookahead scheduler's current wall time.
   for(const previous of this.voices)if(previous.end>time&&previous.start<=time)this.dispose(previous,time);
   const fade=Math.min(.003,duration/3);
   output.gain.setValueAtTime(0,time);output.gain.linearRampToValueAtTime(1,time+fade);
   output.gain.setValueAtTime(1,entry.end-fade);output.gain.linearRampToValueAtTime(0,entry.end);
  }
  this.voices.add(entry);return entry;
 }
 attach(entry,voice,mono=true){
  mono=true;
  entry.voice=voice;
  if(mono&&voice.stop)voice.stop(entry.end+.006);
  const ended=voice.oscs[0].onended;
  voice.oscs[0].onended=()=>{try{ended?.();}finally{entry.output.disconnect();this.voices.delete(entry);}};
 }
 active(time=this.context.currentTime){return [...this.voices].filter(v=>v.start<=time&&v.end>time).map(v=>v.pitch);}
}
if(typeof module!=='undefined'&&module.exports)module.exports=VoiceOutput;else root.VoiceOutput=VoiceOutput;
})(typeof globalThis!=='undefined'?globalThis:this);
