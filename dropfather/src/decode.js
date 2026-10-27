/* Dropfather audio import: everything the browser can decode (MP3, M4A/AAC, MP4, FLAC, OGG, Opus, WebM, WAV …),
   plus AIFF/AIFC, PCM CAF and unusual WAV variants read here, because Chrome and Firefox do not decode AIFF at all. */
(function(root){'use strict';
const ACCEPT='audio/*,video/mp4,video/webm,.wav,.wave,.bwf,.aif,.aiff,.aifc,.mp3,.m4a,.m4b,.mp4,.aac,.adts,.flac,.ogg,.oga,.opus,.webm,.weba,.caf,.alac,.3gp,.mka,.mkv';
const tag=(v,o)=>String.fromCharCode(v.getUint8(o),v.getUint8(o+1),v.getUint8(o+2),v.getUint8(o+3));

// 80-bit IEEE extended (AIFF sample rate).
function extended(v,o){const exp=v.getUint16(o)&0x7fff,sign=v.getUint16(o)&0x8000?-1:1,hi=v.getUint32(o+2),lo=v.getUint32(o+6);if(!exp&&!hi&&!lo)return 0;return sign*(hi*2**(exp-16383-31)+lo*2**(exp-16383-63));}

function pcm(v,o,frames,channels,bits,little,float){
 const out=Array.from({length:channels},()=>new Float32Array(frames)),bytes=bits/8;
 for(let i=0;i<frames;i++)for(let c=0;c<channels;c++){const p=o+(i*channels+c)*bytes;let x;
  if(float)x=bits===64?v.getFloat64(p,little):v.getFloat32(p,little);
  else if(bits===8)x=little?(v.getUint8(p)-128)/128:v.getInt8(p)/128;
  else if(bits===16)x=v.getInt16(p,little)/32768;
  else if(bits===24){const b0=v.getUint8(p),b1=v.getUint8(p+1),b2=v.getUint8(p+2);let n=little?b0|b1<<8|b2<<16:b2|b1<<8|b0<<16;if(n&0x800000)n-=0x1000000;x=n/8388608;}
  else x=v.getInt32(p,little)/2147483648;
  out[c][i]=x;}
 return out;
}

function aiff(buf){
 const v=new DataView(buf);if(tag(v,0)!=='FORM')return null;const kind=tag(v,8);if(kind!=='AIFF'&&kind!=='AIFC')return null;
 let o=12,comm=null,data=-1;
 while(o+8<=v.byteLength){const id=tag(v,o),size=v.getUint32(o+4),body=o+8;
  if(id==='COMM'){comm={channels:v.getInt16(body),frames:v.getUint32(body+2),bits:v.getInt16(body+6),rate:extended(v,body+8),type:kind==='AIFC'&&size>=22?tag(v,body+18):'NONE'};}
  if(id==='SSND')data=body+8+v.getUint32(body);
  o=body+size+(size&1);}
 if(!comm||data<0)throw Error('This AIFF file has no audio data.');
 const t=comm.type.trim().toLowerCase(),little=t==='sowt',float=t==='fl32'||t==='fl64';
 if(!['none','sowt','fl32','fl64','in24','in32','twos'].includes(t))throw Error(`Compressed AIFC (${comm.type}) is not supported. Export it as WAV or plain AIFF.`);
 const bits=float?(t==='fl64'?64:32):Math.ceil(comm.bits/8)*8,frames=Math.min(comm.frames,Math.floor((v.byteLength-data)/(bits/8*comm.channels)));
 return {rate:comm.rate,channels:pcm(v,data,frames,comm.channels,bits,little,float)};
}

function wave(buf){
 const v=new DataView(buf),riff=tag(v,0);if((riff!=='RIFF'&&riff!=='RF64')||tag(v,8)!=='WAVE')return null;
 let o=12,fmt=null,data=-1,dataSize=0;
 while(o+8<=v.byteLength){const id=tag(v,o);let size=v.getUint32(o+4,true);const body=o+8;
  if(id==='fmt '){let format=v.getUint16(body,true);if(format===0xfffe)format=v.getUint16(body+24,true);fmt={format,channels:v.getUint16(body+2,true),rate:v.getUint32(body+4,true),bits:v.getUint16(body+14,true)};}
  if(id==='data'){data=body;dataSize=size===0xffffffff?v.byteLength-body:size;break;}
  o=body+size+(size&1);}
 if(!fmt||data<0)throw Error('This WAV file has no audio data.');
 if(fmt.format!==1&&fmt.format!==3)throw Error('Compressed WAV is not supported. Export it as PCM WAV.');
 const frames=Math.floor(Math.min(dataSize,v.byteLength-data)/(fmt.bits/8*fmt.channels));
 return {rate:fmt.rate,channels:pcm(v,data,frames,fmt.channels,fmt.bits,true,fmt.format===3)};
}

// Core Audio Format with uncompressed PCM ('lpcm'), as Logic and Apple tools write it.
function caf(buf){
 const v=new DataView(buf);if(tag(v,0)!=='caff')return null;let o=8,desc=null,data=-1,end=v.byteLength;
 while(o+12<=v.byteLength){const id=tag(v,o),size=Number(v.getBigInt64(o+4)),body=o+12;
  if(id==='desc')desc={rate:v.getFloat64(body),format:tag(v,body+8),flags:v.getUint32(body+12),channels:v.getUint32(body+24),bits:v.getUint32(body+28)};
  if(id==='data'){data=body+4;end=size<0?v.byteLength:Math.min(v.byteLength,body+size);break;}
  o=body+size;}
 if(!desc||data<0)throw Error('This CAF file has no audio data.');
 if(desc.format!=='lpcm')throw Error(`CAF with ${desc.format.trim()} audio (e.g. Apple Lossless) opens in Safari; in Chrome, export as WAV, FLAC or AAC M4A.`);
 const frames=Math.floor((end-data)/(desc.bits/8*desc.channels));
 return {rate:desc.rate,channels:pcm(v,data,frames,desc.channels,desc.bits,!!(desc.flags&2),!!(desc.flags&1))};
}

async function decode(ctx,file){
 const bytes=await file.arrayBuffer();
 try{return await ctx.decodeAudioData(bytes.slice(0));}
 catch(err){
  const own=aiff(bytes)||wave(bytes)||caf(bytes);
  if(own){const b=new AudioBuffer({numberOfChannels:own.channels.length,length:Math.max(1,own.channels[0].length),sampleRate:own.rate});own.channels.forEach((d,c)=>b.copyToChannel(d,c));return b;}
  const ext=(file.name.split('.').pop()||'').toLowerCase();
  throw Error(`This browser cannot decode .${ext} (${file.type||'unknown type'}). ${['caf','alac','m4a'].includes(ext)?'Apple Lossless/CAF opens in Safari; in Chrome, export as WAV, FLAC or AAC M4A.':'Try Chrome or Safari, or export it as WAV, FLAC or MP3.'}`);
 }
}
const api={ACCEPT,decode,aiff,wave,caf};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.DropDecode=api;
})(typeof globalThis!=='undefined'?globalThis:this);
