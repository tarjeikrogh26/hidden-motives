/* Dropfather drop maker UI: arrangement strip (intro · breakdown · build-up · pre-drop · drop · outro), step grid,
   machines, sounds (Bass Invaders bass, AVANTGARDIAN ARP lead), play and export. */
(()=>{'use strict';
const $=id=>document.getElementById(id),G=DropGrid,X=DropDSP,NOTE=G.NOTE;
const M={view:'drop',sel:0,project:null,section:'drop',player:null,src:null,full:null,raf:0,restart:0,replay:0,cells:null,ui:{arp:0}};
const status=(text,bad)=>{$('mStatus').textContent=text;$('mStatus').style.color=bad?'#ff6a5e':'';};
const ctx=()=>window.Dropfather.audio(),out=()=>window.Dropfather.S.gain;
const seed=()=>(Math.random()*2**31)|0;

/* ---------- Controls ---------- */
const DELAYSY=Object.fromEntries((window.Delaysy?.presets||[]).map((v,i)=>[i,`${i+1}. ${v.name} · ${v.cat}`]));
const BASSES=Object.fromEntries(X.bassCatalog().map((v,i)=>[v.id,`${i+1}. ${v.name}`]));
const LEADS=Object.fromEntries([...(window.DropLead?.list()||[]).map(p=>['dl:'+p.id,'Dropfather · '+p.n]),...G.arpSounds().map((s,i)=>['arp:'+s.id,`ARP ${i+1}. ${s.name} · ${s.group}`]),['minilead','Bass Invaders · Mini Lead'],['lead','Bass Invaders · Saw Lead'],['sqlead','Bass Invaders · Square Lead'],...Object.entries(BASSES).map(([k,v])=>[k,'Bass Invaders '+v])]);
const ARPS=Object.fromEntries(G.arpPatterns().map((p,i)=>[i,`${i+1}. ${p.name} · ${p.mode}`]));
function knob(box,obj,key,label,after){const row=document.createElement('div');row.className='knob';row.innerHTML='<label></label><input type="range" min="0" max="1" step="0.01"><output></output>';row.querySelector('label').textContent=label;const r=row.querySelector('input'),o=row.querySelector('output');const show=()=>{r.value=obj()[key];o.textContent=Math.round(r.value*100)+'%';};show();r.oninput=()=>{obj()[key]=+r.value;o.textContent=Math.round(r.value*100)+'%';};r.onchange=()=>after?.();row.sync=show;box.append(row);return row;}
function pick(box,obj,key,label,opts,after){const long=Object.keys(opts).length>20,row=document.createElement('div');row.className='pick'+(long?' browse':'');row.innerHTML=`<label></label><div class="nav">${long?'<button type="button" aria-label="Back 10">«</button><button type="button" aria-label="Previous">‹</button>':''}<select></select>${long?'<button type="button" aria-label="Next">›</button><button type="button" aria-label="Forward 10">»</button>':''}</div>`;row.querySelector('label').textContent=label;const sel=row.querySelector('select');for(const [v,n] of Object.entries(opts))sel.add(new Option(n,v));const set=v=>{obj()[key]=isNaN(+v)?v:+v;after?.();};sel.onchange=()=>set(sel.value);if(long)row.querySelectorAll('.nav button').forEach((b,i)=>b.onclick=()=>{const n=sel.options.length,s=[-10,-1,1,10][i];sel.selectedIndex=((sel.selectedIndex+s)%n+n)%n;set(sel.value);});row.sync=()=>{sel.value=String(obj()[key]);};row.sync();box.append(row);return row;}
function button(box,label,onclick){const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=onclick;box.append(b);return b;}
let rows=[];
function buildControls(){
 rows=[];const bf=()=>M.project.build.fx,pr=()=>M.project.pre,df=()=>M.project.drop.fx,ch=()=>{changed();renderStrip();};
 const b=$('mBuildCtl'),p=$('mPreCtl'),d=$('mDropCtl'),s=$('mSoundCtl');for(const el of [b,p,d,s])el.replaceChildren();
 rows.push(knob(b,bf,'hp','High-pass sweep',ch),knob(b,bf,'riser','Noise riser',ch),knob(b,bf,'pitch','Pitch riser',ch),pick(b,bf,'roll','Roll',X.ROLLS,ch),knob(b,bf,'rollAmt','Roll level',ch),knob(b,bf,'verb','Reverb wash',ch),knob(b,bf,'swell','Volume swell',ch),knob(b,bf,'kickOut','Kick plays until',ch));
 rows.push(pick(p,pr,'gapBeats','Silence',{0:'None',1:'1 beat',2:'2 beats',4:'1 bar'},ch),knob(p,pr,'throw','Echo throw',ch),pick(p,pr,'delaysy','DELAYSY preset',DELAYSY,ch),pick(p,pr,'throwLen','Throw',{0.5:'Last 1/2 beat',1:'Last beat',2:'Last 2 beats',4:'Last bar'},ch),knob(p,pr,'reverse','Reverse suck',ch));
 rows.push(knob(d,df,'pump','Pump',ch),knob(d,df,'impact','Impact',ch));
 const snd=()=>M.project.sounds,mix=()=>M.project.mix,gate=()=>M.project.gate,sc=()=>{changed();renderGrid();};
 if(window.DropKits)rows.push(pick(s,snd,'drums','Drum kit (Stanley Cupid’s recordings)',Object.fromEntries(DropKits.list().map(k=>[k.id,k.id==='synth'?k.n:'Stanley Cupid · '+k.n])),sc));
 rows.push(pick(s,snd,'bass','Bass sound (Bass Invaders)',BASSES,sc),pick(s,snd,'lead','Lead sound (AVANTGARDIAN ARP or Bass Invaders)',LEADS,sc));
 // The lead line from ARP: a pattern from its library, the next random one, or a fresh blend ("Make arp").
 const arpRow=pick(s,()=>M.ui,'arp','Lead pattern from ARP’s library',ARPS,()=>{const pat=G.arpPatterns()[M.ui.arp];if(!pat)return;useArpLine(G.arpLane(M.project,pat,64),`ARP pattern “${pat.name}”`);});
 const actions=document.createElement('div');actions.className='rowbtns';s.append(actions);
 button(actions,'🎲 New melody',()=>afterLead(G.newMelody(M.project,seed()))).title='A new lead riff on the same chords';
 button(actions,'🎲 New chords',()=>{const prog=G.newChords(M.project,seed());descPart('chords',prog);afterLead('Dropfather riff');status('New chords: '+prog+' · bass and lead rewritten on them');}).title='A new chord progression, with the bass and the lead rewritten on it';
 button(actions,'🎲 Random ARP pattern',()=>{const info=G.newArpLead(M.project,seed(),'arp');if(info)afterLead(info);});
 button(actions,'🎲 ARP blend (Make arp)',()=>{const info=G.newArpLead(M.project,seed(),'blend');if(info)afterLead(info);});
 rows.push(arpRow,knob(s,gate,'bass','Bass note length',ch),knob(s,gate,'lead','Lead note length',ch));
 for(const [k,l] of [...G.DRUMS,['bass','Bass'],['lead','Lead']])rows.push(knob(s,mix,k,l+' level',ch));
}
function useArpLine(line,info){const p=M.project;if(p.drop.patternBars<4)G.resize(p.drop,4);p.drop.grid.lead=line.slice(0,G.steps(p.drop));for(let i=0;i<G.steps(p.build);i++)p.build.grid.lead[i]=p.drop.grid.lead[i%G.steps(p.drop)];afterLead(info);}
// Swap one part of the description line ("chords: …", "lead: …") and keep the rest.
function descPart(label,text){const d=M.project.desc||'',re=new RegExp(' · '+label+': [^·]*?(?= · |$)');M.project.desc=re.test(d)?d.replace(re,' · '+label+': '+text):d+' · '+label+': '+text;}
function afterLead(info){descPart('lead',info);M.section=M.section==='pre'?'drop':M.section;renderAll();changed();status('New lead line: '+info);}

/* ---------- Strip, section bar and grid ---------- */
function renderStrip(){
 const p=M.project,tl=G.timeline(p),el=$('strip');el.replaceChildren();
 const blocks=[];for(const x of tl.parts){if(x.name==='build'){blocks.push(['build',x.start,tl.gapOut,`${p.build.bars} bars`]);blocks.push(['pre',tl.gapOut,tl.dropOut,p.pre.gapBeats?`${p.pre.gapBeats===4?'1 bar':p.pre.gapBeats+' beat'+(p.pre.gapBeats>1?'s':'')}`:'none']);}else blocks.push([x.name,x.start,x.end,`${p[x.name].bars} bars`]);}
 for(const [sec,a,e,info] of blocks){const b=document.createElement('button');b.className=sec+(['intro','breakdown','outro'].includes(sec)?' plain':'')+(M.section===sec?' on':'');b.dataset.sec=sec;b.dataset.a=a;b.dataset.e=e;b.style.flex=sec==='pre'?'0 0 auto':`${(e-a)/tl.total} 1 0`;b.innerHTML='<span></span><small></small><i></i>';b.querySelector('span').textContent=sec==='pre'?'PRE':G.NAMES[sec];b.querySelector('small').textContent=info;b.title=`Play from the ${sec==='pre'?'pre-drop':G.NAMES[sec].toLowerCase()} (and edit it)`;b.onclick=()=>{M.section=sec;renderAll();if(M.player?.playing()&&sec!=='pre')loop();else playFrom(sec);};el.append(b);}
 const has=G.SKETCH.some(k=>p.song?.[k]),t=$('mSketch');t.textContent=has?'− Remove intro, breakdown, outro':'+ Suggest the rest of the song';t.classList.toggle('on',has);$('mExAll').textContent=has?'WAV · whole song sketch':'WAV · build-up + drop';
}
function renderSecbar(){
 const el=$('secbar'),p=M.project,sec=M.section;el.replaceChildren();
 const add=html=>{const d=document.createElement('div');d.className='ctl';d.innerHTML=html;el.append(d);return d;};
 if(sec==='pre'){add('<span>The pre-drop has no grid. Set it in the PRE-DROP machine below.</span>');return;}
 if(!G.timeline(p).parts.some(x=>x.name===sec)){const d=add('<span></span><button type="button">← Back to the song</button>');d.querySelector('span').textContent=`Editing ${G.labelOf(p,sec)}, a part of the song`;d.querySelector('button').onclick=()=>setView('song');}
 const s=p[sec],bars=add('<span>Length</span><select aria-label="Section length"></select><span>bars</span>').querySelector('select');for(const n of G.typeOf(p,sec)==='build'?[2,4,8,16,32]:G.typeOf(p,sec)==='drop'?[8,16,32]:[4,8,16,32])bars.add(new Option(n,n));bars.value=s.bars;bars.onchange=()=>{s.bars=+bars.value;changed();renderStrip();};
 const pat=add('<span>Pattern</span><select aria-label="Pattern length"></select>').querySelector('select');for(const n of [1,2,4])pat.add(new Option(n+(n>1?' bars':' bar'),n));pat.value=s.patternBars;pat.onchange=()=>{G.resize(s,+pat.value);M.full=null;renderGrid();changed();};
 const other=G.typeOf(p,sec)==='drop'?'build':'drop',copy=add(`<button type="button">Copy the ${G.NAMES[other].toLowerCase()} pattern here</button>`).querySelector('button');copy.onclick=()=>{s.grid=JSON.parse(JSON.stringify(p[other].grid));s.patternBars=p[other].patternBars;M.full=null;renderAll();changed();};
 const clr=add('<button type="button">Clear this grid</button>').querySelector('button');clr.onclick=()=>{s.grid=G.blank(G.steps(s));M.full=null;paint();changed();};
 if(s.fx&&'filterFrom' in s.fx){const box=document.createElement('div');box.className='secfx';el.append(box);const f=()=>s.fx;knob(box,f,'filterFrom','Filter at start',changed);knob(box,f,'filterTo','Filter at end',changed);knob(box,f,'verb','Reverb',changed);knob(box,f,'pump','Pump',changed);}
}
function renderGrid(){
 const el=$('grid'),p=M.project,sec=M.section;el.replaceChildren();M.cells=null;$('mHint').textContent='';
 if(sec==='pre'){el.innerHTML='<div class="prenote">The pre-drop is the moment between build-up and drop: a short silence, the build\'s last beat thrown into DELAYSY, and reverse reverb sucking into the drop. Its settings are in the PRE-DROP machine.</div>';return;}
 const s=p[sec],n=G.steps(s),cols=Array.from({length:n},()=>[]);
 const row=(parent,label,lane,d,cls)=>{const r=document.createElement('div');r.className='row'+(cls?' '+cls:'');const l=document.createElement('label');l.textContent=label;r.append(l);for(let i=0;i<n;i++){const c=document.createElement('button');c.type='button';c.className='c'+(i%16===0&&i?' b16':i%4===0&&i?' b4':'');c.dataset.l=lane;c.dataset.i=i;if(d!=null)c.dataset.d=d;r.append(c);cols[i].push(c);}parent.append(r);};
 const grp=(t,cls)=>{const h=document.createElement('div');h.className='grp';h.textContent=t;el.append(h);const box=document.createElement('div');if(cls)box.className=cls;el.append(box);return box;};
 const drums=grp('Drums');for(const [k,l] of G.DRUMS)row(drums,l,k);
 const bassBox=grp(`Bass · ${(BASSES[p.sounds.bass]||p.sounds.bass).replace(/^\d+\. /,'')}`,'notes');for(let d=G.ROWS.bass-1;d>=0;d--)row(bassBox,G.rowLabel(p,'bass',d),'bass',d,d%7===0?'root':'');
 const leadBox=grp(`Lead · ${G.leadName(p.sounds.lead)}`,'notes');for(let d=G.ROWS.lead-1;d>=0;d--)row(leadBox,G.rowLabel(p,'lead',d),'lead',d,d%7===0?'root':'');
 M.cells=cols;paint();
 const tip={build:'The build-up loops this pattern over its length while the high-pass opens.',drop:'Notes are in '+NOTE[p.key]+' '+G.SCALES[p.scale][0].toLowerCase()+'; one note per step per lane.',intro:'The intro\'s low-pass opens from the first to the last bar.',breakdown:'The breakdown sits under reverb, without drums unless you add them.',outro:'The outro\'s low-pass closes towards the end.'}[sec];
 $('mHint').textContent='Click to set a step (drums: once = on, twice = accent). '+tip;
}
function paint(){if(!M.cells)return;const g=M.project[M.section].grid;for(const col of M.cells)for(const c of col){const l=c.dataset.l,i=+c.dataset.i;if(c.dataset.d!=null){c.classList.toggle('on',g[l][i]===+c.dataset.d);}else{c.classList.toggle('on',g[l][i]===1);c.classList.toggle('acc',g[l][i]===2);}}}
function renderAll(){
 const p=M.project;if(M.section!=='pre'&&!p[M.section]?.grid)M.section='drop';
 $('mBpm').value=p.bpm;$('mKey').value=p.key;$('mScale').value=p.scale;$('mDesc').textContent=p.desc||'';
 document.querySelectorAll('#mStyles button[data-style]').forEach(b=>b.classList.toggle('on',b.dataset.style===p.style));
 renderStrip();renderSecbar();renderGrid();for(const r of rows)r.sync();syncMixer();if(M.view==='song')renderSong();
 const another=$('mAnother');if(another)another.textContent=`🎲 Another ${G.STYLES[p.style]?.name||'random'} drop`;
}
// Grid edits are heard at once while looping (the scheduler reads the grid). Other changes rebuild the loop;
// while Play all runs, any change re-renders the whole thing and carries on from the same spot.
function changed(){M.full=null;if(M.player?.playing()){clearTimeout(M.restart);M.restart=setTimeout(loop,250);}if(M.src){clearTimeout(M.replay);M.replay=setTimeout(()=>playAll(true),450);}}

/* ---------- Mixer: four stems (drums, bass, lead, fx) into a master limiter ---------- */
const STEM_NAMES={drums:'Drums',bass:'Bass',lead:'Lead',fx:'FX'};
function mixer(){
 if(M.mixer)return M.mixer;const c=ctx(),master=c.createDynamicsCompressor();
 master.threshold.value=-1.5;master.knee.value=0;master.ratio.value=20;master.attack.value=.002;master.release.value=.12;master.connect(out());
 const bus=G.busOf(M.project),nodes={};for(const k of G.STEMS){const g=c.createGain();g.gain.value=G.faderGain(bus[k]);g.connect(master);nodes[k]=g;}
 return M.mixer=nodes;
}
const dB=v=>{const g=G.faderGain(v);return g<=0?'−∞':(20*Math.log10(g)>=0?'+':'')+(20*Math.log10(g)).toFixed(1);};
function buildMixer(){
 const box=$('mMixer');box.replaceChildren();
 for(const k of G.STEMS){const ch=document.createElement('div');ch.className='ch';ch.innerHTML='<output></output><input type="range" min="0" max="1" step="0.01"><label></label>';
  const r=ch.querySelector('input'),o=ch.querySelector('output');ch.querySelector('label').textContent=STEM_NAMES[k];r.setAttribute('aria-label',STEM_NAMES[k]+' level');
  r.oninput=()=>{const p=M.project;p.bus={...G.busOf(p),[k]:+r.value};o.textContent=dB(+r.value);if(M.mixer)M.mixer[k].gain.setTargetAtTime(G.faderGain(+r.value),ctx().currentTime,.015);};
  r.ondblclick=()=>{r.value=.8;r.oninput();};ch.sync=()=>{r.value=G.busOf(M.project)[k];o.textContent=dB(+r.value);if(M.mixer)M.mixer[k].gain.value=G.faderGain(+r.value);};box.append(ch);}
}
function syncMixer(){for(const ch of $('mMixer').children)ch.sync?.();}
function progress(f,label){const el=$('mProgress');if(f==null){el.classList.add('hidden');return;}el.classList.remove('hidden');el.querySelector('i').style.width=Math.round(f*100)+'%';el.querySelector('span').textContent=`${label} ${Math.round(f*100)}%`;}

/* ---------- Play ---------- */
function player(){if(!M.player)M.player=G.createPlayer(ctx(),mixer());return M.player;}
async function loop(){
 if(M.view==='song'){const k=G.songOrder(M.project)[M.sel];if(k)M.section=k;}
 if(M.section==='pre')M.section='drop';stopBuffer();M.paused=null;playLabel();window.Dropfather.stop();ctx();
 status('Preparing the voices …');await player().play(M.project,M.section);renderStrip();status(`Looping the ${G.labelOf(M.project,M.section).toLowerCase()} · edit the grid while it plays`);tick();
}
function stopBuffer(){if(M.src){try{M.src.stop();}catch(e){}M.src=null;}}
function playLabel(){const b=$('mPlayAll');if(b)b.textContent=M.src?'❚❚ Pause':M.paused!=null?'▶ Resume':'▶ Play all';}
// Start Play all at a part of the arrangement (the pre-drop: one bar before it).
function playFrom(sec){const tl=G.timeline(M.project),part=tl.parts.find(x=>x.name===(sec==='pre'?'build':sec));if(!part)return;M.paused=sec==='pre'?Math.max(0,tl.gapOut-tl.bar):part.start;M.player?.stop();playAll(false).then(()=>status(`Playing from the ${sec==='pre'?'pre-drop':G.NAMES[sec].toLowerCase()}`));}
function pause(){if(!M.src)return;M.paused=ctx().currentTime-M.srcStart;stopBuffer();cancelAnimationFrame(M.raf);markNow(-1);playLabel();status('Paused · press Resume to play on from here');}
function stop(){M.paused=null;M.player?.stop();stopBuffer();playLabel();clearTimeout(M.replay);cancelAnimationFrame(M.raf);markNow(-1);setStripHead(null);}
async function renderAllParts(){const song=M.view==='song';if(M.full&&M.full.song===song)return M.full;const p=M.project;status('Rendering '+G.timeline(p,song).parts.map(x=>G.labelOf(p,x.name).toLowerCase()).join(' → ')+' …');const t=performance.now(),r=await G.render(p,{sr:ctx().sampleRate,song,progress:f=>progress(f,'Rendering')});progress(null);if(M.project!==p||(M.view==='song')!==song)return renderAllParts();M.full=r;const gr=20*Math.log10(r.reduction||1);status(`Rendered in ${((performance.now()-t)/1000).toFixed(1)} s${gr<-.1?` · limiter ${gr.toFixed(1)} dB`:''}`);return r;}
async function playAll(resume){
 const at=resume&&M.src?ctx().currentTime-M.srcStart:M.paused??0;const back=M.paused!=null;M.paused=null;M.player?.stop();window.Dropfather.stop();
 const r=await renderAllParts();stopBuffer();const c=ctx(),s=c.createBufferSource(),split=c.createChannelSplitter(8),mx=mixer();s.buffer=r.stems;s.connect(split);
 G.STEMS.forEach((k,i)=>{const m=c.createChannelMerger(2);split.connect(m,2*i,0);split.connect(m,2*i+1,1);m.connect(mx[k]);});const from=Math.min(at,r.buffer.duration-.1),t0=c.currentTime+.05;s.start(t0,from);M.src=s;M.srcStart=t0-from;
 s.onended=()=>{if(M.src===s){M.src=null;setStripHead(null);markNow(-1);playLabel();}};playLabel();status(resume?'Updated · playing on from the same spot':back?'Playing on from where you paused':'Playing '+r.parts.map(x=>G.labelOf(M.project,x.name).toLowerCase()).join(' → '));tick();
}
function markNow(step){if(!M.cells)return;if(M.now!=null&&M.cells[M.now])for(const c of M.cells[M.now])c.classList.remove('now');M.now=step>=0&&M.cells.length?step%M.cells.length:null;if(M.now!=null)for(const c of M.cells[M.now])c.classList.add('now');}
function setStripHead(t){for(const b of $('strip').querySelectorAll('button')){const i=b.querySelector('i'),a=+b.dataset.a,e=+b.dataset.e;const on=t!=null&&t>=a&&t<e;i.style.display=on?'block':'none';if(on)i.style.left=((t-a)/Math.max(1e-6,e-a)*100)+'%';}}
function tick(){
 cancelAnimationFrame(M.raf);
 if(M.view==='song'){if(!M.src&&!M.player?.playing()){songHead(null);return;}if(M.src)songHead(ctx().currentTime-M.srcStart+(M.full?.t0||0));M.raf=requestAnimationFrame(tick);return;}
 const tl=G.timeline(M.project);
 if(M.player?.playing()){const pos=M.player.position(),part=tl.parts.find(x=>x.name===pos?.section);if(pos&&pos.section===M.section)markNow(pos.step);if(part)setStripHead(part.start+pos.step*tl.step%(part.end-part.start));}
 else if(M.src){const t=ctx().currentTime-M.srcStart+(M.full?.t0||0);setStripHead(t);const part=tl.parts.find(x=>x.name===M.section);markNow(part&&t>=part.start&&t<part.end?Math.floor((t-part.start)/tl.step):-1);}
 else return;
 M.raf=requestAnimationFrame(tick);
}

/* ---------- Song view: the whole arrangement ---------- */
const PART_TYPES=[['intro','+ Intro'],['build','+ Build-up'],['drop','+ Drop'],['breakdown','+ Breakdown'],['outro','+ Outro']];
const fmtTime=t=>`${Math.floor(t/60)}:${String(Math.round(t%60)).padStart(2,'0')}`;
function makeSongNow(){G.makeSong(M.project,seed());M.sel=0;songChanged();const p=M.project;status(`New song around your drop: ${G.songOrder(p).map(k=>G.labelOf(p,k).toLowerCase()).join(' → ')} · the melody is in the breakdowns (${G.leadName(p.breakdown.sounds.lead)})`);}
function setView(v){
 if(v==='song')G.ensureSongParts(M.project);
 stop();M.view=v;document.body.dataset.view=v;M.full=null;
 document.querySelectorAll('#mView button').forEach(b=>b.classList.toggle('on',b.dataset.view===v));
 $('mExAll').textContent=v==='song'?'WAV · whole song':G.SKETCH.some(k=>M.project.song?.[k])?'WAV · whole song sketch':'WAV · build-up + drop';
 renderAll();status(v==='song'?'Song view · click a part to play from it, drag to move it, double-click or ✎ to edit its grid.':'Drop view · build-up, pre-drop and drop.');
}
function songChanged(){M.full=null;renderSong();changed();}
function moveTo(from,to){const a=M.project.arrangement;if(from===to||from<0||to<0||to>=a.length)return;const [k]=a.splice(from,1);a.splice(to,0,k);M.sel=to;songChanged();}
function insertPart(key){const a=M.project.arrangement,at=Math.min(a.length,(M.sel??a.length-1)+1);a.splice(at,0,key);M.sel=at;songChanged();}
function editPart(i){const k=G.songOrder(M.project)[i];if(!k)return;M.section=k;setView('drop');$('makerPanel').scrollIntoView({behavior:'smooth'});}
function playFromTime(t){M.paused=t;M.player?.stop();return playAll(false);}
function songHead(t){const h=$('songHead');if(!h)return;if(t==null){h.style.display='none';return;}const tl=G.timeline(M.project,true);h.style.display='block';h.style.left=Math.min(100,t/tl.total*100)+'%';}
// One part's four lanes as a picture: drum hits, bass and lead notes by pitch, and the fx (riser, pre-drop, impact).
function drawPart(cv,p,x,tl){
 const g=cv.getContext('2d'),W=cv.width,H=cv.height,lane=H/4,sec=p[x.name],n=G.steps(sec),N=sec.bars*16,w=W/N;
 g.clearRect(0,0,W,H);g.fillStyle='rgba(255,255,255,.05)';for(let l=1;l<4;l+=2)g.fillRect(0,l*lane,W,lane);
 for(let b=1;b<sec.bars;b++){g.fillStyle=b%4?'rgba(255,255,255,.05)':'rgba(255,255,255,.14)';g.fillRect(b*16*w,0,1,H);}
 const gapFrom=x.pre?(x.gapOut-x.start)/tl.step:N;
 for(let k=0;k<Math.min(N,gapFrom);k++){const i=k%n,G2=sec.grid;
  if(G2.kick[i]){g.fillStyle='#f3efe4';g.fillRect(k*w,lane*.25,Math.max(1,w*.8),lane*.6);}
  if(G2.clap[i]||G2.snare[i]){g.fillStyle='#ff4a3d';g.fillRect(k*w,lane*.55,Math.max(1,w*.8),lane*.35);}
  if(G2.hat[i]||G2.open[i]){g.fillStyle='#a49f94';g.fillRect(k*w,lane*.1,Math.max(1,w*.6),lane*.15);}
  for(const [li,ln,rows,col] of [[1,'bass',G.ROWS.bass,'#e3201b'],[2,'lead',G.ROWS.lead,'#f3efe4']]){const d=G2[ln][i];if(d==null)continue;let len=1;while(len<16&&k+len<N&&G2[ln][(i+len)%n]==null)len++;g.fillStyle=col;g.fillRect(k*w,li*lane+lane-4-(d/rows)*(lane-8),Math.max(2,len*w*(p.gate?.[ln]??.6)),3);}
 }
 g.fillStyle='rgba(255,74,61,.7)';
 if(x.type==='build'){g.beginPath();g.moveTo(0,H);g.lineTo(Math.min(W,gapFrom*w),3*lane+3);g.lineTo(Math.min(W,gapFrom*w),H);g.fill();}
 if(x.type==='drop'){g.fillRect(0,3*lane+2,Math.max(4,w*6),lane-4);}
 if(x.pre){g.fillStyle='#000';g.fillRect(gapFrom*w,0,W-gapFrom*w,H);g.fillStyle='#ff4a3d';g.font=`${Math.round(lane*.6)}px sans-serif`;g.fillText('pre',gapFrom*w+2,lane*.8);}
}
function renderSong(){
 const p=M.project,el=$('song');if(!el)return;G.ensureSongParts(p);const tl=G.timeline(p,true),order=G.songOrder(p);el.replaceChildren();
 if(M.sel==null||M.sel>=order.length)M.sel=order.length?Math.max(0,order.length-1):null;
 const lanes=document.createElement('div');lanes.className='lanes';lanes.innerHTML='<span></span>'+G.STEMS.map(k=>`<span>${STEM_NAMES[k]}</span>`).join('');el.append(lanes);
 const track=document.createElement('div');track.className='blocks';track.style.minWidth=Math.round(tl.total/tl.bar*9)+'px';el.append(track);
 tl.parts.forEach((x,i)=>{
  const b=document.createElement('div'),sec=p[x.name];b.className='blk '+x.type+(i===M.sel?' on':'');b.style.flex=`${x.end-x.start} 1 0`;b.draggable=true;b.tabIndex=0;b.setAttribute('role','button');
  b.innerHTML=`<div class="bh"><b></b><small></small></div><canvas width="${sec.bars*32}" height="96"></canvas>`;
  b.querySelector('b').textContent=G.labelOf(p,x.name)+(order.indexOf(x.name)!==i?' ↻':'');b.querySelector('small').textContent=`bar ${Math.round(x.start/tl.bar)+1} · ${sec.bars} bars`;
  b.title='Click: play from here · double-click: edit the grid · drag: move';drawPart(b.querySelector('canvas'),p,x,tl);
  b.onclick=()=>{M.sel=i;renderSong();playFromTime(x.start).then(()=>status(`Playing from ${G.labelOf(p,x.name).toLowerCase()} (bar ${Math.round(x.start/tl.bar)+1})`));};
  b.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();b.onclick();}if(e.key==='ArrowLeft'&&e.altKey)moveTo(i,i-1);if(e.key==='ArrowRight'&&e.altKey)moveTo(i,i+1);};
  b.ondblclick=()=>editPart(i);
  b.ondragstart=e=>{e.dataTransfer.setData('text/plain',String(i));e.dataTransfer.effectAllowed='move';b.classList.add('drag');};b.ondragend=()=>b.classList.remove('drag');
  b.ondragover=e=>{e.preventDefault();b.classList.add('over');};b.ondragleave=()=>b.classList.remove('over');
  b.ondrop=e=>{e.preventDefault();b.classList.remove('over');moveTo(+e.dataTransfer.getData('text/plain'),i);};
  track.append(b);
 });
 const head=document.createElement('i');head.className='songhead';head.id='songHead';track.append(head);
 $('songInfo').textContent=`${tl.parts.length} parts · ${Math.round(tl.total/tl.bar)} bars · ${fmtTime(tl.total)} at ${p.bpm} BPM`;
 // The selected part.
 const sel=$('sSel');sel.replaceChildren();const x=tl.parts[M.sel];if(!x)return;const key=x.name,a=p.arrangement;
 const info=document.createElement('span');info.className='selinfo';info.textContent=`${G.labelOf(p,key)} · bar ${Math.round(x.start/tl.bar)+1}`;sel.append(info);
 button(sel,'▶ Play from here',()=>playFromTime(x.start));
 button(sel,'✎ Edit grid',()=>editPart(M.sel)).title='Open this part in the drop view';
 button(sel,'◀ Move',()=>moveTo(M.sel,M.sel-1));button(sel,'Move ▶',()=>moveTo(M.sel,M.sel+1));
 button(sel,'⧉ Repeat',()=>insertPart(key)).title='The same part again right after (edits change both)';
 button(sel,'✦ Variation',()=>{const id=G.variation(p,key,seed());a[M.sel]=id;songChanged();status(`${G.labelOf(p,id)}: its own copy${['drop','build'].includes(x.type)?' with a new lead riff':''}. Edit it without touching the others.`);}).title='Make this one its own copy (drops and build-ups get a new lead riff)';
 if(['breakdown','drop','build'].includes(x.type)||p[key].grid.lead.some(v=>v!=null))button(sel,'🎲 New melody',()=>{const name=G.newPartMelody(p,key,seed());songChanged();status(`New melody in ${name.toLowerCase()}${a.filter(k=>k===key).length>1?' (and its repeats)':''}`);}).title='A new lead line for this part, on the same chords';
 const snd=document.createElement('label');snd.className='sellen';snd.innerHTML='<span>Lead</span><select aria-label="Lead sound of this part"></select>';const ss=snd.querySelector('select');ss.add(new Option('Same as the drop',''));for(const q of (window.DropLead?.list()||[]))ss.add(new Option('Dropfather · '+q.n,'dl:'+q.id));ss.value=p[key].sounds?.lead||'';ss.onchange=()=>{if(ss.value)p[key].sounds={...(p[key].sounds||{}),lead:ss.value};else delete p[key].sounds;songChanged();};sel.append(snd);
 const len=document.createElement('label');len.className='sellen';len.innerHTML='<span>Length</span><select aria-label="Part length"></select>';const ls=len.querySelector('select');for(const n of x.type==='build'?[2,4,8,16,32]:x.type==='drop'?[8,16,32]:[4,8,16,32])ls.add(new Option(n+' bars',n));ls.value=p[key].bars;ls.onchange=()=>{p[key].bars=+ls.value;songChanged();};sel.append(len);
 button(sel,'✕ Remove',()=>{if(a.length<2)return;a.splice(M.sel,1);M.sel=Math.min(M.sel,a.length-1);songChanged();}).classList.add('danger');
}
function initSong(){
 const pal=$('sPalette'),make=button(pal,'🎲 Make a song from the drop',()=>makeSongNow());make.className='primary';make.title='Writes intro, groove, a breakdown with the song melody, a second build-up and drop, and an outro around your drop. Your drop and build-up stay as they are. Click again for another version.';
 for(const [type,label] of PART_TYPES)button(pal,label,()=>insertPart(G.partOfType(M.project,type))).title='Add after the selected part';
 document.querySelectorAll('#mView button').forEach(b=>b.onclick=()=>setView(b.dataset.view));
 $('mFurther').onclick=()=>{setView('song');window.scrollTo({top:$('songPanel').offsetTop-10,behavior:'smooth'});};
}

