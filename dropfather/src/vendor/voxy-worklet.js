// VOXY MUSIC 0.7 by Tarjei Krogh: its AudioWorklet engine, joined by tools/extract-voxy.mjs.
const {offsets,repeatComp}=(()=>{
// Ported from DELAYSY-777-app/source/delaysy-final-engine.js (user-owned source).
// The repeat timing and energy compensation are retained. VOXY applies them to
// live circular buffers instead of scheduling complete prerecorded clips.
function offsets(settings,beat){let sum=0,interval=settings.division;const out=[];for(let r=0;r<settings.reps;r++){sum+=settings.bounce?Math.max(.125,Math.round(interval*8)/8):interval;out.push(sum*beat);interval*=1-settings.bounce*.53}return out}
function repeatComp(q){let e=0;for(let i=0;i<q.reps;i++)e+=Math.pow(q.decay,2*i);const voices=q.mode==='four'?4:q.mode==='ping'?1:2,amp=q.mode==='four'?.34:.54;return 1/(Math.sqrt(Math.max(1,e*voices*amp*amp))*(1+.45*q.flange))}

return {offsets,repeatComp};
})();
const {Voxy201}=(()=>{
// Digital VSM 201 signal-flow model. Filters, noise colour and AGC are
// approximations; the original analogue transfer functions are not calibrated.
class Voxy201 {
 constructor(sr,Filter){
  this.sr=sr;this.low=new Filter('bandpass',650,.707,sr);this.high=new Filter('bandpass',Math.min(5800,sr*.35),.707,sr);
  this.bands=Array.from({length:20},(_,i)=>{const frequency=100*Math.pow(80,i/19),make=()=>new Filter('bandpass',Math.min(frequency,sr*.42),3.8,sr);return {frequency,m1:make(),m2:make(),c1:make(),c2:make(),n1:make(),n2:make(),e1:0,e2:0,carrierPower:0,noisePower:0,gain:1,targetGain:1,speech:1,targetSpeech:1};});
  this.pinkStates=new Float32Array(9);this.pinkCoeffs=Array.from({length:9},(_,i)=>1-Math.exp(-2*Math.PI*(30*2**i)/sr));this.pinkWeights=Array.from({length:9},(_,i)=>1/Math.sqrt(30*2**i));this.pinkGain=Math.sqrt(sr)*.12;
  this.bridgePairs=new Float32Array(10);this.envelopes=new Float32Array(20);
  this.detectCoeff=1-Math.exp(-1/(sr*.003));this.envCoeff=1-Math.exp(-2*Math.PI*60/sr);this.powerCoeff=1-Math.exp(-1/(sr*.025));this.smooth=1-Math.exp(-1/(sr*.025));this.duckCoeff=1-Math.exp(-1/(sr*.004));this.fillCoeff=1-Math.exp(-1/(sr*.060));this.noiseCoeff=1-Math.exp(-2*Math.PI*1400/sr);
  this.route=Array.from({length:20},(_,i)=>i);this.previousRoute=[...this.route];this.routeBlend=1;
  this.configure(130.8128,0);this.reset();
 }
 reset(){
  this.phase=0;this.seed=17389;this.low.reset();this.high.reset();this.lowPower=this.highPower=this.unvoiced=this.inputPower=this.outputPower=this.pauseMix=this.noiseLow=0;this.analysisGain=this.outputGain=this.voiceGain=1;this.voicePower=0;this.envelopes.fill(0);this.pinkStates.fill(0);this.previousRoute=[...this.route];this.routeBlend=1;
  for(const b of this.bands){for(const f of [b.m1,b.m2,b.c1,b.c2,b.n1,b.n2])f.reset();b.e1=b.e2=b.carrierPower=b.noisePower=0;b.gain=b.targetGain;b.speech=b.targetSpeech;}
 }
 configure(root,variation=0,o={}){
  this.dt=Math.max(40,Math.min(1200,root))/this.sr;
  this.mode=o.machineMode||'vocode';this.voiceMode=o.voiceMode||'auto';this.toneSource=o.toneSource||'internal';this.breathSource=o.breathSource||'internal';this.emphasisMode=o.emphasisMode||'channels';this.speechMode=o.speechMode||'channels';this.fillMode=o.fillMode||'off';this.bypass=o.machineBypass||'off';this.autoLevel=o.autoLevel!=='off';this.pink=o.noiseColor==='pink';
  const limit=(v,f)=>Number.isFinite(+v)?Math.max(0,Math.min(1,+v)):f;
  this.fillLevel=limit(o.fillLevel,0);this.speechLevel=limit(o.speechLevel,1);this.bypassLevel=limit(o.bypassLevel,.5);this.threshold=Math.pow(10,Math.max(-72,Math.min(-6,Number.isFinite(+o.gateThreshold)?+o.gateThreshold:-40))/20);
  variation=Number.isFinite(+variation)?Math.max(0,Math.floor(+variation))>>>0:0;
  const shape=['natural','deep','bright','reverse','rewired'].includes(o.voiceShape)?o.voiceShape:'natural';
  if(shape!==this.voiceShape||(shape==='rewired'&&variation!==this.routeSeed)){
   this.previousRoute=[...this.route];this.route=Array.from({length:20},(_,i)=>shape==='deep'?(i+2<20?i+2:-1):shape==='bright'?(i-2>=0?i-2:-1):shape==='reverse'?19-i:i);
   if(shape==='rewired'){let state=(variation||7411)>>>0;for(let i=0;i<19;i++){state=(Math.imul(1664525,state)+1013904223)>>>0;if(state/4294967296<.55){[this.route[i],this.route[i+1]]=[this.route[i+1],this.route[i]];i++;}}}
   this.voiceShape=shape;this.routeSeed=variation;this.routeBlend=0;
  }
  if(variation===this.variation)return;
  this.variation=variation;let seed=variation||7411;const random=()=>{seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296;};
  const varied=variation!==0,tilt=varied?(random()-.5)*7:1.5;this.duty=varied?.12+random()*.30:.18;this.noiseColour=varied?random():.15;this.modeThreshold=varied?.7+random()*.7:1;
  const contour=Array.from({length:5},()=>varied?(random()-.5)*7:0);
  for(let i=0;i<20;i++){const b=this.bands[i],t=i/19,k=Math.min(3,Math.floor(t*4)),f=t*4-k,jitter=varied?(random()-.5)*1.5:0;b.targetGain=Math.pow(10,(contour[k]*(1-f)+contour[k+1]*f+tilt*(t-.5)+jitter)/20);b.targetSpeech=(.04+.8*t*t)*(varied?.5+random():.9);}
  for(let i=0;i<10;i++)this.bridgePairs[i]=varied?.25+random()*.75:1;
 }
 blep(t){const dt=this.dt;if(t<dt){const x=t/dt;return 2*x-x*x-1;}if(t>1-dt){const x=(t-1)/dt;return x*x+2*x+1;}return 0;}
 filterPink(noise){let sum=0;for(let i=0;i<9;i++){this.pinkStates[i]+=this.pinkCoeffs[i]*(noise-this.pinkStates[i]);sum+=this.pinkStates[i]*this.pinkWeights[i];}return sum*this.pinkGain;}
 tick(x,amount,clarity,externalTone=0,externalBreath=0){
  if(amount<.0001)return x;
  externalTone=Number.isFinite(externalTone)?Math.max(-3,Math.min(3,externalTone)):0;externalBreath=Number.isFinite(externalBreath)?Math.max(-3,Math.min(3,externalBreath)):0;
  this.inputPower+=this.powerCoeff*(x*x-this.inputPower);const agc=this.autoLevel?Math.max(.6,Math.min(3,.16/Math.sqrt(this.inputPower+1e-5))):1;this.analysisGain+=this.smooth*(agc-this.analysisGain);
  const analysis=x*this.analysisGain,lo=this.low.tick(analysis),hi=this.high.tick(analysis);this.lowPower+=this.detectCoeff*(lo*lo-this.lowPower);this.highPower+=this.detectCoeff*(hi*hi-this.highPower);
  const noiseMode=this.voiceMode==='breath'?1:this.voiceMode==='tone'?0:this.highPower>this.lowPower*this.modeThreshold?1:0;this.unvoiced+=this.detectCoeff*(noiseMode-this.unvoiced);
  const pauseTarget=Math.max(0,Math.min(1,1-Math.sqrt(this.inputPower)/this.threshold));this.pauseMix+=(pauseTarget<this.pauseMix?this.duckCoeff:this.fillCoeff)*(pauseTarget-this.pauseMix);
  this.phase=(this.phase+this.dt)%1;const t=this.phase,duty=this.duty,pulse=((t<duty?1:-1)+this.blep(t)-this.blep((t+1-duty)%1)-(2*duty-1))*.85;
  this.seed^=this.seed<<13;this.seed^=this.seed>>>17;this.seed^=this.seed<<5;const noise=(this.seed>>>0)/2147483648-1;this.noiseLow+=this.noiseCoeff*(noise-this.noiseLow);
  const coloured=this.pink?this.filterPink(noise):noise,tone=this.toneSource==='file'?externalTone:pulse,breath=this.breathSource==='file'?externalBreath:coloured,toneMix=Math.sqrt(1-this.unvoiced),breathMix=Math.sqrt(this.unvoiced);
  let machine=0,addition=0,filtered=0,fill=0;
  // Complete analysis first: every synthesis channel reads the same sample's
  // envelopes, including routes from higher to lower bands.
  for(let i=0;i<20;i++){const b=this.bands[i],m=b.m2.tick(b.m1.tick(analysis));b.e1+=this.envCoeff*(Math.abs(m)-b.e1);b.e2+=this.envCoeff*(b.e1-b.e2);this.envelopes[i]=b.e2;b.speech+=this.smooth*(b.targetSpeech-b.speech);filtered+=m*b.speech;if(this.speechMode==='channels')addition+=m*b.speech;}
  this.routeBlend+=this.smooth*(1-this.routeBlend);
  for(let i=0;i<20;i++){
   const b=this.bands[i];
   const c=b.c2.tick(b.c1.tick(tone)),n=b.n2.tick(b.n1.tick(breath));b.carrierPower+=this.powerCoeff*(c*c-b.carrierPower);b.noisePower+=this.powerCoeff*(n*n-b.noisePower);b.gain+=this.smooth*(b.targetGain-b.gain);
   const emphasis=this.emphasisMode==='normal'?1:b.gain,cv=c*Math.min(50,1/Math.sqrt(b.carrierPower+1e-5)),nv=n*Math.min(50,1/Math.sqrt(b.noisePower+1e-5));
   const from=this.previousRoute[i],to=this.route[i],oldEnvelope=from<0?0:this.bands[from].e2,newEnvelope=to<0?0:this.bands[to].e2,envelope=oldEnvelope+(newEnvelope-oldEnvelope)*this.routeBlend;
   machine+=(cv*toneMix+nv*breathMix)*envelope*emphasis;
   if(this.fillMode!=='off')fill+=cv*.025*(this.fillMode==='channels'?this.bridgePairs[i>>1]:1)*emphasis*this.pauseMix*this.fillLevel;
  }
  if(this.speechMode==='sum')addition=analysis;
  const shaped=this.mode==='filter'?filtered*this.speechLevel*.6/this.analysisGain:((this.mode==='off'?0:machine*.6)+addition*clarity*this.speechLevel*.6)/this.analysisGain;
  this.outputPower+=this.powerCoeff*(shaped*shaped-this.outputPower);const level=Math.max(.55,Math.min(2.2,Math.sqrt((this.inputPower+1e-8)/(this.outputPower+1e-8))));this.outputGain+=this.smooth*(level-this.outputGain);
  let wet=shaped*this.outputGain*.92;if(this.mode==='vocode'){wet+=x*.2*clarity;this.voicePower+=this.powerCoeff*(wet*wet-this.voicePower);const match=Math.max(.8,Math.min(1.4,Math.sqrt((this.inputPower+1e-8)/(this.voicePower+1e-8))));this.voiceGain+=this.smooth*(match-this.voiceGain);wet=wet*this.voiceGain+fill;}
  if(this.bypass==='speech')wet+=x*this.bypassLevel;else if(this.bypass==='carrier')wet+=tone*this.bypassLevel;
  return x*(1-amount)+wet*amount;
 }
}

return {Voxy201};
})();
const {VoxyVocoder}=(()=>{

// Speech-focused filterbank vocoder. The clean speech path is intentional:
// Machine changes the carrier character; Clarity protects articulation.
class SpeechFilter {
  constructor(type, frequency, q, sr) {
    const w = 2 * Math.PI * frequency / sr;
    const a = Math.sin(w) / (2 * q), c = Math.cos(w), d = 1 + a;
    this.b0 = type === 'highpass' ? (1 + c) / (2 * d) : a / d;
    this.b1 = type === 'highpass' ? -(1 + c) / d : 0;
    this.b2 = type === 'highpass' ? this.b0 : -a / d;
    this.a1 = -2 * c / d; this.a2 = (1 - a) / d;
    this.reset();
  }
  reset() { this.x1 = this.x2 = this.y1 = this.y2 = 0; }
  tick(x) {
    const y = this.b0*x + this.b1*this.x1 + this.b2*this.x2 - this.a1*this.y1 - this.a2*this.y2;
    this.x2 = this.x1; this.x1 = x; this.y2 = this.y1; this.y1 = y;
    return y;
  }
}
class VoxyVocoder {
  constructor(sr) {
    this.vsm=new Voxy201(sr,SpeechFilter);
    this.sr = sr; this.phase = 0; this.dt = 130.8128 / sr;
    this.air = new SpeechFilter('highpass', Math.min(2600, sr * .2), .707, sr);
    this.phase2=.31;this.phase3=.67;this.seed=89173;
    this.profileName='';this.selectProfile('classic');
    this.powerCoeff = 1 - Math.exp(-1/(sr*.018));
    this.carrierCoeff = 1 - Math.exp(-1/(sr*.035));
    this.gainCoeff = 1 - Math.exp(-1/(sr*.012));
    this.reset();
  }
  reset() {
    this.sourcePower = this.wetPower = this.mixPower = 0;
    this.wetGain = this.levelGain = 1;this.profileFade=1;
    this.air.reset();this.vsm.reset();
    if(this.profileName==='vsm201')return;
    for (const b of this.bands) {
      b.mp = b.cp = 0;
      b.m1.reset(); b.m2.reset(); b.c1.reset(); b.c2.reset();
    }
  }
  selectProfile(name) {
    if(name==='vsm201'){this.profileName=name;this.profile={kind:'pulse/noise'};this.bands=this.vsm.bands;this.vsm.reset();return;}
    const profiles={
      classic:{kind:'saw',bands:32,min:90,max:9000,q:4.5,factor:1,attack:1,release:1,duty:.5},
      precise:{kind:'precise',bands:40,min:100,max:10000,q:5.5,factor:1,attack:.7,release:.7,duty:.5},
      pulse:{kind:'pulse',bands:24,min:110,max:8000,q:3.5,factor:1,attack:1.2,release:1.3,duty:.25},
      dark:{kind:'pulse',bands:16,min:80,max:5600,q:2.6,factor:.5,attack:1.5,release:1.8,duty:.48},
      brass:{kind:'brass',bands:24,min:120,max:7500,q:3.8,factor:1,attack:.85,release:1.15,duty:.34},
      glass:{kind:'fm',bands:40,min:140,max:10000,q:5.2,factor:1,attack:.65,release:.8,duty:.5},
      choir:{kind:'choir',bands:24,min:100,max:8500,q:3.6,factor:1,attack:1.6,release:1.7,duty:.5},
      whisper:{kind:'noise',bands:32,min:180,max:10500,q:4.8,factor:1,attack:.6,release:.65,duty:.5}
    };
    name=profiles[name]?name:'classic';this.profileName=name;this.profile=profiles[name];
    const p=this.profile;this.bands=[];
    for(let i=0;i<p.bands;i++){
      const f=p.min*Math.pow(Math.min(p.max,this.sr*.42)/p.min,i/(p.bands-1));
      this.bands.push({m1:new SpeechFilter('bandpass',f,p.q,this.sr),m2:new SpeechFilter('bandpass',f,p.q,this.sr),c1:new SpeechFilter('bandpass',f,p.q,this.sr),c2:new SpeechFilter('bandpass',f,p.q,this.sr),mp:0,cp:0,attack:Math.exp(-1/(this.sr*(f>2000?.0007:.0015)*p.attack)),release:Math.exp(-1/(this.sr*(f>2000?.007:.014)*p.release))});
    }
    this.profileFade=0;
  }
  configure(root, character, scale='minor', variation=0, options={}) {
    if(character!==this.profileName)this.selectProfile(character);
    if(this.profileName==='vsm201'){this.vsm.configure(root,variation,options);return;}
    this.dt=Math.min(.08,root*this.profile.factor/this.sr);
    const third=scale==='major'?4:scale==='open'?7:3;
    this.dt2=this.dt*(this.profile.kind==='choir'?Math.pow(2,third/12):1.005);
    this.dt3=this.dt*(this.profile.kind==='choir'?(scale==='open'?2:1.498307):.995);
  }
  blep(t,dt=this.dt) {
    if(t<dt){const x=t/dt;return x+x-x*x-1;}
    if(t>1-dt){const x=(t-1)/dt;return x*x+x+x+1;}
    return 0;
  }
  saw(t,dt=this.dt){return 2*t-1-this.blep(t,dt);}
  carrier() {
    const p=this.profile,t=this.phase,saw=this.saw(t);
    const pulse=(t<p.duty?1:-1)+this.blep(t)-this.blep((t+1-p.duty)%1)-(2*p.duty-1);
    if(p.kind==='pulse')return pulse*.8+saw*.2;
    if(p.kind==='precise')return saw*.8+this.saw((t*2)%1,this.dt*2)*.2;
    if(p.kind==='brass')return saw*.5+pulse*.24+this.saw((t*2)%1,this.dt*2)*.26;
    if(p.kind==='fm')return Math.sin(2*Math.PI*t+3.8*Math.sin(4*Math.PI*t))*.8+Math.sin(2*Math.PI*t)*.2;
    if(p.kind==='choir')return saw*.44+this.saw(this.phase2,this.dt2)*.28+this.saw(this.phase3,this.dt3)*.28;
    if(p.kind==='noise'){this.seed^=this.seed<<13;this.seed^=this.seed>>>17;this.seed^=this.seed<<5;return ((this.seed>>>0)/2147483648-1)*.8;}
    return saw*.82+pulse*.18;
  }
  tick(x, amount, clarity, tone=0, breath=0) {
    if(this.profileName==='vsm201')return this.vsm.tick(x,amount,clarity,tone,breath);
    const air = this.air.tick(x), body = x - air;
    this.phase += this.dt;
    if (this.phase >= 1) this.phase -= 1;
    this.phase2=(this.phase2+(this.dt2||this.dt))%1;this.phase3=(this.phase3+(this.dt3||this.dt))%1;
    if (amount < .0001) return x;
    const carrier=this.carrier();
    this.profileFade+=.001*(1-this.profileFade);
    let voc = 0;
    for (const b of this.bands) {
      const m = b.m2.tick(b.m1.tick(x)), c = b.c2.tick(b.c1.tick(carrier));
      const power = m*m, follow = power > b.mp ? b.attack : b.release;
      b.mp = follow*b.mp + (1-follow)*power;
      b.cp += this.carrierCoeff*(c*c - b.cp);
      // Carrier whitening keeps upper speech bands from being swallowed by bass.
      const normalizer = Math.min(70, 1/Math.sqrt(b.cp + .000004));
      voc += c * normalizer * Math.sqrt(b.mp);
    }
    voc *= .38;
    this.sourcePower += this.powerCoeff*(body*body-this.sourcePower);
    this.wetPower += this.powerCoeff*(voc*voc-this.wetPower);
    const target = Math.max(.25, Math.min(3.5, Math.sqrt((this.sourcePower+.00000001)/(this.wetPower+.00000001))));
    this.wetGain += this.gainCoeff*(target-this.wetGain);
    const protectedVoice = .22 + .4*clarity;
    const machine = body*protectedVoice + voc*this.wetGain*this.profileFade*.88*Math.sqrt(1-protectedVoice*protectedVoice) + air*(.55+.45*clarity);
    const result = x*(1-amount) + machine*amount;
    this.mixPower += this.powerCoeff*(result*result-this.mixPower);
    // Bound gain changes; never use a syllable-by-syllable hard limiter here.
    const sourceTotal = this.sourcePower + air*air*.05;
    const levelTarget = Math.max(.75, Math.min(1.3, Math.sqrt((sourceTotal+.00000001)/(this.mixPower+.00000001))));
    this.levelGain += this.gainCoeff*(levelTarget-this.levelGain);
    return result*(1-amount+amount*this.levelGain);
  }
}

return {VoxyVocoder};
})();
const {SecondVoiceCore}=(()=>{
// Relative harmony: follows every input note without requiring pitch detection.
// The sequencer selects the interval, not an absolute synthesizer note.
class SecondVoiceCore {
 constructor(sr){this.sr=sr;this.buffer=new Float32Array(2**Math.ceil(Math.log2(sr*.25)));this.mask=this.buffer.length-1;this.configure({});this.reset();}
 configure(p){this.notes=Array.isArray(p.sequenceNotes)?p.sequenceNotes.slice(0,16).map(n=>n===null?null:Math.max(-12,Math.min(12,Math.round(+n)||3))):[3,5,7,5,-3,5,7,12];this.length=[4,8,16].includes(+p.sequenceLength)?+p.sequenceLength:8;this.rate=[.25,.5,1,2,4].includes(+p.sequenceRate)?+p.sequenceRate:1;this.bpm=Math.max(50,Math.min(200,+p.bpm||112));}
 reset(){this.buffer.fill(0);this.index=this.clock=0;this.phase=.25;this.ratio=1;this.gate=0;this.step=0;}
 read(delay){const at=this.index-delay,i=Math.floor(at),f=at-i;return this.buffer[i&this.mask]*(1-f)+this.buffer[(i+1)&this.mask]*f;}
 tick(x){this.buffer[this.index]=x;this.step=Math.floor(this.clock/(this.sr*60/this.bpm*this.rate))%this.length;const note=this.notes[this.step]??null,target=note===null?1:2**(note/12),window=this.sr*.065;this.ratio+=(1-Math.exp(-1/(this.sr*.006)))*(target-this.ratio);this.gate+=(1-Math.exp(-1/(this.sr*.006)))*((note===null?0:1)-this.gate);this.phase+=(1-this.ratio)/window;this.phase-=Math.floor(this.phase);const a=this.phase,b=(a+.5)%1,w=.5-.5*Math.cos(2*Math.PI*a),y=(this.read(64+a*window)*w+this.read(64+b*window)*(1-w))*this.gate;this.index=(this.index+1)&this.mask;this.clock++;return y;}
}

return {SecondVoiceCore};
})();
const {EffectCore}=(()=>{

const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const patterns={off:[0],fifths:[0,7,0,-5,7,12,0,7],major:[0,4,7,12,7,4,0,-5],minor:[0,3,7,12,7,3,0,-5],octaves:[0,12,0,-12],pentatonic:[0,3,5,7,10,12,7,5]};
class Filter {
 constructor(sr){this.sr=sr;this.set('lowpass',6500,.7);this.reset();}
 reset(){this.x1=this.x2=this.y1=this.y2=0;}
 set(type,hz,q){const w=2*Math.PI*clamp(hz,50,this.sr*.42)/this.sr,c=Math.cos(w),a=Math.sin(w)/(2*clamp(q,.5,8)),d=1+a;let b0,b1,b2;if(type==='highpass'){b0=(1+c)/2;b1=-(1+c);b2=b0;}else if(type==='bandpass'){b0=a;b1=0;b2=-a;}else{b0=(1-c)/2;b1=1-c;b2=b0;}this.b0=b0/d;this.b1=b1/d;this.b2=b2/d;this.a1=-2*c/d;this.a2=(1-a)/d;}
 tick(x){const y=this.b0*x+this.b1*this.x1+this.b2*this.x2-this.a1*this.y1-this.a2*this.y2;this.x2=this.x1;this.x1=x;this.y2=this.y1;this.y1=y;return y;}
}
class Colour {
 constructor(sr){this.sr=sr;this.filters=[180,300,500,800,1300,2100,3400,5500].map(hz=>{const m=new Filter(sr),c=new Filter(sr);m.set('bandpass',hz,2.5);c.set('bandpass',hz,2.5);return {m,c,e:0};});this.reset();}
 reset(){this.low=this.held=this.env=this.crackle=this.refPower=this.colourPower=0;this.matchGain=1;this.count=0;this.seed=8371;for(const b of this.filters){b.m.reset();b.c.reset();b.e=0;}}
 configure(q,dry,bpm){this.q=q;this.dry=dry;this.bpm=bpm;const applies=k=>q[k+'Route']==='both'||q[k+'Route']===(dry?'dry':'wet');for(const k of ['crush','drive','fat','robot'])this[k]=applies(k)?+q[k]||0:0;this.creative=applies('creative');this.lowCoeff=1-Math.exp(-2*Math.PI*120/this.sr);}
 tick(x,time){const {q,dry,bpm,crush,drive,fat,robot,creative}=this,before=x;this.env+=.005*(Math.abs(x)-this.env);this.low+=this.lowCoeff*(x-this.low);if(fat)x+=this.low*fat*.7;if(drive||fat)x=Math.tanh(x*(1+drive*19+fat*7))/(1+drive*.7+fat*.45);if(crush){const hold=1+Math.floor(crush*crush*23),quant=2**(16-crush*12);if(this.count%hold===0)this.held=Math.round(x*quant)/quant;x=x*(1-crush*.75)+this.held*crush*.75;}
 if(robot){const carrier=(2*((time*440*2**(((q.carrier||48)-69)/12))%1)-1)*.7;let voc=0;for(const b of this.filters){const m=b.m.tick(x),c=b.c.tick(carrier);b.e+=(Math.abs(m)-b.e)*(Math.abs(m)>b.e?.035:.002);voc+=c*b.e*14;}x=x*(1-robot)+voc*robot;}
 this.refPower+=.001*(before*before-this.refPower);this.colourPower+=.001*(x*x-this.colourPower);const target=this.refPower>1e-9?clamp(Math.sqrt((this.refPower+1e-12)/(this.colourPower+1e-12)),.25,6):1;this.matchGain+=.0005*(target-this.matchGain);x*=this.matchGain;
 if(creative){if(q.fold){const y=2/Math.PI*Math.asin(Math.sin(x*(1+q.fold*8)*Math.PI/2));x=x*(1-q.fold)+y*q.fold;}if(q.ring)x*=1-q.ring+q.ring*Math.cos(2*Math.PI*440*2**(((q.ringNote||36)-69)/12)*time);const phase=(time*bpm/(60*(q.modDivision||.5)))%1;if(q.gate)x*=1-q.gate+q.gate*(.12+.88*Math.min(1,phase/.025,(.55-phase)/.025>0?(.55-phase)/.025:0));if(q.tremolo)x*=1-q.tremolo*(.5-.5*Math.cos(phase*2*Math.PI));}
 this.seed=(Math.imul(1664525,this.seed)+1013904223)>>>0;const noise=this.seed/2147483648-1;if(!dry){x+=noise*(+q.tape||0)*.014*Math.min(1,this.env*30);if((this.seed&65535)/65535<(+q.dust||0)*.0007)this.crackle=noise*q.dust*.09*Math.min(1,this.env*20);x+=this.crackle;this.crackle*=.68;}this.count++;return Number.isFinite(x)?x:0;
 }
}
// Live adaptation: finite taps, delayed granular pitch/reverse, colour and
// rhythmic processing. Reverse uses overlapping buffered grains, not future audio.
class EffectCore {
 constructor(sr){this.sr=sr;this.buffer=new Float32Array(2**Math.ceil(Math.log2(sr*24)));this.mask=this.buffer.length-1;this.filters=Array.from({length:8},()=>new Filter(sr));this.colours=Array.from({length:5},()=>new Colour(sr));this.phase=new Float64Array(36);this.low=new Float64Array(9);this.outputs=new Float64Array(4);this.configure({},112);this.reset();}
 reset(){this.buffer.fill(0);this.phase.fill(.25);this.low.fill(0);this.index=this.clock=this.env=this.age=this.envelope=this.amount=0;this.outputs.fill(0);for(const f of this.filters)f.reset();for(const c of this.colours)c.reset();}
 configure(q,bpm=112){this.q={mix:.42,reps:1,micro:8,width:.85,motion:0,pitch:0,detune:0,bend:0,decay:.55,room:0,flange:0,tone:6500,division:.5,mode:'pair',reverse:false,bounce:0,distance:1.5,spread:.25,height:.2,sweep:0,filter:'lowpass',...q};this.q.reps=clamp(Math.round(this.q.reps)||1,1,8);this.bpm=clamp(+bpm||112,50,200);this.delays=offsets(this.q,60/this.bpm).map(t=>Math.min(this.buffer.length/this.sr-.5,t));this.comp=repeatComp(this.q);this.pattern=patterns[this.q.pattern]||patterns.off;this.dryActive=['pitch','tone','crush','drive','fat','robot','creative'].some(k=>this.q[k+'Route']==='dry'||this.q[k+'Route']==='both');this.toneActive=['sub','octaveUp','unison','sour','sourMove','sourHigh','glide','analogDrift','noise','moreBass','envAttack','envRelease'].some(k=>this.q[k])||(this.q.envSustain??1)!==1;this.toneLowCoeff=1-Math.exp(-2*Math.PI*(this.q.sub<0?30-this.q.sub*700:120)/this.sr);for(let i=0;i<5;i++)this.colours[i].configure(this.q,i===4,this.bpm);this.block();}
 block(){const q=this.q,t=this.clock/this.sr,mod=Math.sin(t*this.bpm/(60*(q.modDivision||.5))*2*Math.PI)*(+q.autoWah||0)*2.5,creative=q.creativeRoute!=='dry';for(let k=0;k<8;k++)this.filters[k].set(q.filter,q.tone*2**(q.sweep*k*1.25+(creative?mod:0)),(q.filter==='bandpass'?1.2:.65)+(creative?(+q.resonance||0)*8:0));}
 read(delay){const at=this.index-Math.max(1,delay),i=Math.floor(at),f=at-i;return this.buffer[i&this.mask]*(1-f)+this.buffer[(i+1)&this.mask]*f;}
 grain(delay,ratio,phase,reverse=false){if(Math.abs(ratio-1)<.00001&&!reverse)return this.read(delay);const window=this.sr*(reverse?.12:.065),a=phase,b=(a+.5)%1,w=.5-.5*Math.cos(2*Math.PI*a);return this.read(delay+64+a*window)*w+this.read(delay+64+b*window)*(1-w);}
 pitched(delay,ratio,k,reverse=false){const window=this.sr*(reverse?.12:.065);this.phase[k]+=(reverse?1+ratio:1-ratio)/window;this.phase[k]-=Math.floor(this.phase[k]);return this.grain(delay,ratio,this.phase[k],reverse);}
 tone(delay,cents,phase,k,dry,time){const q=this.q,applies=this.toneActive&&(q.toneRoute==='both'||q.toneRoute===(dry?'dry':'wet')),drift=applies?(+q.analogDrift||0)*28*Math.sin(time*4.3):0,move=applies?(+q.sourMove||0)*18*Math.sin(time*2.1):0,det=(dry?1:k%2?1:-1)*((+q.detune||0)+(applies?(+q.unison||0)*14+(+q.sour||0)**1.3*47.5+(+q.sourHigh||0)*Math.max(0,cents/100)*1.5+move:0)),glide=applies?(+q.glide||0)*cents*Math.exp(-this.age/(.008+(+q.glide||0)**2*.4)):0,ratio=2**((cents+det+drift-glide)/1200);let x=this.pitched(delay,ratio,k*4,!dry&&q.reverse);if(applies){if(q.unison)x=x*(1-q.unison*.45)+this.pitched(delay,2**((cents-det+drift)/1200),k*4+1,!dry&&q.reverse)*q.unison*.45;if(q.octaveUp)x+=this.pitched(delay,ratio*2,k*4+2,!dry&&q.reverse)*q.octaveUp*.55;if(q.sub>0)x+=this.pitched(delay,ratio*.5,k*4+3,!dry&&q.reverse)*q.sub*.65;this.low[k]+=this.toneLowCoeff*(x-this.low[k]);x+=this.low[k]*((+q.moreBass||0)*2.2+(q.sub<0?-1:0));x+=Math.sin(this.clock*1.731+k*2.17)*(+q.noise||0)*this.env*.8;const attack=(+q.envAttack||0)**2*1.5,decay=.008+(q.envDecay??.5)**2*.6,sustain=q.envSustain??1,attackGain=attack?Math.min(1,this.age/attack):1,decayGain=this.age<attack?1:sustain+(1-sustain)*Math.exp(-(this.age-attack)/decay);x*=attackGain*decayGain;if(this.env<.002&&q.envRelease)x*=Math.exp(-this.age/(.02+q.envRelease**2*.65));}return x;}
 tick(input,amount){this.amount+=(1-Math.exp(-1/(this.sr*.02)))*(amount-this.amount);amount=this.amount;const q=this.q,time=this.clock/this.sr;this.buffer[this.index]=input;this.env+=.005*(Math.abs(input)-this.env);if(this.env>.008&&this.envelope<=.008)this.age=0;this.envelope=this.env;this.age+=1/this.sr;this.outputs.fill(0);let dryDelta=0;if(amount>.00001){const pitchDry=q.pitchRoute==='dry'||q.pitchRoute==='both',toneDry=q.toneRoute==='dry'||q.toneRoute==='both';if(this.dryActive){const y=this.tone(1,pitchDry?(+q.pitch||0)*100:0,this.phase[0],8,true,time);dryDelta=(this.colours[4].tick(y,time)-input)*amount;}
 for(let k=0;k<this.delays.length;k++){const pitch=q.pitchRoute==='dry'?0:(+q.pitch||0)+this.pattern[k%this.pattern.length]+(+q.bend||0)*Math.min(1,(k+1)/3),ratio=2**(pitch/12),window=this.sr*(q.reverse?.12:.065);const dt=this.delays[k]*this.sr+(k%2?q.micro*this.sr/1000:0)+(q.wow||0)*this.sr*.0005*Math.sin(time*3.1)+(q.vibe||0)*this.sr*.0002*Math.sin(time*32);let y=this.tone(dt,pitch*100,this.phase[k],k,false,time);if(q.flange)y+=this.read(dt+this.sr*(.004+.002*Math.sin(time*1.45)))*q.flange*.45;y=this.filters[k].tick(y);const radius=clamp(q.distance+k*q.spread,.5,14),amp=(q.mode==='four'?.34:.54)*q.decay**k*this.comp*(k%2?1-(q.accent||0)*.65:1)/(1+Math.max(0,radius-1)*.08)/Math.sqrt(1+(+q.resonance||0)*4),v=y*amp;if(q.mode==='ping')this.outputs[k%2]+=v;else if(q.mode==='four'){for(let b=0;b<4;b++)this.outputs[b]+=v;}else if(q.mode==='over'){this.outputs[2]+=v*.65;this.outputs[3]+=v*.65;}else{this.outputs[0]+=v;this.outputs[1]+=v;}}
 const gain=amount*(+q.mix||0)*.85/(1+this.env*8);for(let b=0;b<4;b++)this.outputs[b]=this.colours[b].tick(this.outputs[b],time)*gain;}
 this.index=(this.index+1)&this.mask;this.clock++;this.dryDelta=dryDelta;return this.outputs;}
}

return {EffectCore};
})();



