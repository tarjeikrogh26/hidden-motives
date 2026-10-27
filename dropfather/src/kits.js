/* Dropfather drum kits: Stanley Cupid's own recordings from Norwegian Beats (window.NB_DRUMS), or Dropfather's synth drums.
   Each lane's hit is decoded once per sample rate, pitched and layered as the kit says, and level-matched to the
   synth hit of the same lane, so the mix knobs mean the same for every kit. */
(function(root){'use strict';
const SYNTH='synth',LANES=['kick','clap','snare','hat','open'];
const data=()=>root.NB_DRUMS||{kits:[],sounds:{}};
function list(){return [{id:SYNTH,n:'Dropfather synth'},...data().kits.map(k=>({id:k.id,n:k.n}))];}
const has=id=>id===SYNTH||data().kits.some(k=>k.id===id);

const decoded=new Map();// sampleRate|sound → Promise<Float32Array[]>
function sound(sr,id){
 const key=sr+'|'+id;if(decoded.has(key))return decoded.get(key);
 const s=data().sounds[id];if(!s)return Promise.reject(Error('missing drum sound '+id));
 const bytes=Uint8Array.from(atob(s.d),c=>c.charCodeAt(0)),ctx=new OfflineAudioContext(1,1,sr);
 const job=ctx.decodeAudioData(bytes.buffer).then(b=>Array.from({length:b.numberOfChannels},(_,c)=>b.getChannelData(c).slice()));
 decoded.set(key,job);job.catch(()=>decoded.delete(key));return job;
}
// Pitch by resampling (up = shorter), like a sampler without time-stretch.
function pitched(chs,semis){if(!semis)return chs;const r=2**(semis/12);return chs.map(d=>{const n=Math.max(1,Math.floor(d.length/r)),o=new Float32Array(n);for(let i=0;i<n;i++){const p=i*r,k=Math.floor(p),f=p-k;o[i]=d[k]*(1-f)+(d[k+1]||0)*f;}return o;});}
// Loudest 30 ms window: how hard a hit lands, more than its peak.
function punch(chs,sr){const w=Math.max(1,Math.round(sr*.03)),d=chs[0];let best=0;for(let a=0;a<d.length;a+=Math.max(1,w>>2)){let e=0;for(const c of chs)for(let i=a;i<Math.min(d.length,a+w);i++)e+=c[i]*c[i];best=Math.max(best,e/(w*chs.length));}return Math.sqrt(best);}
const peak=chs=>chs.reduce((m,d)=>{for(const v of d)m=Math.max(m,Math.abs(v));return m;},0);

const built=new Map();// sampleRate|kit|lane → Promise<Float32Array[]>
// One lane of a kit as channel data, or null for the synth kit (callers then use the synth hit).
function lane(sr,kitId,laneKey,synthHit){
 if(!kitId||kitId===SYNTH)return Promise.resolve(null);
 const kit=data().kits.find(k=>k.id===kitId),spec=kit?.L[laneKey];if(!spec)return Promise.resolve(null);
 const key=sr+'|'+kitId+'|'+laneKey;if(built.has(key))return built.get(key);
 const job=(async()=>{
  const [id,semis=0,layer,layerLevel=0,layerSemis=0]=spec;let chs=pitched(await sound(sr,id),semis);
  if(layer){const l=pitched(await sound(sr,layer),layerSemis),n=Math.max(chs[0].length,l[0].length);chs=chs.map((d,c)=>{const o=new Float32Array(n);o.set(d);const ld=l[Math.min(c,l.length-1)];for(let i=0;i<ld.length;i++)o[i]+=ld[i]*layerLevel;return o;});}
  // Match the synth hit's punch, but never past full scale.
  const target=synthHit?punch([synthHit],sr):.3,own=punch(chs,sr)||1,pk=peak(chs)||1,gain=Math.min(target/own,.98/pk);
  return chs.map(d=>d.map(v=>v*gain));
 })();
 built.set(key,job);job.catch(()=>built.delete(key));return job;
}
function toBuffer(ctx,chs){const b=ctx.createBuffer(chs.length,chs[0].length,ctx.sampleRate);chs.forEach((d,c)=>b.copyToChannel(d,c));return b;}
const api={SYNTH,LANES,list,has,lane,toBuffer};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.DropKits=api;
})(typeof globalThis!=='undefined'?globalThis:this);
