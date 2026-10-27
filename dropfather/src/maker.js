/* Dropfather drop maker UI: arrangement strip (intro · breakdown · build-up · pre-drop · drop · outro), step grid,
   machines, sounds (Bass Invaders bass, AVANTGARDIAN ARP lead), play and export. */
(()=>{'use strict';
const $=id=>document.getElementById(id),G=DropGrid,X=DropDSP,NOTE=G.NOTE;
const M={project:null,section:'drop',player:null,src:null,full:null,raf:0,restart:0,replay:0,cells:null,ui:{arp:0}};
const status=(text,bad)=>{$('mStatus').textContent=text;$('mStatus').style.color=bad?'#ff6a5e':'';};
const ctx=()=>window.Dropfather.audio(),out=()=>window.Dropfather.S.gain;
const seed=()=>(Math.random()*2**31)|0;

/* ---------- Controls ---------- */
const DELAYSY=Object.fromEntries((window.Delaysy?.presets||[]).map((v,i)=>[i,`${i+1}. ${v.name} · ${v.cat}`]));
const BASSES=Object.fromEntries(X.bassCatalog().map((v,i)=>[v.id,`${i+1}. ${v.name}`]));
const LEADS=Object.fromEntries([...G.arpSounds().map((s,i)=>['arp:'+s.id,`ARP ${i+1}. ${s.name} · ${s.group}`]),['minilead','Bass Invaders · Mini Lead'],['lead','Bass Invaders · Saw Lead'],['sqlead','Bass Invaders · Square Lead'],...Object.entries(BASSES).map(([k,v])=>[k,'Bass Invaders '+v])]);
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
 rows.push(pick(s,snd,'bass','Bass sound (Bass Invaders)',BASSES,sc),pick(s,snd,'lead','Lead sound (AVANTGARDIAN ARP or Bass Invaders)',LEADS,sc));
 // The lead line from ARP: a pattern from its library, the next random one, or a fresh blend ("Make arp").
 const arpRow=pick(s,()=>M.ui,'arp','Lead pattern from ARP’s library',ARPS,()=>{const pat=G.arpPatterns()[M.ui.arp];if(!pat)return;useArpLine(G.arpLane(M.project,pat,64),`ARP pattern “${pat.name}”`);});
 const actions=document.createElement('div');actions.className='rowbtns';s.append(actions);
 button(actions,'🎲 Random ARP pattern',()=>{const info=G.newArpLead(M.project,seed(),'arp');if(info)afterLead(info);});
 button(actions,'🎲 ARP blend (Make arp)',()=>{const info=G.newArpLead(M.project,seed(),'blend');if(info)afterLead(info);});
 rows.push(arpRow,knob(s,gate,'bass','Bass note length',ch),knob(s,gate,'lead','Lead note length',ch));
 for(const [k,l] of [...G.DRUMS,['bass','Bass'],['lead','Lead']])rows.push(knob(s,mix,k,l+' level',ch));
}
function useArpLine(line,info){const p=M.project;if(p.drop.patternBars<4)G.resize(p.drop,4);p.drop.grid.lead=line.slice(0,G.steps(p.drop));for(let i=0;i<G.steps(p.build);i++)p.build.grid.lead[i]=p.drop.grid.lead[i%G.steps(p.drop)];afterLead(info);}
function afterLead(info){M.project.desc=(M.project.desc||'').replace(/ · lead: .*$/,'')+' · lead: '+info;M.section=M.section==='pre'?'drop':M.section;renderAll();changed();status('New lead line: '+info);}

/* ---------- Strip, section bar and grid ---------- */
function renderStrip(){
 const p=M.project,tl=G.timeline(p),el=$('strip');el.replaceChildren();
 const blocks=[];for(const x of tl.parts){if(x.name==='build'){blocks.push(['build',x.start,tl.gapOut,`${p.build.bars} bars`]);blocks.push(['pre',tl.gapOut,tl.dropOut,p.pre.gapBeats?`${p.pre.gapBeats===4?'1 bar':p.pre.gapBeats+' beat'+(p.pre.gapBeats>1?'s':'')}`:'none']);}else blocks.push([x.name,x.start,x.end,`${p[x.name].bars} bars`]);}
 for(const [sec,a,e,info] of blocks){const b=document.createElement('button');b.className=sec+(['intro','breakdown','outro'].includes(sec)?' plain':'')+(M.section===sec?' on':'');b.dataset.sec=sec;b.dataset.a=a;b.dataset.e=e;b.style.flex=sec==='pre'?'0 0 auto':`${(e-a)/tl.total} 1 0`;b.innerHTML='<span></span><small></small><i></i>';b.querySelector('span').textContent=sec==='pre'?'PRE':G.NAMES[sec];b.querySelector('small').textContent=info;b.onclick=()=>{M.section=sec;renderAll();if(M.player?.playing()&&sec!=='pre')loop();};el.append(b);}
 const has=G.SKETCH.some(k=>p.song?.[k]),t=$('mSketch');t.textContent=has?'− Remove intro, breakdown, outro':'+ Suggest the rest of the song';t.classList.toggle('on',has);$('mExAll').textContent=has?'WAV · whole song sketch':'WAV · build-up + drop';
}
function renderSecbar(){
 const el=$('secbar'),p=M.project,sec=M.section;el.replaceChildren();
 const add=html=>{const d=document.createElement('div');d.className='ctl';d.innerHTML=html;el.append(d);return d;};
 if(sec==='pre'){add('<span>The pre-drop has no grid. Set it in the PRE-DROP machine below.</span>');return;}
 const s=p[sec],bars=add('<span>Length</span><select aria-label="Section length"></select><span>bars</span>').querySelector('select');for(const n of sec==='build'?[2,4,8,16,32]:sec==='drop'?[8,16,32]:[4,8,16,32])bars.add(new Option(n,n));bars.value=s.bars;bars.onchange=()=>{s.bars=+bars.value;changed();renderStrip();};
 const pat=add('<span>Pattern</span><select aria-label="Pattern length"></select>').querySelector('select');for(const n of [1,2,4])pat.add(new Option(n+(n>1?' bars':' bar'),n));pat.value=s.patternBars;pat.onchange=()=>{G.resize(s,+pat.value);M.full=null;renderGrid();changed();};
 const other=sec==='drop'?'build':'drop',copy=add(`<button type="button">Copy the ${G.NAMES[other].toLowerCase()} pattern here</button>`).querySelector('button');copy.onclick=()=>{s.grid=JSON.parse(JSON.stringify(p[other].grid));s.patternBars=p[other].patternBars;M.full=null;renderAll();changed();};
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
 const p=M.project;if(M.section!=='pre'&&!G.enabled(p,M.section))M.section='drop';
 $('mBpm').value=p.bpm;$('mKey').value=p.key;$('mScale').value=p.scale;$('mDesc').textContent=p.desc||'';
 document.querySelectorAll('#mStyles button[data-style]').forEach(b=>b.classList.toggle('on',b.dataset.style===p.style));
 renderStrip();renderSecbar();renderGrid();for(const r of rows)r.sync();
}
// Grid edits are heard at once while looping (the scheduler reads the grid). Other changes rebuild the loop;
// while Play all runs, any change re-renders the whole thing and carries on from the same spot.
function changed(){M.full=null;if(M.player?.playing()){clearTimeout(M.restart);M.restart=setTimeout(loop,250);}if(M.src){clearTimeout(M.replay);M.replay=setTimeout(()=>playAll(true),450);}}

/* ---------- Play ---------- */
function player(){if(!M.player)M.player=G.createPlayer(ctx(),out());return M.player;}
async function loop(){
 if(M.section==='pre')M.section='drop';stopBuffer();window.Dropfather.stop();ctx();
 status('Preparing the voices …');await player().play(M.project,M.section);renderStrip();status(`Looping the ${G.NAMES[M.section].toLowerCase()} · edit the grid while it plays`);tick();
}
function stopBuffer(){if(M.src){try{M.src.stop();}catch(e){}M.src=null;}}
function stop(){M.player?.stop();stopBuffer();clearTimeout(M.replay);cancelAnimationFrame(M.raf);markNow(-1);setStripHead(null);}
async function renderAllParts(){if(M.full)return M.full;const p=M.project;status('Rendering '+G.timeline(p).parts.map(x=>G.NAMES[x.name].toLowerCase()).join(' → ')+' …');const t=performance.now(),r=await G.render(p,{sr:ctx().sampleRate});if(M.project!==p)return renderAllParts();M.full=r;const gr=20*Math.log10(r.reduction||1);status(`Rendered in ${((performance.now()-t)/1000).toFixed(1)} s${gr<-.1?` · limiter ${gr.toFixed(1)} dB`:''}`);return r;}
async function playAll(resume){
 const at=resume&&M.src?ctx().currentTime-M.srcStart:0;M.player?.stop();window.Dropfather.stop();
 const r=await renderAllParts();stopBuffer();const c=ctx(),s=c.createBufferSource();s.buffer=r.buffer;s.connect(out());const from=Math.min(at,r.buffer.duration-.1),t0=c.currentTime+.05;s.start(t0,from);M.src=s;M.srcStart=t0-from;
 s.onended=()=>{if(M.src===s){M.src=null;setStripHead(null);markNow(-1);}};status(resume?'Updated · playing on from the same spot':'Playing '+r.parts.map(x=>G.NAMES[x.name].toLowerCase()).join(' → '));tick();
}
function markNow(step){if(!M.cells)return;if(M.now!=null&&M.cells[M.now])for(const c of M.cells[M.now])c.classList.remove('now');M.now=step>=0&&M.cells.length?step%M.cells.length:null;if(M.now!=null)for(const c of M.cells[M.now])c.classList.add('now');}
function setStripHead(t){for(const b of $('strip').querySelectorAll('button')){const i=b.querySelector('i'),a=+b.dataset.a,e=+b.dataset.e;const on=t!=null&&t>=a&&t<e;i.style.display=on?'block':'none';if(on)i.style.left=((t-a)/Math.max(1e-6,e-a)*100)+'%';}}
function tick(){
 cancelAnimationFrame(M.raf);const tl=G.timeline(M.project);
 if(M.player?.playing()){const pos=M.player.position(),part=tl.parts.find(x=>x.name===pos?.section);if(pos&&pos.section===M.section)markNow(pos.step);if(part)setStripHead(part.start+pos.step*tl.step%(part.end-part.start));}
 else if(M.src){const t=ctx().currentTime-M.srcStart+(M.full?.t0||0);setStripHead(t);const part=tl.parts.find(x=>x.name===M.section);markNow(part&&t>=part.start&&t<part.end?Math.floor((t-part.start)/tl.step):-1);}
 else return;
 M.raf=requestAnimationFrame(tick);
}

/* ---------- Export ---------- */
const name=()=>`Dropfather ${G.STYLES[M.project.style]?.name||'drop'} ${NOTE[M.project.key]} ${M.project.bpm}bpm`;
const save=(bytes,file,type)=>DropFiles.download(bytes,file,type,status);
async function exportAll(){const r=await renderAllParts(),whole=r.parts.length>2;if(await save(X.wav(r.buffer,0,r.parts[r.parts.length-1].end-r.t0+1.5),name()+(whole?' (song sketch)':'')+'.wav','audio/wav'))status(`Exported ${r.parts.map(x=>G.NAMES[x.name].toLowerCase()).join(' → ')} as 24-bit WAV.`);}
async function exportDrop(){const r=await renderAllParts();if(await save(X.wav(r.buffer,r.tl.dropOut-r.t0,r.tl.dropEndOut-r.t0),name()+' (drop).wav','audio/wav'))status('Exported the drop alone, bar-exact, as 24-bit WAV.');}
async function exportMidi(){const r=await renderAllParts(),by=l=>r.events.filter(e=>l.includes(e[0])).map(e=>e.slice(1));if(await save(X.midiTracks([{name:'Bass',channel:0,notes:by(['bass'])},{name:'Lead',channel:1,notes:by(['lead'])},{name:'Drums',channel:9,notes:by(['kick','clap','snare','hat','open','roll'])}],M.project.bpm),name()+'.mid','audio/midi'))status('Exported MIDI: bass, lead and drums (GM drum notes), from the start of the arrangement.');}
function saveProject(){return save(new TextEncoder().encode(JSON.stringify({app:'Dropfather drop maker',version:2,project:M.project},null,1)),name()+'.json','application/json');}
async function loadProject(file){try{const j=JSON.parse(await file.text()),p=j.project||j;if(!p.build?.grid||!p.drop?.grid)throw Error('not a Dropfather drop maker project');p.song=p.song||{intro:false,breakdown:false,outro:false};M.project=p;M.full=null;stop();buildControls();renderAll();status('Loaded '+file.name);}catch(e){status('Could not load: '+e.message,true);}}

/* ---------- Wiring ---------- */
function setProject(p,note){M.project=p;M.full=null;buildControls();renderAll();changed();status(note||p.desc);}
function open(){document.body.dataset.mode='maker';window.Dropfather.stop();for(const id of ['makerPanel','makerMachines','makerSounds','makerDock'])$(id).classList.remove('hidden');if(!M.project)setProject(G.generate('house',seed()));else renderAll();}
function init(){
 NOTE.forEach((n,i)=>$('mKey').add(new Option(n,i)));for(const [k,[n]] of Object.entries(G.SCALES))$('mScale').add(new Option(n,k));
 const st=$('mStyles'),keep=()=>({key:M.project.key,scale:M.project.scale});
 for(const [k,v] of Object.entries(G.STYLES)){const b=document.createElement('button');b.textContent=v.name;b.dataset.style=k;b.title='Write a new '+v.name+' drop (different every time)';b.onclick=()=>setProject(G.generate(k,seed(),keep()));st.append(b);}
 button(st,'🎲 New drop',()=>{const k=G.STYLES[M.project.style]?M.project.style:Object.keys(G.STYLES)[Math.floor(Math.random()*5)];setProject(G.generate(k,seed(),keep()));}).title='Another drop in the same style, key and scale';
 const rnd=button(st,'Randomize',()=>setProject(G.randomize(M.project,seed())));rnd.dataset.style='random';rnd.title='Random style, key, scale, sounds and DELAYSY preset';
 $('mSketch').onclick=()=>{const p=M.project;if(G.SKETCH.some(k=>p.song?.[k])){p.song={intro:false,breakdown:false,outro:false};if(G.SKETCH.includes(M.section))M.section='drop';status('Back to build-up → pre-drop → drop.');}else{G.sketch(p);status('Suggested: intro (16 bars, filter opening) → breakdown (8 bars, no drums) → build-up → drop → outro (16 bars, filter closing). Each has its own grid.');}M.full=null;renderAll();changed();};
 const bpm=v=>{M.project.bpm=Math.max(60,Math.min(200,Math.round(v)));$('mBpm').value=M.project.bpm;renderStrip();changed();};
 $('mBpm').onchange=e=>bpm(+e.target.value);$('mBpmDown').onclick=()=>bpm(M.project.bpm-1);$('mBpmUp').onclick=()=>bpm(M.project.bpm+1);
 $('mKey').onchange=e=>{M.project.key=+e.target.value;renderGrid();changed();};$('mScale').onchange=e=>{M.project.scale=e.target.value;renderGrid();changed();};
 $('mClear').onclick=()=>{for(const s of G.ORDER)if(M.project[s])M.project[s].grid=G.blank(G.steps(M.project[s]));M.full=null;paint();changed();};
 $('grid').onclick=e=>{const c=e.target.closest('.c');if(!c)return;const g=M.project[M.section].grid,l=c.dataset.l,i=+c.dataset.i;if(c.dataset.d!=null){const d=+c.dataset.d;g[l][i]=g[l][i]===d?null:d;}else g[l][i]=(g[l][i]+1)%3;M.full=null;paint();if(M.src){clearTimeout(M.replay);M.replay=setTimeout(()=>playAll(true),700);}};
 $('makeDrop').onclick=open;
 $('mPlayAll').onclick=()=>playAll(false);$('mLoop').onclick=loop;$('mStop').onclick=stop;$('mVolume').oninput=e=>{const g=out();if(g)g.gain.value=+e.target.value;};
 $('mExAll').onclick=exportAll;$('mExDrop').onclick=exportDrop;$('mExMidi').onclick=exportMidi;$('mSave').onclick=saveProject;$('mLoad').onchange=e=>e.target.files[0]&&loadProject(e.target.files[0]);
 document.addEventListener('keydown',e=>{if(document.body.dataset.mode==='maker'&&e.code==='Space'&&!/INPUT|SELECT|TEXTAREA|BUTTON/.test(e.target.tagName)){e.preventDefault();M.player?.playing()||M.src?stop():loop();}});
 window.DropMaker={M,stop,open,loop,playAll,render:renderAllParts};
}
init();
})();
