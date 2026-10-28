/* PUMP FICTION v0.5 by Tarjei Krogh: its engine functions, copied unchanged by tools/extract-pumpfiction.mjs.
   PumpFictionEngine(cfg) gives one chain bound to its own settings object. */
window.PumpFictionEngine=function(cfg){
const fclamp=(v,lo,hi)=>Math.min(hi,Math.max(lo,v)),round1=n=>Math.round(n*10)/10,dbfs=x=>20*Math.log10(Math.max(1e-10,x));
function unit(){return 60/cfg.bpm/4;}
function levelStepAt(t){
 const q=unit(),len=cfg.count,cyc=q*len;if(!cfg.enabled||cfg.depth<=0||!cfg.steps.some(x=>x>0))return {since:Infinity,lev:0};
 let within=((t%cyc)+cyc)%cyc;
 for(let k=len-1;k>=0;k--){let j=k,shift=(j%2)?cfg.swing/100*q*.48:0;
  const at=j*q+shift;
  if(cfg.steps[j]&&at<=within)return {since:within-at,lev:cfg.steps[j]/3};
 }
 for(let k=len-1;k>=0;k--){const shift=(k%2)?cfg.swing/100*q*.48:0;
  if(cfg.steps[k])return {since:within+cyc-(k*q+shift),lev:cfg.steps[k]/3};
 }
 return {since:Infinity,lev:0};
}
function gainAt(t){
 const {since,lev}=levelStepAt(t);if(!isFinite(since))return 1;
 const depth=cfg.depth/100*lev,attack=.005,release=.035+cfg.release*.011;
 if(cfg.env==='draw'){
   const u=Math.max(0,Math.min(1,since/release)),x=u*(cfg.drawn.length-1),i=Math.floor(x),f=x-i;
   const a=cfg.drawn[i],b=cfg.drawn[Math.min(i+1,cfg.drawn.length-1)];
   const custom=u>=1?1:a+(b-a)*f;
   return Math.max(.0001,Math.min(1,1-depth*(1-custom)));
 }
 if(since<attack)return 1-depth*since/attack;
 const u=Math.max(0,(since-attack)/release);
 let fade=cfg.env==='gate'?(u<.72?1:Math.max(0,1-(u-.72)/.28)):cfg.env==='snap'?Math.exp(-u*5):Math.exp(-u*2.2);
 return Math.max(.0001,Math.min(1,1-depth*fade));
}
function distortion(amount){const n=4096,c=new Float32Array(n),k=1+amount*.135;for(let i=0;i<n;i++){const x=2*i/(n-1)-1;c[i]=amount?Math.tanh(x*k)/Math.tanh(k):x;}return c;}
function dryWet(n){if(!n)return;const v=cfg.mix/100;n.dry.gain.value=cfg.bypass?1:Math.cos(v*Math.PI/2);n.wet.gain.value=cfg.bypass?0:Math.sin(v*Math.PI/2);n.processed.gain.value=cfg.bypass?0:1;n.original.gain.value=cfg.bypass?1:0;}
function smartClipCurve(mode,db){
 const length=4096,c=new Float32Array(length);
 if(db<.05){for(let i=0;i<length;i++)c[i]=2*i/(length-1)-1;return c;}
 // Fixed-wave soft or hard clip after input boost; 4x oversampling minimizes aliasing.
 for(let i=0;i<length;i++){
  const x=(i/(length-1)*2-1);
  c[i]=mode==='hard'?fclamp(x*1.45,-.86,.86)/.86:Math.tanh(x*1.92)/Math.tanh(1.92);
 }
 return c;
}
function makeNodes(ac,source,dest){
 const input=ac.createGain(),dry=ac.createGain(),wet=ac.createGain(),sum=ac.createGain(),processed=ac.createGain(),original=ac.createGain(),out=ac.createGain(),match=ac.createGain(),lim=ac.createDynamicsCompressor(),an=ac.createAnalyser();
 const bandSum=ac.createGain(),lo=ac.createBiquadFilter(),hi=ac.createBiquadFilter(),comp=ac.createDynamicsCompressor(),pump=ac.createGain();
 const smartEQ=[ac.createBiquadFilter(),ac.createBiquadFilter(),ac.createBiquadFilter(),ac.createBiquadFilter()];
 for(let i=0;i<4;i++){smartEQ[i].type=['lowshelf','peaking','peaking','highshelf'][i];smartEQ[i].frequency.value=[112,350,3200,8800][i];if(i===1||i===2)smartEQ[i].Q.value=.85;}
 const clipPre=ac.createGain(),clipShape=ac.createWaveShaper(),clipPost=ac.createGain();clipShape.oversample='4x';
 lo.type='lowshelf';lo.frequency.value=170;hi.type='highshelf';hi.frequency.value=3400;
 const bands=[];
 function filter(type,f){let n=ac.createBiquadFilter();n.type=type;n.frequency.value=f;n.Q.value=Math.SQRT1_2;return n;}
 for(const band of [0,1,2]){
   let node=input;
   const stages=band===0?[['lowpass',160],['lowpass',160]]:band===1?[['highpass',160],['highpass',160],['lowpass',2600],['lowpass',2600]]:[['highpass',2600],['highpass',2600]];
   for(const [type,f] of stages){const bi=filter(type,f);node.connect(bi);node=bi;}
   const pre=ac.createGain(),shaper=ac.createWaveShaper(),post=ac.createGain(),level=ac.createGain();shaper.oversample='4x';
   node.connect(pre);pre.connect(shaper);shaper.connect(post);post.connect(level);level.connect(bandSum);
   bands.push({pre,shaper,post,level});
 }
 const attackHP=filter('highpass',125),transientDry=ac.createGain(),transientComp=ac.createDynamicsCompressor(),transientInverse=ac.createGain(),transientBus=ac.createGain();
 transientComp.attack.value=.040;transientComp.release.value=.12;transientComp.threshold.value=-23;transientComp.ratio.value=7;transientComp.knee.value=8;
 lim.threshold.value=-1.2;lim.knee.value=0;lim.ratio.value=20;lim.attack.value=.003;lim.release.value=.09;an.fftSize=2048;
 source.connect(input);
 input.connect(dry);dry.connect(sum);
 bandSum.connect(lo);lo.connect(hi);hi.connect(smartEQ[0]);for(let i=0;i<3;i++)smartEQ[i].connect(smartEQ[i+1]);smartEQ[3].connect(comp);comp.connect(pump);
 hi.connect(attackHP);attackHP.connect(transientDry);attackHP.connect(transientComp);transientComp.connect(transientInverse);
 transientDry.connect(transientBus);transientInverse.connect(transientBus);transientBus.connect(pump);
 pump.connect(wet);wet.connect(sum);
 sum.connect(clipPre);clipPre.connect(clipShape);clipShape.connect(clipPost);clipPost.connect(match);match.connect(lim);lim.connect(out);out.connect(processed);processed.connect(an);
 input.connect(original);original.connect(an);an.connect(dest);
 const n={bands,transientDry,transientInverse,lo,hi,smartEQ,comp,pump,dry,wet,sum,clipPre,clipShape,clipPost,processed,original,out,match,lim,an};applyNodes(n);return n;
}
function applyNodes(n){
 if(!n)return;
 const strengths=[cfg.subDrive,cfg.midDrive,cfg.airDrive];
 n.bands.forEach((band,i)=>{
   const amount=Math.max(0,Math.min(100,strengths[i]*(.30+cfg.drive/100*1.15)));
   band.shaper.curve=distortion(amount);
   band.pre.gain.value=1+amount*.015;
   band.post.gain.value=1/Math.sqrt(1+amount*.045);
   band.level.gain.value=1;
 });
 n.transientDry.gain.value=cfg.punch*.008;
 n.transientInverse.gain.value=-cfg.punch*.008;
 n.lo.gain.value=cfg.body*.09;n.hi.gain.value=cfg.bite*.075;
 n.smartEQ.forEach((eq,i)=>{eq.gain.value=[cfg.eqLow||0,cfg.eqMud||0,cfg.eqPresence||0,cfg.eqAir||0][i];});
 n.comp.threshold.value=cfg.autoThreshold===null?(-10-cfg.glue*.23):cfg.autoThreshold;n.comp.ratio.value=cfg.autoRatio===null?(1+cfg.glue*.052):cfg.autoRatio;
 n.clipPre.gain.value=Math.pow(10,(cfg.clipDb||0)/20);n.clipShape.curve=smartClipCurve(cfg.clipMode||'soft',cfg.clipDb||0);n.clipPost.gain.value=Math.pow(10,-(cfg.clipDb||0)*.45/20);
 n.comp.attack.value=.013;n.comp.release.value=.11+cfg.glue*.0025;
 n.out.gain.value=Math.pow(10,cfg.output/20);n.match.gain.value=cfg.matchScale||1;dryWet(n);
}
function fftSpectrum(win){
 const N=win.length,re=new Float64Array(N),im=new Float64Array(N);
 for(let i=0;i<N;i++){
  let k=i,rev=0;
  for(let j=1;j<N;j<<=1){rev=(rev<<1)|(k&1);k>>=1;}
  re[rev]=win[i]*(.5-.5*Math.cos(2*Math.PI*i/(N-1)));
 }
 for(let len=2;len<=N;len<<=1){
  const angle=-2*Math.PI/len,ur=Math.cos(angle),ui=Math.sin(angle);
  for(let i=0;i<N;i+=len){let wr=1,wi=0;for(let j=0;j<len/2;j++){
   const k=i+j,l=k+len/2,tr=wr*re[l]-wi*im[l],ti=wr*im[l]+wi*re[l];
   re[l]=re[k]-tr;im[l]=im[k]-ti;re[k]+=tr;im[k]+=ti;
   const next=wr*ur-wi*ui;wi=wr*ui+wi*ur;wr=next;
  }}
 }
 return {re,im};
}
function analyzeBuffer(buffer){
 const sr=buffer.sampleRate,len=buffer.length,ch=Math.min(2,buffer.numberOfChannels);
 if(len<2048)throw Error('Lydfilen er for kort. Trenger minst 2048 samples.');
 const A=buffer.getChannelData(0),B=ch>1?buffer.getChannelData(1):A;
 let peak=0,energy=0,count=0,cross=0,el=0,er=0;
 const stride=Math.max(1,Math.floor(len/550000));
 for(let i=0;i<len;i+=stride){const x=A[i],y=B[i];peak=Math.max(peak,Math.abs(x),Math.abs(y));energy+=(x*x+y*y)*.5;cross+=x*y;el+=x*x;er+=y*y;count++;}
 const rms=Math.sqrt(energy/Math.max(1,count));
 const N=2048,windows=Math.min(92,Math.max(18,Math.floor(buffer.duration*6))),sum=new Float64Array(5);
 let weighted=0,total=0,transient=0,oldEnergy=0,active=0;
 for(let w=0;w<windows;w++){
  const at=Math.floor(w/(windows-1)*Math.max(0,len-N)),frame=new Float64Array(N);
  let frameE=0;
  for(let j=0;j<N;j++){const val=(A[at+j]+B[at+j])*.5;frame[j]=val;frameE+=val*val;}
  frameE=Math.sqrt(frameE/N);if(w>0)transient+=Math.max(0,frameE-oldEnergy);oldEnergy=frameE;
  if(frameE<.00015)continue;
  active++;
  const {re,im}=fftSpectrum(frame);
  for(let k=1;k<N/2;k++){
   const f=k*sr/N,p=re[k]*re[k]+im[k]*im[k];
   const bi=f<140?0:f<650?1:f<2600?2:f<7500?3:4;
   sum[bi]+=p;weighted+=p*f;total+=p;
  }
 }
 const pct=Array.from(sum,v=>total>0?v/total:0),centroid=weighted/Math.max(1e-12,total);
 const crest=fclamp(dbfs(peak)-dbfs(rms),0,35);
 const stereo=fclamp(cross/Math.sqrt(Math.max(1e-14,el*er)),-1,1);
 let kind='FULL MIX';
 if(pct[0]+pct[1]>.78&&centroid<1000)kind='BASS / LOW END';
 else if(crest>13&&centroid>1100)kind='DRUMS / TRANSIENTS';
 else if(centroid>2300)kind='BRIGHT / PERCUSSIVE';
 else if(pct[2]+pct[3]>.68)kind='SYNTH / MIDRANGE';
 if(buffer.duration>18&&kind==='BASS / LOW END')kind='BASS-HEAVY MIX';
 const stats={rms,peak,rmsDb:dbfs(rms),peakDb:dbfs(peak),crest,centroid,pct,stereo,kind,transient:transient/Math.max(1,active)};
 return stats;
}
function variantSet(a){
 const bass=a.pct[0]+a.pct[1],top=a.pct[3]+a.pct[4],trans=a.crest;
 const m=a.kind==='BASS / LOW END'||a.kind==='BASS-HEAVY MIX',dr=a.kind==='DRUMS / TRANSIENTS';
 const low=fclamp((.30-bass)*4.4,-1.65,1.55),mud=fclamp((.16-a.pct[1])*4,-1.7,1.5),presence=fclamp((.27-a.pct[3])*.9,-.7,.75),air=fclamp((.17-top)*3.4,-1.6,1.5);
 const th=fclamp(a.rmsDb+(trans>12?2:-1),-34,-9),clipMax=trans>12?5.5:3.8;
 function make(name,desc,add){
  return {name,desc,eqLow:round1(fclamp(low+add.low,-4,4)),eqMud:round1(fclamp(mud+add.mud,-4,4)),eqPresence:round1(fclamp(presence+add.presence,-4,4)),eqAir:round1(fclamp(air+add.air,-4,4)),
   autoThreshold:round1(fclamp(th+add.th,-38,-6)),autoRatio:round1(add.ratio),clipDb:round1(add.clip),clipMode:add.cm,drive:add.drive,body:add.body,glue:add.glue,bite:add.bite,mix:add.mix,output:add.output,subDrive:add.sub,midDrive:add.mid,airDrive:add.hi,punch:add.punch,depth:add.depth,enabled:add.depth>0,release:add.release,env:add.env||'smooth'};
 }
 return {
 clean:make('CLEAN','Fjerner litt overskudd og bevarer transienter; skånsom kompresjon og soft clip.',{low:0,mud:-.45,presence:0,air:.15,th:4.5,ratio:1.7,clip:1.1,cm:'soft',drive:13,body:6,glue:22,bite:1,mix:74,output:-1.4,sub:2,mid:21,hi:7,punch:dr?19:8,depth:0,release:65}),
 fat:make('FAT','Mer kropp, tettere kompresjon og kontrollert soft clipping. Subben holdes ren.',{low:m?.15:1.25,mud:.3,presence:.25,air:-.65,th:-1.5,ratio:3.1,clip:Math.min(4.6,clipMax),cm:'soft',drive:61,body:m?22:42,glue:51,bite:1,mix:95,output:-3,sub:3,mid:71,hi:19,punch:dr?39:17,depth:0,release:50}),
 wild:make('WILD','Kraftigere saturation og clipping samt synkopert pumping – bevisst kreativ karakter.',{low:m?-.2:.9,mud:-.6,presence:1.15,air:.3,th:-5.2,ratio:5.3,clip:Math.min(8.4,clipMax+2.4),cm:'hard',drive:86,body:m?18:31,glue:70,bite:22,mix:100,output:-5.2,sub:6,mid:91,hi:43,punch:dr?49:27,depth:69,release:42,env:'snap'})
 };
}
return {makeNodes,applyNodes,gainAt,analyzeBuffer,variantSet};
};
window.PUMP_FICTION={defaults:{drive:45,body:35,glue:40,bite:8,mix:100,output:-3,depth:78,release:42,swing:0,bpm:124,pattern:0,preset:0,count:16,steps:Array(16).fill(0),enabled:true,bypass:false,mode:'track',env:'smooth',matchScale:1,subDrive:4,midDrive:50,airDrive:18,punch:12,drawn:Array.from({length:64},(_,i)=>1-Math.exp(-i/63*4)),eqLow:0,eqMud:0,eqPresence:0,eqAir:0,clipDb:0,clipMode:'soft',autoThreshold:null,autoRatio:null,smartId:'',chaosSeed:null},patterns:[
{0:3,4:3,8:3,12:3},{2:3,6:3,10:3,14:3},{0:3,8:3},{0:3,3:2,4:3,8:3,11:2,12:3},
{0:3,5:2,7:1,10:3,13:2},{0:3,1:2,3:3,4:2,6:3,8:3,9:2,11:2,12:3,14:2,15:3},
{0:3,3:1,6:2,8:3,10:1,14:3},{0:3,2:2,4:3,6:2,8:3,10:2,12:3,14:2},
{0:3,3:2,6:3,9:2,12:3,15:2},{0:3,2:1,4:2,7:1,8:3,11:2,12:2,15:1},
{0:3,3:2,5:2,8:3,11:2,13:2},{0:3,3:2,6:2,8:3,11:1,14:2},
{0:3,4:1,8:3,12:1},{0:3,1:2,4:3,5:2,8:3,9:2,12:3,13:2},
{0:3,5:2,10:3,15:2},{1:3,4:2,7:3,8:1,11:3,14:2},
{0:3,8:2},{0:3,2:3,8:3,10:3},{0:3,4:3,7:2,10:3,14:2},{0:2,1:3,5:2,7:3,11:2,14:3},
{0:3,8:3},{0:3,3:2,4:2,7:1,8:3,11:2,12:2,15:1},
{0:3,1:1,5:3,7:2,10:3,11:1,14:2},{0:3,1:2,2:2,3:1,4:3,5:2,6:2,7:1,8:3,9:2,10:2,11:1,12:3,13:2,14:2,15:1}],presets:[
['FAT BASS',65,48,48,-9,100,-4,70,52,0,0],['SUB TUNNEL',27,80,48,-36,100,-3,89,62,0,0],['DIRTY TECHNO',87,40,62,38,94,-6,92,34,13,2],
['EBM ENGINE',78,60,58,18,100,-5,85,36,12,1],['DARK DISCO',58,42,39,17,100,-3,78,50,18,0],['RUBBER BASS',52,72,49,-12,100,-3,82,31,8,1],
['SLAM DRUMS',72,33,78,29,100,-6,26,17,6,2],['GOLDEN SATURATION',31,38,20,-12,78,-2,15,60,16,0],['NEON STABS',60,19,43,25,100,-4,85,55,3,0],
['ACID TOOTH',86,26,33,48,100,-6,82,29,8,1],['BASS CLOUD',39,77,53,-18,83,-3,49,69,16,0],['MACHINE GUN',85,32,46,57,100,-7,96,12,5,2],
['HARD PUMP',60,43,54,8,100,-4,100,63,0,0],['GENTLE PULSE',18,12,23,-4,72,-1.5,36,67,16,0],['MASTER GLUE',12,8,28,0,72,-1.5,10,67,0,0],
['CLEAN TRANSIENT',0,0,10,9,100,-2,0,45,0,0],['BROKEN FACTORY',91,41,70,54,95,-8,89,14,22,2],['PSY TRANCE PUMP',57,40,49,19,100,-4,91,34,0,1],
['SUBTLE WARMTH',19,30,19,-16,80,-1,8,70,0,0],['AIR COMP',25,6,72,54,84,-3,38,38,11,1]],macros:{
 fatter:{drive:76,subDrive:5,midDrive:86,airDrive:23,punch:18,body:42,glue:40,bite:5,mix:95,output:-5,depth:18,enabled:true},
 punchier:{drive:48,subDrive:6,midDrive:49,airDrive:26,punch:85,body:13,glue:22,bite:28,mix:90,output:-4,depth:12,enabled:true},
 warmer:{drive:40,subDrive:3,midDrive:63,airDrive:5,punch:14,body:26,glue:31,bite:-23,mix:89,output:-3,depth:8,enabled:true},
 tighter:{drive:35,subDrive:0,midDrive:47,airDrive:14,punch:68,body:-12,glue:62,bite:17,mix:85,output:-3,depth:28,release:25,enabled:true},
 louder:{drive:57,subDrive:7,midDrive:61,airDrive:30,punch:25,body:22,glue:72,bite:18,mix:100,output:-2,depth:12,enabled:true}
}};
