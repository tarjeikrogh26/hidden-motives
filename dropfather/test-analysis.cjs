// node test-analysis.cjs — synthetic house track: tempo, bar grid and the drop where kick + bass return.
const assert=require('assert'),A=require('./src/analysis.js');
function track(bpm,start,bars,breakFrom,breakTo){
 const sr=22050,beat=60/bpm,n=Math.round((start+bars*4*beat)*sr)+sr,x=new Float32Array(n);let seed=1;const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647;
 for(let b=0;b<bars;b++)for(let q=0;q<4;q++){const t0=start+(b*4+q)*beat,i0=Math.round(t0*sr),brk=b>=breakFrom&&b<breakTo;
  if(!brk)for(let i=0;i<sr*.25;i++){const t=i/sr;x[i0+i]+=.8*Math.sin(2*Math.PI*(50+100*Math.exp(-t*30))*t)*Math.exp(-t*12);}
  if(!brk){const ib=Math.round((t0+beat/2)*sr);for(let i=0;i<sr*beat*.45;i++)x[ib+i]+=.3*Math.sin(2*Math.PI*55*i/sr)*Math.min(1,i/60);}
  const ih=Math.round((t0+beat/2)*sr);for(let i=0;i<sr*.03;i++)x[ih+i]+=.12*(rnd()*2-1)*Math.exp(-i/sr*80);}
 for(let i=0;i<n;i++)x[i]+=.05*Math.sin(2*Math.PI*220*i/sr);
 return x;
}
for(const [bpm,start] of [[124,.37],[128,1.1],[100,.05],[140,.6]]){
 const a=A.analyse(track(bpm,start,48,16,24)),bar=240/bpm,phase=((a.offset-start)%bar+bar)%bar;
 console.log(bpm,'→',a.bpm,'offset',a.offset.toFixed(3),'grid error',Math.min(phase,bar-phase).toFixed(3),'s · drops',a.candidates.map(c=>c.bar).join(','));
 assert(Math.abs(a.bpm-bpm)<.05,'tempo');
 assert(Math.min(phase,bar-phase)<.03,'bar 1 should sit on a downbeat');
 assert(a.candidates.some(c=>Math.abs(c.time-(start+24*bar))<.05),'drop at bar 25 (index 24)');
}
console.log('analysis ok');
