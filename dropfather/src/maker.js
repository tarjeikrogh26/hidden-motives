/* Dropfather drop maker UI: arrangement strip (intro · breakdown · build-up · pre-drop · drop · outro), step grid,
   machines, sounds (Bass Invaders bass, AVANTGARDIAN ARP lead), play and export. */
(()=>{'use strict';
const $=id=>document.getElementById(id),G=DropGrid,X=DropDSP,NOTE=G.NOTE;
const M={view:'drop',sel:0,clip:null,zoom:1,follow:true,samples:{},project:null,section:'drop',player:null,src:null,full:null,raf:0,restart:0,replay:0,cells:null,ui:{arp:0}};
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
 const has=G.SKETCH.some(k=>p.song?.[k]),t=$('mSketch');t.textContent=has?'− Remove intro, breakdown, outro':'+ Suggest the rest of the song';t.classList.toggle('on',has);$('mExAll').textContent=M.view==='song'?'WAV · whole song':has?'WAV · whole song sketch':'WAV · build-up + drop';
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
 if(M.gselFor!==M.section){M.gsel=null;M.gselFor=M.section;}
 const el=$('grid'),p=M.project,sec=M.section;el.replaceChildren();M.cells=null;$('mHint').textContent='';
 if(sec==='pre'){el.innerHTML='<div class="prenote">The pre-drop is the moment between build-up and drop: a short silence, the build\'s last beat thrown into DELAYSY, and reverse reverb sucking into the drop. Its settings are in the PRE-DROP machine.</div>';return;}
 const s=p[sec],n=G.steps(s),cols=Array.from({length:n},()=>[]);
 let rowNo=0;const row=(parent,label,lane,d,cls)=>{const r=document.createElement('div'),rn=rowNo++;r.className='row'+(cls?' '+cls:'');const l=document.createElement('label');l.textContent=label;r.append(l);for(let i=0;i<n;i++){const c=document.createElement('button');c.type='button';c.className='c'+(i%16===0&&i?' b16':i%4===0&&i?' b4':'');c.dataset.l=lane;c.dataset.i=i;c.dataset.r=rn;if(d!=null)c.dataset.d=d;r.append(c);cols[i].push(c);}parent.append(r);};
 const grp=(t,cls)=>{const h=document.createElement('div');h.className='grp';h.textContent=t;el.append(h);const box=document.createElement('div');if(cls)box.className=cls;el.append(box);return box;};
 const drums=grp('Drums');for(const [k,l] of G.DRUMS)row(drums,l,k);
 const bassBox=grp(`Bass · ${(BASSES[p.sounds.bass]||p.sounds.bass).replace(/^\d+\. /,'')}`,'notes');for(let d=G.ROWS.bass-1;d>=0;d--)row(bassBox,G.rowLabel(p,'bass',d),'bass',d,d%7===0?'root':'');
 const leadBox=grp(`Lead · ${G.leadName(p.sounds.lead)}`,'notes');for(let d=G.ROWS.lead-1;d>=0;d--)row(leadBox,G.rowLabel(p,'lead',d),'lead',d,d%7===0?'root':'');
 M.cells=cols;paint();paintSel();
 const tip={build:'The build-up loops this pattern over its length while the high-pass opens.',drop:'Notes are in '+NOTE[p.key]+' '+G.SCALES[p.scale][0].toLowerCase()+'; one note per step per lane.',intro:'The intro\'s low-pass opens from the first to the last bar.',breakdown:'The breakdown sits under reverb, without drums unless you add them.',outro:'The outro\'s low-pass closes towards the end.'}[sec];
 $('mHint').textContent='Click to set a step (drums: once = on, twice = accent). '+tip;
}
/* ---------- Selecting notes in the grid: drag over cells, then arrows move (Shift: a beat), ↑↓ pitch
   (Shift: an octave), Ctrl/Cmd+D duplicates to the right, Delete clears, Esc lets go. ---------- */
function inSel(c){const q=M.gsel;return q&&+c.dataset.r>=q.r[0]&&+c.dataset.r<=q.r[1]&&+c.dataset.i>=q.i[0]&&+c.dataset.i<=q.i[1];}
function paintSel(){if(!M.cells)return;for(const col of M.cells)for(const c of col)c.classList.toggle('sel',!!inSel(c));$('gselbar').classList.toggle('hidden',!M.gsel);}
function selectRect(r0,i0,r1,i1){M.gsel={r:[Math.min(r0,r1),Math.max(r0,r1)],i:[Math.min(i0,i1),Math.max(i0,i1)]};paintSel();}
function clearSel(){M.gsel=null;paintSel();}
function selItems(){const g=M.project[M.section].grid,out=[];for(const col of M.cells||[])for(const c of col){if(!inSel(c))continue;const l=c.dataset.l,i=+c.dataset.i;if(c.dataset.d!=null){if(g[l][i]===+c.dataset.d)out.push({l,i,d:+c.dataset.d});}else if(g[l][i])out.push({l,i,v:g[l][i]});}return out;}
function gridOp(kind,amount=0){
 const sec=M.project[M.section],g=sec.grid,n=G.steps(sec),items=selItems(),q=M.gsel;if(!q)return;
 const clear=x=>{g[x.l][x.i]=x.d!=null?null:0;},put=(x,i,d)=>{i=((i%n)+n)%n;if(x.d!=null)g[x.l][i]=Math.max(0,Math.min(G.ROWS[x.l]-1,d));else g[x.l][i]=x.v;};
 if(kind==='move'){items.forEach(clear);items.forEach(x=>put(x,x.i+amount,x.d));q.i=q.i.map(v=>Math.max(0,Math.min(n-1,v+amount)));}
 if(kind==='pitch'){items.forEach(x=>{if(x.d!=null)clear(x);});items.forEach(x=>{if(x.d!=null)put(x,x.i,x.d+amount);});q.r=q.r.map(v=>v-amount);}
 if(kind==='dup'){const w=q.i[1]-q.i[0]+1;items.forEach(x=>put(x,x.i+w,x.d));q.i=q.i.map(v=>Math.min(n-1,v+w));}
 if(kind==='delete'){items.forEach(clear);}
 M.full=null;paint();paintSel();if(M.src){clearTimeout(M.replay);M.replay=setTimeout(()=>playAll(true),700);}
 status(items.length?`${items.length} note${items.length>1?'s':''} ${{move:'moved',pitch:'transposed',dup:'duplicated',delete:'cleared'}[kind]}`:'Nothing selected on those cells');
}
function gridKeys(e){
 if(!M.gsel||M.view!=='drop')return false;const mod=e.ctrlKey||e.metaKey,k=e.key;
 if(k==='Escape')clearSel();else if(k==='ArrowLeft'||k==='ArrowRight')gridOp('move',(k==='ArrowLeft'?-1:1)*(e.shiftKey?4:1));else if(k==='ArrowUp'||k==='ArrowDown')gridOp('pitch',(k==='ArrowUp'?1:-1)*(e.shiftKey?7:1));
 else if(k==='Delete'||k==='Backspace')gridOp('delete');else if(mod&&k.toLowerCase()==='d')gridOp('dup');else return false;
 e.preventDefault();return true;
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
const STEM_NAMES={drums:'Drums',bass:'Bass',lead:'Lead',fx:'FX',audio:'Audio'};
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
async function renderAllParts(){const song=M.view==='song';if(M.full&&M.full.song===song)return M.full;const p=M.project;status('Rendering '+G.timeline(p,song).parts.map(x=>G.labelOf(p,x.name).toLowerCase()).join(' → ')+' …');const t=performance.now(),r=await G.render(p,{sr:ctx().sampleRate,song,samples:Object.fromEntries(Object.entries(M.samples).map(([k,v])=>[k,v.buffer])),progress:f=>progress(f,'Rendering')});progress(null);if(M.project!==p||(M.view==='song')!==song)return renderAllParts();M.full=r;const gr=20*Math.log10(r.reduction||1);status(`Rendered in ${((performance.now()-t)/1000).toFixed(1)} s${gr<-.1?` · limiter ${gr.toFixed(1)} dB`:''}`);return r;}
async function playAll(resume){
 const at=resume&&M.src?ctx().currentTime-M.srcStart:M.paused??0;const back=M.paused!=null;M.paused=null;M.player?.stop();window.Dropfather.stop();
 const r=await renderAllParts();stopBuffer();const c=ctx(),s=c.createBufferSource(),split=c.createChannelSplitter(G.STEMS.length*2),mx=mixer();s.buffer=r.stems;s.connect(split);
 G.STEMS.forEach((k,i)=>{const m=c.createChannelMerger(2);split.connect(m,2*i,0);split.connect(m,2*i+1,1);m.connect(mx[k]);});const from=Math.min(at,r.buffer.duration-.1),t0=c.currentTime+.05;s.start(t0,from);M.src=s;M.srcStart=t0-from;
 s.onended=()=>{if(M.src===s){M.src=null;setStripHead(null);markNow(-1);playLabel();}};playLabel();status(resume?'Updated · playing on from the same spot':back?'Playing on from where you paused':'Playing '+r.parts.map(x=>G.labelOf(M.project,x.name).toLowerCase()).join(' → '));tick();
}
function markNow(step){if(!M.cells)return;if(M.now!=null&&M.cells[M.now])for(const c of M.cells[M.now])c.classList.remove('now');M.now=step>=0&&M.cells.length?step%M.cells.length:null;if(M.now!=null)for(const c of M.cells[M.now])c.classList.add('now');}
function setStripHead(t){for(const b of $('strip').querySelectorAll('button')){const i=b.querySelector('i'),a=+b.dataset.a,e=+b.dataset.e;const on=t!=null&&t>=a&&t<e;i.style.display=on?'block':'none';if(on)i.style.left=((t-a)/Math.max(1e-6,e-a)*100)+'%';}}
function tick(){
 cancelAnimationFrame(M.raf);
 if(M.view==='song'){if(!M.src&&!M.player?.playing()){songHead(M.paused??null);return;}if(M.src)songHead(ctx().currentTime-M.srcStart+(M.full?.t0||0));M.raf=requestAnimationFrame(tick);return;}
 const tl=G.timeline(M.project);
 if(M.player?.playing()){const pos=M.player.position(),part=tl.parts.find(x=>x.name===pos?.section);if(pos&&pos.section===M.section)markNow(pos.step);if(part)setStripHead(part.start+pos.step*tl.step%(part.end-part.start));}
 else if(M.src){const t=ctx().currentTime-M.srcStart+(M.full?.t0||0);setStripHead(t);const part=tl.parts.find(x=>x.name===M.section);markNow(part&&t>=part.start&&t<part.end?Math.floor((t-part.start)/tl.step):-1);}
 else return;
 M.raf=requestAnimationFrame(tick);
}

/* ---------- Song view: a small DAW over the whole track ---------- */
// Parts (drop-maker sections) on top, then the four instrument lanes inside each part, then audio tracks with
// clips that follow the tempo (warp). A ruler to jump around, a playhead that the view follows.
const PART_TYPES=[['intro','+ Intro'],['build','+ Build-up'],['drop','+ Drop'],['breakdown','+ Breakdown'],['outro','+ Outro']];
const fmtTime=t=>`${Math.floor(t/60)}:${String(Math.round(t%60)).padStart(2,'0')}`;
const PX_PER_BAR=16;
function makeSongNow(){G.makeSong(M.project,seed());M.sel=0;M.clip=null;songChanged();const p=M.project;status(`New song around your drop: ${G.songOrder(p).map(k=>G.labelOf(p,k).toLowerCase()).join(' → ')} · the melody is in the breakdowns (${G.leadName(p.breakdown.sounds.lead)})`);}
function setView(v){
 if(v==='song')G.ensureSongParts(M.project);
 stop();M.view=v;document.body.dataset.view=v;M.full=null;
 document.querySelectorAll('#mView button').forEach(b=>b.classList.toggle('on',b.dataset.view===v));
 renderAll();status(v==='song'?'Song view · click a part or the ruler to play from there, drag parts and clips, drop audio files on the timeline.':'Drop view · build-up, pre-drop and drop.');
}
function songChanged(){M.full=null;renderSong();changed();}
function moveTo(from,to){const a=M.project.arrangement;if(from===to||from<0||to<0||to>=a.length)return;const [k]=a.splice(from,1);a.splice(to,0,k);M.sel=to;songChanged();}
function insertPart(key){const a=M.project.arrangement,at=Math.min(a.length,(M.sel??a.length-1)+1);a.splice(at,0,key);M.sel=at;M.clip=null;songChanged();}
function editPart(i){const k=G.songOrder(M.project)[i];if(!k)return;M.section=k;setView('drop');$('makerPanel').scrollIntoView({behavior:'smooth'});}
function playFromTime(t){M.paused=t;M.player?.stop();return playAll(false);}
const songSpan=(p,tl)=>Math.max(tl.total,G.clipEnd(p)*tl.bar)+tl.bar*4;
// Jump: while playing it plays on from there; stopped, it moves the start point.
function seek(t){
 const song=M.view==='song',tl=G.timeline(M.project,song),end=song?Math.max(tl.total,G.clipEnd(M.project)*tl.bar):tl.total;t=Math.max(0,Math.min(end-.05,t));
 if(M.src)return playFromTime(t).then(()=>status(`Playing from bar ${Math.floor(t/tl.bar+1e-6)+1}`));
 M.paused=t;playLabel();songHead(t);status(`Start point: bar ${Math.floor(t/tl.bar+1e-6)+1} · ▶ plays from here`);
}
function songHead(t){
 const h=$('songHead');if(!h)return;if(t==null){h.style.display='none';return;}
 const p=M.project,tl=G.timeline(p,true),span=songSpan(p,tl);h.style.display='block';h.style.left=(t/span*100)+'%';
 const wrap=$('songWrap'),col=h.parentElement;if(!M.follow||!wrap||!col||!M.src)return;
 const x=col.offsetLeft+t/span*col.offsetWidth,left=wrap.scrollLeft+70,right=wrap.scrollLeft+wrap.clientWidth*.85;
 if(x>right||x<left)wrap.scrollLeft=Math.max(0,x-70-wrap.clientWidth*.15);
}
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
  for(const [li,ln,rows,col] of [[1,'bass',G.ROWS.bass,'#e3201b'],[2,'lead',G.ROWS.lead,'#f3efe4']]){const d=G2[ln][i];if(d==null)continue;let len=1;while(len<16&&k+len<N&&G2[ln][(i+len)%n]==null)len++;g.fillStyle=col;g.fillRect(k*w,li*lane+lane-4-(d/rows)*(lane-8),Math.max(2,len*w*(sec.gate?.[ln]??p.gate?.[ln]??.6)),3);}
 }
 g.fillStyle='rgba(255,74,61,.7)';
 if(x.type==='build'){g.beginPath();g.moveTo(0,H);g.lineTo(Math.min(W,gapFrom*w),3*lane+3);g.lineTo(Math.min(W,gapFrom*w),H);g.fill();}
 if(x.type==='drop'){g.fillRect(0,3*lane+2,Math.max(4,w*6),lane-4);}
 if(x.pre){g.fillStyle='#000';g.fillRect(gapFrom*w,0,W-gapFrom*w,H);g.fillStyle='#ff4a3d';g.font=`${Math.round(lane*.6)}px sans-serif`;g.fillText('pre',gapFrom*w+2,lane*.8);}
}
// A clip's waveform as it plays in the song (bars of the clip's own tempo).
function drawWave(cv,buf,c){
 const g=cv.getContext('2d'),W=cv.width,H=cv.height,d=buf.getChannelData(0),sr=buf.sampleRate,secPerBar=240/(c.warp==='off'||!c.bpm?M.project.bpm:c.bpm),total=d.length/sr-(c.offset||0);
 g.clearRect(0,0,W,H);g.fillStyle='rgba(243,239,228,.75)';
 for(let x=0;x<W;x++){let t=x/W*c.len*secPerBar;if(c.loop&&total>0)t%=total;if(t>total)break;const a=Math.floor((t+(c.offset||0))*sr),b=Math.min(d.length,a+Math.max(1,Math.floor(c.len*secPerBar*sr/W)));let lo=0,hi=0;for(let i=a;i<b;i+=8){const v=d[i];if(v<lo)lo=v;if(v>hi)hi=v;}g.fillRect(x,H/2-hi*H/2,1,Math.max(1,(hi-lo)*H/2));}
}
function clipEl(c,tl,span){
 const d=document.createElement('div'),bar=tl.bar;d.className='clip'+(M.clip===c.id?' on':'');d.style.left=(c.start*bar/span*100)+'%';d.style.width=`calc(${c.len*bar/span*100}% - 1px)`;d.tabIndex=0;
 d.innerHTML='<canvas height="34"></canvas><span></span>';d.querySelector('span').textContent=c.name+(c.semis?` (${c.semis>0?'+':''}${c.semis})`:'')+(c.loop?' ↻':'');
 const smp=M.samples[c.sample],cv=d.querySelector('canvas');cv.width=Math.max(24,Math.round(c.len*24));if(smp)drawWave(cv,smp.buffer,c);else{d.classList.add('missing');d.title='Sample missing: load the collected project (.zip) to bring it back';}
 // Drag to move: whole bars (Shift: beats); up or down onto another audio track.
 d.onpointerdown=e=>{
  if(e.button)return;e.preventDefault();M.clip=c.id;M.sel=null;const x0=e.clientX,orig=c.start,origTrack=c.track,barPx=d.parentElement.getBoundingClientRect().width/(span/bar);let moved=false;d.setPointerCapture(e.pointerId);d.classList.add('on');
  d.onpointermove=ev=>{const q=ev.shiftKey?.25:1,ns=Math.max(0,Math.round((orig+(ev.clientX-x0)/barPx)/q)*q);if(Math.abs(ev.clientX-x0)>3)moved=true;c.start=ns;d.style.left=(ns*bar/span*100)+'%';const row=document.elementsFromPoint(ev.clientX,ev.clientY).find(el=>el.classList?.contains('arow'));if(row&&!row.classList.contains('add'))c.track=+row.dataset.track;};
  d.onpointerup=()=>{d.onpointermove=d.onpointerup=null;if(moved||c.track!==origTrack)songChanged();else renderSong();};
 };
 d.ondblclick=()=>seek(c.start*bar);
 return d;
}
function renderSong(){
 const p=M.project,el=$('song');if(!el)return;G.ensureSongParts(p);p.audio=p.audio||{tracks:[],clips:[]};if(!p.audio.tracks.length)p.audio.tracks.push({name:'Audio 1'});
 const tl=G.timeline(p,true),order=G.songOrder(p),span=songSpan(p,tl),spanBars=span/tl.bar,pct=t=>(t/span*100)+'%';el.replaceChildren();
 if(M.sel!=null&&M.sel>=order.length)M.sel=order.length-1;
 const lanes=document.createElement('div');lanes.className='lanes';
 lanes.innerHTML='<span class="rl">bar</span><span class="pl"></span>'+G.STEMS.slice(0,4).map(k=>`<span>${STEM_NAMES[k]}</span>`).join('')+'<span class="sp"></span>'+p.audio.tracks.map(t=>`<span class="al"></span>`).join('')+'<span class="al add">+ Audio</span>';
 lanes.querySelectorAll('.al:not(.add)').forEach((s2,i)=>s2.textContent=p.audio.tracks[i].name);el.append(lanes);
 const col=document.createElement('div');col.className='tlcol';col.style.width=Math.round(spanBars*PX_PER_BAR*M.zoom)+'px';el.append(col);
 const ruler=document.createElement('div');ruler.className='ruler';ruler.title='Click to play (or start) from here';const every=M.zoom<.75?8:4;
 for(let b=0;b<spanBars;b+=every){const m=document.createElement('span');m.style.left=pct(b*tl.bar);m.textContent=b+1;ruler.append(m);}
 ruler.onclick=e=>{const r=ruler.getBoundingClientRect(),t=(e.clientX-r.left)/r.width*span;seek(e.shiftKey?Math.round(t/tl.beat)*tl.beat:Math.round(t/tl.bar)*tl.bar);};col.append(ruler);
 const row=document.createElement('div');row.className='partsrow';col.append(row);
 tl.parts.forEach((x,i)=>{
  const b=document.createElement('div'),sec=p[x.name];b.className='blk '+x.type+(i===M.sel?' on':'');b.style.left=pct(x.start);b.style.width=`calc(${(x.end-x.start)/span*100}% - 2px)`;b.draggable=true;b.tabIndex=0;b.setAttribute('role','button');
  b.innerHTML=`<div class="bh"><b></b><small></small></div><canvas width="${sec.bars*32}" height="96"></canvas>`;
  b.querySelector('b').textContent=G.labelOf(p,x.name)+(order.indexOf(x.name)!==i?' ↻':'');b.querySelector('small').textContent=`bar ${Math.round(x.start/tl.bar)+1} · ${sec.bars} bars`;
  b.title='Click: play from here · double-click: edit the grid · drag onto another part: move';drawPart(b.querySelector('canvas'),p,x,tl);
  b.onclick=()=>{M.sel=i;M.clip=null;renderSong();if(M.src)seek(x.start);else{M.paused=x.start;playAll(false).then(()=>status(`Playing from ${G.labelOf(p,x.name).toLowerCase()} (bar ${Math.round(x.start/tl.bar)+1})`));}};
  b.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();b.onclick();}if(e.key==='ArrowLeft'&&e.altKey)moveTo(i,i-1);if(e.key==='ArrowRight'&&e.altKey)moveTo(i,i+1);};
  b.ondblclick=()=>editPart(i);
  b.ondragstart=e=>{e.dataTransfer.setData('text/x-part',String(i));e.dataTransfer.effectAllowed='move';b.classList.add('drag');};b.ondragend=()=>b.classList.remove('drag');
  b.ondragover=e=>{if(e.dataTransfer.types.includes('text/x-part')){e.preventDefault();b.classList.add('over');}};b.ondragleave=()=>b.classList.remove('over');
  b.ondrop=e=>{if(!e.dataTransfer.types.includes('text/x-part'))return;e.preventDefault();e.stopPropagation();b.classList.remove('over');moveTo(+e.dataTransfer.getData('text/x-part'),i);};
  row.append(b);
 });
 p.audio.tracks.forEach((t,ti)=>{const r=document.createElement('div');r.className='arow';r.dataset.track=ti;for(const c of p.audio.clips.filter(c=>c.track===ti))r.append(clipEl(c,tl,span));col.append(r);});
 const add=document.createElement('div');add.className='arow add';add.dataset.track=p.audio.tracks.length;add.textContent='Drop audio files here or anywhere on the timeline: WAV, AIFF, MP3, M4A, FLAC … They land on the bar you drop them on and follow the tempo.';col.append(add);
 const head=document.createElement('i');head.className='songhead';head.id='songHead';col.append(head);
 if(M.paused!=null&&!M.src)songHead(M.paused);
 $('songInfo').textContent=`${tl.parts.length} parts · ${Math.round(tl.total/tl.bar)} bars · ${fmtTime(tl.total)} at ${p.bpm} BPM${p.audio.clips.length?` · ${p.audio.clips.length} audio clip${p.audio.clips.length>1?'s':''}`:''}`;
 renderSongSel(tl);
}
function renderSongSel(tl){
 const p=M.project,sel=$('sSel');sel.replaceChildren();
 const c=p.audio.clips.find(x=>x.id===M.clip);if(c)return renderClipSel(c,tl,sel);
 const x=tl.parts[M.sel];if(!x)return;const key=x.name,a=p.arrangement;
 const info=document.createElement('span');info.className='selinfo';info.textContent=`${G.labelOf(p,key)} · bar ${Math.round(x.start/tl.bar)+1}`;sel.append(info);
 button(sel,'▶ Play from here',()=>playFromTime(x.start));
 button(sel,'✎ Edit grid',()=>editPart(M.sel)).title='Open this part in the drop view';
 button(sel,'◀ Move',()=>moveTo(M.sel,M.sel-1));button(sel,'Move ▶',()=>moveTo(M.sel,M.sel+1));
 button(sel,'⧉ Repeat',()=>insertPart(key)).title='The same part again right after (edits change both)';
 button(sel,'␣ Insert space',()=>{const id=G.insertSpace(p,M.sel,p[key].bars);M.sel=M.sel+1;songChanged();status(`Inserted ${p[id].bars} empty bars after ${G.labelOf(p,key).toLowerCase()}: room for a new part or audio. Audio after it moved along.`);}).title='Push everything after this part along by its length and leave the room empty (Ableton: Insert Time)';
 button(sel,'✦ Variation',()=>{const id=G.variation(p,key,seed());a[M.sel]=id;songChanged();status(`${G.labelOf(p,id)}: its own copy${['drop','build'].includes(x.type)?' with a new lead riff':''}. Edit it without touching the others.`);}).title='Make this one its own copy (drops and build-ups get a new lead riff)';
 if(['breakdown','drop','build'].includes(x.type)||p[key].grid.lead.some(v=>v!=null))button(sel,'🎲 New melody',()=>{const name=G.newPartMelody(p,key,seed());songChanged();status(`New melody in ${name.toLowerCase()}${a.filter(k=>k===key).length>1?' (and its repeats)':''}`);}).title='A new lead line for this part, on the same chords';
 const snd=document.createElement('label');snd.className='sellen';snd.innerHTML='<span>Lead</span><select aria-label="Lead sound of this part"></select>';const ss=snd.querySelector('select');ss.add(new Option('Same as the drop',''));for(const q of (window.DropLead?.list()||[]))ss.add(new Option('Dropfather · '+q.n,'dl:'+q.id));ss.value=p[key].sounds?.lead||'';ss.onchange=()=>{if(ss.value)p[key].sounds={...(p[key].sounds||{}),lead:ss.value};else delete p[key].sounds;songChanged();};sel.append(snd);
 const len=document.createElement('label');len.className='sellen';len.innerHTML='<span>Length</span><select aria-label="Part length"></select>';const ls=len.querySelector('select');for(const n of x.type==='space'?[1,2,4,8,16,32]:x.type==='build'?[2,4,8,16,32]:x.type==='drop'?[8,16,32]:[4,8,16,32])ls.add(new Option(n+(n>1?' bars':' bar'),n));ls.value=p[key].bars;ls.onchange=()=>{p[key].bars=+ls.value;songChanged();};sel.append(len);
 button(sel,'✕ Remove',()=>{if(a.length<2)return;a.splice(M.sel,1);M.sel=Math.min(M.sel,a.length-1);songChanged();}).classList.add('danger');
}
function renderClipSel(c,tl,sel){
 const p=M.project,info=document.createElement('span');info.className='selinfo';info.textContent=`${c.name} · bar ${+(c.start+1).toFixed(2)}`;sel.append(info);
 const upd=()=>{songChanged();};
 button(sel,'▶ Play from here',()=>playFromTime(c.start*tl.bar));
 const wl=document.createElement('label');wl.className='sellen';wl.innerHTML='<span>Warp</span><select aria-label="Warp mode"></select>';const ws=wl.querySelector('select');for(const [k,v] of Object.entries(DropWarp.MODES))ws.add(new Option(v,k));ws.value=c.warp;ws.onchange=()=>{c.warp=ws.value;upd();};sel.append(wl);
 const bl=document.createElement('label');bl.className='sellen';bl.innerHTML='<span>Clip BPM</span><input type="number" min="40" max="250" step="0.01" aria-label="Clip tempo">';const bi=bl.querySelector('input');bi.value=c.bpm;bi.onchange=()=>{c.bpm=Math.max(40,Math.min(250,+bi.value||p.bpm));upd();};sel.append(bl);
 const tp=document.createElement('span');tp.className='sellen';tp.innerHTML='<span>Pitch</span>';sel.append(tp);
 button(tp,'−',()=>{c.semis=(c.semis||0)-1;upd();}).title='Down a semitone (Shift: an octave via the arrow keys)';const tv=document.createElement('b');tv.textContent=`${c.semis>0?'+':''}${c.semis||0} st`;tp.append(tv);button(tp,'+',()=>{c.semis=(c.semis||0)+1;upd();});
 const gl=document.createElement('label');gl.className='sellen';gl.innerHTML='<span>Gain</span><input type="range" min="0" max="1.5" step="0.01" aria-label="Clip gain">';const gi=gl.querySelector('input');gi.value=c.gain??.8;gi.onchange=()=>{c.gain=+gi.value;upd();};sel.append(gl);
 const ll=document.createElement('label');ll.className='sellen';ll.innerHTML='<span>Length</span><select aria-label="Clip length"></select>';const lsel=ll.querySelector('select');for(const n of [...new Set([1,2,4,8,16,32,64,c.len])].sort((a,b)=>a-b))lsel.add(new Option(n+(n===1?' bar':' bars'),n));lsel.value=c.len;lsel.onchange=()=>{c.len=+lsel.value;upd();};sel.append(ll);
 const lp=document.createElement('label');lp.className='sellen';lp.innerHTML='<input type="checkbox"> <span>Loop</span>';const lc=lp.querySelector('input');lc.checked=!!c.loop;lc.onchange=()=>{c.loop=lc.checked;upd();};sel.append(lp);
 button(sel,'⧉ Duplicate',()=>duplicateClip(c)).title='A copy right after it (Ctrl/Cmd+D)';
 button(sel,'✕ Delete',()=>deleteClip(c)).classList.add('danger');
}
function duplicateClip(c){const n={...c,id:'c'+Math.random().toString(36).slice(2,9),start:c.start+c.len};M.project.audio.clips.push(n);M.clip=n.id;songChanged();}
function deleteClip(c){const a=M.project.audio.clips;a.splice(a.indexOf(c),1);M.clip=null;songChanged();}
// Audio files dropped on the timeline: decoded, tempo guessed, placed on the bar under the pointer.
async function importAudio(files,bar,track){
 const p=M.project,a=p.audio;let placed=0;
 for(const f of files){
  if(!/^(audio|video)\//.test(f.type)&&!/\.(wav|wave|aiff?|aifc|mp3|m4a|aac|flac|ogg|oga|opus|webm|caf|mp4)$/i.test(f.name))continue;
  status(`Importing ${f.name} …`);
  try{
   const buffer=await DropDecode.decode(ctx(),f),bytes=new Uint8Array(await f.arrayBuffer()),id='s'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
   M.samples[id]={name:f.name,buffer,bytes,type:f.type};const g=await DropWarp.guess(buffer,p.bpm);
   if(track>=a.tracks.length){a.tracks.push({name:'Audio '+(a.tracks.length+1)});track=a.tracks.length-1;}
   const len=g.loop?Math.max(1,g.bars):Math.max(1,Math.min(256,g.bars));
   const clip={id:'c'+id,track,sample:id,name:f.name.replace(/\.[^.]+$/,''),start:bar,len,warp:'beats',bpm:g.bpm,offset:g.offset,semis:0,gain:.8,loop:g.loop&&g.bars<1};
   a.clips.push(clip);M.clip=clip.id;M.sel=null;bar+=len;placed++;
   status(`${f.name}: ${g.bpm} BPM (${g.loop?'loop':'analysed'}), ${len} bar${len>1?'s':''}, warped to ${p.bpm} BPM in Beats mode.`);
  }catch(e){status(`${f.name}: ${e.message}`,true);}
 }
 if(placed)songChanged();
}
function initSong(){
 const pal=$('sPalette'),make=button(pal,'🎲 Make a song from the drop',()=>makeSongNow());make.className='primary';make.title='Writes intro, groove, a breakdown with the song melody, a second build-up and drop, and an outro around your drop. Your drop and build-up stay as they are. Click again for another version.';
 for(const [type,label] of PART_TYPES)button(pal,label,()=>insertPart(G.partOfType(M.project,type))).title='Add after the selected part';
 const zoom=document.createElement('span');zoom.className='zoom';pal.append(zoom);
 button(zoom,'−',()=>{M.zoom=Math.max(.4,M.zoom/1.5);renderSong();}).title='Zoom out';button(zoom,'+',()=>{M.zoom=Math.min(5,M.zoom*1.5);renderSong();}).title='Zoom in';
 const fl=document.createElement('label');fl.className='sellen';fl.innerHTML='<input type="checkbox" checked> <span>Follow</span>';fl.querySelector('input').onchange=e=>M.follow=e.target.checked;fl.title='Scroll along with the playhead';pal.append(fl);
 document.querySelectorAll('#mView button').forEach(b=>b.onclick=()=>setView(b.dataset.view));
 $('mFurther').onclick=()=>{setView('song');window.scrollTo({top:$('songPanel').offsetTop-10,behavior:'smooth'});};
 // Files dropped anywhere on the timeline.
 const wrap=$('songWrap'),files=e=>e.dataTransfer?.types?.includes('Files');
 wrap.addEventListener('dragover',e=>{if(!files(e))return;e.preventDefault();wrap.classList.add('filedrop');});
 wrap.addEventListener('dragleave',e=>{if(e.target===wrap)wrap.classList.remove('filedrop');});
 wrap.addEventListener('drop',e=>{if(!files(e))return;e.preventDefault();e.stopPropagation();wrap.classList.remove('filedrop');
  const col=wrap.querySelector('.tlcol');if(!col)return;const p=M.project,tl=G.timeline(p,true),span=songSpan(p,tl),r=col.getBoundingClientRect(),bar=Math.max(0,Math.floor((e.clientX-r.left)/r.width*span/tl.bar));
  const row=document.elementsFromPoint(e.clientX,e.clientY).find(el=>el.classList?.contains('arow'));let track=row?+row.dataset.track:p.audio.tracks.length;if(track>=p.audio.tracks.length){const empty=p.audio.tracks.findIndex((t,i)=>!p.audio.clips.some(c=>c.track===i));if(empty>=0)track=empty;}
  importAudio([...e.dataTransfer.files],bar,track);});
}

/* ---------- Export ---------- */
const name=()=>`Dropfather ${G.STYLES[M.project.style]?.name||'drop'} ${NOTE[M.project.key]} ${M.project.bpm}bpm`;
const save=(bytes,file,type)=>DropFiles.download(bytes,file,type,status);
const endOf=r=>Math.max(r.parts[r.parts.length-1].end,r.song?G.clipEnd(M.project)*r.tl.bar:0)-r.t0+1.5;
async function exportAll(){const r=await renderAllParts(),whole=r.parts.length>2;if(await save(X.wav(G.mix(r,M.project).buffer,0,endOf(r)),name()+(M.view==='song'?' (song)':whole?' (song sketch)':'')+'.wav','audio/wav'))status(`Exported ${r.parts.map(x=>G.labelOf(M.project,x.name).toLowerCase()).join(' → ')} as 24-bit WAV.`);}
async function exportDrop(){const r=await renderAllParts();if(await save(X.wav(G.mix(r,M.project).buffer,r.tl.dropOut-r.t0,r.tl.dropEndOut-r.t0),name()+' (drop).wav','audio/wav'))status('Exported the drop alone, bar-exact, as 24-bit WAV.');}
async function exportMidi(){const r=await renderAllParts(),by=l=>r.events.filter(e=>l.includes(e[0])).map(e=>e.slice(1));if(await save(X.midiTracks([{name:'Bass',channel:0,notes:by(['bass'])},{name:'Lead',channel:1,notes:by(['lead'])},{name:'Drums',channel:9,notes:by(['kick','clap','snare','hat','open','roll'])}],M.project.bpm),name()+'.mid','audio/midi'))status('Exported MIDI: bass, lead and drums (GM drum notes), from the start of the arrangement.');}
// Stems: drums, bass, lead, fx and audio as 24-bit WAVs from the start of the arrangement, at their faders.
function stemFiles(r){
 const end=endOf(r),bus=G.busOf(M.project),files=[];
 G.STEMS.forEach((k,i)=>{const n=r.stems.length,b=new AudioBuffer({numberOfChannels:2,length:n,sampleRate:r.stems.sampleRate}),gn=G.faderGain(bus[k]);for(let c=0;c<2;c++){const d=b.getChannelData(c),src=r.stems.getChannelData(2*i+c);for(let j=0;j<n;j++)d[j]=src[j]*gn;}if(k!=='audio'||M.project.audio?.clips?.length)files.push({name:`${i+1} ${STEM_NAMES[k]}.wav`,bytes:X.wav(b,0,end)});});
 return files;
}
async function exportStems(){
 const r=await renderAllParts(),files=stemFiles(r);
 if(await save(DropFiles.zipFiles(files),name()+' (stems).zip','application/zip'))status(`Exported ${files.length} stems (${files.map(f=>f.name.replace(/^\d+ |\.wav$/g,'')).join(', ')}) as 24-bit WAVs in one zip. Drop them in at bar 1 and they line up.`);
}
// Save: the project as JSON; with audio clips it is collected into a zip with the samples (Ableton: Collect All and Save).
function usedSamples(){const ids=new Set((M.project.audio?.clips||[]).map(c=>c.sample));return [...ids].filter(id=>M.samples[id]);}
function projectJson(){return new TextEncoder().encode(JSON.stringify({app:'Dropfather',version:3,project:M.project,samples:Object.fromEntries(usedSamples().map(id=>[id,{name:M.samples[id].name,file:`samples/${id}-${M.samples[id].name}`}]))},null,1));}
async function saveProject(){
 const ids=usedSamples();if(!ids.length)return save(projectJson(),name()+'.json','application/json');
 const files=[{name:'project.dropfather.json',bytes:projectJson()},...ids.map(id=>({name:`samples/${id}-${M.samples[id].name}`,bytes:M.samples[id].bytes}))];
 if(await save(DropFiles.zipFiles(files),name()+' (collected).zip','application/zip'))status(`Saved the project with its ${ids.length} sample${ids.length>1?'s':''} collected in one zip. Load the zip to get everything back.`);
}
async function loadProject(file){try{
 let j,entries=null;
 if(/\.zip$/i.test(file.name)||file.type.includes('zip')){entries=await DropFiles.unzip(file);const pj=Object.keys(entries).find(n=>/\.json$/i.test(n));if(!pj)throw Error('no project in this zip');j=JSON.parse(new TextDecoder().decode(entries[pj]));}
 else j=JSON.parse(await file.text());
 const p=j.project||j;if(!p.build?.grid||!p.drop?.grid)throw Error('not a Dropfather project');p.song=p.song||{intro:false,breakdown:false,outro:false};p.sounds.drums=window.DropKits?.has(p.sounds.drums)?p.sounds.drums:'synth';
 let missing=0;for(const [id,info] of Object.entries(j.samples||{})){const bytes=entries?.[info.file];if(!bytes){missing++;continue;}try{M.samples[id]={name:info.name,bytes,buffer:await DropDecode.decode(ctx(),new File([bytes],info.name))};}catch(e){missing++;}}
 if(M.view==='song'||p.arrangement)G.ensureSongParts(p);M.project=p;M.full=null;stop();buildControls();renderAll();
 status('Loaded '+file.name+(missing?` · ${missing} sample${missing>1?'s are':' is'} missing (load the collected .zip to bring them)`:''));
}catch(e){status('Could not load: '+e.message,true);}}
// Ableton pack: the stems from bar 1, the MIDI parts, the project and a short how-to, in one folder.
async function exportAbleton(){
 const r=await renderAllParts(),p=M.project,by=l=>r.events.filter(e=>l.includes(e[0])).map(e=>e.slice(1)),dir=name()+'/';
 const midi=X.midiTracks([{name:'Bass',channel:0,notes:by(['bass'])},{name:'Lead',channel:1,notes:by(['lead'])},{name:'Drums',channel:9,notes:by(['kick','clap','snare','hat','open','roll'])}],p.bpm);
 const how=`Dropfather → Ableton Live\n\n1. Set Live's tempo to ${p.bpm} BPM.\n2. Select all the WAV files in "Audio" and drag them into the Arrangement View at bar 1.1.\n   Hold Cmd (Mac) / Ctrl (Windows) while dropping to put each on its own track.\n   Warp is not needed: they are already at ${p.bpm} BPM. Turn Warp off on the clips.\n3. Drag "MIDI/${name()}.mid" to bar 1.1 as well: Live makes one MIDI track per part (Bass, Lead, Drums),\n   so you can play them with your own instruments.\n4. Key: ${NOTE[p.key]} ${G.SCALES[p.scale][0].toLowerCase()} · chords: ${G.progName(p)}.\n\nThe project file (project.dropfather.json) opens again in Dropfather.\n`;
 const files=[...stemFiles(r).map(f=>({name:dir+'Audio/'+f.name,bytes:f.bytes})),{name:dir+'MIDI/'+name()+'.mid',bytes:midi},{name:dir+'project.dropfather.json',bytes:projectJson()},{name:dir+'HOW TO OPEN IN ABLETON.txt',bytes:new TextEncoder().encode(how)}];
 if(await save(DropFiles.zipFiles(files),name()+' (Ableton).zip','application/zip'))status(`Ableton pack: ${files.length-3} stems, MIDI (bass, lead, drums), the project and a how-to. Unzip, set Live to ${p.bpm} BPM and drag it in at bar 1.`);
}

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
 const gridEl=$('grid');
 gridEl.addEventListener('pointerdown',e=>{const c=e.target.closest('.c');if(!c||e.button||e.pointerType==='touch')return;M.drag={r0:+c.dataset.r,i0:+c.dataset.i,moved:false};});
 gridEl.addEventListener('pointerover',e=>{if(!M.drag||!(e.buttons&1))return;const c=e.target.closest('.c');if(!c)return;const r=+c.dataset.r,i=+c.dataset.i;if(r===M.drag.r0&&i===M.drag.i0&&!M.drag.moved)return;M.drag.moved=true;selectRect(M.drag.r0,M.drag.i0,r,i);});
 document.addEventListener('pointerup',()=>{if(M.drag?.moved)M.skipClick=true;M.drag=null;});
 for(const [label,fn,title] of [['◀',()=>gridOp('move',-1),'Move left (←, Shift: a beat)'],['▶',()=>gridOp('move',1),'Move right (→)'],['▲',()=>gridOp('pitch',1),'Up a scale step (↑, Shift: an octave)'],['▼',()=>gridOp('pitch',-1),'Down a scale step (↓)'],['⧉',()=>gridOp('dup'),'Duplicate to the right (Ctrl/Cmd+D)'],['✕',()=>gridOp('delete'),'Clear (Delete)'],['Done',clearSel,'Let go of the selection (Esc)']])button($('gselbar'),label,fn).title=title;
 $('grid').onclick=e=>{if(M.skipClick){M.skipClick=false;return;}const c=e.target.closest('.c');if(!c)return;if(M.gsel){clearSel();}const g=M.project[M.section].grid,l=c.dataset.l,i=+c.dataset.i;if(c.dataset.d!=null){const d=+c.dataset.d;g[l][i]=g[l][i]===d?null:d;}else g[l][i]=(g[l][i]+1)%3;M.full=null;paint();if(M.src){clearTimeout(M.replay);M.replay=setTimeout(()=>playAll(true),700);}};
 $('makeDrop').onclick=open;
 $('mPlayAll').onclick=()=>M.src?pause():playAll(false);$('mRandom').onclick=()=>setProject(G.randomize(M.project,seed()));$('mLoop').onclick=loop;$('mStop').onclick=stop;
 const now=()=>M.src?ctx().currentTime-M.srcStart+(M.full?.t0||0):(M.paused??0),barLen=()=>G.timeline(M.project,M.view==='song').bar;
 $('mHome').onclick=()=>seek(0);$('mBack').onclick=()=>seek(Math.round(now()/barLen()-4)*barLen());$('mFwd').onclick=()=>seek(Math.round(now()/barLen()+4)*barLen());$('mVolume').oninput=e=>{const g=out();if(g)g.gain.value=+e.target.value;};
 $('mExStems').onclick=exportStems;$('mExAbleton').onclick=exportAbleton;$('mExAll').onclick=exportAll;$('mExDrop').onclick=exportDrop;$('mExMidi').onclick=exportMidi;$('mSave').onclick=saveProject;$('mLoad').onchange=e=>e.target.files[0]&&loadProject(e.target.files[0]);
 document.addEventListener('keydown',e=>{
  if(document.body.dataset.mode!=='maker'||/INPUT|SELECT|TEXTAREA/.test(e.target.tagName))return;
  if(M.view==='song'){
   const c=M.project.audio?.clips.find(x=>x.id===M.clip),mod=e.ctrlKey||e.metaKey;
   if(e.code==='Space'&&e.target.tagName!=='BUTTON'){e.preventDefault();M.src?pause():playAll(false);return;}
   if(e.key==='Home'){e.preventDefault();seek(0);return;}
   if(!c)return;
   if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();deleteClip(c);}
   else if(mod&&e.key.toLowerCase()==='d'){e.preventDefault();duplicateClip(c);}
   else if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();c.start=Math.max(0,c.start+(e.key==='ArrowLeft'?-1:1)*(e.shiftKey?.25:1));songChanged();}
   else if(e.key==='ArrowUp'||e.key==='ArrowDown'){e.preventDefault();c.semis=(c.semis||0)+(e.key==='ArrowUp'?1:-1)*(e.shiftKey?12:1);songChanged();}
   return;
  }
  if(gridKeys(e))return;
  if(e.code==='Space'&&e.target.tagName!=='BUTTON'){e.preventDefault();M.player?.playing()||M.src?stop():loop();}
 });
 window.DropMaker={M,stop,open,loop,playAll,render:renderAllParts};
}
init();preview();
})();