class VoxyProcessor extends AudioWorkletProcessor {
 constructor(options){super();const __o=options&&options.processorOptions;this.p={robot:0,clarity:.92,harmony:0,delay:0,warmth:0,bpm:112,key:0,scale:'minor',character:'classic',machineSeed:0,active:false,secondSource:'clean'};this.v={natural:1,vocoder:0,warmth:0};this.vocoder=new VoxyVocoder(sampleRate);this.second=new SecondVoiceCore(sampleRate);this.effect=new EffectCore(sampleRate);this.lastStep=-1;if(__o){Object.assign(this.p,__o);this.second.configure(this.p);this.effect.configure(this.p.effectSettings||{},this.p.bpm);}this.port.onmessage=e=>{if(e.data.reset){this.vocoder.reset();this.second.reset();this.effect.reset();this.lastStep=-1;}else{Object.assign(this.p,e.data);this.second.configure(this.p);this.effect.configure(this.p.effectSettings||{},this.p.bpm);}};}
 process(inputs,outputs){const out=outputs[0];if(!out?.length)return true;if(this.p.active===false){for(const bus of outputs)for(const ch of bus)ch.fill(0);return true;}const p=this.p,inp=inputs[0],tone=inputs[1],breath=inputs[2],secondOut=outputs[1],effectOut=outputs[2],natural=Number.isFinite(p.natural)?p.natural:1-p.robot,machine=Number.isFinite(p.vocoder)?p.vocoder:p.robot;this.vocoder.configure(130.8128*2**(p.key/12),p.character,p.scale,p.machineSeed,p);this.effect.block();
 for(let i=0;i<out[0].length;i++){let x=inp?.[0]?.[i]||0;if(inp?.length>1)x=(x+(inp[1]?.[i]||0))*.5;x=Number.isFinite(x)?Math.max(-3,Math.min(3,x)):0;this.v.natural+=.001*(natural-this.v.natural);this.v.vocoder+=.001*(machine-this.v.vocoder);this.v.warmth+=.001*(p.warmth-this.v.warmth);const read=bus=>bus?.length>1?((bus[0]?.[i]||0)+(bus[1]?.[i]||0))*.5:(bus?.[0]?.[i]||0);const needMachine=this.v.vocoder>.00001||p.secondSource==='machine',voc=needMachine?this.vocoder.tick(x,1,p.clarity,read(tone),read(breath)):0;let centre=x*this.v.natural+voc*this.v.vocoder;const drive=1+this.v.warmth*1.5;if(this.v.warmth>.0001)centre=Math.tanh(centre*drive)/drive*(1+this.v.warmth*.14);const second=this.second.tick(p.secondSource==='machine'?voc:x),fx=this.effect.tick(centre,p.delay);centre+=this.effect.dryDelta;for(const channel of out)channel[i]=Number.isFinite(centre)?centre:0;if(secondOut?.[0])secondOut[0][i]=second;for(let c=0;c<(effectOut?.length||0);c++)effectOut[c][i]=Number.isFinite(fx[c])?fx[c]:0;}
 if(this.second.step!==this.lastStep){this.lastStep=this.second.step;this.port.postMessage?.({step:this.lastStep});}return true;}
}
registerProcessor('voxy-processor',VoxyProcessor);

