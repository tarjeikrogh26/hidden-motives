/* Norwegian Beats v46 worklets; added explicit disposal lifecycle. */
class L extends AudioWorkletProcessor{
static get parameterDescriptors(){return[{name:'cutoff',defaultValue:1000,minValue:10,maxValue:22000},{name:'res',defaultValue:0,minValue:0,maxValue:1,automationRate:'k-rate'},{name:'drive',defaultValue:1,minValue:.1,maxValue:8,automationRate:'k-rate'},{name:'poles',defaultValue:4,minValue:2,maxValue:4,automationRate:'k-rate'}];}
constructor(){super();this.disposed=false;this.port.onmessage=e=>{if(e.data?.type==='dispose')this.disposed=true;};this.s=new Float64Array(4);}
process(I,O,P){if(this.disposed)return false;const o=O[0]&&O[0][0];if(!o)return true;const x=I[0]&&I[0][0],n=o.length,c=P.cutoff,k=P.res[0]*3.9,dr=P.drive[0],two=P.poles[0]<3,s=this.s,sr=sampleRate,comp=(1+k*.35)/Math.max(1,dr*.6);
let fc=-1,G=0,G2=0,G3=0,G4=0,b=0;
for(let i=0;i<n;i++){const f=Math.min(c.length>1?c[i]:c[0],sr*.45);if(f!==fc){fc=f;const g=Math.tan(Math.PI*f/sr);G=g/(1+g);b=1/(1+g);G2=G*G;G3=G2*G;G4=G3*G;}
const xin=x?x[i]*dr:0,S=b*(G3*s[0]+G2*s[1]+G*s[2]+s[3]),y4=(G4*xin+S)/(1+k*G4);let u=Math.tanh(xin-k*y4),y=0,y2=0;
for(let j=0;j<4;j++){const v=(u-s[j])*G;y=v+s[j];s[j]=y+v;u=y;if(j===1)y2=y;}
o[i]=(two?y2:y)*comp;}
return true;}}
registerProcessor('nb-ladder',L);
class FS extends AudioWorkletProcessor{static get parameterDescriptors(){return[{name:'shift',defaultValue:0,minValue:-3000,maxValue:3000,automationRate:'k-rate'},{name:'mix',defaultValue:.5,minValue:0,maxValue:1,automationRate:'k-rate'}];}
constructor(){super();this.disposed=false;this.port.onmessage=e=>{if(e.data?.type==='dispose')this.disposed=true;};this.ca=[.6923878,.9360654322959,.988229522686,.9987488452737].map(x=>x*x);this.cb=[.4021921162426,.856171088242,.9722909545651,.9952884791278].map(x=>x*x);
this.sa=new Float64Array(16);this.sb=new Float64Array(16);this.ph=0;this.pb=0;}
process(I,O,P){if(this.disposed)return false;const x=I[0]&&I[0][0],o=O[0][0];if(!x){o.fill(0);return true;}const w=2*Math.PI*P.shift[0]/sampleRate,mx=P.mix[0],A=this.sa,B=this.sb,ca=this.ca,cb=this.cb;
for(let i=0;i<o.length;i++){let ya=x[i],yb=x[i];
for(let k=0;k<4;k++){const j=k*4;let y=ca[k]*(ya+A[j+3])-A[j+1];A[j+1]=A[j];A[j]=ya;A[j+3]=A[j+2];A[j+2]=y;ya=y;
y=cb[k]*(yb+B[j+3])-B[j+1];B[j+1]=B[j];B[j]=yb;B[j+3]=B[j+2];B[j+2]=y;yb=y;}
const ybd=this.pb;this.pb=yb;const sh=ya*Math.cos(this.ph)-ybd*Math.sin(this.ph);this.ph+=w;if(this.ph>6.283185307)this.ph-=6.283185307;else if(this.ph<0)this.ph+=6.283185307;
o[i]=x[i]*(1-mx)+sh*mx;}return true;}}
registerProcessor('nb-fshift',FS);
class CR extends AudioWorkletProcessor{static get parameterDescriptors(){return[{name:'bits',defaultValue:16,minValue:2,maxValue:16,automationRate:'k-rate'},{name:'down',defaultValue:1,minValue:1,maxValue:40,automationRate:'k-rate'}];}
constructor(){super();this.disposed=false;this.port.onmessage=e=>{if(e.data?.type==='dispose')this.disposed=true;};this.ph=0;this.h=0;}
process(I,O,P){if(this.disposed)return false;const x=I[0]&&I[0][0],o=O[0][0];if(!x){o.fill(0);return true;}const L=Math.pow(2,P.bits[0]-1),d=P.down[0];
for(let i=0;i<o.length;i++){this.ph+=1;if(this.ph>=d){this.ph-=d;this.h=Math.round(x[i]*L)/L;}o[i]=this.h;}return true;}}
registerProcessor('nb-crush',CR);