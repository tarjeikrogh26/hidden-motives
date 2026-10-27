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
const api={guess,render,peaks,MODES:{beats:'Beats',tones:'Tones',repitch:'Re-pitch',off:'Off'}};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.DropWarp=api;
})(typeof globalThis!=='undefined'?globalThis:this);
