/* Dropfather drop maker: build-up and drop on a step grid, pre-drop between them, and optionally the rest of the
   song around them (intro, breakdown, outro). No song needed.
   Bass is Bass Invaders; the lead is AVANTGARDIAN ARP (its 777 sounds and its pattern library) or Bass Invaders;
   drums, roll and risers are Dropfather's own; the throw is DELAYSY.
   One scheduler serves both live looping (while editing) and offline rendering (for Play all and export). */
(function(root){'use strict';
const X=root.DropDSP,P=X.parts,clamp=P.clamp;

const SCALES={minor:['Minor',[0,2,3,5,7,8,10]],phrygian:['Phrygian',[0,1,3,5,7,8,10]],dorian:['Dorian',[0,2,3,5,7,9,10]],harmonic:['Harmonic minor',[0,2,3,5,7,8,11]],major:['Major',[0,2,4,5,7,9,11]]};
const DRUMS=[['kick','Kick'],['clap','Clap'],['snare','Snare'],['hat','Hat'],['open','Open hat']];
const ROWS={bass:14,lead:11};// scale degrees per note lane, 0 = root (bass: two octaves, so riffs keep their octave jumps on every chord)
const NOTE=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
// Arrangement order. The pre-drop is the end of the build-up (its silence, throw and reverse suck).
const ORDER=['intro','breakdown','build','drop','outro'];
const NAMES={intro:'INTRO',breakdown:'BREAKDOWN',build:'BUILD-UP',drop:'DROP',outro:'OUTRO',space:'SPACE'};
const SKETCH=['intro','breakdown','outro'];

const steps=p=>p.patternBars*16;
function blank(n){const g={};for(const [k] of DRUMS)g[k]=Array(n).fill(0);g.bass=Array(n).fill(null);g.lead=Array(n).fill(null);return g;}
function resize(sec,bars){const n=bars*16,g=blank(n);for(const k of Object.keys(g))for(let i=0;i<n;i++)g[k][i]=sec.grid[k][i%sec.grid[k].length];if(sec.len)for(const k of Object.keys(sec.len)){const o=sec.len[k]||[];sec.len[k]=Array.from({length:n},(_,i)=>o.length?o[i%o.length]??null:null);}sec.patternBars=bars;sec.grid=g;}
function degree(project,d){const sc=SCALES[project.scale][1],n=sc.length,o=Math.floor(d/n);return sc[((d%n)+n)%n]+12*o;}
const bassBase=key=>28+((key-4+12)%12);// E1..D#2, as in song mode
const leadBase=key=>57+((key-9+12)%12);// A3..G#4
function midiFor(project,lane,d){return (lane==='bass'?bassBase(project.key):leadBase(project.key))+degree(project,d);}
function rowLabel(project,lane,d){const m=midiFor(project,lane,d);return NOTE[m%12]+(Math.floor(m/12)-1);}
// Sections are keyed: the drop view's intro … outro, plus song parts made in the song view ('drop2' …), which carry
// their type and label. typeOf decides how a section sounds (build-ups open up, drops hit, the rest are filtered).
const typeOf=(p,key)=>p?.[key]?.type||key;
const labelOf=(p,key)=>p?.[key]?.label||NAMES[typeOf(p,key)]||String(key).toUpperCase();
const enabled=(p,name)=>(name==='build'||name==='drop')?true:!!(p.song&&p.song[name]&&p[name]);

/* ---------- Sound sources ---------- */
// AVANTGARDIAN ARP's 777 factory sounds and its pattern library (first 4 bars of every arp-ready pattern).
const arpSounds=()=>root.NB46Bank?.factory||[];
let library=null;
function arpPatterns(){if(library)return library;const el=root.document?.getElementById('arp-patterns');library=el?JSON.parse(el.textContent).patterns:[];return library;}
function leadName(id){if(id?.startsWith('dl:'))return 'Dropfather · '+(root.DropLead?.PATCHES[id.slice(3)]?.n||id);if(id?.startsWith('arp:')){const e=arpSounds().find(s=>s.id===id.slice(4));return e?'ARP · '+e.name:id;}return {minilead:'Bass Invaders · Mini Lead',lead:'Bass Invaders · Saw Lead',sqlead:'Bass Invaders · Square Lead'}[id]||id;}

/* ---------- Turning an ARP pattern into the lead lane ---------- */
// Pitches relative to the pattern's root become the nearest degree of the project's scale; one note per sixteenth.
function arpLane(project,pattern,n){
 const sc=SCALES[project.scale][1],out=Array(n).fill(null),base=60+(pattern.root||0);
 for(const [beat,,pitch] of [...pattern.notes].sort((a,b)=>a[0]-b[0]||b[2]-a[2])){
  const i=Math.round(beat*4);if(i<0||i>=n||out[i]!=null)continue;
  const rel=pitch-base,oct=Math.floor(rel/12),pc=((rel%12)+12)%12;let best=0,dist=99;sc.forEach((s,k)=>{const d=Math.abs(s-pc);if(d<dist){dist=d;best=k;}});
  let deg=best+7*oct;while(deg<0)deg+=7;while(deg>=ROWS.lead)deg-=7;
  if(project.chords&&i%4===0){const T=chordTones(chordOf(project,i));for(const step of [0,-1,1,-2,2])if(T.includes(pc7(deg+step))&&deg+step>=0&&deg+step<ROWS.lead){deg+=step;break;}}
  out[i]=deg;
 }
 return out;
}
function arpPick(rng,mode){const all=arpPatterns().filter(p=>p.notes.length>=4);if(!all.length)return null;const same=all.filter(p=>p.mode===(mode==='major'?'major':'minor'));const pool=same.length?same:all;return pool[Math.floor(rng()*pool.length)];}
function arpBlend(seed){const N=root.NoteEngine,all=arpPatterns();if(!N?.hybrid||all.length<2)return null;try{return N.hybrid(all,seed>>>0,16);}catch(e){return null;}}

/* ---------- Styles: each writes a whole drop project, different every time ---------- */
const STYLES={
 house:{kits:['club','deep','crisp','punch'],name:'House lift',genre:'house',bpm:[122,126],bass:['pal:house:5:1','pal:house:6:1','pal2:house:1','pal:house:4:1'],group:'soft',hats:['off8','shuffle','sixteen'],clap:['twofour','pickup'],open:['none','offopen'],fill:['none','small'],bassline:['invaders','offbeat','syncopated'],lead:['riff'],leads:['dl:house','dl:trance','dl:future'],riffs:'house',prog:'pop',
  build:{bars:8,fx:{hp:.5,riser:.4,pitch:0,roll:'clap',rollAmt:.5,verb:.35,swell:.2,kickOut:.75}},pre:{gapBeats:1,throw:.5,delaysy:8,throwLen:1,reverse:.4},drop:{bars:16,fx:{pump:.35,impact:.4}},gate:{bass:.55,lead:.45}},
 festival:{kits:['punch','club','heavy'],name:'Festival',genre:'edm',bpm:[126,130],bass:['pal:edm:1:1','pal:edm:0:0','pal:edm:2:1','pal:edm:3:0'],group:'wide',hats:['off8','sixteen'],clap:['twofour','layer'],open:['barend','offopen'],fill:['big','small'],bassline:['invaders','roll16','bounce'],lead:['riff'],leads:['dl:festival','dl:bigroom','dl:hoover'],riffs:'festival',prog:'pop',
  build:{bars:16,fx:{hp:.8,riser:.8,pitch:.6,roll:'snare',rollAmt:.85,verb:.6,swell:.5,kickOut:.5}},pre:{gapBeats:4,throw:.6,delaysy:61,throwLen:2,reverse:.8},drop:{bars:16,fx:{pump:.7,impact:.9}},gate:{bass:.7,lead:.75}},
 techno:{kits:['heavy','room','tape'],name:'Techno tunnel',genre:'motor',bpm:[128,134],bass:['pal:motor:3:1','pal:motor:7:0','pal:motor:2:1','pal:ebm:3:1'],group:'modular',hats:['sixteen','gallop','off8'],clap:['none','rim'],open:['offopen'],fill:['none'],bassline:['invaders','gallop','offbeat'],lead:['riff','riff','none'],leads:['dl:techno','dl:screech'],riffs:'techno',prog:'dark',
  build:{bars:8,fx:{hp:.7,riser:.6,pitch:0,roll:'kick',rollAmt:.7,verb:.5,swell:.3,kickOut:1}},pre:{gapBeats:2,throw:.7,delaysy:98,throwLen:1,reverse:.3},drop:{bars:16,fx:{pump:.55,impact:.6}},gate:{bass:.6,lead:.3}},
 takeoff:{kits:['punch','club','crisp'],name:'Take-off',genre:'edm',bpm:[126,130],bass:['pal:edm:0:1','pal:edm:1:1','pal:edm:3:0'],group:'wide',hats:['off8','sixteen'],clap:['twofour','layer'],open:['none','barend'],fill:['small','big'],bassline:['roll16','bounce','invaders'],lead:['riff'],leads:['dl:trance','dl:festival','dl:future'],riffs:'takeoff',prog:'pop',
  build:{bars:8,fx:{hp:.65,riser:.55,pitch:.5,roll:'snare',rollAmt:.6,verb:.45,swell:.35,kickOut:.6}},pre:{gapBeats:1,throw:.45,delaysy:30,throwLen:1,reverse:.6},drop:{bars:16,fx:{pump:.5,impact:.7}},gate:{bass:.7,lead:.5}},
 ebm:{kits:['heavy','tape','dusty'],name:'EBM motor',genre:'ebm',bpm:[116,124],bass:['pal:ebm:3:1','pal:ebm:1:0','pal:ebm:6:1','pal:acid:0:0'],group:'modular',hats:['off8','sparse'],clap:['snare'],open:['none'],fill:['none','small'],bassline:['octave8','invaders','roll16'],lead:['riff','riff','none'],leads:['dl:ebm','dl:screech','dl:hoover'],riffs:'ebm',prog:'dark',
  build:{bars:4,fx:{hp:.55,riser:.3,pitch:0,roll:'snare',rollAmt:.7,verb:.25,swell:.2,kickOut:.75}},pre:{gapBeats:2,throw:.35,delaysy:179,throwLen:.5,reverse:.2},drop:{bars:16,fx:{pump:.3,impact:.5}},gate:{bass:.8,lead:.35}},
 progressive:{kits:['club','crisp','punch'],name:'Progressive trance',genre:'edm',bpm:[126,132],bass:['pal:edm:0:1','pal:edm:2:1','pal:house:5:1'],group:'wide',hats:['off8','sixteen'],clap:['twofour','layer'],open:['offopen','barend'],fill:['small','none'],bassline:['offbeat','gallop','roll16'],lead:['riff'],leads:['dl:trance','dl:glass','dl:festival'],riffs:'progressive',prog:'pop',
  build:{bars:16,fx:{hp:.7,riser:.65,pitch:.35,roll:'snare',rollAmt:.55,verb:.55,swell:.4,kickOut:.75}},pre:{gapBeats:2,throw:.55,delaysy:30,throwLen:1,reverse:.5},drop:{bars:16,fx:{pump:.6,impact:.55}},gate:{bass:.5,lead:.55}},
 ambient:{kits:['deep','room','dusty'],name:'Ambient chill',genre:'house',bpm:[96,108],bass:['pal:house:5:1','pal:house:6:1','pal2:house:1'],group:'soft',hats:['sparse','off8'],clap:['rim'],open:['none'],fill:['none'],bassline:['held','offbeat'],lead:['riff'],leads:['dl:pad','dl:glass','dl:future'],riffs:'ambient',prog:'pop',
  build:{bars:8,fx:{hp:.35,riser:.25,pitch:0,roll:'off',rollAmt:0,verb:.7,swell:.2,kickOut:.5}},pre:{gapBeats:2,throw:.6,delaysy:8,throwLen:2,reverse:.6},drop:{bars:16,fx:{pump:.25,impact:.2}},gate:{bass:.95,lead:.9}}
};
const MIX={kick:.9,clap:.55,snare:.5,hat:.35,open:.3,bass:.7,lead:.45};
const LABEL={off8:'offbeat hats',shuffle:'shuffled hats',sixteen:'16th hats',gallop:'galloping hats',sparse:'sparse hats',twofour:'clap on 2 and 4',pickup:'clap with pickup',layer:'clap + snare',rim:'soft snare',snare:'snare on 2 and 4',none:'',offopen:'open hats on the off',barend:'open hat at the bar end',small:'small fill',big:'snare fill',invaders:'Bass Invaders riff',offbeat:'offbeat bass',syncopated:'syncopated bass',roll16:'rolling 16ths',gallop2:'galloping bass',bounce:'octave bounce',octave8:'octave motor',held:'held bass'};

// The bass riff from Bass Invaders' own phrase generator, quantised to the scale (root..octave).
function invadersLine(project,genre,seed,n){
 const H=root.BassInvadersHost,B=root.BassPatterns;if(!H||!B)return null;
 const knobs=H.phraseKnobs(),notes=B.generate({...knobs,genre,riffMode:'auto',seed,bars:n/16,phraseBars:Math.min(4,n/16)}),sc=SCALES[project.scale][1],out=Array(n).fill(null);
 for(let i=0;i<n&&i<notes.length;i++){const e=notes[i];if(!e)continue;const iv=e.interval,pc=((iv%12)+12)%12;let best=0,dist=99;sc.forEach((s,k)=>{const d=Math.min(Math.abs(s-pc),12-Math.abs(s-pc));if(d<dist){dist=d;best=k;}});out[i]=iv>=12&&pc===0?7:best;}
 return out.some(v=>v!==null)?out:null;
}
// A short hook: call in bar 1, answer in bar 2, from the strong degrees of the scale.
function hook(rng,n,density){
 const out=Array(n).fill(null),rhythms=[[0,3,6,10,12],[0,2,4,7,10,14],[0,3,6,8,11,14],[2,6,10,14],[0,4,6,10,12,14]],pool=[0,2,4,6,7,9];
 const r=rhythms[Math.floor(rng()*rhythms.length)].filter(()=>rng()<density+.35),motif=r.map((s,i)=>[s,i===0?(rng()<.5?0:4):pool[Math.floor(rng()*pool.length)]]);
 for(let bar=0;bar*16<n;bar++)motif.forEach(([s,d],i)=>{let deg=d;if(bar%2===1&&i===motif.length-1)deg=rng()<.5?0:4;if(bar%4===3&&i>=motif.length-2)deg=Math.min(9,d+2);out[bar*16+s]=deg;});
 return out;
}
/* ---------- Harmony: a 4-bar chord progression under the drop ---------- */
// Chords are scale degrees (0 = the key's own chord), one per bar. Bass riffs move with them, the lead's notes
// land on chord tones, and chord leads stack the bar's chord under the melody note.
const PROGS={
 minor:{pop:[[0,5,2,6],[0,5,3,4],[5,3,0,4],[0,3,5,4],[0,6,5,6],[5,6,0,0],[0,2,6,5]],dark:[[0,0,5,6],[0,5,0,6],[0,0,3,4],[0,0,0,5],[0,6,0,5]]},
 phrygian:{pop:[[0,1,0,6],[0,5,1,0],[0,6,5,1]],dark:[[0,1,0,0],[0,0,1,6],[0,0,0,1]]},
 dorian:{pop:[[0,3,0,3],[0,6,3,0],[0,3,6,0],[0,2,3,0]],dark:[[0,0,3,3],[0,6,0,3]]},
 harmonic:{pop:[[0,5,3,4],[0,3,4,4],[0,5,4,4],[0,5,2,4]],dark:[[0,0,4,4],[0,1,4,0]]},
 major:{pop:[[0,4,5,3],[5,3,0,4],[0,5,3,4],[3,4,0,5],[0,3,5,4]],dark:[[0,0,3,4],[0,6,3,0]]}};
const pc7=d=>((d%7)+7)%7;
const chordOf=(p,k)=>{const c=p.chords||[0];return c[Math.floor(k/16)%c.length]||0;};
const chordTones=(c,seventh)=>[0,2,4].concat(seventh?[6]:[]).map(x=>pc7(c+x));
function chordName(p,c){const a=degree(p,c),third=degree(p,c+2)-a,fifth=degree(p,c+4)-a;return NOTE[(p.key+a)%12]+(third===3?(fifth===6?'dim':'m'):'');}
const progName=p=>(p.chords||[0]).map(c=>chordName(p,c)).join(' – ');
// The lead's chord: the bar's chord tones just below the melody note (the melody stays on top).
function voiceChord(p,d,k,kind){
 if(!kind||kind==='single')return [d];
 if(kind==='power')return [d,d-4,d-7];
 if(kind==='dyad')return [d,d-2];
 const T=chordTones(chordOf(p,k),kind==='seventh'),out=[d],want=kind==='seventh'?4:3;
 if(!T.includes(pc7(d)))return kind==='stack'?[d,d-2,d-4,d-7]:[d,d-2,d-4];
 for(let x=d-1;x>d-8&&out.length<want;x--)if(T.includes(pc7(x)))out.push(x);
 if(kind==='stack')out.push(d-7);
 return out;
}
// Bass riffs are written on the key's root; on chords each bar moves to its chord's root.
function onChords(line,p){return line.map((d,i)=>{if(d==null)return d;let v=d+chordOf(p,i);while(v>ROWS.bass-1)v-=7;return v;});}
// Lead riffs: a one-bar rhythm (the call) and its answer, notes on the bar's chord tones with smooth voice
// leading, a contour per phrase, passing notes on weak steps and a lift at the end of the 4 bars.
const RIFFS={
 festival:[[0,3,6,8,10,12,14],[0,3,6,10,12],[0,2,3,6,8,11,14],[0,3,6,9,12,14],[0,3,6,8,11,14]],
 takeoff:[[0,2,4,6,8,10,12,14],[0,3,4,7,8,11,12,14],[0,2,3,5,6,8,10,11,13,14],[0,2,4,7,8,10,12,15]],
 house:[[2,6,10,14],[0,3,6,10,13],[0,3,7,10,12],[2,5,8,11,14],[0,3,6,8,11,14]],
 techno:[[0,3,6,10,13],[2,6,10,14],[0,6,12],[3,6,11,14]],
 ebm:[[0,2,4,6,8,10,12,14],[0,3,4,7,8,10,12,14],[0,2,3,6,8,10,11,14]],
 progressive:[[0,2,3,5,6,8,10,11,13,14],[0,2,4,6,8,10,12,14],[0,3,6,8,11,14],[0,1,3,4,6,8,9,11,12,14]],
 ambient:[[0,6,10],[0,8],[2,8,14],[0,4,8,12],[0,10]],
 // The song's melody (breakdowns): fewer, longer notes that sing over the chords.
 melody:[[0,6,8,12],[0,4,10,12],[0,3,6,8,12],[0,8,12],[0,6,10],[0,3,8,10,14]]};
function riff(p,rng,kind,n){
 const pick=a=>a[Math.floor(rng()*a.length)],A=pick(RIFFS[kind]||RIFFS.festival);
 const B=rng()<.4?A:[...A.filter(s=>s<10),...pick([[10,12,14],[11,14],[12,13,14],[10,14,15],[12,14]])];
 const contour=kind==='takeoff'||kind==='progressive'?'arp':kind==='ambient'||kind==='melody'?pick(['arch','wave','down','up']):kind==='techno'||kind==='ebm'?pick(['hold','hold','wave']):pick(['up','down','arch','hold','wave']);
 const out=Array(n).fill(null),lo=2,hi=10;let prev=7;
 for(let bar=0;bar*16<n;bar++){
  const T=chordTones(chordOf(p,bar*16)),tones=[];for(let x=lo;x<=hi;x++)if(T.includes(pc7(x)))tones.push(x);
  const hits=bar%2?B:A,start=tones.reduce((b,x,i)=>Math.abs(x-prev)<Math.abs(tones[b]-prev)?i:b,0);let idx=start;
  hits.forEach((s,j)=>{
   const step=bar*16+s;if(step>=n)return;
   if(contour==='arp')idx=Math.max(0,Math.min(start,tones.length-3))+[0,1,2,1][j%4];
   else if(j>0){if(contour==='up')idx+=rng()<.55?1:0;else if(contour==='down')idx-=rng()<.55?1:0;else if(contour==='arch')idx+=j<hits.length/2?(rng()<.6?1:0):(rng()<.6?-1:0);else if(contour==='wave')idx+=j%2?1:-1;else if(j===hits.length-1&&rng()<.5)idx+=rng()<.5?1:-1;}
   const top=tones.length-1;if(idx>top)idx=Math.max(0,top-1);if(idx<0)idx=Math.min(top,1);let d=tones[idx];
   if(s%2===1&&rng()<.25)d=Math.max(lo,Math.min(hi,d+(rng()<.5?1:-1)));
   if(bar%4===3&&j===hits.length-1)d=tones[Math.min(tones.length-1,idx+1)];
   out[step]=d;prev=d;
  });
 }
 return out;
}
function bassline(kind,p,st,rng,seed,n,used=()=>{}){
 const b=Array(n).fill(null),turn=()=>{if(rng()<.6){b[n-3]=null;b[n-2]=[4,5,6][Math.floor(rng()*3)];}};
 if(kind==='invaders'){const line=invadersLine(p,st.genre,810001+seed%9973,n);if(line)return line;kind='offbeat';used(kind);}
 if(kind==='offbeat')for(let i=2;i<n;i+=4)b[i]=0;
 if(kind==='syncopated')for(let bar=0;bar*16<n;bar++)for(const s of [0,3,6,10,13])b[bar*16+s]=0;
 if(kind==='roll16')for(let i=0;i<n;i++)if(i%4)b[i]=0;
 if(kind==='gallop')for(let i=0;i<n;i++)if(i%4===2||i%4===3)b[i]=0;
 if(kind==='bounce')for(let i=0;i<n;i+=2)b[i]=i%4===2?7:0;
 if(kind==='octave8')for(let i=0;i<n;i+=2)b[i]=(i/2)%2?7:0;
 if(kind==='held')for(let i=0;i<n;i+=16)b[i]=0;
 if(kind!=='bounce'&&kind!=='octave8'&&kind!=='held')turn();
 return b;
}
function drums(g,n,v){
 const set=(lane,list,val=1)=>{for(const i of list)if(i>=0&&i<n)g[lane][i]=val;},all=k=>Array.from({length:n},(_,i)=>i).filter(k);
 set('kick',all(i=>i%4===0));set('kick',all(i=>i%16===0),2);
 if(v.clap==='twofour'||v.clap==='pickup'||v.clap==='layer')set('clap',all(i=>i%8===4));if(v.clap==='pickup')set('clap',[n-1]);if(v.clap==='layer')set('snare',all(i=>i%8===4));
 if(v.clap==='rim')set('snare',all(i=>i%16===12));if(v.clap==='snare')set('snare',all(i=>i%8===4),2);
 if(v.hats==='off8')set('hat',all(i=>i%4===2));if(v.hats==='sixteen'){set('hat',all(i=>i%4!==0));set('hat',all(i=>i%4===2),2);}
 if(v.hats==='shuffle')set('hat',all(i=>i%4===2||i%8===7));if(v.hats==='gallop')set('hat',all(i=>i%4===2||i%4===3));if(v.hats==='sparse')set('hat',all(i=>i%8===6));
 if(v.open==='offopen')set('open',all(i=>i%8===6));if(v.open==='barend')set('open',all(i=>i%16===14));
 if(v.fill==='small')set('snare',[n-3,n-1]);if(v.fill==='big'){set('snare',[n-8,n-6,n-4,n-3,n-2]);set('snare',[n-1],2);}
}
function generate(styleKey,seed,base={}){
 const st=STYLES[styleKey]||STYLES.house,rng=P.rng(seed||1),pick=a=>a[Math.floor(rng()*a.length)],key=base.key??9,scale=base.scale||'minor';
 const v={hats:pick(st.hats),clap:pick(st.clap),open:pick(st.open),fill:pick(st.fill),bassline:pick(st.bassline),lead:pick(st.lead)};
 const lead=root.DropLead&&st.leads?pick(st.leads):(()=>{const sounds=arpSounds().filter(s=>s.group===st.group);return sounds.length?'arp:'+pick(sounds).id:pick(['minilead','lead','sqlead']);})();
 const bpm=base.keepTempo&&base.bpm?base.bpm:st.bpm[0]+Math.floor(rng()*(st.bpm[1]-st.bpm[0]+1));
 const p={version:2,style:styleKey,seed,bpm,key,scale,sounds:{bass:pick(st.bass),lead},mix:{...MIX},gate:{...st.gate},song:{intro:false,breakdown:false,outro:false},
  build:{bars:st.build.bars,patternBars:4,grid:blank(64),fx:{...st.build.fx}},pre:{...st.pre},drop:{bars:st.drop.bars,patternBars:4,grid:blank(64),fx:{...st.drop.fx}}};
 p.chords=pick((PROGS[scale]||PROGS.minor)[st.prog||'pop']).slice();p.v={...v};
 // Lead: an ARP pattern, a fresh ARP blend ("Make arp"), or a short hook. ARP phrases keep all four bars.
 let leadLine=null,leadInfo='';
 if(v.lead==='arp'){const pat=arpPick(rng,scale);if(pat){p.drop.patternBars=4;leadLine=arpLane(p,pat,64);leadInfo=`ARP pattern “${pat.name}”`;}}
 if(v.lead==='blend'){const pat=arpBlend(seed);if(pat){p.drop.patternBars=4;leadLine=arpLane(p,pat,64);leadInfo=`ARP blend ${pat.name.replace('MIDI blend ','#')}`;}}
 if(v.lead==='riff'){leadLine=riff(p,rng,st.riffs,64);leadInfo='Dropfather riff';}
 if(v.lead==='hook'||(v.lead!=='none'&&!leadLine)){leadLine=hook(rng,32,styleKey==='festival'?.9:.55);leadInfo='hook';}
 const d=p.drop.grid,n=steps(p.drop);drums(d,n,v);d.bass=onChords(bassline(v.bassline,p,st,rng,seed,n,k=>v.bassline=p.v.bassline=k),p);if(leadLine)for(let i=0;i<n;i++)d.lead[i]=leadLine[i%leadLine.length];
 // Build: the drop's drums thinned (no fill, no open hats), hats driving, and the drop's whole lead line, filtered:
 // it opens up over the build-up and arrives wide open in the drop. No bass.
 const b=p.build.grid;drums(b,64,{...v,fill:'none',open:'none',clap:v.clap==='pickup'?'twofour':v.clap});if(v.hats==='off8'||v.hats==='sparse')for(let i=0;i<64;i+=2)b.hat[i]=b.hat[i]||1;
 for(let i=0;i<64;i++)b.lead[i]=d.lead[i%n];
 // Drum kit last, so a seed's grids and sounds stay what they were before kits existed.
 if(root.DropKits){const ok=(st.kits||[]).filter(root.DropKits.has);p.sounds.drums=ok.length?pick(ok):'synth';}
 p.desc=[st.name,LABEL[v.hats],LABEL[v.clap],LABEL[v.open],LABEL[v.fill],v.bassline==='gallop'?'galloping bass':LABEL[v.bassline],'chords: '+progName(p),leadInfo&&('lead: '+leadInfo),p.sounds.drums&&p.sounds.drums!=='synth'&&('drums: '+root.DropKits.list().find(k=>k.id===p.sounds.drums).n)].filter(Boolean).join(' · ');
 return p;
}
function randomize(project,seed){const keys=Object.keys(STYLES),rng=P.rng(seed),style=keys[Math.floor(rng()*keys.length)],p=generate(style,seed,{key:Math.floor(rng()*12),scale:Object.keys(SCALES)[Math.floor(rng()*4)]});const cat=X.bassCatalog();if(cat.length&&rng()<.5)p.sounds.bass=cat[Math.floor(rng()*cat.length)].id;if(root.Delaysy)p.pre.delaysy=Math.floor(rng()*root.Delaysy.presets.length);p.style='random';p.desc='Random · '+p.desc;return p;}
// Swap only the lead line for a new ARP pattern or blend, keeping everything else.
function newArpLead(project,seed,kind='arp'){
 const rng=P.rng(seed),pat=kind==='blend'?arpBlend(seed):arpPick(rng,project.scale);if(!pat)return null;
 if(project.drop.patternBars<4)resize(project.drop,4);const line=arpLane(project,pat,64);project.drop.grid.lead=line.slice(0,steps(project.drop));
 for(let i=0;i<steps(project.build);i++)project.build.grid.lead[i]=project.drop.grid.lead[i%steps(project.drop)];
 return kind==='blend'?'ARP blend '+pat.name.replace('MIDI blend ','#'):`ARP pattern “${pat.name}”`;
}

// A new lead riff on the same chords; or new chords, with the bass riff and the lead rewritten on them.
function leadToBuild(project){if(project.build.patternBars<4)resize(project.build,4);const n=steps(project.drop);for(let i=0;i<steps(project.build);i++)project.build.grid.lead[i]=project.drop.grid.lead[i%n];}
function newMelody(project,seed){
 const rng=P.rng(seed),st=STYLES[project.style]||STYLES.festival;if(project.drop.patternBars<4)resize(project.drop,4);
 project.drop.grid.lead=riff(project,rng,st.riffs||'festival',steps(project.drop));leadToBuild(project);return 'Dropfather riff';
}
function newChords(project,seed){
 const rng=P.rng(seed),st=STYLES[project.style]||STYLES.festival,list=(PROGS[project.scale]||PROGS.minor)[st.prog||'pop'],old=(project.chords||[]).join();
 const pool=list.filter(c=>c.join()!==old);project.chords=(pool.length?pool:list)[Math.floor(rng()*(pool.length||list.length))].slice();
 if(project.drop.patternBars<4)resize(project.drop,4);const n=steps(project.drop),v=project.v||{bassline:'offbeat'};
 project.drop.grid.bass=onChords(bassline(v.bassline,project,st,rng,seed,n),project);newMelody(project,seed+1);
 return progName(project);
}

/* ---------- The rest of the song, derived from the drop ---------- */
// Intro: the drop's groove without clap and lead, filter opening. Breakdown: no drums, the lead and held bass
// under reverb. Outro: the drop's drums and bass, filter closing.
function sketch(p){
 const d=p.drop,n=steps(d),copy=g=>JSON.parse(JSON.stringify(g));
 const intro=copy(d.grid);intro.clap.fill(0);intro.snare.fill(0);intro.open.fill(0);intro.lead.fill(null);
 const brk=blank(n);brk.lead=d.grid.lead.slice();for(let bar=0;bar*16<n;bar++){const first=d.grid.bass.slice(bar*16,bar*16+16).find(x=>x!=null);brk.bass[bar*16]=first??0;}
 const outro=copy(d.grid);outro.lead.fill(null);outro.open.fill(0);
 p.intro={bars:16,patternBars:d.patternBars,grid:intro,fx:{filterFrom:.25,filterTo:.85,verb:.15,pump:d.fx.pump*.6}};
 p.breakdown={bars:8,patternBars:d.patternBars,grid:brk,fx:{filterFrom:.6,filterTo:.75,verb:.55,pump:0}};
 p.outro={bars:16,patternBars:d.patternBars,grid:outro,fx:{filterFrom:1,filterTo:.2,verb:.2,pump:d.fx.pump}};
 p.song={intro:true,breakdown:true,outro:true};
 return p;
}

/* ---------- Timeline ---------- */
function timeline(p,song=false){
 const beat=60/p.bpm,bar=beat*4,parts=[];let t=0;
 for(const name of song?songOrder(p):ORDER.filter(n=>enabled(p,n))){const len=p[name].bars*bar;parts.push({name,type:typeOf(p,name),index:parts.length,start:t,end:t+len});t+=len;}
 // A build-up straight before a drop ends in the pre-drop: its last beats are the silence.
 parts.forEach((x,i)=>{if(x.type==='build'&&parts[i+1]?.type==='drop'){x.pre=true;x.gapOut=x.end-Math.min(p.pre.gapBeats*beat,(x.end-x.start)-beat);}});
 const b=parts.find(x=>x.pre)||parts.find(x=>x.type==='build'),d=parts.find(x=>x.type==='drop');
 return {beat,bar,step:beat/4,parts,song,gap:b?.pre?b.end-b.gapOut:0,buildOut:b?.start??0,gapOut:b?(b.gapOut??b.end):0,dropOut:d?.start??0,dropEndOut:d?.end??0,total:t};
}
/* ---------- Song: the whole arrangement, parts in any order, repeated or varied ---------- */
const SONG_DEFAULT=['intro','build','drop','breakdown','build','drop','outro'];
const songOrder=p=>(p.arrangement||[]).filter(k=>p[k]?.grid);
// Make sure intro, breakdown and outro exist (from the drop, as Suggest does) without turning them on in the drop view.
function ensureSongParts(p){if(!songOrder(p).length)return makeSong(p,(p.seed||1)+101);if(SKETCH.some(k=>!p[k])){const flags={...(p.song||{})};sketch(p);p.song={intro:!!flags.intro,breakdown:!!flags.breakdown,outro:!!flags.outro};}return p;}
// A new part of the song with its own grid: a copy of an existing part. A drop or build-up variation gets a new lead riff.
function variation(p,key,seed){
 const type=typeOf(p,key),count=Object.keys(p).filter(k=>p[k]?.grid&&typeOf(p,k)===type).length+1;let id=type+count;while(p[id])id+='b';
 p[id]={...JSON.parse(JSON.stringify(p[key])),type,label:NAMES[type]+' '+count};
 if((type==='drop'||type==='build')&&seed!=null){const sec=p[id],st=STYLES[p.style]||STYLES.festival;if(sec.patternBars<4)resize(sec,4);sec.grid.lead=riff(p,P.rng(seed),st.riffs||'festival',steps(sec));}
 return id;
}
// Make a whole track around the drop: intro, a groove, a breakdown where the song's melody lives (chords and a
// singing line, no kick), the build-up and drop, a second breakdown, a second drop (sometimes a variation) and an
// outro. The drop and the build-up themselves are kept as they are.
const FORMS={
 club:[['intro',16],['groove',16],['breakdown',16],['build',8],['drop',16],['breakdown2',8],['build',8],['drop2',16],['outro',16]],
 festival:[['intro',8],['breakdown',16],['build',16],['drop',16],['breakdown2',16],['build',16],['drop2',16],['outro',8]],
 chill:[['intro',8],['breakdown',16],['groove',16],['build',8],['drop',16],['breakdown2',16],['outro',16]]};
const FORM_OF={house:'club',techno:'club',ebm:'club',progressive:'club',festival:'festival',takeoff:'festival',ambient:'chill'};
const MELODY_SOUNDS=['dl:pad','dl:future','dl:glass'];
function makeSong(p,seed){
 const rng=P.rng(seed>>>0),pick=a=>a[Math.floor(rng()*a.length)],st=STYLES[p.style]||STYLES.festival,form=FORMS[FORM_OF[p.style]]||FORMS[pick(Object.keys(FORMS))];
 const flags={...(p.song||{})};sketch(p);p.song={intro:!!flags.intro,breakdown:!!flags.breakdown,outro:!!flags.outro};
 const d=p.drop,copy=g=>JSON.parse(JSON.stringify(g)),bars=k=>form.find(x=>x[0]===k)?.[1];
 // The melody: a 4-bar phrase on the drop's chords, played as chords by a pad, a future-bass chord or a glass pluck.
 const mel=blank(64);mel.lead=riff(p,rng,'melody',64);for(let i=0;i<64;i+=16)mel.bass[i]=chordRoot(p,i);
 if(rng()<.5)for(let i=8;i<64;i+=16)mel.hat[i]=1;
 const sound=pick(MELODY_SOUNDS);
 p.breakdown={type:'breakdown',label:'BREAKDOWN',bars:bars('breakdown')||16,patternBars:4,grid:mel,sounds:{lead:sound},gate:{lead:.95,bass:.98},fx:{filterFrom:.5,filterTo:.92,verb:.45,pump:0}};
 const mel2=copy(mel);if(rng()<.5)for(let i=0;i<64;i+=4)mel2.kick[i]=i%16===0?1:0;
 p.breakdown2={type:'breakdown',label:'BREAKDOWN 2',bars:bars('breakdown2')||8,patternBars:4,grid:mel2,sounds:{lead:sound},gate:{lead:.95,bass:.98},fx:{filterFrom:.4,filterTo:.85,verb:.55,pump:0}};
 // The groove: the drop's drums and bass, open, no lead: the DJ-friendly part.
 const groove=copy(d.grid);groove.lead.fill(null);if(rng()<.5)groove.open.fill(0);
 p.groove={type:'outro',label:'GROOVE',bars:bars('groove')||16,patternBars:d.patternBars,grid:groove,fx:{filterFrom:.95,filterTo:1,verb:.12,pump:d.fx.pump}};
 if(bars('intro'))p.intro.bars=bars('intro');if(bars('outro'))p.outro.bars=bars('outro');
 // Drop 2: the same drop, or its own copy with a new lead riff.
 delete p.drop2;let drop2='drop';if(form.some(x=>x[0]==='drop2')&&rng()<.5){drop2=variation(p,'drop',seed+11);}
 p.arrangement=form.map(([k])=>k==='drop2'?drop2:k);
 return p;
}
const chordRoot=(p,k)=>{let v=chordOf(p,k);while(v>ROWS.bass-1)v-=7;return v;};
// A new lead line for one part: the song melody in breakdowns, the style's riff elsewhere.
function newPartMelody(p,key,seed){const sec=p[key],type=typeOf(p,key),st=STYLES[p.style]||STYLES.festival;if(sec.patternBars<4)resize(sec,4);sec.grid.lead=riff(p,P.rng(seed>>>0),type==='breakdown'?'melody':st.riffs||'festival',steps(sec));if(key==='drop')leadToBuild(p);return labelOf(p,key);}
// Insert space: an empty part of n bars after position `at` of the arrangement; audio clips after it move along.
function insertSpace(p,at,bars){
 let n=1;while(p['space'+n])n++;const id='space'+n;
 p[id]={type:'space',label:'SPACE',bars,patternBars:1,grid:blank(16),fx:{filterFrom:1,filterTo:1,verb:0,pump:0}};
 const tl=timeline(p,true),from=tl.parts[at]?Math.round(tl.parts[at].end/tl.bar):Math.round(tl.total/tl.bar);
 p.arrangement.splice(at+1,0,id);for(const c of p.audio?.clips||[])if(c.start>=from-1e-6)c.start+=bars;
 return id;
}
// Insert a drop at a bar of the song: audio clips are split there and everything after moves along by the
// build-up + drop; in the parts row the build-up and drop start at that bar (a space part is split around them).
function insertDropAt(p,bar){
 const tl=timeline(p,true),parts=tl.parts,b2=x=>Math.round(x/tl.bar);let at=parts.findIndex(x=>b2(x.start)<=bar&&b2(x.end)>bar);
 if(at<0){at=parts.length;bar=b2(tl.total);}
 else{const x=parts[at],from=b2(x.start);if(from<bar){if(x.type==='space'){const rest=b2(x.end)-bar;p[x.name].bars=bar-from;let n=1;while(p['space'+n])n++;const id='space'+n;p[id]={...JSON.parse(JSON.stringify(p[x.name])),bars:rest,label:p[x.name].label};p.arrangement.splice(at+1,0,id);at++;}else{bar=b2(x.end);at++;}}}
 const add=p.build.bars+p.drop.bars,clips=p.audio?.clips||[];
 for(const c of [...clips]){if(c.start<bar&&c.start+c.len>bar){const n={...c,id:'c'+Math.random().toString(36).slice(2,9),start:bar,len:c.start+c.len-bar,phase:(c.phase||0)+(bar-c.start),fadeIn:0};c.len=bar-c.start;c.fadeOut=0;clips.push(n);}}
 for(const c of clips)if(c.start>=bar)c.start+=add;
 p.arrangement.splice(at,0,'build','drop');
 return {bar,bars:add};
}
// Where the last audio clip ends, in bars.
const clipEnd=p=>Math.max(0,...(p.audio?.clips||[]).map(c=>c.start+c.len));
// A new part of a type: the existing pattern of that type if there is one, else a copy derived from the drop.
function partOfType(p,type){if(p[type]?.grid)return type;if(SKETCH.includes(type)){ensureSongParts(p);return type;}return 'drop';}

/* ---------- Graph and scheduler (shared by live play and offline render) ---------- */
// AVANTGARDIAN ARP's own chain for one factory sound: mono VoiceOutput → SoundMatch trim → StudioFX with the sound's FX.
async function arpVoice(ctx,dest,id,bpm){
 const entry=arpSounds().find(s=>s.id===id);if(!entry||!root.NBVoice)return null;
 await root.NBVoice.prepare(ctx);
 const Pv={...root.NB46Bank.knobs(entry.patch),...root.AmpEnvelope.migrate(entry.knobs),envelopeVersion:2,legato:false,patch:entry.patch};
 const fx=new root.StudioFX(ctx,dest);fx.apply(entry.fx||root.NB46Bank.factory[0].fx,bpm,true);const trim=ctx.createGain();trim.connect(fx.input);
 try{trim.gain.value=(await root.SoundMatch.measure(Pv,entry.id,ctx.sampleRate)).gain;}catch(e){trim.gain.value=1;}
 const out=new root.VoiceOutput(ctx,trim);let last=null;
 return {play({midi,time,duration,velocity}){const note={pitch:midi,velocity,duration,releaseSeconds:root.AmpEnvelope.seconds(Pv).release},slot=out.create(note,time,true);out.attach(slot,root.NBVoice.play(ctx,slot.output,note,Pv,entry.id,time,last),true);last=midi;},dispose(){out.reset();}};
}
async function voice(ctx,dest,id,project,base){
 if(id?.startsWith('arp:'))return arpVoice(ctx,dest,id.slice(4),project.bpm);
 if(id?.startsWith('dl:'))return root.DropLead?root.DropLead.create(ctx,dest,id.slice(3)):null;
 const H=root.BassInvadersHost,K=root.KroghBass;if(!H||!K)return null;
 const settings=H.settingsFor(id,{bpm:project.bpm,root:project.key,octave:base-project.key}),graph=H.makeGraph(ctx,dest,settings),engine=K.create(ctx,graph.input,{preset:id});
 await engine.ready();H.applySound(engine,settings);if(typeof root.balanceSound==='function')await root.balanceSound(engine,structuredClone(settings));
 return engine;
}
// One drum hit as a buffer: the project's kit (Stanley Cupid's recordings), or the synth hit when the kit is "synth".
async function drumShot(ctx,project,k){
 const d=await P.oneShot(ctx.sampleRate,k==='clap'||k==='snare'||k==='hat'||k==='open'?k:'kick'),K=root.DropKits;
 const kit=K?await K.lane(ctx.sampleRate,project.sounds.drums,k,d).catch(()=>null):null;if(kit)return K.toBuffer(ctx,kit);
 const b=ctx.createBuffer(1,d.length,ctx.sampleRate);b.copyToChannel(d,0);return b;
}
const LEAD_LEVEL=1.6;
// Four stems (drums, bass, lead, fx), each through its own copy of the section's chain, so the mix can be
// changed after rendering. The chain is linear (filters, gains, reverb), so the stems sum to the same mix.
const STEMS=['drums','bass','lead','fx'],CH=STEMS.length*2,MIXER=[...STEMS,'audio'];
// dest: one node for everything, or {drums,bass,lead,fx} with a node per stem.
async function makeGraph(ctx,dest,project,section){
 const leadId=project[section].sounds?.lead||project.sounds.lead;
 const g={ctx,section,type:typeOf(project,section),events:[],lane:{},shots:{},grp:{},noise:P.noiseBuffer(ctx,4,11)},fx=project[section].fx,type=typeOf(project,section),isBuild=type==='build',isDrop=type==='drop',plain=!isBuild&&!isDrop,ir=P.impulse(ctx,2.6,2.6,5,1);
 // Build: everything through one high-pass that opens. Drop: everything but kick and clap pumps.
 // Intro, breakdown, outro: one low-pass that moves over the section, plus reverb and optional pump.
 for(const stem of STEMS){
  const G={out:ctx.createGain(),verb:ctx.createConvolver(),body:ctx.createGain(),pump:ctx.createGain()},vr=ctx.createGain();
  G.out.gain.value=.6;G.out.connect(dest[stem]||dest);G.verb.normalize=true;G.verb.buffer=ir;vr.gain.value=.4;G.verb.connect(vr).connect(G.out);
  if(isBuild){G.hp=ctx.createBiquadFilter();G.hp.type='highpass';G.hp.frequency.value=20;G.swell=ctx.createGain();G.wash=ctx.createGain();G.wash.gain.value=0;G.body.connect(G.hp).connect(G.swell).connect(G.out);G.hp.connect(G.wash).connect(G.verb);}
  else if(plain){G.lp=ctx.createBiquadFilter();G.lp.type='lowpass';G.lp.frequency.value=20000;G.lp.Q.value=.9;G.body.connect(G.lp).connect(G.out);G.pump.connect(G.lp);const w=ctx.createGain();w.gain.value=fx.verb||0;G.lp.connect(w).connect(G.verb);}
  else{G.body.connect(G.out);G.pump.connect(G.out);}
  g.grp[stem]=G;
 }
 // Risers, impact and the like go to the fx stem.
 g.out=g.grp.fx.out;g.verb=g.grp.fx.verb;const D=g.grp.drums,B=g.grp.bass,L=g.grp.lead;
 const pumped=k=>!isBuild&&(k==='hat'||k==='open'||k==='bass'||k==='lead');
 for(const [k] of DRUMS){const n=ctx.createGain();n.gain.value=project.mix[k];g.lane[k]=n;g.shots[k]=await drumShot(ctx,project,k);}
 for(const [k] of DRUMS)if(k!=='kick')g.lane[k].connect(pumped(k)?D.pump:D.body);
 g.kickShaper=P.shaper(ctx,.25);g.lane.kick.connect(g.kickShaper).connect(D.body);
 for(const k of ['bass','lead']){const n=ctx.createGain();n.gain.value=project.mix[k]*(k==='bass'?3:leadId?.startsWith('dl:')?LEAD_LEVEL:2.2);g.lane[k]=n;}
 g.lane.bass.connect(pumped('bass')?B.pump:B.body);
 // The lead bus: its own drive, delay and reverb, and a tone filter the section moves. In the build-up it skips the
 // high-pass (the lead is what opens up there) and goes straight to the swell.
 if(root.DropLead){g.leadBus=root.DropLead.bus(ctx,isBuild?L.swell:pumped('lead')?L.pump:L.body,leadId?.startsWith('dl:')?leadId.slice(3):null,project.bpm);g.lane.lead.connect(g.leadBus.input);}
 else{g.lane.lead.connect(pumped('lead')?L.pump:L.body);const ls=ctx.createGain();ls.gain.value=.25;g.lane.lead.connect(ls).connect(L.verb);}
 // ARP and Bass Invaders share one ladder worklet per context: prepare ARP's first, then both voices.
 if(leadId?.startsWith('arp:')&&root.NBVoice)await root.NBVoice.prepare(ctx);
 const [bass,lead]=await Promise.all([voice(ctx,g.lane.bass,project.sounds.bass,project,bassBase(project.key)),voice(ctx,g.lane.lead,leadId,project,leadBase(project.key))]);
 g.bass=bass;g.lead=lead;
 // Dropfather leads render each distinct chord of the section once, before it plays.
 if(lead?.prepare){const sec=project[section],list=[],seen=new Set();let prev=null;
  for(let k=0;k<sec.bars*16;k++){const x=noteAt(project,sec,'lead',k,lead);if(!x)continue;const key=(x.chord||[x.midi]).join()+'|'+x.dur+'|'+x.vel+'|'+prev;if(!seen.has(key)){seen.add(key);list.push({midi:x.midi,chord:x.chord,duration:x.dur,velocity:x.vel,glide:prev});}prev=x.midi;}
  await lead.prepare(list);}
 if(isBuild){const roll=fx.roll==='off'?null:fx.roll;if(roll){g.rollShot=await drumShot(ctx,project,roll);g.rollBus=ctx.createGain();g.rollHP=ctx.createBiquadFilter();g.rollHP.type='highpass';g.rollBus.connect(g.rollHP).connect(D.out);const s=ctx.createGain();s.gain.value=.25;g.rollHP.connect(s).connect(D.verb);}}
 return g;
}
function hit(g,buffer,dest,t,vel,rate=1){const s=g.ctx.createBufferSource(),v=g.ctx.createGain();s.buffer=buffer;s.playbackRate.value=rate;v.gain.value=vel;s.connect(v).connect(dest);s.start(t);}
const lpHz=x=>120*2**(clamp(x,0,1)*7.4);// 0 → 120 Hz, 1 → ~20 kHz
// Called at every pass through the section's start: whole-section automation.
function sectionStart(g,project,t){
 const ctx=g.ctx,tl=timeline(project),sec=project[g.section],fx=sec.fx,len=sec.bars*tl.bar;
 // Lead tone: closed and narrow before the drop, opening through the build-up, wide open in the drop.
 if(g.leadBus){const L=g.leadBus,f=L.tone.frequency,at=(x,v)=>{x.cancelScheduledValues(t);x.setValueAtTime(v,t);};
  if(g.type==='build'){at(f,280);f.exponentialRampToValueAtTime(9000,t+len);at(L.verb.gain,L.base.verb*1.8);at(L.delay.gain,L.base.delay*1.3);}
  else if(g.type==='drop'){at(f,20000);at(L.verb.gain,L.base.verb);at(L.delay.gain,L.base.delay);}
  else{at(f,{intro:1400,breakdown:5200,outro:2400}[g.type]||2400);at(L.verb.gain,Math.min(.9,L.base.verb*(g.type==='breakdown'?1.5:1.4)));at(L.delay.gain,L.base.delay*1.2);}}
 for(const G of Object.values(g.grp))if(G.lp){G.lp.frequency.cancelScheduledValues(t);G.lp.frequency.setValueAtTime(lpHz(fx.filterFrom),t);G.lp.frequency.exponentialRampToValueAtTime(lpHz(fx.filterTo),t+len);}
 if(g.type==='build'){
  const hpEnd=20*2**(fx.hp*6.6);
  for(const G of Object.values(g.grp)){G.hp.frequency.cancelScheduledValues(t);G.hp.frequency.setValueAtTime(20,t);G.hp.frequency.exponentialRampToValueAtTime(Math.max(21,hpEnd),t+len);G.hp.Q.setValueAtTime(.7,t);G.hp.Q.linearRampToValueAtTime(.7+fx.hp*2.5,t+len);
   G.swell.gain.cancelScheduledValues(t);G.swell.gain.setValueAtTime(1,t);G.swell.gain.linearRampToValueAtTime((1+fx.swell*.3)/(1+fx.verb*.9),t+len);G.wash.gain.cancelScheduledValues(t);G.wash.gain.setValueAtTime(0,t);G.wash.gain.linearRampToValueAtTime(fx.verb*.9,t+len);}
  if(fx.riser>0){const s=ctx.createBufferSource(),bp=ctx.createBiquadFilter(),v=ctx.createGain();s.buffer=g.noise;s.loop=true;bp.type='bandpass';bp.Q.value=.9;bp.frequency.setValueAtTime(300,t);bp.frequency.exponentialRampToValueAtTime(9000,t+len);v.gain.setValueAtTime(.0001,t);v.gain.exponentialRampToValueAtTime(fx.riser*.5,t+len);v.gain.linearRampToValueAtTime(0,t+len+.03);s.connect(bp).connect(v).connect(g.out);v.connect(g.verb);s.start(t);s.stop(t+len+.05);}
  if(fx.pitch>0){const f0=P.mtof(48+project.key),st=fx.pitch>.6?24:12,lp=ctx.createBiquadFilter(),v=ctx.createGain();lp.type='lowpass';lp.frequency.setValueAtTime(500,t);lp.frequency.exponentialRampToValueAtTime(7000,t+len);v.gain.setValueAtTime(.0001,t);v.gain.exponentialRampToValueAtTime(fx.pitch*.25,t+len);v.gain.linearRampToValueAtTime(0,t+len+.02);lp.connect(v).connect(g.out);v.connect(g.verb);
   for(const [type,det,mul,lv] of [['sawtooth',-11,1,.5],['sawtooth',11,1,.5],['square',0,2,.25]]){const o=ctx.createOscillator(),og=ctx.createGain();o.type=type;o.detune.value=det;og.gain.value=lv;o.frequency.setValueAtTime(f0*mul,t);o.frequency.exponentialRampToValueAtTime(f0*mul*2**(st/12),t+len);o.connect(og).connect(lp);o.start(t);o.stop(t+len+.05);}}
  if(g.rollShot&&fx.rollAmt>0){const kick=fx.roll==='kick';g.rollBus.gain.value=fx.rollAmt*(kick?.5:.45);g.rollHP.frequency.setValueAtTime(kick?30:250,t);g.rollHP.frequency.exponentialRampToValueAtTime(kick?400:1600,t+len);
   for(let u=0;u<len-1e-4;){const p=u/len,div=p<.5?1:p<.75?2:p<.875?4:8,vel=.25+.75*p**1.4;hit(g,g.rollShot,g.rollBus,t+u,vel,kick?1:2**(p*7/12));g.events.push(['roll',t+u,tl.beat/div*.5,kick?36:38,vel]);u+=tl.beat/div;}}
 }else if(g.type==='drop'&&fx.impact>0){const o=ctx.createOscillator(),v=ctx.createGain();o.frequency.setValueAtTime(82,t);o.frequency.exponentialRampToValueAtTime(36,t+1.2);v.gain.setValueAtTime(0,t);v.gain.linearRampToValueAtTime(fx.impact*.7,t+.004);v.gain.setTargetAtTime(0,t+.02,.45);o.connect(v).connect(g.out);o.start(t);o.stop(t+3);
  const n=ctx.createBufferSource(),h=ctx.createBiquadFilter(),nv=ctx.createGain();n.buffer=g.noise;h.type='highpass';h.frequency.value=4200;nv.gain.setValueAtTime(fx.impact*.25,t);nv.gain.setTargetAtTime(0,t+.01,.8);n.connect(h).connect(nv).connect(g.out);nv.connect(g.verb);n.start(t,0,3.9);}
}
// The note a lane plays at step k of a section: pitch, length up to the next note (times the gate), velocity by
// position, and for chord leads the chord under it.
function noteAt(project,sec,lane,k,eng){
 const n=steps(sec),i=k%n,grid=sec.grid,d=grid[lane][i];if(d==null)return null;let gap=1;while(gap<Math.min(n,16)&&grid[lane][(i+gap)%n]==null)gap++;
 const midi=midiFor(project,lane,d),L=sec.len?.[lane]?.[i],dur=Math.max(.04,L?L*timeline(project).step*.98:gap*timeline(project).step*(sec.gate?.[lane]??project.gate[lane])),vel=i%16===0?112:i%4===0?104:92;
 const kind=lane==='lead'&&eng?.patch&&root.DropLead?root.DropLead.VOICING[eng.patch]:null;
 return {midi,dur,vel,chord:kind?voiceChord(project,d,k,kind).map(x=>midiFor(project,'lead',x)):null};
}
// One sixteenth: k = step index within the section (0 .. bars*16-1).
function scheduleStep(g,project,k,t){
 const sec=project[g.section],n=steps(sec),i=k%n,grid=sec.grid,tl=timeline(project),progress=k/(sec.bars*16);
 if(k===0)sectionStart(g,project,t);
 for(const [lane] of DRUMS){const v=grid[lane][i];if(!v)continue;if(g.type==='build'&&lane==='kick'&&progress>=sec.fx.kickOut)continue;hit(g,g.shots[lane],g.lane[lane],t,v===2?1:.72);g.events.push([lane,t,tl.step*.9,{kick:36,clap:39,snare:38,hat:42,open:46}[lane],v===2?1:.72]);}
 if(g.type!=='build'&&i%4===0&&(sec.fx.pump||0)>0)for(const G of Object.values(g.grp)){G.pump.gain.setTargetAtTime(1-sec.fx.pump*.85,t,.003);G.pump.gain.setTargetAtTime(1,t+.03,tl.beat*.17);}
 for(const lane of ['bass','lead']){const x=noteAt(project,sec,lane,k,g[lane]);if(!x)continue;const eng=g[lane];
  if(eng)eng.play({midi:x.midi,time:t,duration:x.dur,velocity:x.vel,accent:i%4===2&&lane==='bass',chord:x.chord});for(const m of x.chord||[x.midi])g.events.push([lane,t,x.dur,m,x.vel/127]);}
}
function dispose(g){if(!g)return;try{g.bass?.dispose();g.lead?.dispose();}catch(e){}for(const G of Object.values(g.grp))try{G.out.disconnect();}catch(e){}}

/* ---------- Live looping of one section ---------- */
function createPlayer(ctx,dest){
 let g=null,timer=null,k=0,next=0,start=0,project=null,ticket=0;
 async function play(p,section){
  stop();const mine=++ticket;project=p;const graph=await makeGraph(ctx,dest,p,section);if(mine!==ticket){dispose(graph);return;}
  g=graph;k=0;next=start=ctx.currentTime+.08;timer=setInterval(pump,25);pump();
 }
 function pump(){const sec=project[g.section],total=sec.bars*16,sd=timeline(project).step;while(next<ctx.currentTime+.15){scheduleStep(g,project,k%total,next);g.events.length=0;k++;next+=sd;}}
 function stop(){ticket++;clearInterval(timer);timer=null;if(g){const old=g;for(const G of Object.values(old.grp))G.out.gain.setTargetAtTime(0,ctx.currentTime,.01);setTimeout(()=>dispose(old),300);}g=null;}
 // Where the loop is now, as a step within the section (for the playhead).
 function position(){if(!g)return null;const total=project[g.section].bars*16;return {section:g.section,step:Math.max(0,Math.floor((ctx.currentTime-start)/timeline(project).step))%total};}
 return {play,stop,position,playing:()=>!!g};
}

/* ---------- Offline render of the arrangement ---------- */
// Notes are scheduled one bar ahead while rendering (suspend/resume): ARP builds a full voice per note, and
// creating a whole section's voices up front makes the offline render crawl.
// A stem's stereo pair into channels 2i, 2i+1 of the stems output (mono sources spread to both sides).
function stemRouter(ctx,dest){
 const merge=ctx.createChannelMerger(CH),map={};merge.connect(dest);
 STEMS.forEach((stem,i)=>{const n=ctx.createGain();n.channelCount=2;n.channelCountMode='explicit';n.channelInterpretation='speakers';const split=ctx.createChannelSplitter(2);n.connect(split);split.connect(merge,0,2*i);split.connect(merge,1,2*i+1);map[stem]=n;});
 return map;
}
// Rendered parts are kept while nothing they depend on changes, so an edit re-renders only its own part.
const SECTION_CACHE=new Map(),CACHE_MAX=10;
const sectionKey=(p,k,sr)=>JSON.stringify([sr,p.bpm,p.key,p.scale,p.chords,p.sounds,p.mix,p.gate,p.style,p[k]]);
async function renderSection(project,section,sr,tick=()=>{}){
 const key=sectionKey(project,section,sr),hit=SECTION_CACHE.get(key);
 if(hit){SECTION_CACHE.delete(key);SECTION_CACHE.set(key,hit);for(let b=0;b<project[section].bars;b++)tick();return hit;}
 const tl=timeline(project),bars=project[section].bars,len=bars*tl.bar,ctx=new OfflineAudioContext(CH,Math.round((len+3)*sr),sr),g=await makeGraph(ctx,stemRouter(ctx,ctx.destination),project,section);
 const bar=b=>{for(let k=b*16;k<(b+1)*16;k++)scheduleStep(g,project,k,k*tl.step);};
 bar(0);
 for(let b=1;b<bars;b++){const at=Math.floor((b*tl.bar-tl.beat)*sr/128)*128/sr;ctx.suspend(at).then(()=>{bar(b);tick();ctx.resume();});}
 const out={buffer:await ctx.startRendering(),events:g.events};tick();
 SECTION_CACHE.set(key,out);while(SECTION_CACHE.size>CACHE_MAX)SECTION_CACHE.delete(SECTION_CACHE.keys().next().value);
 return out;
}
// Fader value (0..1, 0.8 = unity) → gain.
const faderGain=v=>v<=0?0:(v/.8)**2;
const busOf=p=>({drums:.8,bass:.8,lead:.8,fx:.8,audio:.8,...(p.bus||{})});
// What each mixer channel actually lets through: its fader, unless muted, or another channel is soloed.
function busGains(p){const bus=busOf(p),mute=p.busMute||{},solo=p.busSolo||{},any=MIXER.some(k=>solo[k]);return Object.fromEntries(MIXER.map(k=>[k,mute[k]||(any&&!solo[k])?0:faderGain(bus[k])]));}
// The same for the audio tracks (solo works among the audio tracks).
function trackGains(p){const t=p.audio?.tracks||[],any=t.some(x=>x.solo);return t.map(x=>x.mute||(any&&!x.solo)?0:(x.gain??1));}
// Stems (a stereo pair each) → stereo, each stem at its gain, plus extra stereo buffers [{buffer, gain}].
function mixdown(stems,gains=[1,1,1,1],extra=[]){
 const n=Math.max(stems.length,...extra.map(x=>x.buffer.length)),out=new AudioBuffer({numberOfChannels:2,length:n,sampleRate:stems.sampleRate}),L=out.getChannelData(0),R=out.getChannelData(1);
 const add=(a,b,gn,len)=>{for(let i=0;i<len;i++){L[i]+=a[i]*gn;R[i]+=b[i]*gn;}};
 for(let s=0;s*2+1<stems.numberOfChannels;s++){const gn=gains[s]??1;if(gn)add(stems.getChannelData(2*s),stems.getChannelData(2*s+1),gn,stems.length);}
 for(const x of extra)if(x.gain)add(x.buffer.getChannelData(0),x.buffer.getChannelData(x.buffer.numberOfChannels>1?1:0),x.gain,x.buffer.length);
 return out;
}
/* ---------- Automation (song view): per mixer channel, volume and a low-pass filter, drawn as points ----------
   p.auto['lead.vol'] = [[bar, value], …], value 0..1 (volume: 1 = as mixed; filter: 1 = open, 0 = 20 Hz). */
const AUTO_KINDS={vol:'volume',filter:'filter'};
const autoHz=v=>20*2**(clamp(v,0,1)*10);
function autoValue(points,bar){if(!points?.length)return null;if(bar<=points[0][0])return points[0][1];for(let i=1;i<points.length;i++){const [b0,v0]=points[i-1],[b1,v1]=points[i];if(bar<=b1)return b1===b0?v1:v0+(v1-v0)*(bar-b0)/(b1-b0);}return points[points.length-1][1];}
// Points onto an AudioParam. opt: bar (s), from (song time at t0), t0 (context time).
function scheduleAuto(param,points,opt,map,exp){
 param.cancelScheduledValues(0);param.setValueAtTime(map(autoValue(points,opt.from/opt.bar)),opt.t0);
 for(const [b,v] of points){const t=opt.t0+b*opt.bar-opt.from;if(t<=opt.t0)continue;const y=map(v);exp?param.exponentialRampToValueAtTime(Math.max(1e-4,y),t):param.linearRampToValueAtTime(y,t);}
}
// The automation chain of one channel: volume → low-pass → dest. Returns its input.
function autoChain(ctx,dest,p,k,opt){
 const g=ctx.createGain(),f=ctx.createBiquadFilter(),A=opt?p.auto||{}:{};f.type='lowpass';f.Q.value=.7;f.frequency.value=20480;g.connect(f).connect(dest);
 if(A[k+'.vol']?.length)scheduleAuto(g.gain,A[k+'.vol'],opt,v=>v*v,false);if(A[k+'.filter']?.length)scheduleAuto(f.frequency,A[k+'.filter'],opt,autoHz,true);
 return g;
}
// Offline mix of a render: every stem and audio track through its gain and automation. only: one stem key or
// 'track:i' (for stem export: fader and automation, but not mute or solo).
async function mixOffline(result,project,only=null){
 const sr=result.stems.sampleRate,len=Math.max(result.stems.length,...(result.audio||[]).map(b=>b.length)),ctx=new OfflineAudioContext(2,len,sr),opt=result.song?{bar:timeline(project,true).bar,from:result.t0||0,t0:0}:null;
 const bus=busOf(project),g=only?Object.fromEntries(MIXER.map(k=>[k,faderGain(bus[k])])):busGains(project),tg=only?(project.audio?.tracks||[]).map(t=>t.gain??1):trackGains(project);
 const src=ctx.createBufferSource(),split=ctx.createChannelSplitter(CH);src.buffer=result.stems;src.connect(split);
 STEMS.forEach((k,i)=>{if(only&&only!==k)return;const m=ctx.createChannelMerger(2),gn=ctx.createGain();gn.gain.value=g[k];split.connect(m,2*i,0);split.connect(m,2*i+1,1);m.connect(autoChain(ctx,gn,project,k,opt));gn.connect(ctx.destination);});
 const ag=ctx.createGain();ag.gain.value=g.audio;ag.connect(ctx.destination);const aIn=autoChain(ctx,ag,project,'audio',opt);
 (result.audio||[]).forEach((b,i)=>{if(only&&only!=='track:'+i)return;const s=ctx.createBufferSource(),t=ctx.createGain();s.buffer=b;t.gain.value=tg[i]??1;s.connect(t).connect(aIn);s.start();});
 src.start();return ctx.startRendering();
}
// The finished stereo mix at the project's mixer settings (faders, mute, solo, audio tracks, automation), limited.
async function mix(result,project){const buf=await mixOffline(result,project),lim=P.limit(buf,0,buf.duration);return {buffer:buf,peak:lim.peak,reduction:lim.reduction};}
// Chords from a song's ARP analysis: the strongest root of each bar, as degrees of the project's scale.
// segments in seconds; at(b) gives the song second where bar b of the window starts.
function chordsFromHarmony(p,segments,at,barSec,n=4){
 const sc=SCALES[p.scale][1],out=[];
 for(let b=0;b<n;b++){const a=at(b),e=a+barSec,w=Array(12).fill(0);for(const s of segments){if(s.silent)continue;const o=Math.min(e,s.end)-Math.max(a,s.start);if(o>0)w[s.root]+=o;}
  const m=Math.max(...w);if(m<=0){out.push(out[out.length-1]??0);continue;}const rel=(w.indexOf(m)-p.key+12)%12;let best=0,dist=99;sc.forEach((v,i)=>{const d=Math.min(Math.abs(v-rel),12-Math.abs(v-rel));if(d<dist){dist=d;best=i;}});out.push(best);}
 return out;
}
// Put the drop (and the build-up's lead) on a given progression: bass riff and lead written again on it.
function setChords(project,chords,seed){
 project.chords=chords.slice();const st=STYLES[project.style]||STYLES.festival,rng=P.rng(seed>>>0);if(project.drop.patternBars<4)resize(project.drop,4);
 const n=steps(project.drop),v=project.v||{bassline:'offbeat'};project.drop.grid.bass=onChords(bassline(v.bassline,project,st,rng,seed,n),project);newMelody(project,seed+1);
 return progName(project);
}
// Audio tracks (song view), one stereo buffer each from the song's start: clips warped to the song tempo, from
// their phase (where in the clip it starts, after a trim or split), looped or cut to their length, with fades.
async function renderAudio(project,samples,sr,t0=0){
 const tl=timeline(project,true),bar=tl.bar,tracks=project.audio?.tracks||[],end=Math.max(tl.total,clipEnd(project)*bar)-t0+1;
 return Promise.all(tracks.map(async(t,ti)=>{
  const ctx=new OfflineAudioContext(2,Math.max(1,Math.round(end*sr)),sr);
  for(const c of project.audio.clips.filter(c=>c.track===ti)){
   const src=samples[c.sample];if(!src)continue;const W=root.DropWarp.render(src,c,project.bpm,sr),at=c.start*bar-t0,len=c.len*bar,gain=c.gain??.8,v=ctx.createGain();v.connect(ctx.destination);
   const fi=Math.min(len/2,(c.fadeIn||0)*tl.beat),fo=Math.min(len/2,(c.fadeOut||0)*tl.beat),a0=Math.max(0,at);
   v.gain.setValueAtTime(fi?0:gain,a0);if(fi)v.gain.linearRampToValueAtTime(gain,at+fi);v.gain.setValueAtTime(gain,Math.max(a0,at+len-Math.max(fo,.006)));v.gain.linearRampToValueAtTime(0,at+len);
   let o=0,pos=c.loop?((c.phase||0)*bar)%W.duration:(c.phase||0)*bar;
   while(o<len-1e-3){const d=Math.min(W.duration-pos,len-o);if(d<=1e-3)break;const s=ctx.createBufferSource();s.buffer=W;s.connect(v);const when=at+o;if(when+d>0)s.start(Math.max(0,when),pos+Math.max(0,-when),d-Math.max(0,-when));o+=d;pos=0;if(!c.loop)break;}
  }
  return ctx.startRendering();
 }));
}
// opts.song: the song view's arrangement instead of the drop view. opts.progress(0..1) is called as bars render.
async function render(project,{sr=44100,only=null,song=false,samples={},progress=()=>{}}={}){
 const tl=timeline(project,song),parts=tl.parts.filter(x=>!only||only.includes(x.name)||only.includes(x.type)),pre=project.pre,beat=tl.beat,fade=.006;
 const keys=[...new Set(parts.map(x=>x.name))],pairs=parts.filter((x,i)=>x.pre&&parts[i+1]===tl.parts[x.index+1]);
 const total=keys.reduce((a,k)=>a+project[k].bars,0)+2*pairs.length+2;let done=0;const tick=()=>{done++;progress(Math.min(.99,done/total));};progress(0);
 const rendered=await Promise.all(keys.map(k=>typeOf(project,k)==='space'?(()=>{for(let b=0;b<project[k].bars;b++)tick();return {buffer:null,events:[]};})():renderSection(project,k,sr,tick))),by=Object.fromEntries(keys.map((k,i)=>[k,rendered[i]]));
 const t0=parts[0].start,length=Math.max(parts[parts.length-1].end,song?clipEnd(project)*tl.bar:0)-t0+3,ctx=new OfflineAudioContext(CH,Math.round(length*sr),sr),fxStem=stemRouter(ctx,ctx.destination).fx;
 const place=(buf,at,offset=0,dur=buf.duration-offset)=>{const s=ctx.createBufferSource(),v=ctx.createGain();s.buffer=buf;v.gain.setValueAtTime(1,Math.max(0,at+dur-fade));v.gain.linearRampToValueAtTime(0,at+dur);s.connect(v).connect(ctx.destination);s.start(Math.max(0,at),offset+Math.max(0,-at),dur);};
 // Parts ring into the next one, except a build-up before a drop: it stops dead at the pre-drop.
 for(const x of parts){const R=by[x.name],at=x.start-t0;if(!R.buffer)continue;if(x.pre)place(R.buffer,at,0,x.gapOut-x.start+fade);else place(R.buffer,at);}
 // Every pre-drop: the build-up's last beat thrown into DELAYSY, and the drop's first beat reversed into it. Both on the fx stem.
 const throws={},swells={};
 for(const x of pairs){const D=tl.parts[x.index+1],gapOut=x.gapOut-t0,dropOut=D.start-t0;
  if(pre.throw>0&&root.Delaysy){const len=Math.min(pre.throwLen*beat,x.gapOut-x.start),W=throws[x.name]||(throws[x.name]=await P.delaysyThrow(mixdown(by[x.name].buffer),x.gapOut-x.start-len,len,pre.delaysy,project.bpm)),v=ctx.createGain(),s=ctx.createBufferSource(),at=gapOut-len-W.lead;s.buffer=W.buffer;v.gain.setValueAtTime(pre.throw*W.gain,Math.max(0,at));v.gain.setValueAtTime(pre.throw*W.gain,dropOut);v.gain.setTargetAtTime(pre.throw*W.gain*.3,dropOut,beat*.5);v.gain.setTargetAtTime(0,D.end-t0-beat,beat);s.connect(v).connect(fxStem);s.start(Math.max(0,at),Math.max(0,-at));}
  tick();
  if(pre.reverse>0&&by[D.name]){const R=swells[D.name]||(swells[D.name]=await P.reverseSwell(mixdown(by[D.name].buffer),0,beat,2.4)),len=clamp(Math.max(D.start-x.gapOut,2*beat),.2,R.duration-.05),a=dropOut-len,s=ctx.createBufferSource(),v=ctx.createGain();s.buffer=R;v.gain.setValueAtTime(0,a);v.gain.linearRampToValueAtTime(pre.reverse*.9,dropOut-.01);v.gain.linearRampToValueAtTime(0,dropOut+.004);s.connect(v).connect(fxStem);s.start(a,R.duration-len);s.stop(dropOut+.02);}
  tick();
 }
 const stems=await ctx.startRendering(),audio=song?await renderAudio(project,samples,sr,t0):[],m=await mix({stems,audio,song,t0},project);tick();
 const events=parts.flatMap(x=>by[x.name].events.filter(e=>!x.pre||e[1]<x.gapOut-x.start).map(e=>[e[0],e[1]+x.start-t0,...e.slice(2)]));
 progress(1);
 return {stems,audio,buffer:m.buffer,tl,t0,parts,events,peak:m.peak,reduction:m.reduction,song};
}

const api={AUTO_KINDS,autoValue,autoChain,mixOffline,chordsFromHarmony,setChords,insertDropAt,MIXER,busGains,trackGains,renderAudio,insertSpace,clipEnd,makeSong,newPartMelody,typeOf,labelOf,SONG_DEFAULT,songOrder,ensureSongParts,variation,partOfType,STEMS,faderGain,busOf,mixdown,mix,PROGS,progName,chordName,newMelody,newChords,SCALES,DRUMS,ROWS,NOTE,ORDER,NAMES,SKETCH,STYLES,steps,blank,resize,degree,midiFor,rowLabel,enabled,arpSounds,arpPatterns,leadName,arpLane,newArpLead,generate,randomize,sketch,timeline,createPlayer,render};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.DropGrid=api;
})(typeof globalThis!=='undefined'?globalThis:this);
