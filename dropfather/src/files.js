/* Dropfather file saving. Inside a claude.ai artifact files go through the downloads capability, which takes zip
   but not wav/mid, so those are packed into a zip there. Opened as a local file, the browser saves them directly. */
(function(root){'use strict';
const saver=root.claude?.use?root.claude.use('downloads').catch(()=>null):Promise.resolve(null);
const CRC=Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
function zip(name,bytes){
 let crc=~0;for(let i=0;i<bytes.length;i++)crc=CRC[(crc^bytes[i])&255]^(crc>>>8);crc=~crc>>>0;
 const n=new TextEncoder().encode(name),head=(sig,extra)=>{const h=new DataView(new ArrayBuffer(extra));h.setUint32(0,sig,true);return h;};
 const local=head(0x04034b50,30+n.length);local.setUint16(4,20,true);local.setUint16(6,0x800,true);local.setUint32(14,crc,true);local.setUint32(18,bytes.length,true);local.setUint32(22,bytes.length,true);local.setUint16(26,n.length,true);new Uint8Array(local.buffer).set(n,30);
 const central=head(0x02014b50,46+n.length);central.setUint16(4,20,true);central.setUint16(6,20,true);central.setUint16(8,0x800,true);central.setUint32(16,crc,true);central.setUint32(20,bytes.length,true);central.setUint32(24,bytes.length,true);central.setUint16(28,n.length,true);new Uint8Array(central.buffer).set(n,46);
 const end=head(0x06054b50,22);end.setUint16(8,1,true);end.setUint16(10,1,true);end.setUint32(12,central.byteLength,true);end.setUint32(16,local.byteLength+bytes.length,true);
 return new Blob([local.buffer,bytes,central.buffer,end.buffer]);
}
// Resolves true when saved; report(text, isError) gets the reason when it is not.
async function download(bytes,name,type,report=()=>{}){
 const downloads=await saver;
 if(downloads){const packed=!/\.(json|txt|csv|zip)$/.test(name);try{await downloads.save({filename:packed?name.replace(/\.[^.]+$/,'')+'.zip':name,data:packed?zip(name,bytes):new Blob([bytes])});return true;}catch(e){report(e?.code==='declined'?'Save cancelled.':'Could not save: '+(e?.message||e?.code||e),e?.code!=='declined');return false;}}
 const url=URL.createObjectURL(new Blob([bytes],{type})),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),4000);return true;
}
root.DropFiles={download,zip};
})(typeof globalThis!=='undefined'?globalThis:this);
