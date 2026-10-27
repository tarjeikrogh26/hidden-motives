/* Audio-only spatial effects. Finite repeat layouts and HRTF placement adapted
   from the user's DELAYZY-BY-KROGH-v0.2. No extra MIDI voices or feedback loop. */
(function(root){'use strict';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,Number.isFinite(+v)?+v:0));
class StudioFX {
 constructor(c,destination){this.c=c;this.input=c.createGain();this.output=c.createGain();this.output.gain.value=.8;this.output.connect(destination);this.settings={delayMix:18,delayTime:.75,feedback:32,reverbMix:15,room:55,chorus:24,tone:62,fxDrive:12};this.bpm=129;this.nodes=[];this.lfos=[];this.impulses=new Map();this.rebuild();}
 impulse(room,style='room'){
  const amount=Math.round(room/5)*5,key=style+':'+amount;if(this.impulses.has(key))return this.impulses.get(key);
  const c=this.c,shapes={booth:[.18,.5,.72,.003],plate:[.35,1.4,.3,.01],room:[.4,1.5,.55,.008],chamber:[.45,1.9,.68,.016],air:[.6,2.1,.4,.025],hall:[.9,2.8,.6,.02],early:[.18,.8,.4,.002],gallery:[.6,2,.35,.012],cloud:[1,3,.5,.06],dark:[.7,2.3,.86,.015]},shape=shapes[style]||shapes.room;
  const length=Math.floor(c.sampleRate*(shape[0]+amount/100*shape[1])),buffer=c.createBuffer(2,length,c.sampleRate);let seed=731+amount;
  for(const char of style)seed=(Math.imul(seed,31)+char.charCodeAt(0))>>>0;
  for(let ch=0;ch<2;ch++){const a=buffer.getChannelData(ch);let low=0;for(let i=0;i<length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const n=seed/4294967296*2-1;low=low*shape[2]+n*(1-shape[2]);a[i]=low*Math.exp(-6*i/length)*(1-Math.exp(-i/(c.sampleRate*shape[3])));}for(const [j,amp] of [[.013,.3],[.027,.2],[.043,.12],[.067,.08]]){const at=Math.floor((j+ch*.003)*c.sampleRate);if(at<a.length)a[at]+=amp;}}
  if(this.impulses.size>35)this.impulses.delete(this.impulses.keys().next().value);this.impulses.set(key,buffer);return buffer;
 }
 spatial(make){const p=make('createPanner');p.panningModel='HRTF';p.distanceModel='inverse';p.rolloffFactor=0;p.refDistance=1;p.maxDistance=100;p.channelCount=1;p.channelCountMode='explicit';return p;}
 place(p,x,y,z,t,immediate){for(const [key,v] of [['positionX',x],['positionY',y],['positionZ',z]]){p[key].cancelScheduledValues(t);if(immediate)p[key].setValueAtTime(v,t);else p[key].setTargetAtTime(v,t,.035);}}
 rebuild(){
  const c=this.c;this.input.disconnect();for(const o of this.lfos){try{o.stop();}catch{}}for(const n of this.nodes){try{n.disconnect();}catch{}}this.nodes=[];this.lfos=[];
  const make=method=>{const n=method==='createDelay'?c.createDelay(12):c[method]();this.nodes.push(n);return n;};
  this.high=make('createBiquadFilter');this.high.type='highpass';this.high.frequency.value=65;this.high.Q.value=.6;
  this.color=make('createBiquadFilter');this.color.type='lowpass';this.color.Q.value=.55;
  this.body=make('createWaveShaper');this.body.oversample='2x';this.input.connect(this.high);this.high.connect(this.body);this.body.connect(this.color);
  this.dry=make('createGain');this.color.connect(this.dry);this.dry.connect(this.output);
  this.chorusGain=make('createGain');this.chorusGain.connect(this.output);
  for(let side=0;side<2;side++){const d=make('createDelay'),p=make('createStereoPanner'),o=make('createOscillator'),depth=make('createGain');d.delayTime.value=.012+side*.003;p.pan.value=side?1:-1;o.frequency.value=side?.19:.13;depth.gain.value=.0018;o.connect(depth);depth.connect(d.delayTime);this.color.connect(d);d.connect(p);p.connect(this.chorusGain);o.start();this.lfos.push(o);}
  this.send=make('createGain');this.color.connect(this.send);this.echoReturn=make('createGain');this.echoReturn.connect(this.output);this.taps=[];
  for(let i=0;i<6;i++){const delay=make('createDelay'),filter=make('createBiquadFilter'),pan=this.spatial(make),spread=make('createStereoPanner'),gain=make('createGain');filter.type='lowpass';filter.Q.value=.5;gain.gain.value=0;this.send.connect(delay);delay.connect(filter);filter.connect(pan);pan.connect(spread);spread.connect(gain);gain.connect(this.echoReturn);this.taps.push({delay,filter,pan,spread,gain});}
  this.verb=make('createConvolver');this.verb.normalize=true;this.verbGain=make('createGain');this.color.connect(this.verb);this.verbSplit=make('createChannelSplitter');this.verb.connect(this.verbSplit);this.verbPanners=[];
  for(let side=0;side<2;side++){const pan=this.spatial(make);this.verbSplit.connect(pan,side);pan.connect(this.verbGain);this.verbPanners.push(pan);}this.verbGain.connect(this.output);
  this.roomKey=null;this.driveKey=null;this.apply(this.settings,this.bpm,true);
 }
 apply(settings,bpm=this.bpm,immediate=false){
  this.settings={...this.settings,...settings};this.bpm=bpm;const c=this.c,s=this.settings,t=c.currentTime,set=(p,v)=>{if(immediate)p.setValueAtTime(v,t);else p.setTargetAtTime(v,t,.025);};
  set(this.color.frequency,1400*Math.pow(8,clamp(s.tone,0,100)/100));set(this.dry.gain,.9);set(this.chorusGain.gain,clamp(s.chorus,0,100)/100*.22);set(this.send.gain,s.delayMix>0?1:0);set(this.echoReturn.gain,clamp(s.delayMix,0,100)/100);
  const delay=clamp(s.delaySeconds||s.delayTime*60/bpm,.025,1.8),decay=clamp(s.feedback/100,0,.58),count=Math.round(clamp(s.echoRepeats??(decay?4:1),1,6)),width=clamp(s.echoWidth??1,0,1.5),mode=s.echoMode||'pingpong';
  this.taps.forEach(({delay:d,filter,pan,spread,gain},i)=>{
   const scatter=mode==='scatter'?[1,1.75,2.5,3.5,4.25,5.5][i]:i+1,side=i%2?-1:1;
   set(d.delayTime,delay*scatter);set(filter.frequency,clamp((s.echoTone||4200)*Math.pow(.92,i),500,14000));set(gain.gain,i<count?Math.pow(decay,i)*(mode==='wide'?.9:1):0);
   set(spread.pan,mode==='orbit'?0:side*Math.min(1,width)*.35);
   let x=side*width*2.4,y=0,z=-.5;
   if(mode==='rear'){z=1.6;y=.25;}else if(mode==='around'){z=i%2?1.1:-.8;y=i%2?.3:-.15;}else if(mode==='scatter'){z=i%3-1;y=(i%3-1)*.6;}
   else if(mode==='wide'){z=-.35;x=side*width*3.5;}
   this.place(pan,x,y,z,t,immediate);
   if(mode==='orbit'&&s.echoMotion>0){const steps=481,hz=clamp(s.echoMotion,.05,.5),xs=new Float32Array(steps),zs=new Float32Array(steps);for(let j=0;j<steps;j++){const a=(t+j/8)*hz+i*Math.PI*.75;xs[j]=Math.sin(a)*width*2.5;zs[j]=-Math.cos(a)*1.5;}pan.positionX.cancelScheduledValues(t);pan.positionZ.cancelScheduledValues(t);pan.positionX.setValueCurveAtTime(xs,t,60);pan.positionZ.setValueCurveAtTime(zs,t,60);}
  });
  const verbWidth=clamp(s.verbWidth??1,.2,1.5),depth=clamp(s.verbDepth??1,0,2);this.verbPanners.forEach((p,i)=>this.place(p,(i?1:-1)*verbWidth*2.4,.2+depth*.3,depth-.8,t,immediate));
  set(this.verbGain.gain,clamp(s.reverbMix,0,100)/100*.9);
  const roomKey=(s.reverbStyle||'room')+':'+Math.round(s.room/5)*5;if(this.roomKey!==roomKey){this.roomKey=roomKey;this.verb.buffer=this.impulse(s.room,s.reverbStyle||'room');}
  const driveKey=Math.round(s.fxDrive);if(this.driveKey!==driveKey){this.driveKey=driveKey;const k=1+driveKey/100*1.5,n=Math.tanh(k);this.body.curve=Float32Array.from({length:2048},(_,i)=>driveKey?Math.tanh((i/2047*2-1)*k)/n:(i/2047*2-1));}
 }
 reset(){this.rebuild();}
 dispose(){this.input.disconnect();for(const o of this.lfos){try{o.stop();}catch{}}for(const n of this.nodes){try{n.disconnect();}catch{}}this.output.disconnect();}
}
root.StudioFX=StudioFX;
})(typeof window!=='undefined'?window:globalThis);
