/* High-passed wet-only spatial return. Browser HRTF; no external sample or DSP dependency. */
(function(root){
'use strict';
const bounded=(v,d)=>Number.isFinite(v)?Math.max(0,Math.min(100,v))/100:d;
function create(c,input,output,sound={},bpm=118){
 const hp1=c.createBiquadFilter(),hp2=c.createBiquadFilter(),air=c.createBiquadFilter(),wet=c.createGain(),dustSend=c.createGain(),dustHP=c.createBiquadFilter(),dustWet=c.createGain();
 for(const hp of [hp1,hp2,dustHP]){hp.type='highpass';hp.frequency.value=420;hp.Q.value=.707;}
 air.type='lowpass';air.frequency.value=5400;air.Q.value=.6;
 input.connect(hp1);hp1.connect(hp2);hp2.connect(air);air.connect(wet);
 input.connect(dustHP);dustHP.connect(dustSend);dustSend.gain.value=0;dustWet.gain.value=.34;dustWet.connect(output);
 const taps=[],lfo=c.createOscillator(),motion=c.createGain();lfo.frequency.value=.11;lfo.connect(motion);motion.gain.value=0;
 for(const [side,ratio]of [[-1,.25],[1,.375]]){
  const delay=c.createDelay(2),pan=c.createPanner(),gain=c.createGain(),dustDelay=c.createDelay(2);
  pan.panningModel='HRTF';pan.distanceModel='inverse';pan.refDistance=1;pan.rolloffFactor=0;pan.positionX.value=side;pan.positionZ.value=-1;gain.gain.value=.34;
  wet.connect(delay);delay.connect(pan);pan.connect(gain);gain.connect(output);motion.connect(delay.delayTime);
  const dustPan=c.createStereoPanner();dustPan.pan.value=side*.75;dustSend.connect(dustDelay);dustDelay.connect(dustPan);dustPan.connect(dustWet);
  taps.push({side,ratio,delay,pan,dustDelay});
 }
 lfo.start();
 function update(s,tempo){
  const now=c.currentTime,amount=bounded(s.spaceMix,0),width=bounded(s.spaceWidth,.7),depth=bounded(s.spaceDepth,.4),move=bounded(s.spaceMotion,.15);
  wet.gain.setTargetAtTime(amount*.65,now,.035);motion.gain.setTargetAtTime(move*.0025,now,.05);
  for(const t of taps){t.delay.delayTime.setTargetAtTime(60/tempo*t.ratio+.007+depth*.025,now,.05);t.dustDelay.delayTime.setTargetAtTime(60/tempo*t.ratio,now,.05);t.pan.positionX.setTargetAtTime(t.side*width*2,now,.05);t.pan.positionY.setTargetAtTime(depth*.65,now,.05);t.pan.positionZ.setTargetAtTime(-.65-depth*1.5,now,.05);}
 }
 function dust(time,amount,seed){
  const n=(Math.sin(seed*78.233)*43758.5453)%1,r=n-Math.floor(n);if(amount<=0||r>amount*.85)return;
  const p=dustSend.gain;p.setValueAtTime(0,time);p.linearRampToValueAtTime(amount*(.22+r*.18),time+.004);p.setTargetAtTime(0,time+.025,.025);
 }
 update(sound,bpm);return{update,dust,taps,wet,hp1,hp2,dustSend};
}
root.BassSpace={create};
})(typeof globalThis!=='undefined'?globalThis:this);
