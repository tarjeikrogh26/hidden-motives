/* Dropfather warp: audio clips follow the song tempo, as in Ableton's warp modes.
   Beats: cut at the hits and move each slice to its new time (drums and loops, no smearing).
   Tones: WSOLA time-stretch (overlapping grains lined up by correlation) for pads, vocals and melodies.
   Re-pitch: plays faster or slower, so the pitch follows the tempo. Off: as recorded.
   Transpose (Beats and Tones) resamples and stretches back, so the length stays on the grid. */
(function(root){'use strict';

// Tempo of a clip. Loops (up to 20 s) are guessed as a whole number of bars nearest the song tempo;
// longer audio goes through Dropfather's tempo and downbeat analysis.
async function guess(buffer,songBpm){
 const dur=buffer.duration;
 if(dur<=20){let best=null;for(const bars of [.25,.5,1,2,4,8,16]){const bpm=bars*4*60/dur;if(bpm<70||bpm>190)continue;const score=Math.abs(Math.log(bpm/songBpm));if(!best||score<best.score)best={bpm,bars,score,offset:0};}
  if(best)return {bpm:+best.bpm.toFixed(2),bars:best.bars,offset:0,loop:true};}
 const A=root.DropAnalysis;if(!A)return {bpm:songBpm,bars:Math.max(1,Math.round(dur/(240/songBpm))),offset:0,loop:false};
 const c=new OfflineAudioContext(1,Math.ceil(dur*A.SR),A.SR),s=c.createBufferSource();s.buffer=buffer;s.connect(c.destination);s.start();
 const mono=(await c.startRendering()).getChannelData(0),a=A.analyse(mono);
 return {bpm:+a.bpm.toFixed(2),bars:Math.max(1,Math.round((dur-a.offset)/(240/a.bpm))),offset:+a.offset.toFixed(3),loop:false};
}

const chans=b=>Array.from({length:b.numberOfChannels},(_,c)=>b.getChannelData(c));
function resample(data,rate){const n=Math.max(1,Math.floor(data.length/rate)),o=new Float32Array(n);for(let i=0;i<n;i++){const p=i*rate,k=Math.floor(p),f=p-k;o[i]=(data[k]||0)*(1-f)+(data[k+1]||0)*f;}return o;}

// Onsets: rises in short-time energy, at least 50 ms apart.
function onsets(chs,sr){
 const hop=Math.round(sr*.005),n=Math.floor(chs[0].length/hop),e=new Float32Array(n);
 for(let i=0;i<n;i++){let s=0;for(const d of chs)for(let j=i*hop;j<(i+1)*hop;j++)s+=d[j]*d[j];e[i]=Math.sqrt(s/hop/chs.length);}
 const out=[0];let last=-1e9;for(let i=4;i<n;i++){const prev=Math.max(e[i-1],e[i-2],e[i-3],e[i-4]);if(e[i]>.02&&e[i]>prev*1.9&&(i-last)*hop>sr*.05){out.push(i*hop);last=i;}}
 return out;
}
// Beats mode: each slice starts at its scaled time; a slice longer than its new room gets a short fade.
function beats(chs,sr,ratio){
 const cuts=onsets(chs,sr),len=Math.round(chs[0].length*ratio),out=chs.map(()=>new Float32Array(len)),fade=Math.round(sr*.004);
 cuts.forEach((a,i)=>{const b=i+1<cuts.length?cuts[i+1]:chs[0].length,to=Math.round(a*ratio),room=Math.round((b-a)*ratio),n=Math.min(b-a,room,len-to);
  for(let c=0;c<chs.length;c++)for(let j=0;j<n;j++)out[c][to+j]+=chs[c][a+j]*Math.min(1,(n-j)/fade);});
 return out;
}
// Tones mode: WSOLA. Grains of 46 ms, half overlap, each lined up within ±12 ms by cross-correlation.
function wsola(chs,sr,ratio){
 const W=Math.round(sr*.046)&~1,H=W/2,tol=Math.round(sr*.012),len=Math.round(chs[0].length*ratio),out=chs.map(()=>new Float32Array(len+W)),win=new Float32Array(W);
 for(let i=0;i<W;i++)win[i]=.5-.5*Math.cos(2*Math.PI*i/W);
 const mono=chs.length>1?chs[0].map((v,i)=>(v+chs[1][i])/2):chs[0];let prev=0;
 for(let o=0;o<len;o+=H){
  const ideal=Math.round(o/ratio);let best=Math.max(0,Math.min(mono.length-W,ideal));
  if(o>0){const want=prev+H;let bestScore=-Infinity;for(let d=-tol;d<=tol;d+=2){const s=ideal+d;if(s<0||s+W>=mono.length)continue;let sc=0;for(let j=0;j<H;j+=4)sc+=mono[s+j]*mono[want+j];if(sc>bestScore){bestScore=sc;best=s;}}}
  for(let c=0;c<chs.length;c++)for(let j=0;j<W;j++)out[c][o+j]+=(chs[c][best+j]||0)*win[j];
  prev=best;
 }
 return out.map(d=>d.subarray(0,len));
}
const cache=new Map();
// A clip as it sounds in the song: {warp, bpm, semis, offset} against the song tempo. Returns an AudioBuffer.
function render(buffer,clip,songBpm,sr){
 const key=[clip.sample,clip.warp,clip.bpm,clip.semis||0,clip.offset||0,songBpm,sr].join('|');if(cache.has(key))return cache.get(key);
 let chs=chans(buffer).map(d=>d.subarray(Math.round((clip.offset||0)*buffer.sampleRate)));const inSr=buffer.sampleRate;
 if(inSr!==sr)chs=chs.map(d=>resample(d,inSr/sr));
 const ratio=clip.warp==='off'||!clip.bpm?1:clip.bpm/songBpm,semis=clip.semis||0;
 if(clip.warp==='repitch')chs=chs.map(d=>resample(d,1/ratio*2**(semis/12)));
 else if(clip.warp==='beats'||clip.warp==='tones'){
  let r=ratio;if(semis){chs=chs.map(d=>resample(d,2**(semis/12)));r=ratio*2**(semis/12);}
  if(Math.abs(r-1)>.002)chs=clip.warp==='beats'?beats(chs,sr,r):wsola(chs,sr,r);
 }
 const out=new AudioBuffer({numberOfChannels:Math.max(2,chs.length),length:Math.max(1,chs[0].length),sampleRate:sr});
 out.copyToChannel(chs[0],0);out.copyToChannel(chs[1]||chs[0],1);
 if(cache.size>40)cache.delete(cache.keys().next().value);cache.set(key,out);return out;
}
// Peaks for drawing a waveform: n columns of [min, max].
function peaks(buffer,n){const d=buffer.getChannelData(0),step=Math.max(1,Math.floor(d.length/n)),out=[];for(let i=0;i<n;i++){let lo=0,hi=0;for(let j=i*step;j<Math.min(d.length,(i+1)*step);j+=4){const v=d[j];if(v<lo)lo=v;if(v>hi)hi=v;}out.push([lo,hi]);}return out;}
// Key of a recording: a chromagram (11 kHz, 90 s from the middle) against the Krumhansl-Kessler key profiles.
async function key(buffer){
 const SR=11025,dur=Math.min(buffer.duration,90),from=Math.max(0,(buffer.duration-dur)/2),c=new OfflineAudioContext(1,Math.ceil(dur*SR),SR),s=c.createBufferSource();s.buffer=buffer;s.connect(c.destination);s.start(0,from,dur);
 const x=(await c.startRendering()).getChannelData(0),N=4096,chroma=new Float64Array(12),re=new Float64Array(N),im=new Float64Array(N),win=new Float64Array(N).map((_,i)=>.5-.5*Math.cos(2*Math.PI*i/N));
 for(let o=0;o+N<=x.length;o+=N/2){
  for(let i=0;i<N;i++){re[i]=x[o+i]*win[i];im[i]=0;}fft(re,im);
  for(let k=Math.ceil(55*N/SR);k<Math.min(N/2,2000*N/SR);k++){const f=k*SR/N,m=Math.sqrt(re[k]*re[k]+im[k]*im[k]),pc=((Math.round(12*Math.log2(f/440))+69)%12+12)%12;chroma[pc]+=m;}
 }
 const MAJ=[6.35,2.23,3.48,2.33,4.38,4.09,2.52,5.19,2.39,3.66,2.29,2.88],MIN=[6.33,2.68,3.52,5.38,2.6,3.53,2.54,4.75,3.98,2.69,3.34,3.17];
 const corr=(prof,r)=>{const xs=[...chroma],ys=prof.map((_,i)=>prof[(i-r+12)%12]),mx=xs.reduce((a,b)=>a+b)/12,my=ys.reduce((a,b)=>a+b)/12;let n=0,dx=0,dy=0;for(let i=0;i<12;i++){n+=(xs[i]-mx)*(ys[i]-my);dx+=(xs[i]-mx)**2;dy+=(ys[i]-my)**2;}return n/Math.sqrt(dx*dy||1);};
 let best={key:9,scale:'minor',r:-2};for(let r=0;r<12;r++){const a=corr(MAJ,r),b=corr(MIN,r);if(a>best.r)best={key:r,scale:'major',r:a};if(b>best.r)best={key:r,scale:'minor',r:b};}
 return {key:best.key,scale:best.scale,confidence:+best.r.toFixed(2)};
}
function fft(re,im){const n=re.length;for(let i=1,j=0;i<n;i++){let bit=n>>1;for(;j&bit;bit>>=1)j^=bit;j^=bit;if(i<j){[re[i],re[j]]=[re[j],re[i]];[im[i],im[j]]=[im[j],im[i]];}}
 for(let len=2;len<=n;len<<=1){const ang=-2*Math.PI/len,wr=Math.cos(ang),wi=Math.sin(ang);for(let i=0;i<n;i+=len){let cr=1,ci=0;for(let j=0;j<len/2;j++){const a=i+j,b=a+len/2,tr=re[b]*cr-im[b]*ci,ti=re[b]*ci+im[b]*cr;re[b]=re[a]-tr;im[b]=im[a]-ti;re[a]+=tr;im[a]+=ti;const t=cr*wr-ci*wi;ci=cr*wi+ci*wr;cr=t;}}}}
const api={guess,key,render,peaks,MODES:{beats:'Beats',tones:'Tones',repitch:'Re-pitch',off:'Off'}};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.DropWarp=api;
})(typeof globalThis!=='undefined'?globalThis:this);
