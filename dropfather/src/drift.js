/* DRIFT SONATA in Dropfather: Tarjei Krogh's string, choir and pad engine (WASM in an AudioWorklet, with its
   choir and cello recordings), its 111 sounds as Dropfather leads. Chords render offline in batches, one slot
   each with room for the tail, are level-matched and reused. */
(function(root){'use strict';
const data=()=>root.DRIFT_DATA||{ids:[],sounds:[]};
let moduleJob=null,zonesJob=null,workletURL=null;const modules=new WeakMap();
const bytes=b64=>Uint8Array.from(atob(b64),c=>c.charCodeAt(0));
const wasm=()=>moduleJob||(moduleJob=WebAssembly.compile(bytes(root.DRIFT_WASM_B64)));
// The choir and cello recordings, decoded once.
function zones(){return zonesJob||(zonesJob=(async()=>{const c=new OfflineAudioContext(1,1,44100),out=[];for(const s of root.DRIFT_SAMPLES||[]){try{const b=await c.decodeAudioData(bytes(s.b64).buffer);out.push({fam:s.fam,root:s.root,sr:b.sampleRate,data:b.getChannelData(0).slice()});}catch(e){}}return out;})());}
// Some pages refuse a blob: worklet (a file opened locally), others a data: one, so try both (as DriftSonata does).
function addModule(ctx){
 if(!modules.has(ctx)){const code=root.document.getElementById('driftWorklet').textContent;workletURL=workletURL||URL.createObjectURL(new Blob([code],{type:'application/javascript'}));
  modules.set(ctx,ctx.audioWorklet.addModule(workletURL).catch(()=>ctx.audioWorklet.addModule('data:application/javascript;base64,'+btoa(unescape(encodeURIComponent(code))))));}
 return modules.get(ctx);
}
const READY=new Map(),JOBS=new Map(),TARGET=.034;
const keyOf=(sr,i,notes,dur,vel)=>[sr,i,notes.join('.'),Math.round(dur*1000),vel].join('|');
// Render chords in one offline pass: each in its own slot, then cut out, trimmed at the end of its tail and level-matched.
function renderBatch(sr,s,items){
 const todo=items.filter(it=>!JOBS.has(it.key));if(!todo.length)return Promise.all(items.map(it=>JOBS.get(it.key)));
 const job=(async()=>{
  const [module,zs]=await Promise.all([wasm(),zones()]),ids=data().ids,vals=s.values.slice(),at=id=>ids.indexOf(id);
  vals[at('freeze')]=0;const tail=Math.min(9,vals[at('release')]*1.2+2.5),fr=x=>Math.round(x*sr),events=[],slots=[];let t=.05;
  for(const it of todo){events.push({f:fr(t),on:it.notes,v:Math.max(.2,it.vel/127)},{f:fr(t+it.dur),off:it.notes});slots.push({it,a:fr(t),b:fr(t+it.dur+tail)});t+=it.dur+tail;}
  const c=new OfflineAudioContext(2,fr(t)+256,sr);await addModule(c);
  const node=new AudioWorkletNode(c,'drift-df',{numberOfInputs:0,outputChannelCount:[2],processorOptions:{module,params:vals,zones:zs,events,seed:4711+s.i,bpm:120}});node.connect(c.destination);
  const all=await c.startRendering(),L=all.getChannelData(0),R=all.getChannelData(1),out={};
  for(const sl of slots){
   let end=sl.a;for(let i=sl.b-1;i>sl.a;i--)if(Math.abs(L[i])>1e-4||Math.abs(R[i])>1e-4){end=i;break;}
   const n=Math.max(256,end-sl.a+256),buf=new AudioBuffer({numberOfChannels:2,length:n,sampleRate:sr}),bl=buf.getChannelData(0),br=buf.getChannelData(1);bl.set(L.subarray(sl.a,sl.a+n));br.set(R.subarray(sl.a,sl.a+n));
   const hop=Math.round(sr*.02);let sum=0,cnt=0,peak=0;for(let a=0;a<n;a+=hop){let e=0;for(let i=a;i<Math.min(n,a+hop);i++){e+=bl[i]*bl[i]+br[i]*br[i];peak=Math.max(peak,Math.abs(bl[i]),Math.abs(br[i]));}e/=2*hop;if(e>1e-6){sum+=e;cnt++;}}
   const g=cnt?Math.min(TARGET/Math.sqrt(sum/cnt),.95/(peak||1)):1;for(const d of [bl,br])for(let i=0;i<n;i++)d[i]*=g*Math.min(1,(n-1-i)/256);
   READY.set(sl.it.key,buf);out[sl.it.key]=buf;
  }
  while(READY.size>400){const k=READY.keys().next().value;READY.delete(k);JOBS.delete(k);}
  return out;
 })();
 for(const it of todo)JOBS.set(it.key,job);job.catch(()=>{for(const it of todo)JOBS.delete(it.key);});
 return Promise.all(items.map(it=>JOBS.get(it.key)));
}
function create(ctx,dest,s){
 const srcs=new Set(),sr=ctx.sampleRate,item=(notes,dur,vel)=>({notes,dur:Math.max(.05,dur),vel,key:keyOf(sr,s.i,notes,dur,vel)});
 return {
  prepare(list){return renderBatch(sr,s,list.map(x=>item(x.chord?.length?x.chord:[x.midi],x.duration,x.velocity)));},
  play({midi,chord,time,duration,velocity}){
   const it=item(chord?.length?chord:[midi],duration,velocity),b=READY.get(it.key);
   // A chord just drawn while looping is rendered for the next pass.
   if(!b){renderBatch(sr,s,[it]).catch(()=>{});return;}
   const src=ctx.createBufferSource();src.buffer=b;src.connect(dest);src.start(time);srcs.add(src);src.onended=()=>srcs.delete(src);
  },
  dispose(){for(const x of srcs)try{x.stop();}catch(e){}srcs.clear();}
 };
}
const sounds=()=>data().sounds.map((s,i)=>({...s,i}));
function registerAll(){const L=root.DropLead;if(!L?.register||!root.DRIFT_WASM_B64)return;for(const s of sounds())L.register('drift'+s.i,{name:'Drift · '+s.name,voicing:'triad',create:(ctx,dest)=>create(ctx,dest,s)});}
registerAll();
const api={sounds,create};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.DriftSonata=api;
})(typeof globalThis!=='undefined'?globalThis:this);
