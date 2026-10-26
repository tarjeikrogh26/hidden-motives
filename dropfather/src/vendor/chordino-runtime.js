/* Browser/Node bridge to Chordino, GPL-2.0-or-later. No audio leaves the device. */
(function(root){'use strict';
function fft(re,im){const n=re.length;for(let i=1,j=0;i<n;i++){let bit=n>>1;for(;j&bit;bit>>=1)j^=bit;j^=bit;if(i<j){[re[i],re[j]]=[re[j],re[i]];[im[i],im[j]]=[im[j],im[i]];}}for(let len=2;len<=n;len<<=1){const angle=-2*Math.PI/len,wr0=Math.cos(angle),wi0=Math.sin(angle);for(let base=0;base<n;base+=len){let wr=1,wi=0;for(let j=0;j<len/2;j++){const a=base+j,b=a+len/2,tr=re[b]*wr-im[b]*wi,ti=re[b]*wi+im[b]*wr;re[b]=re[a]-tr;im[b]=im[a]-ti;re[a]+=tr;im[a]+=ti;const next=wr*wr0-wi*wi0;wi=wr*wi0+wi*wr0;wr=next;}}}}
async function analyse(samples,sr,progress=()=>{},wasmBytes){
 if(sr!==22050)throw Error('Chordino krever 22050 Hz i denne versjonen.');
 const bytes=wasmBytes||await fetch('chordino.wasm?v=04').then(r=>{if(!r.ok)throw Error('Kunne ikke laste Chordino-motoren.');return r.arrayBuffer();});let e;
 const data=()=>new DataView(e.memory.buffer),zero=(a,b)=>{data().setUint32(a,0,true);data().setUint32(b,0,true);return 0;};
 const wasi={args_get:()=>0,args_sizes_get:zero,environ_get:()=>0,environ_sizes_get:zero,fd_fdstat_get:(fd,p)=>{new Uint8Array(e.memory.buffer,p,24).fill(0);return 0;},fd_read:(fd,p,n,out)=>{data().setUint32(out,0,true);return 0;},fd_seek:()=>70,fd_close:()=>0,fd_write:(fd,p,n,out)=>{const v=data();let bytes=0;for(let i=0;i<n;i++)bytes+=v.getUint32(p+i*8+4,true);v.setUint32(out,bytes,true);return 0;},proc_exit:code=>{throw Error('Chordino avsluttet med kode '+code);}};
 const module=await WebAssembly.instantiate(bytes,{wasi_snapshot_preview1:wasi});e=module.instance.exports;e._initialize();
 const n=16384,hop=2048,re=new Float64Array(n),im=new Float64Array(n),win=Float64Array.from({length:n},(_,i)=>.5-.5*Math.cos(2*Math.PI*i/(n-1)));
 try{if(!e.chord_init(sr,n,hop))throw Error('Chordino kunne ikke starte.');const ptr=e.chord_input();
 for(let frame=0;frame<samples.length;frame+=hop){im.fill(0);for(let k=0;k<n;k++)re[k]=(samples[frame+k-n/2]||0)*win[k];fft(re,im);const input=new Float32Array(e.memory.buffer,ptr,n+2);for(let k=0;k<=n/2;k++){input[k*2]=re[k];input[k*2+1]=im[k];}e.chord_frame(frame/sr);if(frame%(hop*32)===0)progress(frame/samples.length*.8);}
 progress(.85);const length=e.chord_finish(),ptrOut=e.chord_result();const result=JSON.parse(new TextDecoder().decode(new Uint8Array(e.memory.buffer,ptrOut,length)));progress(1);return result;
 }finally{e.chord_dispose();}
}
const api={analyse};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.Chordino=api;
})(typeof globalThis!=='undefined'?globalThis:this);