/* ---------- Export ---------- */
const name=()=>`Dropfather ${G.STYLES[M.project.style]?.name||'drop'} ${NOTE[M.project.key]} ${M.project.bpm}bpm`;
const save=(bytes,file,type)=>DropFiles.download(bytes,file,type,status);
async function exportAll(){const r=await renderAllParts(),whole=r.parts.length>2;if(await save(X.wav(G.mix(r,M.project).buffer,0,r.parts[r.parts.length-1].end-r.t0+1.5),name()+(M.view==='song'?' (song)':whole?' (song sketch)':'')+'.wav','audio/wav'))status(`Exported ${r.parts.map(x=>G.labelOf(M.project,x.name).toLowerCase()).join(' → ')} as 24-bit WAV.`);}
async function exportDrop(){const r=await renderAllParts();if(await save(X.wav(G.mix(r,M.project).buffer,r.tl.dropOut-r.t0,r.tl.dropEndOut-r.t0),name()+' (drop).wav','audio/wav'))status('Exported the drop alone, bar-exact, as 24-bit WAV.');}
async function exportMidi(){const r=await renderAllParts(),by=l=>r.events.filter(e=>l.includes(e[0])).map(e=>e.slice(1));if(await save(X.midiTracks([{name:'Bass',channel:0,notes:by(['bass'])},{name:'Lead',channel:1,notes:by(['lead'])},{name:'Drums',channel:9,notes:by(['kick','clap','snare','hat','open','roll'])}],M.project.bpm),name()+'.mid','audio/midi'))status('Exported MIDI: bass, lead and drums (GM drum notes), from the start of the arrangement.');}
// Stems: drums, bass, lead and fx as 24-bit WAVs from the start of the arrangement, at their faders, in one zip.
async function exportStems(){
 const r=await renderAllParts(),end=r.parts[r.parts.length-1].end-r.t0+1.5,bus=G.busOf(M.project),files=[];
 G.STEMS.forEach((k,i)=>{const n=r.stems.length,b=new AudioBuffer({numberOfChannels:2,length:n,sampleRate:r.stems.sampleRate}),gn=G.faderGain(bus[k]);for(let c=0;c<2;c++){const d=b.getChannelData(c),src=r.stems.getChannelData(2*i+c);for(let j=0;j<n;j++)d[j]=src[j]*gn;}files.push({name:`${i+1} ${STEM_NAMES[k]}.wav`,bytes:X.wav(b,0,end)});});
 if(await save(DropFiles.zipFiles(files),name()+' (stems).zip','application/zip'))status('Exported 4 stems (drums, bass, lead, fx) as 24-bit WAVs in one zip. Drop them in at bar 1 and they line up.');
}
function saveProject(){return save(new TextEncoder().encode(JSON.stringify({app:'Dropfather drop maker',version:2,project:M.project},null,1)),name()+'.json','application/json');}
async function loadProject(file){try{const j=JSON.parse(await file.text()),p=j.project||j;if(!p.build?.grid||!p.drop?.grid)throw Error('not a Dropfather drop maker project');p.song=p.song||{intro:false,breakdown:false,outro:false};p.sounds.drums=window.DropKits?.has(p.sounds.drums)?p.sounds.drums:'synth';if(M.view==='song')G.ensureSongParts(p);M.project=p;M.full=null;stop();buildControls();renderAll();status('Loaded '+file.name);}catch(e){status('Could not load: '+e.message,true);}}

