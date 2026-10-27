/* Common amp envelope and restrained performance FX; shared by every source. */
(function(root){'use strict';
const clamp=(v,a,b)=>Math.min(b,Math.max(a,Number.isFinite(+v)?+v:0));
const seconds=P=>({attack:.002+(clamp(P.attack,0,100)/100)**2*1.44,decay:.015+(clamp(P.ampDecay,0,100)/100)**2*2.52,sustain:(clamp(P.sustain??65,0,100)/100)**(1/1.4),release:.006+(clamp(P.release,0,100)/100)**2*4});
function migrate(k){if(!k||k.envelopeVersion===2)return k||{};return {...k,envelopeVersion:2,attack:Math.round(Math.sqrt(Math.max(0,(.001+(k.attack||0)*.0012-.002)/1.44))*100),ampDecay:Math.round(Math.sqrt((.05+(k.ampDecay??22)*.0035-.015)/2.52)*100),sustain:Math.round(((100-(k.pluck??50)*.85)/100)**1.4*100),release:Math.round(Math.sqrt(Math.max(0,((k.release??13)/100-.006)/4))*100)};}
function level(elapsed,env){if(elapsed<=0)return 0;if(elapsed<env.attack)return elapsed/env.attack;return 1+(env.sustain-1)*Math.min(1,(elapsed-env.attack)/env.decay);}
function schedule(param,time,duration,peak,P){const env=seconds(P),off=time+duration;param.cancelScheduledValues(time);param.setValueAtTime(0,time);if(env.attack<duration){param.linearRampToValueAtTime(peak,time+env.attack);param.linearRampToValueAtTime(peak*level(Math.min(duration,env.attack+env.decay),env),time+Math.min(duration,env.attack+env.decay));}else param.linearRampToValueAtTime(peak*level(duration,env),off);param.setValueAtTime(peak*level(duration,env),off);param.linearRampToValueAtTime(0,off+env.release);return off+env.release;}

// Finite tap layouts and HRTF placement adapted from the user's Delayzy v0.2.
const D=(name,mix,time,repeats,decay,width,mode='pingpong',tone=4200,seconds=0,motion=0)=>({name,values:{delayMix:mix,feedback:Math.round(decay*100),delayTime:time,delaySeconds:seconds,echoWidth:width,echoTone:tone,echoRepeats:repeats,echoMode:mode,echoMotion:motion}});
const delays=[
 D('Dry',0,.25,1,0,0),D('One wide reply',27,.5,1,0,1,'wide'),
 D('Binaural slap',26,.25,2,.36,1,'around',4800,.095),
 D('Tight ping-pong',29,.25,3,.46,1),D('Eighth ping-pong',30,.5,4,.45,1),
 D('Dotted conversation',28,.75,3,.46,1),D('Quarter bounce',28,1,3,.42,1),
 D('Double-tap sides',27,.25,2,.55,1),D('Outside your head',30,.5,2,.5,1,'around'),
 D('Orbiting replies',29,.75,4,.48,1,'orbit',4800,0,.28),
 D('Rear wall whisper',28,.5,3,.42,.8,'rear',3200),
 D('Silver scatter',27,.25,4,.42,1,'scatter',5800),
 D('Dark tape space',31,.5,4,.48,.9,'around',1900),
 D('Floating dotted',28,.75,4,.4,1,'orbit',3400,0,.12),
 D('Single shoulder echo',29,.5,1,0,1,'rear',3800),
 D('Fast alternating sparks',25,.25,5,.4,1,'pingpong',6800),
 D('Long velvet answer',30,1.5,2,.44,1,'wide',2800)
];
const R=(name,mix,room,style,width=1,depth=1)=>({name,values:{reverbMix:mix,room,reverbStyle:style,verbWidth:width,verbDepth:depth}});
const reverbs=[
 R('Dry',0,0,'room'),R('Binaural booth',25,10,'booth',.8,.4),
 R('Silver plate',28,35,'plate',1,.7),R('Wide studio',27,25,'room',1,.8),
 R('Soft chamber',29,48,'chamber',1,1),R('Air behind you',29,58,'air',1,1.6),
 R('Velvet hall',28,68,'hall',1,1.3),R('Golden early room',30,25,'early',.9,.5),
 R('Left-right gallery',29,48,'gallery',1.3,1),R('Cloud ceiling',28,75,'cloud',1.2,1.4),
 R('Tight drum room',27,15,'early',1,.4),R('Wide dark chamber',30,58,'dark',1.2,1.2),
 R('Short bright plate',27,15,'plate',1,.5)
];
root.AmpEnvelope={seconds,level,schedule,migrate};root.FXRecipes={delays,reverbs};
if(typeof module!=='undefined'&&module.exports)module.exports={AmpEnvelope:root.AmpEnvelope,FXRecipes:root.FXRecipes};
})(typeof window!=='undefined'?window:globalThis);
