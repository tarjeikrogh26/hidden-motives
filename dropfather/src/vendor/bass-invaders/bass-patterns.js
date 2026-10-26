/* Bass phrase generation and MIDI import. Quarter-note beats, 4/4. */
(function(root){'use strict';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),mod=(a,b)=>(a%b+b)%b;
const rng=seed=>()=>{seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};
const genres={
 ebm:{label:'EBM',tag:'MACHINE',description:'Tette 16-deler · sure oscillatorer · rytmiske hull',references:'DAF-retningen du beskrev: korte maskinriff, raske sekstendeler og pauser.'},
 edm:{label:'EDM',tag:'PRESSURE',description:'Tydelig offbeat · kraft · få, store bevegelser',references:'Din kommersielle house / EDM-retning: Swedish House Mafia og Axwell / Ingrosso som lydlige holdepunkter.'},
 house:{label:'HOUSE',tag:'DRIVE',description:'Stram groove · synkoper · bass som hook',references:'Hovedreferanse: Inland Knights – Gonna Miss You (Chemars Remix), bekreftet av bildet ditt. Freemasons er en sekundær retning. Korte, hørbare basshook med luft og lang levetid i loop.'},
 disco:{label:'DISCO',tag:'REPEAT',description:'Dansbar repetisjon · oktaver · små svar',references:'Junior Jack / Stupid Disco som retningspeker: en tydelig gjentakende bassfigur.'},
 funk:{label:'FUNKY RIFF',tag:'POCKET',description:'Enkel funkiness · hørbart riff · ingen soloøvelse',references:'B-52’s og White Stripes der riffene har luft. Pixies brukes mer forsiktig. Rock Your Body, Another One Bites the Dust, Billie Jean, Thriller, Beat It, Get Lucky, Ghetto Supastar og Avenues. Korte, tydelige figurer som tåler gjentakelse. Freemasons og Kraak & Smaak er også holdepunkter.'},
 motor:{label:'80s MOTOR',tag:'EIGHTHS',description:'Åttendeler · melodisk driv · transponert riff',references:'Vitalic, Erasure og Dragostea Din Tei slik du beskrev retningen. Egen knapp for åttendelsbassen.'},
 hiphop:{label:'HIP-HOP',tag:'LOW POCKET',description:'70–100 BPM · luft · rund og tydelig bass',references:'Funky basshook i roligere tempo. Et kort melodisk motiv med tunge anslag, lommer av stillhet og lite fyll.'},
 acid:{label:'ACID / ELECTRO',tag:'BITE',description:'Bitt · filterbevegelse · kort og pågående',references:'Satisfaction / Benny Benassi og Klaas-retningen du beskrev, pluss mulighet for 303-lydene. Dette er din arbeidskategori, ikke en streng sjangerfasit.'}
};
const defaults={
 ebm:{bpm:120,preset:'dafsour',density:84,space:20,spastic:24,moves:45,gate:66,swing:0,accent:48,slide:18,sour:55,cut:38,res:42,drive:48},
 edm:{bpm:124,preset:'sub37',density:65,space:25,spastic:8,moves:35,gate:61,swing:2,accent:36,slide:20,sour:18,cut:41,res:24,drive:32},
 house:{bpm:123,preset:'body:round',density:80,space:26,spastic:0,moves:70,gate:68,swing:10,accent:48,slide:0,snote:0,dust:0,development:12,turnaround:12,sour:0,cut:61,res:6,drive:16},
 disco:{bpm:124,preset:'jupbass',density:72,space:24,spastic:6,moves:55,gate:70,swing:6,accent:52,slide:8,sour:12,cut:46,res:20,drive:23},
 funk:{bpm:103,preset:'body:finger',density:65,space:34,spastic:2,moves:60,gate:65,swing:13,accent:60,slide:0,snote:0,dust:0,spunk:18,rhythmic:7,development:12,turnaround:12,sour:0,cut:60,res:5,drive:12},
 motor:{bpm:120,preset:'sourcebass',density:100,space:0,spastic:0,moves:100,gate:78,swing:0,accent:36,slide:0,dust:0,snote:0,rhythmic:0,sour:22,cut:43,res:27,drive:30},
 hiphop:{bpm:88,preset:'body:round',density:65,space:45,spastic:0,moves:65,gate:74,swing:22,accent:58,slide:0,snote:0,dust:0,rhythmic:0,development:0,turnaround:0,sour:0,cut:58,res:5,drive:10},
 acid:{bpm:122,preset:'msgrowl',density:78,space:20,spastic:18,moves:35,gate:54,swing:0,accent:55,slide:31,sour:22,cut:40,res:58,drive:65}
};
for(const d of Object.values(defaults)){d.development=30;d.turnaround=45;}
const tempoRange=genre=>genre==='hiphop'?[70,100]:[100,125];
function randomTempo(genre,seed=1){const [lo,hi]=tempoRange(genre);return lo+Math.floor(rng(seed+9743)()*(hi-lo+1));}
// Riff profiles describe musical intent; actual motifs are generated procedurally below.
const riffProfiles={
 auto:{label:'Retningens eget riff',description:'Rytme og tonebevegelse følger valgt bassretning.'},
 houseLoop:{label:'House-loop · hovedreferansen',description:'Et kort, hørbart hook med synkoper og luft. Din hovedreferanse: Inland Knights – Gonna Miss You (Chemars Remix).'},
 air:{label:'Riff med luft · B-52’s / White Stripes',description:'Få toner, markante hull og korte svar. Ingen jevn rockabilly-rulling.'},
 pop:{label:'Funky hook · korte melodiske figurer',description:'Rock Your Body / Billie Jean / Queen-retningen. Rundt anslag, tydelig melodisk krok og plass mellom tonene.'},
 octave:{label:'Åttendeler · oktav opp / ned',description:'En egen motor: grunntone og oktav veksler, med en liten skjev tone mot slutten.'}
};
function vary(notes,{seed=1,phraseBars=4}={}){const R=rng(seed),out=notes.map(n=>n?{...n}:null),candidates=notes.flatMap((n,i)=>n&&i>=16&&(i% (phraseBars*16))>= (phraseBars-1)*16?[i]:[]);if(!candidates.length)return out;const changed=new Set();for(let k=0;k<Math.min(2,candidates.length);k++){const i=candidates[Math.floor(R()*candidates.length)];if(changed.has(i))continue;changed.add(i);out[i].interval=clamp(out[i].interval+[2,-2,3,-3][Math.floor(R()*4)],-12,24);}return trim(out);}
function progression({mode='monotone',bars=8,phraseBars=4,secondRoot=5,custom=[]}={}){const n=Math.ceil(bars/phraseBars),map=[];for(let i=0;i<n;i++)map.push(mode==='monotone'?0:mode==='return'?[0,secondRoot,0,secondRoot][i%4]:mode==='rise'?(n===1?0:i===n-1?5:i===n-2&&i>0?3:0):mode==='custom'?clamp(Number(custom[i])||0,-12,12):i%2?secondRoot:0);return map;}
function rootAt(step,{rootMap=[0],phraseBars=4}={}){return rootMap[Math.floor(step/(phraseBars*16))%rootMap.length]||0;}
function makeMotif(genre,mode,R){
 const pick=a=>a[Math.floor(R()*a.length)],chance=p=>R()<p;
 if(mode==='octave'){
  const tail=pick([2,3,5,7,10,-2]),last=pick([0,7,12,-12]);
  return Array.from({length:8},(_,i)=>[i*2,i<6?(i%2?12:0):i===6?tail:last,2]);
 }
 const type=mode==='air'?'air':mode==='houseLoop'?'house':mode==='pop'?'funk':genre;
 const config={ebm:[10,14],edm:[5,8],house:[5,8],disco:[7,10],funk:[4,7],air:[3,5],hiphop:[3,6],acid:[9,13]}[type]||[5,8];
 const goal=config[0]+Math.floor(R()*(config[1]-config[0]+1));
 const weights=Array.from({length:16},(_,i)=>{
  if(type==='ebm'||type==='acid')return i%4===0?2:i%2?1.2:1.5;
  if(type==='edm')return i%4===2?4:i%8===0?1.8:.4;
  if(type==='disco')return i%2===0?3:.7;
  if(type==='hiphop')return [0,3,6,8,10,14].includes(i)?2.4:.3;
  if(type==='air')return [0,4,6,8,10,14].includes(i)?2:.3;
  return [0,3,6,7,8,10,11,14,15].includes(i)?2:.6;
 });
 const slots=[0];while(slots.length<goal){let sum=weights.reduce((n,w,i)=>n+(slots.includes(i)?0:w),0),v=R()*sum,chosen=-1;for(let i=0;i<16;i++){if(slots.includes(i))continue;v-=weights[i];if(v<=0){chosen=i;break;}}if(chosen<0)break;slots.push(chosen);}slots.sort((a,b)=>a-b);
 const vocabulary=type==='hiphop'?pick([[0,3,5,7],[0,2,5,7],[0,3,7,10]]):type==='ebm'||type==='acid'?pick([[0,3,7,12],[0,7,12,-12],[0,2,7,10]]):pick([[0,3,5,7],[0,2,5,7],[0,7,10,12],[0,3,7,12]]);
 const direction=chance(.5)?1:-1,peak=Math.max(1,Math.floor(slots.length*.55)),phrase=[];
 for(let k=0;k<slots.length;k++){
  const at=slots[k],progress=k<=peak?k/peak:(slots.length-k)/Math.max(1,slots.length-peak),walk=Math.round(progress*(vocabulary.length-1));
  let pitch=k===0||chance(type==='ebm'?.62:.38)?0:vocabulary[clamp(direction>0?walk:vocabulary.length-1-walk,0,vocabulary.length-1)];
  if(type==='disco'&&k%2&&chance(.75))pitch=12;if(type==='air')pitch=clamp(pitch,0,7);
  const distance=(slots[k+1]??16)-at,dur=type==='hiphop'?pick([2,3,4,5]):type==='ebm'||type==='acid'?pick([1,1,1,2]):type==='edm'?pick([1,2,2,3]):pick([1,2,2,3]);
  phrase.push([at,pitch,Math.min(distance,dur)]);
 }
 return phrase;
}
function generate({genre='ebm',riffMode='auto',seed=1,bars=8,phraseBars=4,development=30,turnaround=45,density=75,space=20,spastic=20,moves=50,accent=45,slide=20,length=40,spunk=35,rhythmic=20,dust=15,slup=0,spsl=0,reverse=0,snote=10}={}){
 const R=rng(seed),pick=a=>a[Math.floor(R()*a.length)],N=clamp(bars|0,1,32)*16,base=Array(16).fill(null),mode=riffMode==='auto'?(genre==='house'?'houseLoop':genre==='motor'?'octave':'auto'):riffMode,source=makeMotif(genre,mode,R);
 for(const [step,pitch,dur]of source){if(step!==0&&R()>clamp(density/90,0,1)*(1-space/330))continue;const acc=R()<accent/100;let interval=R()<moves/100?pitch:0;
 if(R()<dust/650)interval+=pick([7,12,-12]);if(R()<snote/500)interval=pick([-12,3,7,12]);
 base[step]={interval,length:Math.max(1,Math.round(dur*(.5+length/75))),velocity:clamp((acc?108:genre==='funk'?82:88)+(R()-.5)*spunk*.5,35,127),accent:acc,slide:R()<slide/100};}
 for(let i=0;i<16;i++){if(!base[i]&&i%2&&R()<rhythmic/500)base[i]={interval:pick([0,7]),length:1,velocity:70,accent:false,slide:false};const n=base[i];if(!n)continue;if(R()<spsl/350){n.slide=true;n.length=2;}if(R()<slup/350&&base[i+1]){n.slide=true;n.length=1;base[i+1].interval=Math.max(n.interval+3,base[i+1].interval);}if(R()<spastic/430){n.interval=pick([0,7,12,-12]);}}
 if(R()<reverse/100)base.reverse();
 return develop(base,{seed,bars:N/16,phraseBars,development,turnaround});
}
function develop(input,{seed=1,bars=Math.ceil(input.length/16)||1,phraseBars=4,development=30,turnaround=45}={}){
 const R=rng(seed+73019),clean=trim(Array.from({length:16},(_,i)=>input[i]?{...input[i]}:null)),N=clamp(bars|0,1,32)*16,notes=Array.from({length:N},(_,i)=>clean[i%16]?{...clean[i%16]}:null);
 if(!clean.some(Boolean))return notes;
 // The first bar is the user's hook. Preserve its root anchor while writing
 // sparse pitch answers, one delayed onset or one extra grace note later on.
 const answerSlots=clean.flatMap((n,i)=>n&&i>0?[i]:[]);
 const changedPitch=(original,serial)=>{const choices=[2,3,-2,-3,5,-5].map(d=>clamp(original.interval+d,-12,24)).filter((v,i,a)=>v!==original.interval&&a.indexOf(v)===i);return choices[mod(serial,choices.length)];};
 const changeAnswer=(bar,serial,second=false)=>{
  if(!answerSlots.length){const at=bar*16+12;notes[at]={interval:[3,5,7,10][mod(serial,4)],length:1,velocity:84,accent:false,slide:false};return;}
  const at=answerSlots[mod((seed|0)+serial+(second?1:0),answerSlots.length)],original=clean[at];
  notes[bar*16+at]={...original,interval:changedPitch(original,serial+(second?2:0))};
 };
 const changeRhythm=(bar,serial)=>{
  // Delay one answering note into a neighbouring gap: exactly two grid cells.
  // A later onset cannot shorten the preceding note, so the rest of the motif stays intact.
  const movable=answerSlots.filter(i=>i<15&&!clean[i+1]);
  if(movable.length){const from=movable[mod((seed|0)+serial,movable.length)],to=from+1,original=clean[from],next=clean.findIndex((n,i)=>i>to&&n),room=(next<0?16:next)-to;notes[bar*16+from]=null;notes[bar*16+to]={...original,interval:changedPitch(original,serial),length:Math.min(original.length,room)};return true;}
  // If every answering note is packed against the next, insert a single grace
  // in a free late slot. Its only possible other change is shortening the note before it.
  const gaps=[15,13,11,14,12,10,9].filter(i=>!clean[i]);
  if(gaps.length){const at=gaps[mod(serial,gaps.length)];notes[bar*16+at]={interval:[3,5,7,10][mod(serial,4)],length:1,velocity:76,accent:false,slide:false};return true;}
  return false;
 };
 for(let bar=1;bar<N/16;bar++){
  const blockEnd=(bar+1)%4===0,last=(bar+1)%phraseBars===0||bar===N/16-1,serial=Math.floor(bar/4),micro=development>0&&(blockEnd||bar%2===1&&R()<development/100),ending=turnaround>0&&last;
  // An eight-bar ending receives a tiny rhythmic answer rather than a fill.
  // The 16-bar ending chooses another answer using its absolute bar serial.
  const rhythm=ending&&((bar+1)%8===0||bar===N/16-1)&&changeRhythm(bar,serial);
  if(!rhythm){if(micro||ending)changeAnswer(bar,serial);if(ending&&answerSlots.length>2&&R()<turnaround/200)changeAnswer(bar,serial,true);}
 }
 return trim(notes);
}
function trim(notes){return notes.map((n,i)=>{if(!n)return null;let distance=notes.length-i;for(let j=i+1;j<notes.length;j++)if(notes[j]){distance=j-i;break;}return {...n,length:clamp(Math.round(n.length)||1,1,Math.min(8,distance)),interval:clamp(Math.round(n.interval),-12,24),velocity:clamp(Math.round(n.velocity||90),1,127)};});}
function events(notes,{bpm=128,rootMidi=36,gate=65,swing=0,rootMap=[0],phraseBars=4}={}){notes=trim(notes);const step=60/bpm/4;return notes.flatMap((n,i)=>{if(!n)return[];const shift=i%2?swing/100*.46:0,time=(i+shift)*step;// Slide connects only to the next attack.
 let next=notes.findIndex((v,j)=>j>i&&v);if(next<0)next=notes.length;const nextTime=(next+(next%2?swing/100*.46:0))*step;
 const connected=n.slide&&next<notes.length&&next<=i+n.length;
 const duration=connected?nextTime-time:Math.min((n.length*gate/100)*step,nextTime-time-.002);
 return [{step:i,time,duration:Math.max(.006,duration),pitch:clamp(rootMidi+rootAt(i,{rootMap,phraseBars})+n.interval,12,96),velocity:n.velocity,accent:n.accent,slideOut:connected,slideIn:false}];}).map((e,i,a)=>({...e,slideIn:i>0&&a[i-1].slideOut}));}
function importMidi(buffer,rootMidi=36){const v=new DataView(buffer);let p=0;const u8=()=>{if(p>=v.byteLength)throw Error('The MIDI file is truncated.');return v.getUint8(p++);},u16=()=>u8()*256+u8(),u32=()=>((u8()*16777216)+(u8()<<16)+(u8()<<8)+u8())>>>0,str=n=>Array.from({length:n},()=>String.fromCharCode(u8())).join(''),vlq=()=>{let n=0;for(let i=0;i<4;i++){let b=u8();n=n*128+(b&127);if(!(b&128))return n;}throw Error('Invalid MIDI time.');};
 if(str(4)!=='MThd')throw Error('Choose a standard .mid file.');const len=u32();if(len<6)throw Error('Invalid MIDI header.');const format=u16(),tracks=u16(),ppq=u16();if(format>1||ppq&32768||!ppq)throw Error('Use MIDI type 0/1 with PPQ timing.');p=8+len;const groups=new Map();let tempo=null;
 for(let tr=0;tr<tracks;tr++){if(str(4)!=='MTrk')throw Error('Invalid MIDI track.');const size=u32(),end=p+size;if(end>v.byteLength)throw Error('The MIDI track is truncated.');let tick=0,running=0;const held=new Map();while(p<end){tick+=vlq();let status=u8(),first=null;if(status<128){if(!running)throw Error('Invalid MIDI status.');first=status;status=running;}else if(status<240)running=status;if(status===255){const type=u8(),n=vlq();if(p+n>end)throw Error('Truncated MIDI metadata.');if(type===81&&n===3&&tempo===null)tempo=60000000/(v.getUint8(p)*65536+v.getUint8(p+1)*256+v.getUint8(p+2));p+=n;continue;}if(status===240||status===247){const n=vlq();if(p+n>end)throw Error('Truncated MIDI data.');p+=n;running=0;continue;}if(status>=240)throw Error('Unsupported MIDI event.');const type=status>>4,ch=status&15,a=first??u8(),b=type===12||type===13?0:u8(),key=ch+':'+a;
 if(type===9&&b){held.set(key,{tick,pitch:a,velocity:b});}else if(type===8||type===9&&!b){const n=held.get(key);if(n&&ch!==9){const k=tr+':'+ch;if(!groups.has(k))groups.set(k,[]);groups.get(k).push({...n,duration:Math.max(1,tick-n.tick)});}held.delete(key);}if(p>end)throw Error('Invalid MIDI length.');}p=end;}
 const ranked=[...groups.values()].filter(g=>g.length).sort((a,b)=>score(b)-score(a));function score(g){const pitches=g.map(n=>n.pitch).sort((a,b)=>a-b),med=pitches[Math.floor(pitches.length/2)];return Math.min(g.length,64)+(med>=28&&med<=60?50:0);}
 if(!ranked.length)throw Error('No playable notes found.');const source=ranked[0].sort((a,b)=>a.tick-b.tick||a.pitch-b.pitch),start=Math.floor(source[0].tick/ppq/4)*4,span=Math.max(...source.slice(0,10000).map(n=>(n.tick+n.duration)/ppq))-start,bars=[1,2,4,8,16,32].find(b=>b>=Math.ceil(span/4))||32,notes=Array(bars*16).fill(null);
 for(const n of source){const step=Math.round((n.tick/ppq-start)*4);if(step<0||step>=notes.length||notes[step])continue;let pitch=n.pitch;while(pitch<rootMidi-12)pitch+=12;while(pitch>rootMidi+24)pitch-=12;notes[step]={interval:pitch-rootMidi,length:clamp(Math.round(n.duration/ppq*4),1,8),velocity:n.velocity,accent:n.velocity>=100,slide:false};}
 return {notes:trim(notes),bpm:tempo?clamp(Math.round(tempo),50,200):null,sourceNotes:source.length,bars};}
const api={genres,riffProfiles,defaults,tempoRange,randomTempo,progression,rootAt,generate,develop,vary,events,trim,importMidi,rng};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.BassPatterns=api;
})(typeof globalThis!=='undefined'?globalThis:this);
