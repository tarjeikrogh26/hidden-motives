/* Dropfather drop maker: build-up and drop on a step grid, pre-drop between them, and optionally the rest of the
   song around them (intro, breakdown, outro). No song needed.
   Bass is Bass Invaders; the lead is AVANTGARDIAN ARP (its 777 sounds and its pattern library) or Bass Invaders;
   drums, roll and risers are Dropfather's own; the throw is DELAYSY.
   One scheduler serves both live looping (while editing) and offline rendering (for Play all and export). */
(function(root){'use strict';
const X=root.DropDSP,P=X.parts,clamp=P.clamp;

const SCALES={minor:['Minor',[0,2,3,5,7,8,10]],phrygian:['Phrygian',[0,1,3,5,7,8,10]],dorian:['Dorian',[0,2,3,5,7,9,10]],harmonic:['Harmonic minor',[0,2,3,5,7,8,11]],major:['Major',[0,2,4,5,7,9,11]]};
const DRUMS=[['kick','Kick'],['clap','Clap'],['snare','Snare'],['hat','Hat'],['open','Open hat']];
const ROWS={bass:8,lead:11};// scale degrees per note lane, 0 = root
const NOTE=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
// Arrangement order. The pre-drop is the end of the build-up (its silence, throw and reverse suck).
const ORDER=['intro','breakdown','build','drop','outro'];
const NAMES={intro:'INTRO',breakdown:'BREAKDOWN',build:'BUILD-UP',drop:'DROP',outro:'OUTRO'};
const SKETCH=['intro','breakdown','outro'];

const steps=p=>p.patternBars*16;
function blank(n){const g={};for(const [k] of DRUMS)g[k]=Array(n).fill(0);g.bass=Array(n).fill(null);g.lead=Array(n).fill(null);return g;}
function resize(sec,bars){const n=bars*16,g=blank(n);for(const k of Object.keys(g))for(let i=0;i<n;i++)g[k][i]=sec.grid[k][i%sec.grid[k].length];sec.patternBars=bars;sec.grid=g;}
function degree(project,d){const sc=SCALES[project.scale][1],n=sc.length,o=Math.floor(d/n);return sc[((d%n)+n)%n]+12*o;}
const bassBase=key=>28+((key-4+12)%12);// E1..D#2, as in song mode
const leadBase=key=>57+((key-9+12)%12);// A3..G#4
function midiFor(project,lane,d){return (lane==='bass'?bassBase(project.key):leadBase(project.key))+degree(project,d);}
function rowLabel(project,lane,d){const m=midiFor(project,lane,d);return NOTE[m%12]+(Math.floor(m/12)-1);}
const enabled=(p,name)=>(name==='build'||name==='drop')?true:!!(p.song&&p.song[name]&&p[name]);

/* ---------- Sound sources ---------- */
// AVANTGARDIAN ARP's 777 factory sounds and its pattern library (first 4 bars of every arp-ready pattern).
const arpSounds=()=>root.NB46Bank?.factory||[];
let library=null;
function arpPatterns(){if(library)return library;const el=root.document?.getElementById('arp-patterns');library=el?JSON.parse(el.textContent).patterns:[];return library;}
function leadName(id){if(id?.startsWith('arp:')){const e=arpSounds().find(s=>s.id===id.slice(4));return e?'ARP · '+e.name:id;}return {minilead:'Bass Invaders · Mini Lead',lead:'Bass Invaders · Saw Lead',sqlead:'Bass Invaders · Square Lead'}[id]||id;}

/* ---------- Turning an ARP pattern into the lead lane ---------- */
// Pitches relative to the pattern's root become the nearest degree of the project's scale; one note per sixteenth.
function arpLane(project,pattern,n){
 const sc=SCALES[project.scale][1],out=Array(n).fill(null),base=60+(pattern.root||0);
 for(const [beat,,pitch] of [...pattern.notes].sort((a,b)=>a[0]-b[0]||b[2]-a[2])){
  const i=Math.round(beat*4);if(i<0||i>=n||out[i]!=null)continue;
  const rel=pitch-base,oct=Math.floor(rel/12),pc=((rel%12)+12)%12;let best=0,dist=99;sc.forEach((s,k)=>{const d=Math.abs(s-pc);if(d<dist){dist=d;best=k;}});
  let deg=best+7*oct;while(deg<0)deg+=7;while(deg>=ROWS.lead)deg-=7;out[i]=deg;
 }
 return out;
}
function arpPick(rng,mode){const all=arpPatterns().filter(p=>p.notes.length>=4);if(!all.length)return null;const same=all.filter(p=>p.mode===(mode==='major'?'major':'minor'));const pool=same.length?same:all;return pool[Math.floor(rng()*pool.length)];}
function arpBlend(seed){const N=root.NoteEngine,all=arpPatterns();if(!N?.hybrid||all.length<2)return null;try{return N.hybrid(all,seed>>>0,16);}catch(e){return null;}}

/* ---------- Styles: each writes a whole drop project, different every time ---------- */
const STYLES={
 house:{kits:['club','deep','crisp','punch'],name:'House lift',genre:'house',bpm:[122,126],bass:['pal:house:5:1','pal:house:6:1','pal2:house:1','pal:house:4:1'],group:'soft',hats:['off8','shuffle','sixteen'],clap:['twofour','pickup'],open:['none','offopen'],fill:['none','small'],bassline:['invaders','offbeat','syncopated'],lead:['arp','blend','hook'],
  build:{bars:8,fx:{hp:.5,riser:.4,pitch:0,roll:'clap',rollAmt:.5,verb:.35,swell:.2,kickOut:.75}},pre:{gapBeats:1,throw:.5,delaysy:8,throwLen:1,reverse:.4},drop:{bars:16,fx:{pump:.35,impact:.4}},gate:{bass:.55,lead:.45}},
 festival:{kits:['punch','club','heavy'],name:'Festival',genre:'edm',bpm:[126,130],bass:['pal:edm:1:1','pal:edm:0:0','pal:edm:2:1','pal:edm:3:0'],group:'wide',hats:['off8','sixteen'],clap:['twofour','layer'],open:['barend','offopen'],fill:['big','small'],bassline:['invaders','roll16','bounce'],lead:['arp','blend','hook'],
  build:{bars:16,fx:{hp:.8,riser:.8,pitch:.6,roll:'snare',rollAmt:.85,verb:.6,swell:.5,kickOut:.5}},pre:{gapBeats:4,throw:.6,delaysy:61,throwLen:2,reverse:.8},drop:{bars:16,fx:{pump:.7,impact:.9}},gate:{bass:.7,lead:.75}},
 techno:{kits:['heavy','room','tape'],name:'Techno tunnel',genre:'motor',bpm:[128,134],bass:['pal:motor:3:1','pal:motor:7:0','pal:motor:2:1','pal:ebm:3:1'],group:'modular',hats:['sixteen','gallop','off8'],clap:['none','rim'],open:['offopen'],fill:['none'],bassline:['invaders','gallop','offbeat'],lead:['arp','blend','none'],
  build:{bars:8,fx:{hp:.7,riser:.6,pitch:0,roll:'kick',rollAmt:.7,verb:.5,swell:.3,kickOut:1}},pre:{gapBeats:2,throw:.7,delaysy:98,throwLen:1,reverse:.3},drop:{bars:16,fx:{pump:.55,impact:.6}},gate:{bass:.6,lead:.3}},
 takeoff:{kits:['punch','club','crisp'],name:'Take-off',genre:'edm',bpm:[126,130],bass:['pal:edm:0:1','pal:edm:1:1','pal:edm:3:0'],group:'wide',hats:['off8','sixteen'],clap:['twofour','layer'],open:['none','barend'],fill:['small','big'],bassline:['roll16','bounce','invaders'],lead:['arp','blend','hook'],
  build:{bars:8,fx:{hp:.65,riser:.55,pitch:.5,roll:'snare',rollAmt:.6,verb:.45,swell:.35,kickOut:.6}},pre:{gapBeats:1,throw:.45,delaysy:30,throwLen:1,reverse:.6},drop:{bars:16,fx:{pump:.5,impact:.7}},gate:{bass:.7,lead:.5}},
 ebm:{kits:['heavy','tape','dusty'],name:'EBM motor',genre:'ebm',bpm:[116,124],bass:['pal:ebm:3:1','pal:ebm:1:0','pal:ebm:6:1','pal:acid:0:0'],group:'modular',hats:['off8','sparse'],clap:['snare'],open:['none'],fill:['none','small'],bassline:['octave8','invaders','roll16'],lead:['none','arp','blend'],
  build:{bars:4,fx:{hp:.55,riser:.3,pitch:0,roll:'snare',rollAmt:.7,verb:.25,swell:.2,kickOut:.75}},pre:{gapBeats:2,throw:.35,delaysy:179,throwLen:.5,reverse:.2},drop:{bars:16,fx:{pump:.3,impact:.5}},gate:{bass:.8,lead:.35}}
};
const MIX={kick:.9,clap:.55,snare:.5,hat:.35,open:.3,bass:.7,lead:.45};
const LABEL={off8:'offbeat hats',shuffle:'shuffled hats',sixteen:'16th hats',gallop:'galloping hats',sparse:'sparse hats',twofour:'clap on 2 and 4',pickup:'clap with pickup',layer:'clap + snare',rim:'soft snare',snare:'snare on 2 and 4',none:'',offopen:'open hats on the off',barend:'open hat at the bar end',small:'small fill',big:'snare fill',invaders:'Bass Invaders riff',offbeat:'offbeat bass',syncopated:'syncopated bass',roll16:'rolling 16ths',gallop2:'galloping bass',bounce:'octave bounce',octave8:'octave motor'};

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
function bassline(kind,p,st,rng,seed,n,used=()=>{}){
 const b=Array(n).fill(null),turn=()=>{if(rng()<.6){b[n-3]=null;b[n-2]=[4,5,6][Math.floor(rng()*3)];}};
 if(kind==='invaders'){const line=invadersLine(p,st.genre,810001+seed%9973,n);if(line)return line;kind='offbeat';used(kind);}
 if(kind==='offbeat')for(let i=2;i<n;i+=4)b[i]=0;
 if(kind==='syncopated')for(let bar=0;bar*16<n;bar++)for(const s of [0,3,6,10,13])b[bar*16+s]=0;
 if(kind==='roll16')for(let i=0;i<n;i++)if(i%4)b[i]=0;
 if(kind==='gallop')for(let i=0;i<n;i++)if(i%4===2||i%4===3)b[i]=0;
 if(kind==='bounce')for(let i=0;i<n;i+=2)b[i]=i%4===2?7:0;
 if(kind==='octave8')for(let i=0;i<n;i+=2)b[i]=(i/2)%2?7:0;
 if(kind!=='bounce'&&kind!=='octave8')turn();
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
 const sounds=arpSounds().filter(s=>s.group===st.group),lead=sounds.length?'arp:'+pick(sounds).id:pick(['minilead','lead','sqlead']);
 const bpm=base.keepTempo&&base.bpm?base.bpm:st.bpm[0]+Math.floor(rng()*(st.bpm[1]-st.bpm[0]+1));
 const p={version:2,style:styleKey,seed,bpm,key,scale,sounds:{bass:pick(st.bass),lead},mix:{...MIX},gate:{...st.gate},song:{intro:false,breakdown:false,outro:false},
  build:{bars:st.build.bars,patternBars:1,grid:blank(16),fx:{...st.build.fx}},pre:{...st.pre},drop:{bars:st.drop.bars,patternBars:2,grid:blank(32),fx:{...st.drop.fx}}};
 // Lead: an ARP pattern, a fresh ARP blend ("Make arp"), or a short hook. ARP phrases keep all four bars.
 let leadLine=null,leadInfo='';
 if(v.lead==='arp'){const pat=arpPick(rng,scale);if(pat){p.drop.patternBars=4;leadLine=arpLane(p,pat,64);leadInfo=`ARP pattern “${pat.name}”`;}}
 if(v.lead==='blend'){const pat=arpBlend(seed);if(pat){p.drop.patternBars=4;leadLine=arpLane(p,pat,64);leadInfo=`ARP blend ${pat.name.replace('MIDI blend ','#')}`;}}
 if(v.lead==='hook'||(v.lead!=='none'&&!leadLine)){leadLine=hook(rng,32,styleKey==='festival'?.9:.55);leadInfo='hook';}
 if(p.drop.patternBars===4)p.drop.grid=blank(64);
 const d=p.drop.grid,n=steps(p.drop);drums(d,n,v);d.bass=bassline(v.bassline,p,st,rng,seed,n,k=>v.bassline=k);if(leadLine)for(let i=0;i<n;i++)d.lead[i]=leadLine[i%leadLine.length];
 // Build: the drop's drums thinned (no fill, no open hats), hats driving, the lead's first bar as a teaser, no bass.
 const b=p.build.grid;drums(b,16,{...v,fill:'none',open:'none',clap:v.clap==='pickup'?'twofour':v.clap});if(v.hats==='off8'||v.hats==='sparse')for(let i=0;i<16;i+=2)b.hat[i]=b.hat[i]||1;
 for(let i=0;i<16;i++)b.lead[i]=d.lead[i];
 // Drum kit last, so a seed's grids and sounds stay what they were before kits existed.
 if(root.DropKits){const ok=(st.kits||[]).filter(root.DropKits.has);p.sounds.drums=ok.length?pick(ok):'synth';}
 p.desc=[st.name,LABEL[v.hats],LABEL[v.clap],LABEL[v.open],LABEL[v.fill],v.bassline==='gallop'?'galloping bass':LABEL[v.bassline],leadInfo&&('lead: '+leadInfo),p.sounds.drums&&p.sounds.drums!=='synth'&&('drums: '+root.DropKits.list().find(k=>k.id===p.sounds.drums).n)].filter(Boolean).join(' · ');
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
function timeline(p){
 const beat=60/p.bpm,bar=beat*4,parts=[];let t=0;
 for(const name of ORDER){if(!enabled(p,name))continue;const len=p[name].bars*bar;parts.push({name,start:t,end:t+len});t+=len;}
 const b=parts.find(x=>x.name==='build'),d=parts.find(x=>x.name==='drop'),gap=Math.min(p.pre.gapBeats*beat,(b.end-b.start)-beat);
 return {beat,bar,step:beat/4,parts,gap,buildOut:b.start,gapOut:b.end-gap,dropOut:d.start,dropEndOut:d.end,total:t};
}

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
async function makeGraph(ctx,dest,project,section){
 const g={ctx,section,events:[],out:ctx.createGain(),lane:{},shots:{},noise:P.noiseBuffer(ctx,4,11)},fx=project[section].fx,isBuild=section==='build',isDrop=section==='drop',plain=!isBuild&&!isDrop;
 g.out.gain.value=.6;g.out.connect(dest);g.verb=ctx.createConvolver();g.verb.normalize=true;g.verb.buffer=P.impulse(ctx,2.6,2.6,5,1);const vr=ctx.createGain();vr.gain.value=.4;g.verb.connect(vr).connect(g.out);
 // Build: everything through one high-pass that opens. Drop: everything but kick and clap pumps.
 // Intro, breakdown, outro: one low-pass that moves over the section, plus reverb and optional pump.
 g.body=ctx.createGain();g.pump=ctx.createGain();
 if(isBuild){g.hp=ctx.createBiquadFilter();g.hp.type='highpass';g.hp.frequency.value=20;g.swell=ctx.createGain();g.wash=ctx.createGain();g.wash.gain.value=0;g.body.connect(g.hp).connect(g.swell).connect(g.out);g.hp.connect(g.wash).connect(g.verb);}
 else if(plain){g.lp=ctx.createBiquadFilter();g.lp.type='lowpass';g.lp.frequency.value=20000;g.lp.Q.value=.9;g.body.connect(g.lp).connect(g.out);g.pump.connect(g.lp);const w=ctx.createGain();w.gain.value=fx.verb||0;g.lp.connect(w).connect(g.verb);}
 else{g.body.connect(g.out);g.pump.connect(g.out);}
 const pumped=k=>!isBuild&&(k==='hat'||k==='open'||k==='bass'||k==='lead');
 for(const [k] of DRUMS){const n=ctx.createGain();n.gain.value=project.mix[k];g.lane[k]=n;g.shots[k]=await drumShot(ctx,project,k);}
 for(const [k] of DRUMS)if(k!=='kick')g.lane[k].connect(pumped(k)?g.pump:g.body);
 g.kickShaper=P.shaper(ctx,.25);g.lane.kick.connect(g.kickShaper).connect(g.body);
 for(const k of ['bass','lead']){const n=ctx.createGain();n.gain.value=project.mix[k]*(k==='bass'?3:2.2);n.connect(pumped(k)?g.pump:g.body);g.lane[k]=n;}
 const ls=ctx.createGain();ls.gain.value=.25;g.lane.lead.connect(ls).connect(g.verb);
 // ARP and Bass Invaders share one ladder worklet per context: prepare ARP's first, then both voices.
 if(project.sounds.lead?.startsWith('arp:')&&root.NBVoice)await root.NBVoice.prepare(ctx);
 const [bass,lead]=await Promise.all([voice(ctx,g.lane.bass,project.sounds.bass,project,bassBase(project.key)),voice(ctx,g.lane.lead,project.sounds.lead,project,leadBase(project.key))]);
 g.bass=bass;g.lead=lead;
 if(isBuild){const roll=fx.roll==='off'?null:fx.roll;if(roll){g.rollShot=await drumShot(ctx,project,roll);g.rollBus=ctx.createGain();g.rollHP=ctx.createBiquadFilter();g.rollHP.type='highpass';g.rollBus.connect(g.rollHP).connect(g.out);const s=ctx.createGain();s.gain.value=.25;g.rollHP.connect(s).connect(g.verb);}}
 return g;
}
function hit(g,buffer,dest,t,vel,rate=1){const s=g.ctx.createBufferSource(),v=g.ctx.createGain();s.buffer=buffer;s.playbackRate.value=rate;v.gain.value=vel;s.connect(v).connect(dest);s.start(t);}
const lpHz=x=>120*2**(clamp(x,0,1)*7.4);// 0 → 120 Hz, 1 → ~20 kHz
// Called at every pass through the section's start: whole-section automation.
function sectionStart(g,project,t){
 const ctx=g.ctx,tl=timeline(project),sec=project[g.section],fx=sec.fx,len=sec.bars*tl.bar;
 if(g.lp){g.lp.frequency.cancelScheduledValues(t);g.lp.frequency.setValueAtTime(lpHz(fx.filterFrom),t);g.lp.frequency.exponentialRampToValueAtTime(lpHz(fx.filterTo),t+len);}
 if(g.section==='build'){
  const hpEnd=20*2**(fx.hp*6.6);g.hp.frequency.cancelScheduledValues(t);g.hp.frequency.setValueAtTime(20,t);g.hp.frequency.exponentialRampToValueAtTime(Math.max(21,hpEnd),t+len);g.hp.Q.setValueAtTime(.7,t);g.hp.Q.linearRampToValueAtTime(.7+fx.hp*2.5,t+len);
  g.swell.gain.cancelScheduledValues(t);g.swell.gain.setValueAtTime(1,t);g.swell.gain.linearRampToValueAtTime((1+fx.swell*.3)/(1+fx.verb*.9),t+len);g.wash.gain.cancelScheduledValues(t);g.wash.gain.setValueAtTime(0,t);g.wash.gain.linearRampToValueAtTime(fx.verb*.9,t+len);
  if(fx.riser>0){const s=ctx.createBufferSource(),bp=ctx.createBiquadFilter(),v=ctx.createGain();s.buffer=g.noise;s.loop=true;bp.type='bandpass';bp.Q.value=.9;bp.frequency.setValueAtTime(300,t);bp.frequency.exponentialRampToValueAtTime(9000,t+len);v.gain.setValueAtTime(.0001,t);v.gain.exponentialRampToValueAtTime(fx.riser*.5,t+len);v.gain.linearRampToValueAtTime(0,t+len+.03);s.connect(bp).connect(v).connect(g.out);v.connect(g.verb);s.start(t);s.stop(t+len+.05);}
  if(fx.pitch>0){const f0=P.mtof(48+project.key),st=fx.pitch>.6?24:12,lp=ctx.createBiquadFilter(),v=ctx.createGain();lp.type='lowpass';lp.frequency.setValueAtTime(500,t);lp.frequency.exponentialRampToValueAtTime(7000,t+len);v.gain.setValueAtTime(.0001,t);v.gain.exponentialRampToValueAtTime(fx.pitch*.25,t+len);v.gain.linearRampToValueAtTime(0,t+len+.02);lp.connect(v).connect(g.out);v.connect(g.verb);
   for(const [type,det,mul,lv] of [['sawtooth',-11,1,.5],['sawtooth',11,1,.5],['square',0,2,.25]]){const o=ctx.createOscillator(),og=ctx.createGain();o.type=type;o.detune.value=det;og.gain.value=lv;o.frequency.setValueAtTime(f0*mul,t);o.frequency.exponentialRampToValueAtTime(f0*mul*2**(st/12),t+len);o.connect(og).connect(lp);o.start(t);o.stop(t+len+.05);}}
  if(g.rollShot&&fx.rollAmt>0){const kick=fx.roll==='kick';g.rollBus.gain.value=fx.rollAmt*(kick?.5:.45);g.rollHP.frequency.setValueAtTime(kick?30:250,t);g.rollHP.frequency.exponentialRampToValueAtTime(kick?400:1600,t+len);
   for(let u=0;u<len-1e-4;){const p=u/len,div=p<.5?1:p<.75?2:p<.875?4:8,vel=.25+.75*p**1.4;hit(g,g.rollShot,g.rollBus,t+u,vel,kick?1:2**(p*7/12));g.events.push(['roll',t+u,tl.beat/div*.5,kick?36:38,vel]);u+=tl.beat/div;}}
 }else if(g.section==='drop'&&fx.impact>0){const o=ctx.createOscillator(),v=ctx.createGain();o.frequency.setValueAtTime(82,t);o.frequency.exponentialRampToValueAtTime(36,t+1.2);v.gain.setValueAtTime(0,t);v.gain.linearRampToValueAtTime(fx.impact*.7,t+.004);v.gain.setTargetAtTime(0,t+.02,.45);o.connect(v).connect(g.out);o.start(t);o.stop(t+3);
  const n=ctx.createBufferSource(),h=ctx.createBiquadFilter(),nv=ctx.createGain();n.buffer=g.noise;h.type='highpass';h.frequency.value=4200;nv.gain.setValueAtTime(fx.impact*.25,t);nv.gain.setTargetAtTime(0,t+.01,.8);n.connect(h).connect(nv).connect(g.out);nv.connect(g.verb);n.start(t,0,3.9);}
}
// One sixteenth: k = step index within the section (0 .. bars*16-1).
function scheduleStep(g,project,k,t){
 const sec=project[g.section],n=steps(sec),i=k%n,grid=sec.grid,tl=timeline(project),progress=k/(sec.bars*16);
 if(k===0)sectionStart(g,project,t);
 for(const [lane] of DRUMS){const v=grid[lane][i];if(!v)continue;if(g.section==='build'&&lane==='kick'&&progress>=sec.fx.kickOut)continue;hit(g,g.shots[lane],g.lane[lane],t,v===2?1:.72);g.events.push([lane,t,tl.step*.9,{kick:36,clap:39,snare:38,hat:42,open:46}[lane],v===2?1:.72]);}
 if(g.section!=='build'&&i%4===0&&(sec.fx.pump||0)>0){g.pump.gain.setTargetAtTime(1-sec.fx.pump*.85,t,.003);g.pump.gain.setTargetAtTime(1,t+.03,tl.beat*.17);}
 for(const lane of ['bass','lead']){const d=grid[lane][i],eng=g[lane];if(d==null)continue;let gap=1;while(gap<Math.min(n,16)&&grid[lane][(i+gap)%n]==null)gap++;
  const midi=midiFor(project,lane,d),dur=Math.max(.04,gap*tl.step*project.gate[lane]),vel=i%16===0?112:i%4===0?104:92;
  if(eng)eng.play({midi,time:t,duration:dur,velocity:vel,accent:i%4===2&&lane==='bass'});g.events.push([lane,t,dur,midi,vel/127]);}
}
function dispose(g){if(!g)return;try{g.bass?.dispose();g.lead?.dispose();}catch(e){}try{g.out.disconnect();}catch(e){}}

/* ---------- Live looping of one section ---------- */
function createPlayer(ctx,dest){
 let g=null,timer=null,k=0,next=0,start=0,project=null,ticket=0;
 async function play(p,section){
  stop();const mine=++ticket;project=p;const graph=await makeGraph(ctx,dest,p,section);if(mine!==ticket){dispose(graph);return;}
  g=graph;k=0;next=start=ctx.currentTime+.08;timer=setInterval(pump,25);pump();
 }
 function pump(){const sec=project[g.section],total=sec.bars*16,sd=timeline(project).step;while(next<ctx.currentTime+.15){scheduleStep(g,project,k%total,next);g.events.length=0;k++;next+=sd;}}
 function stop(){ticket++;clearInterval(timer);timer=null;if(g){const old=g;old.out.gain.setTargetAtTime(0,ctx.currentTime,.01);setTimeout(()=>dispose(old),300);}g=null;}
 // Where the loop is now, as a step within the section (for the playhead).
 function position(){if(!g)return null;const total=project[g.section].bars*16;return {section:g.section,step:Math.max(0,Math.floor((ctx.currentTime-start)/timeline(project).step))%total};}
 return {play,stop,position,playing:()=>!!g};
}

/* ---------- Offline render of the arrangement ---------- */
// Notes are scheduled one bar ahead while rendering (suspend/resume): ARP builds a full voice per note, and
// creating a whole section's voices up front makes the offline render crawl.
async function renderSection(project,section,sr){
 const tl=timeline(project),bars=project[section].bars,len=bars*tl.bar,ctx=new OfflineAudioContext(2,Math.round((len+3)*sr),sr),g=await makeGraph(ctx,ctx.destination,project,section);
 const bar=b=>{for(let k=b*16;k<(b+1)*16;k++)scheduleStep(g,project,k,k*tl.step);};
 bar(0);
 for(let b=1;b<bars;b++){const at=Math.floor((b*tl.bar-tl.beat)*sr/128)*128/sr;ctx.suspend(at).then(()=>{bar(b);ctx.resume();});}
 return {buffer:await ctx.startRendering(),events:g.events};
}
async function render(project,{sr=44100,only=null}={}){
 const tl=timeline(project),parts=tl.parts.filter(x=>!only||only.includes(x.name)),pre=project.pre,beat=tl.beat,fade=.006;
 const rendered=await Promise.all(parts.map(x=>renderSection(project,x.name,sr))),by=Object.fromEntries(parts.map((x,i)=>[x.name,rendered[i]]));
 const t0=parts[0].start,total=parts[parts.length-1].end-t0+3,ctx=new OfflineAudioContext(2,Math.round(total*sr),sr);
 const place=(buf,at,offset=0,dur=buf.duration-offset)=>{const s=ctx.createBufferSource(),v=ctx.createGain();s.buffer=buf;v.gain.setValueAtTime(1,Math.max(0,at+dur-fade));v.gain.linearRampToValueAtTime(0,at+dur);s.connect(v).connect(ctx.destination);s.start(Math.max(0,at),offset+Math.max(0,-at),dur);};
 // Sections ring into the next one, except the build-up: it stops dead at the pre-drop.
 for(const x of parts){const R=by[x.name],at=x.start-t0;if(x.name==='build')place(R.buffer,at,0,tl.gapOut-x.start+fade);else place(R.buffer,at);}
 const B=by.build,D=by.drop;
 if(B&&D&&pre.throw>0&&root.Delaysy){const len=Math.min(pre.throwLen*beat,tl.gapOut-tl.buildOut),W=await P.delaysyThrow(B.buffer,tl.gapOut-tl.buildOut-len,len,pre.delaysy,project.bpm),v=ctx.createGain(),s=ctx.createBufferSource(),at=tl.gapOut-len-W.lead-t0;s.buffer=W.buffer;v.gain.setValueAtTime(pre.throw*W.gain,0);v.gain.setValueAtTime(pre.throw*W.gain,tl.dropOut-t0);v.gain.setTargetAtTime(pre.throw*W.gain*.3,tl.dropOut-t0,beat*.5);s.connect(v).connect(ctx.destination);if(at>=0)s.start(at);else s.start(0,-at);}
 if(B&&D&&pre.reverse>0){const R=await P.reverseSwell(D.buffer,0,beat,2.4),len=clamp(Math.max(tl.gap,2*beat),.2,R.duration-.05),a=tl.dropOut-len-t0,s=ctx.createBufferSource(),v=ctx.createGain();s.buffer=R;v.gain.setValueAtTime(0,a);v.gain.linearRampToValueAtTime(pre.reverse*.9,tl.dropOut-t0-.01);v.gain.linearRampToValueAtTime(0,tl.dropOut-t0+.004);s.connect(v).connect(ctx.destination);s.start(a,R.duration-len);s.stop(tl.dropOut-t0+.02);}
 const out=await ctx.startRendering(),lim=P.limit(out,0,out.duration);
 const events=parts.flatMap(x=>by[x.name].events.filter(e=>x.name!=='build'||e[1]<tl.gapOut-x.start).map(e=>[e[0],e[1]+x.start-t0,...e.slice(2)]));
 return {buffer:out,tl,t0,parts,events,peak:lim.peak,reduction:lim.reduction};
}

const api={SCALES,DRUMS,ROWS,NOTE,ORDER,NAMES,SKETCH,STYLES,steps,blank,resize,degree,midiFor,rowLabel,enabled,arpSounds,arpPatterns,leadName,arpLane,newArpLead,generate,randomize,sketch,timeline,createPlayer,render};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.DropGrid=api;
})(typeof globalThis!=='undefined'?globalThis:this);
