/* Dropfather drop maker: build-up and drop on a step grid, pre-drop between them. No song needed.
   Bass and lead are Bass Invaders voices; drums, roll and risers are Dropfather's own; the throw is DELAYSY.
   One scheduler serves both live looping (while editing) and offline rendering (for Play all and export). */
(function(root){'use strict';
const X=root.DropDSP,P=X.parts,clamp=P.clamp;

const SCALES={minor:['Minor',[0,2,3,5,7,8,10]],phrygian:['Phrygian',[0,1,3,5,7,8,10]],dorian:['Dorian',[0,2,3,5,7,9,10]],harmonic:['Harmonic minor',[0,2,3,5,7,8,11]],major:['Major',[0,2,4,5,7,9,11]]};
const DRUMS=[['kick','Kick'],['clap','Clap'],['snare','Snare'],['hat','Hat'],['open','Open hat']];
const ROWS={bass:8,lead:11};// scale degrees per note lane, 0 = root
const NOTE=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const LEADS=['minilead','lead','sqlead'];// Bass Invaders' own lead patches; every factory bass sound also works up high

const steps=p=>p.patternBars*16;
function blank(n){const g={};for(const [k] of DRUMS)g[k]=Array(n).fill(0);g.bass=Array(n).fill(null);g.lead=Array(n).fill(null);return g;}
function resize(sec,bars){const n=bars*16,g=blank(n);for(const k of Object.keys(g))for(let i=0;i<n;i++)g[k][i]=sec.grid[k][i%sec.grid[k].length];sec.patternBars=bars;sec.grid=g;}
function degree(project,d){const sc=SCALES[project.scale][1],n=sc.length,o=Math.floor(d/n);return sc[((d%n)+n)%n]+12*o;}
const bassBase=key=>28+((key-4+12)%12);// E1..D#2, as in song mode
const leadBase=key=>57+((key-9+12)%12);// A3..G#4
function midiFor(project,lane,d){return (lane==='bass'?bassBase(project.key):leadBase(project.key))+degree(project,d);}
function rowLabel(project,lane,d){const m=midiFor(project,lane,d);return NOTE[m%12]+(Math.floor(m/12)-1);}

/* ---------- Styles: each writes a whole drop project ---------- */
const STYLES={
 house:{name:'House lift',genre:'house',bpm:124,bass:'pal:house:5:1',lead:'minilead',build:{bars:8,fx:{hp:.5,riser:.4,pitch:0,roll:'clap',rollAmt:.5,verb:.35,swell:.2,kickOut:.75}},pre:{gapBeats:1,throw:.5,delaysy:8,throwLen:1,reverse:.4},drop:{bars:16,fx:{pump:.35,impact:.4}},gate:{bass:.55,lead:.35}},
 festival:{name:'Festival',genre:'edm',bpm:128,bass:'pal:edm:1:1',lead:'lead',build:{bars:16,fx:{hp:.8,riser:.8,pitch:.6,roll:'snare',rollAmt:.85,verb:.6,swell:.5,kickOut:.5}},pre:{gapBeats:4,throw:.6,delaysy:61,throwLen:2,reverse:.8},drop:{bars:16,fx:{pump:.7,impact:.9}},gate:{bass:.7,lead:.8}},
 techno:{name:'Techno tunnel',genre:'motor',bpm:132,bass:'pal:motor:3:1',lead:'sqlead',build:{bars:8,fx:{hp:.7,riser:.6,pitch:0,roll:'kick',rollAmt:.7,verb:.5,swell:.3,kickOut:1}},pre:{gapBeats:2,throw:.7,delaysy:98,throwLen:1,reverse:.3},drop:{bars:16,fx:{pump:.55,impact:.6}},gate:{bass:.6,lead:.2}},
 takeoff:{name:'Take-off',genre:'edm',bpm:128,bass:'pal:edm:0:1',lead:'minilead',build:{bars:8,fx:{hp:.65,riser:.55,pitch:.5,roll:'snare',rollAmt:.6,verb:.45,swell:.35,kickOut:.6}},pre:{gapBeats:1,throw:.45,delaysy:30,throwLen:1,reverse:.6},drop:{bars:16,fx:{pump:.5,impact:.7}},gate:{bass:.7,lead:.5}},
 ebm:{name:'EBM motor',genre:'ebm',bpm:120,bass:'pal:ebm:3:1',lead:'sqlead',build:{bars:4,fx:{hp:.55,riser:.3,pitch:0,roll:'snare',rollAmt:.7,verb:.25,swell:.2,kickOut:.75}},pre:{gapBeats:2,throw:.35,delaysy:179,throwLen:.5,reverse:.2},drop:{bars:16,fx:{pump:.3,impact:.5}},gate:{bass:.8,lead:.3}}
};
const MIX={kick:.9,clap:.55,snare:.5,hat:.35,open:.3,bass:.7,lead:.4};

// The bass riff from Bass Invaders' own phrase generator, quantised to the scale (root..octave).
function invadersLine(project,genre,seed,n){
 const H=root.BassInvadersHost,B=root.BassPatterns;if(!H||!B)return null;
 const knobs=H.phraseKnobs(),notes=B.generate({...knobs,genre,riffMode:'auto',seed,bars:n/16,phraseBars:Math.min(4,n/16)}),sc=SCALES[project.scale][1],out=Array(n).fill(null);
 for(let i=0;i<n&&i<notes.length;i++){const e=notes[i];if(!e)continue;const iv=e.interval,pc=((iv%12)+12)%12;let best=0,dist=99;sc.forEach((s,k)=>{const d=Math.min(Math.abs(s-pc),12-Math.abs(s-pc));if(d<dist){dist=d;best=k;}});out[i]=iv>=12&&pc===0?7:best;}
 return out;
}
// A short hook: call in bar 1, answer in bar 2, from the strong degrees of the scale.
function hook(rng,n,density){
 const out=Array(n).fill(null),rhythms=[[0,3,6,10,12],[0,2,4,7,10,14],[0,3,6,8,11,14],[2,6,10,14],[0,4,6,10,12,14]],pool=[0,2,4,6,7,9];
 const r=rhythms[Math.floor(rng()*rhythms.length)].filter(()=>rng()<density+.35),motif=r.map((s,i)=>[s,i===0?(rng()<.5?0:4):pool[Math.floor(rng()*pool.length)]]);
 for(let bar=0;bar*16<n;bar++)motif.forEach(([s,d],i)=>{let deg=d;if(bar%2===1&&i===motif.length-1)deg=rng()<.5?0:4;if(bar%4===3&&i>=motif.length-2)deg=Math.min(9,d+2);out[bar*16+s]=deg;});
 return out;
}
function generate(styleKey,seed,base={}){
 const st=STYLES[styleKey]||STYLES.house,rng=P.rng(seed||1),key=base.key??9,scale=base.scale||'minor';
 const p={version:1,style:styleKey,seed,bpm:base.keepTempo&&base.bpm?base.bpm:st.bpm,key,scale,sounds:{bass:st.bass,lead:st.lead},mix:{...MIX},gate:{...st.gate},
  build:{bars:st.build.bars,patternBars:1,grid:blank(16),fx:{...st.build.fx}},pre:{...st.pre},drop:{bars:st.drop.bars,patternBars:2,grid:blank(32),fx:{...st.drop.fx}}};
 const d=p.drop.grid,b=p.build.grid,set=(lane,list,v=1)=>{for(const i of list)lane[i]=v;},every=(n,k,o=0)=>Array.from({length:n/k},(_,i)=>i*k+o);
 // Drop drums.
 set(d.kick,every(32,4));
 if(styleKey==='ebm')set(d.snare,every(32,8,4));else if(styleKey!=='techno')set(d.clap,every(32,8,4));
 set(d.hat,every(32,4,2));if(styleKey==='techno')set(d.hat,every(32,1).filter(i=>i%4),1);if(styleKey==='festival'||styleKey==='techno')set(d.open,every(32,8,6),1);
 set(d.kick,[0,16],2);
 // Drop bass: monotone take-off, octave motor, or the genre's Bass Invaders riff.
 if(styleKey==='takeoff'){for(let i=0;i<32;i++)if(i%4)d.bass[i]=0;}
 else if(styleKey==='ebm'){for(let i=0;i<32;i+=2)d.bass[i]=(i/2)%2?7:0;}
 else{const line=invadersLine(p,st.genre,810001+seed%9973,32);if(line&&line.some(v=>v!==null))d.bass=line;else for(let i=2;i<32;i+=4)d.bass[i]=0;}
 // Drop lead hook (none for EBM).
 if(styleKey!=='ebm')d.lead=hook(rng,32,styleKey==='festival'?.9:styleKey==='techno'?.2:.55);
 // Build: thinner drums, hats driving, the hook's first bar as a teaser, no bass.
 set(b.kick,every(16,4));if(styleKey!=='techno')set(b.clap,[4,12]);set(b.hat,every(16,2,0),1);
 for(let i=0;i<16;i++)b.lead[i]=d.lead[i];
 return p;
}
function randomize(project,seed){const keys=Object.keys(STYLES),rng=P.rng(seed),style=keys[Math.floor(rng()*keys.length)],p=generate(style,seed,{key:Math.floor(rng()*12),scale:Object.keys(SCALES)[Math.floor(rng()*4)]});const cat=X.bassCatalog();if(cat.length&&rng()<.6)p.sounds.bass=cat[Math.floor(rng()*cat.length)].id;if(root.Delaysy)p.pre.delaysy=Math.floor(rng()*root.Delaysy.presets.length);p.style='random';return p;}

/* ---------- Timeline ---------- */
function timeline(p){const beat=60/p.bpm,bar=beat*4,buildLen=p.build.bars*bar,gap=Math.min(p.pre.gapBeats*beat,buildLen-beat);return {beat,bar,step:beat/4,buildOut:0,gapOut:buildLen-gap,dropOut:buildLen,dropEndOut:buildLen+p.drop.bars*bar,gap};}

/* ---------- Graph and scheduler (shared by live play and offline render) ---------- */
async function voice(ctx,dest,id,project,base){
 const H=root.BassInvadersHost,K=root.KroghBass;if(!H||!K)return null;
 const settings=H.settingsFor(id,{bpm:project.bpm,root:project.key,octave:base-project.key}),graph=H.makeGraph(ctx,dest,settings),engine=K.create(ctx,graph.input,{preset:id});
 await engine.ready();H.applySound(engine,settings);if(typeof root.balanceSound==='function')await root.balanceSound(engine,structuredClone(settings));
 return engine;
}
async function makeGraph(ctx,dest,project,section){
 const g={ctx,section,events:[],out:ctx.createGain(),lane:{},shots:{},noise:P.noiseBuffer(ctx,4,11)},fx=project[section].fx,isBuild=section==='build';
 g.out.gain.value=.6;g.out.connect(dest);g.verb=ctx.createConvolver();g.verb.normalize=true;g.verb.buffer=P.impulse(ctx,2.6,2.6,5,1);const vr=ctx.createGain();vr.gain.value=.4;g.verb.connect(vr).connect(g.out);
 // Build: everything through one high-pass that opens over the section. Drop: everything but kick and clap pumps.
 g.body=ctx.createGain();
 if(isBuild){g.hp=ctx.createBiquadFilter();g.hp.type='highpass';g.hp.frequency.value=20;g.swell=ctx.createGain();g.wash=ctx.createGain();g.wash.gain.value=0;g.body.connect(g.hp).connect(g.swell).connect(g.out);g.hp.connect(g.wash).connect(g.verb);}
 else{g.pump=ctx.createGain();g.body.connect(g.out);g.pump.connect(g.out);}
 for(const [k] of DRUMS){const n=ctx.createGain();n.gain.value=project.mix[k];n.connect(!isBuild&&(k==='hat'||k==='open')?g.pump:g.body);g.lane[k]=n;const d=await P.oneShot(ctx.sampleRate,k==='clap'||k==='snare'||k==='hat'||k==='open'?k:'kick'),b=ctx.createBuffer(1,d.length,ctx.sampleRate);b.copyToChannel(d,0);g.shots[k]=b;}
 g.kickShaper=P.shaper(ctx,.25);g.lane.kick.disconnect();g.lane.kick.connect(g.kickShaper).connect(g.body);
 for(const k of ['bass','lead']){const n=ctx.createGain();n.gain.value=project.mix[k]*(k==='bass'?3:2.2);n.connect(isBuild?g.body:g.pump);g.lane[k]=n;}
 const ls=ctx.createGain();ls.gain.value=.25;g.lane.lead.connect(ls).connect(g.verb);
 const [bass,lead]=await Promise.all([voice(ctx,g.lane.bass,project.sounds.bass,project,bassBase(project.key)),voice(ctx,g.lane.lead,project.sounds.lead,project,leadBase(project.key))]);
 g.bass=bass;g.lead=lead;
 if(isBuild){const roll=fx.roll==='off'?null:fx.roll;if(roll){const d=await P.oneShot(ctx.sampleRate,roll),b=ctx.createBuffer(1,d.length,ctx.sampleRate);b.copyToChannel(d,0);g.rollShot=b;g.rollBus=ctx.createGain();g.rollHP=ctx.createBiquadFilter();g.rollHP.type='highpass';g.rollBus.connect(g.rollHP).connect(g.out);const s=ctx.createGain();s.gain.value=.25;g.rollHP.connect(s).connect(g.verb);}}
 return g;
}
function hit(g,buffer,dest,t,vel,rate=1){const s=g.ctx.createBufferSource(),v=g.ctx.createGain();s.buffer=buffer;s.playbackRate.value=rate;v.gain.value=vel;s.connect(v).connect(dest);s.start(t);}
// Called at every pass through the section's start: whole-section automation (build sweep, risers, roll; drop impact).
function sectionStart(g,project,t){
 const ctx=g.ctx,tl=timeline(project),sec=project[g.section],fx=sec.fx,len=sec.bars*tl.bar;
 if(g.section==='build'){
  const hpEnd=20*2**(fx.hp*6.6);g.hp.frequency.cancelScheduledValues(t);g.hp.frequency.setValueAtTime(20,t);g.hp.frequency.exponentialRampToValueAtTime(Math.max(21,hpEnd),t+len);g.hp.Q.setValueAtTime(.7,t);g.hp.Q.linearRampToValueAtTime(.7+fx.hp*2.5,t+len);
  g.swell.gain.cancelScheduledValues(t);g.swell.gain.setValueAtTime(1,t);g.swell.gain.linearRampToValueAtTime((1+fx.swell*.3)/(1+fx.verb*.9),t+len);g.wash.gain.cancelScheduledValues(t);g.wash.gain.setValueAtTime(0,t);g.wash.gain.linearRampToValueAtTime(fx.verb*.9,t+len);
  if(fx.riser>0){const s=ctx.createBufferSource(),bp=ctx.createBiquadFilter(),v=ctx.createGain();s.buffer=g.noise;s.loop=true;bp.type='bandpass';bp.Q.value=.9;bp.frequency.setValueAtTime(300,t);bp.frequency.exponentialRampToValueAtTime(9000,t+len);v.gain.setValueAtTime(.0001,t);v.gain.exponentialRampToValueAtTime(fx.riser*.5,t+len);v.gain.linearRampToValueAtTime(0,t+len+.03);s.connect(bp).connect(v).connect(g.out);v.connect(g.verb);s.start(t);s.stop(t+len+.05);}
  if(fx.pitch>0){const f0=P.mtof(48+project.key),st=fx.pitch>.6?24:12,lp=ctx.createBiquadFilter(),v=ctx.createGain();lp.type='lowpass';lp.frequency.setValueAtTime(500,t);lp.frequency.exponentialRampToValueAtTime(7000,t+len);v.gain.setValueAtTime(.0001,t);v.gain.exponentialRampToValueAtTime(fx.pitch*.25,t+len);v.gain.linearRampToValueAtTime(0,t+len+.02);lp.connect(v).connect(g.out);v.connect(g.verb);
   for(const [type,det,mul,lv] of [['sawtooth',-11,1,.5],['sawtooth',11,1,.5],['square',0,2,.25]]){const o=ctx.createOscillator(),og=ctx.createGain();o.type=type;o.detune.value=det;og.gain.value=lv;o.frequency.setValueAtTime(f0*mul,t);o.frequency.exponentialRampToValueAtTime(f0*mul*2**(st/12),t+len);o.connect(og).connect(lp);o.start(t);o.stop(t+len+.05);}}
  if(g.rollShot&&fx.rollAmt>0){const kick=fx.roll==='kick';g.rollBus.gain.value=fx.rollAmt*(kick?.5:.45);g.rollHP.frequency.setValueAtTime(kick?30:250,t);g.rollHP.frequency.exponentialRampToValueAtTime(kick?400:1600,t+len);
   for(let u=0;u<len-1e-4;){const p=u/len,div=p<.5?1:p<.75?2:p<.875?4:8,vel=.25+.75*p**1.4;hit(g,g.rollShot,g.rollBus,t+u,vel,kick?1:2**(p*7/12));g.events.push(['roll',t+u,tl.beat/div*.5,kick?36:38,vel]);u+=tl.beat/div;}}
 }else if(fx.impact>0){const o=ctx.createOscillator(),v=ctx.createGain();o.frequency.setValueAtTime(82,t);o.frequency.exponentialRampToValueAtTime(36,t+1.2);v.gain.setValueAtTime(0,t);v.gain.linearRampToValueAtTime(fx.impact*.7,t+.004);v.gain.setTargetAtTime(0,t+.02,.45);o.connect(v).connect(g.out);o.start(t);o.stop(t+3);
  const n=ctx.createBufferSource(),h=ctx.createBiquadFilter(),nv=ctx.createGain();n.buffer=g.noise;h.type='highpass';h.frequency.value=4200;nv.gain.setValueAtTime(fx.impact*.25,t);nv.gain.setTargetAtTime(0,t+.01,.8);n.connect(h).connect(nv).connect(g.out);nv.connect(g.verb);n.start(t,0,3.9);}
}
// One sixteenth: k = step index within the section (0 .. bars*16-1).
function scheduleStep(g,project,k,t){
 const sec=project[g.section],n=steps(sec),i=k%n,grid=sec.grid,tl=timeline(project),progress=k/(sec.bars*16);
 if(k===0)sectionStart(g,project,t);
 for(const [lane] of DRUMS){const v=grid[lane][i];if(!v)continue;if(g.section==='build'&&lane==='kick'&&progress>=sec.fx.kickOut)continue;hit(g,g.shots[lane],g.lane[lane],t,v===2?1:.72);g.events.push([lane,t,tl.step*.9,{kick:36,clap:39,snare:38,hat:42,open:46}[lane],v===2?1:.72]);}
 if(g.section==='drop'&&i%4===0&&sec.fx.pump>0){g.pump.gain.setTargetAtTime(1-sec.fx.pump*.85,t,.003);g.pump.gain.setTargetAtTime(1,t+.03,tl.beat*.17);}
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

/* ---------- Offline render of the whole drop: build-up → pre-drop → drop ---------- */
async function renderSection(project,section,sr){
 const tl=timeline(project),len=project[section].bars*tl.bar,ctx=new OfflineAudioContext(2,Math.round((len+3)*sr),sr),g=await makeGraph(ctx,ctx.destination,project,section);
 for(let k=0;k<project[section].bars*16;k++)scheduleStep(g,project,k,k*tl.step);
 return {buffer:await ctx.startRendering(),events:g.events};
}
async function render(project,{sr=44100}={}){
 const tl=timeline(project),[B,D]=await Promise.all([renderSection(project,'build',sr),renderSection(project,'drop',sr)]),pre=project.pre,beat=tl.beat;
 const total=tl.dropEndOut+3,ctx=new OfflineAudioContext(2,Math.round(total*sr),sr),fade=.006;
 const place=(buf,at,offset=0,dur=buf.duration-offset,gain=1)=>{const s=ctx.createBufferSource(),v=ctx.createGain();s.buffer=buf;v.gain.setValueAtTime(gain,Math.max(0,at));v.gain.setValueAtTime(gain,Math.max(0,at+dur-fade));v.gain.linearRampToValueAtTime(0,at+dur);s.connect(v).connect(ctx.destination);s.start(Math.max(0,at),offset+Math.max(0,-at),dur);return v;};
 // The build stops dead at the pre-drop; the drop starts on the bar.
 place(B.buffer,0,0,tl.gapOut+fade);place(D.buffer,tl.dropOut);
 if(pre.throw>0&&root.Delaysy){const len=Math.min(pre.throwLen*beat,tl.gapOut),W=await P.delaysyThrow(B.buffer,tl.gapOut-len,len,pre.delaysy,project.bpm),v=ctx.createGain(),s=ctx.createBufferSource(),at=tl.gapOut-len-W.lead;s.buffer=W.buffer;v.gain.setValueAtTime(pre.throw*W.gain,0);v.gain.setValueAtTime(pre.throw*W.gain,tl.dropOut);v.gain.setTargetAtTime(pre.throw*W.gain*.3,tl.dropOut,beat*.5);s.connect(v).connect(ctx.destination);if(at>=0)s.start(at);else s.start(0,-at);}
 if(pre.reverse>0){const R=await P.reverseSwell(D.buffer,0,beat,2.4),len=clamp(Math.max(tl.gap,2*beat),.2,R.duration-.05),a=tl.dropOut-len,s=ctx.createBufferSource(),v=ctx.createGain();s.buffer=R;v.gain.setValueAtTime(0,a);v.gain.linearRampToValueAtTime(pre.reverse*.9,tl.dropOut-.01);v.gain.linearRampToValueAtTime(0,tl.dropOut+.004);s.connect(v).connect(ctx.destination);s.start(a,R.duration-len);s.stop(tl.dropOut+.02);}
 const out=await ctx.startRendering(),lim=P.limit(out,0,out.duration);
 const events=[...B.events.filter(e=>e[1]<tl.gapOut),...D.events.map(e=>[e[0],e[1]+tl.dropOut,...e.slice(2)])];
 return {buffer:out,tl,events,peak:lim.peak,reduction:lim.reduction};
}

const api={SCALES,DRUMS,ROWS,NOTE,LEADS,STYLES,steps,blank,resize,degree,midiFor,rowLabel,generate,randomize,timeline,createPlayer,render};
if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.DropGrid=api;
})(typeof globalThis!=='undefined'?globalThis:this);
