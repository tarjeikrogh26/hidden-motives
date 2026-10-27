/* Dropfather drop maker UI: arrangement strip (build-up · pre-drop · drop), step grid, machines, sounds, play and export. */
(()=>{'use strict';
const $=id=>document.getElementById(id),G=DropGrid,X=DropDSP,NOTE=G.NOTE;
const M={project:G.generate('house',1),section:'drop',player:null,src:null,full:null,raf:0,restart:0,cells:null};
const status=(text,bad)=>{$('mStatus').textContent=text;$('mStatus').style.color=bad?'#ff6a5e':'';};
const ctx=()=>window.Dropfather.audio(),out=()=>window.Dropfather.S.gain;

/* ---------- Controls ---------- */
const DELAYSY=Object.fromEntries((window.Delaysy?.presets||[]).map((v,i)=>[i,`${i+1}. ${v.name} · ${v.cat}`]));
const BASSES=Object.fromEntries(X.bassCatalog().map((v,i)=>[v.id,`${i+1}. ${v.name}`]));
const LEADS=Object.fromEntries([['minilead','Lead · Mini Lead'],['lead','Lead · Saw Lead'],['sqlead','Lead · Square Lead'],...Object.entries(BASSES)]);
function knob(box,obj,key,label,after){const row=document.createElement('div');row.className='knob';row.innerHTML='<label></label><input type="range" min="0" max="1" step="0.01"><output></output>';row.querySelector('label').textContent=label;const r=row.querySelector('input'),o=row.querySelector('output');r.value=obj()[key];o.textContent=Math.round(r.value*100)+'%';r.oninput=()=>{obj()[key]=+r.value;o.textContent=Math.round(r.value*100)+'%';};r.onchange=()=>after?.();row.sync=()=>{r.value=obj()[key];o.textContent=Math.round(r.value*100)+'%';};box.append(row);return row;}
function pick(box,obj,key,label,opts,after){const long=Object.keys(opts).length>20,row=document.createElement('div');row.className='pick'+(long?' browse':'');row.innerHTML=`<label></label><div class="nav">${long?'<button type="button" aria-label="Back 10">«</button><button type="button" aria-label="Previous">‹</button>':''}<select></select>${long?'<button type="button" aria-label="Next">›</button><button type="button" aria-label="Forward 10">»</button>':''}</div>`;row.querySelector('label').textContent=label;const sel=row.querySelector('select');for(const [v,n] of Object.entries(opts))sel.add(new Option(n,v));const set=v=>{obj()[key]=isNaN(+v)?v:+v;after?.();};sel.onchange=()=>set(sel.value);if(long)row.querySelectorAll('.nav button').forEach((b,i)=>b.onclick=()=>{const n=sel.options.length,s=[-10,-1,1,10][i];sel.selectedIndex=((sel.selectedIndex+s)%n+n)%n;set(sel.value);});row.sync=()=>{sel.value=String(obj()[key]);};row.sync();box.append(row);return row;}
let rows=[];
function buildControls(){
 rows=[];const P=()=>M.project,bf=()=>M.project.build.fx,pr=()=>M.project.pre,df=()=>M.project.drop.fx,ch=()=>{changed();renderStrip();};
 const b=$('mBuildCtl'),p=$('mPreCtl'),d=$('mDropCtl'),s=$('mSoundCtl');for(const el of [b,p,d,s])el.replaceChildren();
 rows.push(knob(b,bf,'hp','High-pass sweep',ch),knob(b,bf,'riser','Noise riser',ch),knob(b,bf,'pitch','Pitch riser',ch),pick(b,bf,'roll','Roll',X.ROLLS,ch),knob(b,bf,'rollAmt','Roll level',ch),knob(b,bf,'verb','Reverb wash',ch),knob(b,bf,'swell','Volume swell',ch),knob(b,bf,'kickOut','Kick plays until',ch));
 rows.push(pick(p,pr,'gapBeats','Silence',{0:'None',1:'1 beat',2:'2 beats',4:'1 bar'},ch),knob(p,pr,'throw','Echo throw',ch),pick(p,pr,'delaysy','DELAYSY preset',DELAYSY,ch),pick(p,pr,'throwLen','Throw',{0.5:'Last 1/2 beat',1:'Last beat',2:'Last 2 beats',4:'Last bar'},ch),knob(p,pr,'reverse','Reverse suck',ch));
 rows.push(knob(d,df,'pump','Pump',ch),knob(d,df,'impact','Impact',ch));
 const snd=()=>M.project.sounds,mix=()=>M.project.mix,gate=()=>M.project.gate,sc=()=>{changed(true);renderGrid();};
 rows.push(pick(s,snd,'bass','Bass sound (Bass Invaders)',BASSES,sc),pick(s,snd,'lead','Lead sound (Bass Invaders)',LEADS,sc),knob(s,gate,'bass','Bass note length',ch),knob(s,gate,'lead','Lead note length',ch));
 for(const [k,l] of [...G.DRUMS,['bass','Bass'],['lead','Lead']])rows.push(knob(s,mix,k,l+' level',ch));
}

/* ---------- Strip, section bar and grid ---------- */
function renderStrip(){
 const p=M.project,tl=G.timeline(p),total=tl.dropEndOut,el=$('strip');el.replaceChildren();
 for(const [sec,label,len,info] of [['build','BUILD-UP',tl.gapOut,`${p.build.bars} bars`],['pre','PRE',tl.gap,p.pre.gapBeats?`${p.pre.gapBeats===4?'1 bar':p.pre.gapBeats+' beat'+(p.pre.gapBeats>1?'s':'')}`:'none'],['drop','DROP',tl.dropEndOut-tl.dropOut,`${p.drop.bars} bars`]]){
  const b=document.createElement('button');b.className=sec+(M.section===sec?' on':'');b.style.flex=sec==='pre'?'0 0 auto':`${len/total} 1 0`;b.innerHTML='<span></span><small></small><i></i>';b.querySelector('span').textContent=label;b.querySelector('small').textContent=info;b.onclick=()=>{M.section=sec;renderAll();if(M.player?.playing()&&sec!=='pre')loop();};el.append(b);}
}
function renderSecbar(){
 const el=$('secbar'),p=M.project,sec=M.section;el.replaceChildren();
 const add=html=>{const d=document.createElement('div');d.className='ctl';d.innerHTML=html;el.append(d);return d;};
 if(sec==='pre'){add('<span>The pre-drop has no grid. Set it in the PRE-DROP machine below.</span>');return;}
 const s=p[sec],bars=add('<span>Length</span><select aria-label="Section length"></select><span>bars</span>').querySelector('select');for(const n of sec==='build'?[2,4,8,16,32]:[8,16,32])bars.add(new Option(n,n));bars.value=s.bars;bars.onchange=()=>{s.bars=+bars.value;changed(true);renderStrip();};
 const pat=add('<span>Pattern</span><select aria-label="Pattern length"></select>').querySelector('select');for(const n of [1,2,4])pat.add(new Option(n+(n>1?' bars':' bar'),n));pat.value=s.patternBars;pat.onchange=()=>{G.resize(s,+pat.value);M.full=null;renderGrid();};
 const other=sec==='build'?'drop':'build',copy=add(`<button type="button">Copy the ${other==='drop'?'drop':'build-up'} pattern here</button>`).querySelector('button');copy.onclick=()=>{s.grid=JSON.parse(JSON.stringify(p[other].grid));s.patternBars=p[other].patternBars;M.full=null;renderAll();};
 const clr=add('<button type="button">Clear this grid</button>').querySelector('button');clr.onclick=()=>{s.grid=G.blank(G.steps(s));M.full=null;paint();};
}
function renderGrid(){
 const el=$('grid'),p=M.project,sec=M.section;el.replaceChildren();M.cells=null;$('mHint').textContent='';
 if(sec==='pre'){el.innerHTML='<div class="prenote">The pre-drop is the moment between build-up and drop: a short silence, the build\'s last beat thrown into DELAYSY, and reverse reverb sucking into the drop. Its settings are in the PRE-DROP machine.</div>';return;}
 const s=p[sec],n=G.steps(s),g=s.grid,cols=Array.from({length:n},()=>[]);
 const row=(parent,label,lane,d,cls)=>{const r=document.createElement('div');r.className='row'+(cls?' '+cls:'');const l=document.createElement('label');l.textContent=label;r.append(l);for(let i=0;i<n;i++){const c=document.createElement('button');c.type='button';c.className='c'+(i%16===0&&i?' b16':i%4===0&&i?' b4':'');c.dataset.l=lane;c.dataset.i=i;if(d!=null)c.dataset.d=d;r.append(c);cols[i].push(c);}parent.append(r);};
 const grp=(t,cls)=>{const h=document.createElement('div');h.className='grp';h.textContent=t;el.append(h);const box=document.createElement('div');if(cls)box.className=cls;el.append(box);return box;};
 const drums=grp('Drums');for(const [k,l] of G.DRUMS)row(drums,l,k);
 for(const lane of ['bass','lead']){const box=grp(`${lane==='bass'?'Bass':'Lead'} · ${(lane==='bass'?BASSES:LEADS)[p.sounds[lane]]?.replace(/^\d+\. /,'')||p.sounds[lane]}`,'notes');for(let d=G.ROWS[lane]-1;d>=0;d--)row(box,G.rowLabel(p,lane,d),lane,d,d%7===0?'root':'');}
 M.cells=cols;paint();
 $('mHint').textContent=sec==='build'?'Click to set a step (drums: once = on, twice = accent). The build-up loops this pattern over its length while the high-pass opens.':'Click to set a step (drums: once = on, twice = accent). Notes are in '+NOTE[p.key]+' '+G.SCALES[p.scale][0].toLowerCase()+'; one note per step per lane.';
}
function paint(){if(!M.cells)return;const g=M.project[M.section].grid;for(const col of M.cells)for(const c of col){const l=c.dataset.l,i=+c.dataset.i;if(c.dataset.d!=null){c.classList.toggle('on',g[l][i]===+c.dataset.d);}else{c.classList.toggle('on',g[l][i]===1);c.classList.toggle('acc',g[l][i]===2);}}}
function renderAll(){
 const p=M.project;$('mBpm').value=p.bpm;$('mKey').value=p.key;$('mScale').value=p.scale;
 document.querySelectorAll('#mStyles button').forEach(b=>b.classList.toggle('on',b.dataset.style===p.style));
 renderStrip();renderSecbar();renderGrid();for(const r of rows)r.sync();
}
// Grid edits are heard at once (the scheduler reads the grid); other changes rebuild the looping section shortly after.
function changed(){M.full=null;if(M.player?.playing()){clearTimeout(M.restart);M.restart=setTimeout(loop,250);}}

/* ---------- Play ---------- */
function player(){if(!M.player)M.player=G.createPlayer(ctx(),out());return M.player;}
async function loop(){
 if(M.section==='pre')M.section='drop';stopBuffer();window.Dropfather.stop();ctx();
 status('Preparing the Bass Invaders voices …');await player().play(M.project,M.section);renderAll();status(`Looping the ${M.section==='build'?'build-up':'drop'} · edit the grid while it plays`);tick();
}
function stopBuffer(){if(M.src){try{M.src.stop();}catch(e){}M.src=null;}}
function stop(){M.player?.stop();stopBuffer();cancelAnimationFrame(M.raf);markNow(-1);setStripHead(null);}
async function renderAllParts(){if(M.full)return M.full;status('Rendering build-up → pre-drop → drop …');const t=performance.now();M.full=await G.render(M.project,{sr:ctx().sampleRate});const gr=20*Math.log10(M.full.reduction||1);status(`Rendered in ${((performance.now()-t)/1000).toFixed(1)} s${gr<-.1?` · limiter ${gr.toFixed(1)} dB`:''}`);return M.full;}
async function playAll(){
 stop();window.Dropfather.stop();const r=await renderAllParts(),c=ctx(),s=c.createBufferSource();s.buffer=r.buffer;s.connect(out());const t0=c.currentTime+.05;s.start(t0);M.src=s;M.srcStart=t0;s.onended=()=>{if(M.src===s){M.src=null;setStripHead(null);markNow(-1);}};status('Playing build-up → pre-drop → drop');tick();
}
function markNow(step){if(!M.cells)return;if(M.now!=null&&M.cells[M.now])for(const c of M.cells[M.now])c.classList.remove('now');M.now=step>=0&&M.cells[step%M.cells.length]?step%M.cells.length:null;if(M.now!=null)for(const c of M.cells[M.now])c.classList.add('now');}
function setStripHead(frac){const strip=$('strip');for(const i of strip.querySelectorAll('i'))i.style.display='none';if(frac==null)return;const btns=[...strip.querySelectorAll('button')],tl=G.timeline(M.project),t=frac*tl.dropEndOut,sec=t<tl.gapOut?0:t<tl.dropOut?1:2,b=btns[sec],[a,e]=[[0,tl.gapOut],[tl.gapOut,tl.dropOut],[tl.dropOut,tl.dropEndOut]][sec],i=b.querySelector('i');i.style.display='block';i.style.left=Math.min(100,(t-a)/Math.max(1e-6,e-a)*100)+'%';}
function tick(){
 cancelAnimationFrame(M.raf);const tl=G.timeline(M.project);
 if(M.player?.playing()){const pos=M.player.position();if(pos&&pos.section===M.section)markNow(pos.step);const sec=M.project[pos?.section||'drop'],secStart=pos?.section==='build'?0:tl.dropOut,secLen=pos?.section==='build'?tl.gapOut:tl.dropEndOut-tl.dropOut;if(pos)setStripHead((secStart+pos.step/(sec.bars*16)*secLen)/tl.dropEndOut);}
 else if(M.src){const t=ctx().currentTime-M.srcStart;setStripHead(Math.min(1,t/tl.dropEndOut));const inSec=M.section==='build'?t<tl.gapOut:t>=tl.dropOut&&t<tl.dropEndOut;markNow(inSec?Math.floor((M.section==='build'?t:t-tl.dropOut)/tl.step):-1);}
 else return;
 M.raf=requestAnimationFrame(tick);
}

/* ---------- Export ---------- */
const name=()=>`Dropfather ${G.STYLES[M.project.style]?.name||'drop'} ${NOTE[M.project.key]} ${M.project.bpm}bpm`;
const save=(bytes,file,type)=>DropFiles.download(bytes,file,type,status);
async function exportAll(){const r=await renderAllParts();if(await save(X.wav(r.buffer,0,r.tl.dropEndOut+1.5),name()+'.wav','audio/wav'))status('Exported build-up + pre-drop + drop as 24-bit WAV.');}
async function exportDrop(){const r=await renderAllParts();if(await save(X.wav(r.buffer,r.tl.dropOut,r.tl.dropEndOut),name()+' (drop).wav','audio/wav'))status('Exported the drop alone, bar-exact, as 24-bit WAV.');}
async function exportMidi(){const r=await renderAllParts(),by=l=>r.events.filter(e=>l.includes(e[0])).map(e=>e.slice(1));if(await save(X.midiTracks([{name:'Bass',channel:0,notes:by(['bass'])},{name:'Lead',channel:1,notes:by(['lead'])},{name:'Drums',channel:9,notes:by(['kick','clap','snare','hat','open','roll'])}],M.project.bpm),name()+'.mid','audio/midi'))status('Exported MIDI: bass, lead and drums (GM drum notes), from the start of the build-up.');}
function saveProject(){return save(new TextEncoder().encode(JSON.stringify({app:'Dropfather drop maker',version:1,project:M.project},null,1)),name()+'.json','application/json');}
async function loadProject(file){try{const j=JSON.parse(await file.text()),p=j.project||j;if(!p.build?.grid||!p.drop?.grid)throw Error('not a Dropfather drop maker project');M.project=p;M.full=null;stop();buildControls();renderAll();status('Loaded '+file.name);}catch(e){status('Could not load: '+e.message,true);}}

/* ---------- Wiring ---------- */
function open(){document.body.dataset.mode='maker';window.Dropfather.stop();for(const id of ['makerPanel','makerMachines','makerSounds','makerDock'])$(id).classList.remove('hidden');renderAll();}
function init(){
 NOTE.forEach((n,i)=>$('mKey').add(new Option(n,i)));for(const [k,[n]] of Object.entries(G.SCALES))$('mScale').add(new Option(n,k));
 const st=$('mStyles');for(const [k,v] of Object.entries(G.STYLES)){const b=document.createElement('button');b.textContent=v.name;b.dataset.style=k;b.title='Write a new '+v.name+' build-up and drop';b.onclick=()=>{M.project=G.generate(k,(Math.random()*1e6)|0,{key:M.project.key,scale:M.project.scale});buildControls();renderAll();changed(true);};st.append(b);}
 const rnd=document.createElement('button');rnd.textContent='Randomize';rnd.dataset.style='random';rnd.onclick=()=>{M.project=G.randomize(M.project,(Math.random()*2**31)|0);buildControls();renderAll();changed(true);};st.append(rnd);
 const bpm=v=>{M.project.bpm=Math.max(60,Math.min(200,Math.round(v)));$('mBpm').value=M.project.bpm;renderStrip();changed(true);};
 $('mBpm').onchange=e=>bpm(+e.target.value);$('mBpmDown').onclick=()=>bpm(M.project.bpm-1);$('mBpmUp').onclick=()=>bpm(M.project.bpm+1);
 $('mKey').onchange=e=>{M.project.key=+e.target.value;renderGrid();changed(true);};$('mScale').onchange=e=>{M.project.scale=e.target.value;renderGrid();changed(true);};
 $('mClear').onclick=()=>{for(const s of ['build','drop'])M.project[s].grid=G.blank(G.steps(M.project[s]));M.full=null;paint();};
 $('grid').onclick=e=>{const c=e.target.closest('.c');if(!c)return;const g=M.project[M.section].grid,l=c.dataset.l,i=+c.dataset.i;if(c.dataset.d!=null){const d=+c.dataset.d;g[l][i]=g[l][i]===d?null:d;}else g[l][i]=(g[l][i]+1)%3;M.full=null;paint();};
 $('makeDrop').onclick=open;
 $('mPlayAll').onclick=playAll;$('mLoop').onclick=loop;$('mStop').onclick=stop;$('mVolume').oninput=e=>{const g=out();if(g)g.gain.value=+e.target.value;};
 $('mExAll').onclick=exportAll;$('mExDrop').onclick=exportDrop;$('mExMidi').onclick=exportMidi;$('mSave').onclick=saveProject;$('mLoad').onchange=e=>e.target.files[0]&&loadProject(e.target.files[0]);
 document.addEventListener('keydown',e=>{if(document.body.dataset.mode==='maker'&&e.code==='Space'&&!/INPUT|SELECT|TEXTAREA|BUTTON/.test(e.target.tagName)){e.preventDefault();M.player?.playing()||M.src?stop():loop();}});
 buildControls();
 window.DropMaker={M,stop,open,loop,playAll,render:renderAllParts};
}
init();
})();