/* ---------- Wiring ---------- */
function setProject(p,note){if(M.view==='song')G.ensureSongParts(p);M.project=p;M.full=null;buildControls();renderAll();changed();status(note||p.desc);}
// Before anything is chosen, the whole engine lies under the start screen in black and white. Make a drop
// brings it to life in red.
function show(){for(const id of ['makerPanel','songPanel','makerMachines','makerSounds','makerDock'])$(id).classList.remove('hidden');}
function preview(){M.project=G.generate('house',seed());buildControls();renderAll();show();}
function open(){
 const first=!document.body.dataset.mode;document.body.dataset.mode='maker';window.Dropfather.stop();show();if(!M.project)setProject(G.generate('house',seed()));else renderAll();
 if(first&&!matchMedia('(prefers-reduced-motion: reduce)').matches){document.body.classList.add('waking');setTimeout(()=>document.body.classList.remove('waking'),1800);}
 status('Engine on · loop a section to hear it while you edit the grid, or play it all.');
}
function init(){
 buildMixer();initSong();
 NOTE.forEach((n,i)=>$('mKey').add(new Option(n,i)));for(const [k,[n]] of Object.entries(G.SCALES))$('mScale').add(new Option(n,k));
 const st=$('mStyles'),keep=()=>({key:M.project.key,scale:M.project.scale});{const l=document.createElement('span');l.className='stylelabel';l.textContent='Pick a style: every click writes a new drop in it. 🎲 Randomize (in the bar at the bottom) picks the style for you too.';st.append(l);}
 for(const [k,v] of Object.entries(G.STYLES)){const b=document.createElement('button');b.textContent=v.name;b.dataset.style=k;b.title='Write a new '+v.name+' drop (different every time)';b.onclick=()=>setProject(G.generate(k,seed(),keep()));st.append(b);}
 const another=button(st,'🎲 New drop',()=>{const keys=Object.keys(G.STYLES),k=G.STYLES[M.project.style]?M.project.style:keys[Math.floor(Math.random()*keys.length)];setProject(G.generate(k,seed(),keep()));});another.title='Another drop in the same style, key and scale';another.id='mAnother';
 $('mSketch').onclick=()=>{const p=M.project;if(G.SKETCH.some(k=>p.song?.[k])){p.song={intro:false,breakdown:false,outro:false};if(G.SKETCH.includes(M.section))M.section='drop';status('Back to build-up → pre-drop → drop.');}else{G.sketch(p);status('Suggested: intro (16 bars, filter opening) → breakdown (8 bars, no drums) → build-up → drop → outro (16 bars, filter closing). Each has its own grid.');}M.full=null;renderAll();changed();};
 const bpm=v=>{M.project.bpm=Math.max(60,Math.min(200,Math.round(v)));$('mBpm').value=M.project.bpm;renderStrip();changed();};
 $('mBpm').onchange=e=>bpm(+e.target.value);$('mBpmDown').onclick=()=>bpm(M.project.bpm-1);$('mBpmUp').onclick=()=>bpm(M.project.bpm+1);
 $('mKey').onchange=e=>{M.project.key=+e.target.value;renderGrid();changed();};$('mScale').onchange=e=>{M.project.scale=e.target.value;renderGrid();changed();};
 $('mClear').onclick=()=>{for(const s of G.ORDER)if(M.project[s])M.project[s].grid=G.blank(G.steps(M.project[s]));M.full=null;paint();changed();};
 $('grid').onclick=e=>{const c=e.target.closest('.c');if(!c)return;const g=M.project[M.section].grid,l=c.dataset.l,i=+c.dataset.i;if(c.dataset.d!=null){const d=+c.dataset.d;g[l][i]=g[l][i]===d?null:d;}else g[l][i]=(g[l][i]+1)%3;M.full=null;paint();if(M.src){clearTimeout(M.replay);M.replay=setTimeout(()=>playAll(true),700);}};
 $('makeDrop').onclick=open;
 $('mPlayAll').onclick=()=>M.src?pause():playAll(false);$('mRandom').onclick=()=>setProject(G.randomize(M.project,seed()));$('mLoop').onclick=loop;$('mStop').onclick=stop;$('mVolume').oninput=e=>{const g=out();if(g)g.gain.value=+e.target.value;};
 $('mExStems').onclick=exportStems;$('mExAll').onclick=exportAll;$('mExDrop').onclick=exportDrop;$('mExMidi').onclick=exportMidi;$('mSave').onclick=saveProject;$('mLoad').onchange=e=>e.target.files[0]&&loadProject(e.target.files[0]);
 document.addEventListener('keydown',e=>{if(document.body.dataset.mode==='maker'&&e.code==='Space'&&!/INPUT|SELECT|TEXTAREA|BUTTON/.test(e.target.tagName)){e.preventDefault();M.player?.playing()||M.src?stop():loop();}});
 window.DropMaker={M,stop,open,loop,playAll,render:renderAllParts};
}
init();preview();
})();
