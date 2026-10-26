/* Post-processing for actual Chordino NNLS outputs. Confidence is evidence, not probability. */
(function(root){'use strict';
const PC={C:0,D:2,E:4,F:5,G:7,A:9,B:11};
const TYPES={maj:[0,4,7],min:[0,3,7],sus2:[0,2,7],sus4:[0,5,7],dim:[0,3,6],aug:[0,4,8],'6':[0,4,7,9],m6:[0,3,7,9],'7':[0,4,7,10],m7:[0,3,7,10],maj7:[0,4,7,11],m7b5:[0,3,6,10]};
function parse(label){if(label==='N')return null;const m=/^([A-G])([b#]?)([^/]*)(?:\/([A-G])([b#]?))?$/.exec(label);if(!m)return null;const pc=(n,a)=>(PC[n]+(a==='#'?1:a==='b'?-1:0)+12)%12,quality=m[3]===''?'maj':m[3]==='m'?'min':m[3];return {root:pc(m[1],m[2]),quality:TYPES[quality]?quality:'maj',bass:m[4]?pc(m[4],m[5]):pc(m[1],m[2]),label};}
function partition(analysis){
 const bassSegments=(analysis.bassSegments||analysis.segments).map(s=>({...s})),segments=[];
 for(const s of analysis.segments){const last=segments[segments.length-1];if(last&&last.root===s.root&&last.quality===s.quality&&last.silent===s.silent&&!!last.edited===!!s.edited&&Math.abs(last.end-s.start)<.001)last.end=s.end;else segments.push({...s});}
 // A passing bass pitch is not a new chord. Keep the independent bass timeline.
 for(const s of segments){const weights=Array(12).fill(0);for(const b of bassSegments){const overlap=Math.max(0,Math.min(s.end,b.end)-Math.max(s.start,b.start));if(overlap)weights[b.bass]+=overlap;}if(!s.edited)s.bass=weights.indexOf(Math.max(...weights));}
 return {...analysis,segments,bassSegments,analysisVersion:5};
}
function finish(raw,{bpm,offset,duration,waveform=[]}){
 const frames=raw.frames,chords=raw.chords.filter((x,i,a)=>!i||x[0]>a[i-1][0]),N=frames.length;if(!N)throw Error('Analysen fant ingen lydrammer.');
 // NNLS bass chroma is A-based, independently of the chord root and inversions.
 // The original bass window heavily suppresses notes above E3. Use the actual
 // NNLS semitone activations as a second bass view, especially for missing fundamentals.
 const observations=frames.map(f=>{const acts=f.slice(25),region=acts.slice(6,39).sort((a,b)=>a-b),floor=region[Math.floor(region.length/2)]*1.15,wide=Array(12).fill(0),low=Array.from({length:12},(_,pc)=>f[1+(pc+3)%12]);for(let note=27;note<=59;note++)wide[note%12]=Math.max(wide[note%12],Math.max(0,acts[note-21]-floor));const wn=wide.reduce((a,b)=>a+b,0)||1,ln=low.reduce((a,b)=>a+b,0)||1;return wide.map((x,pc)=>.85*x/wn+.15*low[pc]/ln);});
 const bass=observations.map((f,i)=>Array.from({length:12},(_,pc)=>{let sum=0,weight=0;for(let k=Math.max(0,i-1);k<=Math.min(N-1,i+1);k++){const w=k===i?2:1;sum+=w*observations[k][pc];weight+=w;}return sum/weight;}));
 const emissions=bass.map(row=>{const norm=row.reduce((a,b)=>a+b,0)||1;return row.map(x=>Math.log(.006+x/norm));});
 let dp=emissions[0].slice();const back=[];
 for(let i=1;i<N;i++){const prev=new Uint8Array(12),next=[];for(let j=0;j<12;j++){let best=-Infinity;for(let k=0;k<12;k++){const v=dp[k]-(k===j?0:.2);if(v>best){best=v;prev[j]=k;}}next[j]=best+emissions[i][j];}back.push(prev);dp=next;}
 const path=new Uint8Array(N);path[N-1]=dp.indexOf(Math.max(...dp));for(let i=N-2;i>=0;i--)path[i]=back[i][path[i+1]];
 if(N>3&&path[1]===path[2]&&path[2]===path[3])path[0]=path[1];
 const segments=[];let chordIndex=0;
 for(let i=0;i<N;i++){
  const f=frames[i],a=f[0],end=Math.min(duration,i+1<N?frames[i+1][0]:duration);if(end<=a)continue;
  while(chordIndex+1<chords.length&&chords[chordIndex+1][0]<=a+.00001)chordIndex++;
  let chord=parse(chords[chordIndex]?.[1]||'N');
  // The first centered FFT is zero padded; do not invent an initial rest from that edge alone.
  if(!chord&&a<.19&&chordIndex+1<chords.length&&chords[chordIndex+1][0]<.19)chord=parse(chords[chordIndex+1][1]);
  const sorted=bass[i].slice().sort((a,b)=>b-a),margin=(sorted[0]-sorted[1])/(sorted[0]+1e-8),treble=f.slice(13,25),sum=treble.reduce((a,b)=>a+b,0)||1;
  const coverage=chord?TYPES[chord.quality].reduce((v,k)=>v+treble[(chord.root+k+3)%12],0)/sum:0;
  const clarity=Math.max(0,Math.min(1,.65*coverage+.35*margin)),silent=!chord;
  const s={start:(a-offset)*bpm/60,end:(end-offset)*bpm/60,root:chord?.root??0,quality:chord?.quality??'maj',bass:path[i],clarity:+clarity.toFixed(3),silent,edited:false,label:chord?.label??'N'};
  const last=segments[segments.length-1];if(last&&last.root===s.root&&last.quality===s.quality&&last.bass===s.bass&&last.silent===silent){last.end=s.end;last.clarity=Math.min(last.clarity,s.clarity);}else segments.push(s);
 }
 return partition({bpm,offset,duration,segments,waveform,verified:false,method:'Chordino 0.3 / NNLS-Chroma (QMUL), global tuning + harmonic note decomposition + separate continuous bass decoding'});
}
const api={parse,finish,partition,TYPES};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.HarmonyEngine=api;
})(typeof globalThis!=='undefined'?globalThis:this);
