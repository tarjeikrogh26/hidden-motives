/* Dropfather file saving. Inside a claude.ai artifact files go through the downloads capability, which takes zip
   but not wav/mid, so those are packed into a zip there. Opened as a local file, the browser saves them directly. */
(function(root){'use strict';
const saver=root.claude?.use?root.claude.use('downloads').catch(()=>null):Promise.resolve(null);
const CRC=Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
// Stored (uncompressed) zip of one or more files: [{name, bytes}].
function zipFiles(files){
 const parts=[],centrals=[];let offset=0;
 const head=(sig,extra)=>{const h=new DataView(new ArrayBuffer(extra));h.setUint32(0,sig,true);return h;};
 for(const {name,bytes} of files){
  let crc=~0;for(let i=0;i<bytes.length;i++)crc=CRC[(crc^bytes[i])&255]^(crc>>>8);crc=~crc>>>0;
  const n=new TextEncoder().encode(name);
  const local=head(0x04034b50,30+n.length);local.setUint16(4,20,true);local.setUint16(6,0x800,true);local.setUint32(14,crc,true);local.setUint32(18,bytes.length,true);local.setUint32(22,bytes.length,true);local.setUint16(26,n.length,true);new Uint8Array(local.buffer).set(n,30);
  const central=head(0x02014b50,46+n.length);central.setUint16(4,20,true);central.setUint16(6,20,true);central.setUint16(8,0x800,true);central.setUint32(16,crc,true);central.setUint32(20,bytes.length,true);central.setUint32(24,bytes.length,true);central.setUint16(28,n.length,true);central.setUint32(42,offset,true);new Uint8Array(central.buffer).set(n,46);
  parts.push(local.buffer,bytes);centrals.push(central.buffer);offset+=local.byteLength+bytes.length;
 }
 const size=centrals.reduce((a,c)=>a+c.byteLength,0),end=head(0x06054b50,22);end.setUint16(8,files.length,true);end.setUint16(10,files.length,true);end.setUint32(12,size,true);end.setUint32(16,offset,true);
 return new Blob([...parts,...centrals,end.buffer]);
}
const zip=(name,bytes)=>zipFiles([{name,bytes}]);
// Read a zip (stored or deflated) into {name: Uint8Array}, through its central directory.
async function unzip(blob){
 const b=new Uint8Array(await blob.arrayBuffer()),v=new DataView(b.buffer),out={};let e=-1;
 for(let i=b.length-22;i>=Math.max(0,b.length-65557);i--)if(v.getUint32(i,true)===0x06054b50){e=i;break;}
 if(e<0)throw Error('not a zip file');
 let o=v.getUint32(e+16,true);const count=v.getUint16(e+10,true);
 for(let k=0;k<count;k++){
  if(v.getUint32(o,true)!==0x02014b50)throw Error('damaged zip');
  const method=v.getUint16(o+10,true),size=v.getUint32(o+20,true),nl=v.getUint16(o+28,true),xl=v.getUint16(o+30,true),cl=v.getUint16(o+32,true),at=v.getUint32(o+42,true);
  const name=new TextDecoder().decode(b.subarray(o+46,o+46+nl)),start=at+30+v.getUint16(at+26,true)+v.getUint16(at+28,true),data=b.subarray(start,start+size);
  if(!name.endsWith('/'))out[name]=method===0?data.slice():method===8?new Uint8Array(await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer()):null;
  o+=46+nl+xl+cl;
 }
 return out;
}
// Resolves true when saved; report(text, isError) gets the reason when it is not.
async function download(bytes,name,type,report=()=>{}){
 const downloads=await saver;
 if(downloads){const packed=!/\.(json|txt|csv|zip)$/.test(name);try{await downloads.save({filename:packed?name.replace(/\.[^.]+$/,'')+'.zip':name,data:packed?zip(name,bytes):new Blob([bytes])});return true;}catch(e){report(e?.code==='declined'?'Save cancelled.':'Could not save: '+(e?.message||e?.code||e),e?.code!=='declined');return false;}}
 const url=URL.createObjectURL(new Blob([bytes],{type})),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),4000);return true;
}
root.DropFiles={download,zip,zipFiles,unzip};
})(typeof globalThis!=='undefined'?globalThis:this);
