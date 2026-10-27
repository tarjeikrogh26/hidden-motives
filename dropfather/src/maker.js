/* Dropfather drop maker UI: arrangement strip (intro · breakdown · build-up · pre-drop · drop · outro), step grid,
   machines, sounds (Bass Invaders bass, AVANTGARDIAN ARP lead), play and export. */
(()=>{'use strict';
const $=id=>document.getElementById(id),G=DropGrid,X=DropDSP,NOTE=G.NOTE;
const M={autoTarget:'lead.filter',view:'drop',sel:0,clip:null,zoom:1,follow:true,samples:{},project:null,section:'drop',player:null,src:null,full:null,raf:0,restart:0,replay:0,cells:null,ui:{arp:0}};
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
 const lens=sec.len||{};items.forEach(x=>x.L=lens[x.l]?.[x.i]??null);
 const clear=x=>{g[x.l][x.i]=x.d!=null?null:0;if(lens[x.l])lens[x.l][x.i]=null;},put=(x,i,d)=>{i=((i%n)+n)%n;if(x.d!=null){g[x.l][i]=Math.max(0,Math.min(G.ROWS[x.l]-1,d));if(lens[x.l])lens[x.l][i]=x.L;}else g[x.l][i]=x.v;};
 if(kind==='move'){items.forEach(clear);items.forEach(x=>put(x,x.i+amount,x.d));q.i=q.i.map(v=>Math.max(0,Math.min(n-1,v+amount)));}
 if(kind==='pitch'){items.forEach(x=>{if(x.d!=null)clear(x);});items.forEach(x=>{if(x.d!=null)put(x,x.i,x.d+amount);});q.r=q.r.map(v=>v-amount);}
 if(kind==='dup'){const w=q.i[1]-q.i[0]+1;items.forEach(x=>put(x,x.i+w,x.d));q.i=q.i.map(v=>Math.min(n-1,v+w));}
 if(kind==='delete'){items.forEach(clear);}
 M.full=null;paint();paintSel();remember();if(M.src){clearTimeout(M.replay);M.replay=setTimeout(()=>playAll(true),700);}
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
function changed(){remember();M.full=null;if(M.player?.playing()){clearTimeout(M.restart);M.restart=setTimeout(loop,250);}if(M.src){clearTimeout(M.replay);M.replay=setTimeout(()=>playAll(true),450);}}

/* ---------- Mixer: four stems (drums, bass, lead, fx) into a master limiter ---------- */
const STEM_NAMES={drums:'Drums',bass:'Bass',lead:'Lead',fx:'FX',audio:'Audio'};
function mixer(){
 if(M.mixer)return M.mixer;const c=ctx(),master=c.createDynamicsCompressor();
 master.threshold.value=-1.5;master.knee.value=0;master.ratio.value=20;master.attack.value=.002;master.release.value=.12;master.connect(out());
 const g=G.busGains(M.project),nodes={};for(const k of G.MIXER){const n=c.createGain();n.gain.value=g[k];n.connect(master);nodes[k]=n;}
 return M.mixer=nodes;
}
// Apply faders, mute and solo (mixer) and the audio tracks' own gain, mute and solo, without re-rendering.
function applyMix(){
 if(M.mixer){const g=G.busGains(M.project),t=ctx().currentTime;for(const k of G.MIXER)M.mixer[k].gain.setTargetAtTime(g[k],t,.015);}
 if(M.trackNodes){const tg=G.trackGains(M.project),t=ctx().currentTime;M.trackNodes.forEach((n,i)=>n.gain.setTargetAtTime(tg[i]??1,t,.015));}
}
const dB=v=>{const g=G.faderGain(v);return g<=0?'−∞':(20*Math.log10(g)>=0?'+':'')+(20*Math.log10(g)).toFixed(1);};
function buildMixer(){
 const box=$('mMixer');box.replaceChildren();
 for(const k of G.MIXER){const ch=document.createElement('div');ch.className='ch';ch.innerHTML='<output></output><input type="range" min="0" max="1" step="0.01"><span class="ms"><button type="button" class="m">M</button><button type="button" class="s">S</button></span><label></label>';
  const r=ch.querySelector('input'),o=ch.querySelector('output'),bm=ch.querySelector('.m'),bs=ch.querySelector('.s');ch.querySelector('label').textContent=STEM_NAMES[k];r.setAttribute('aria-label',STEM_NAMES[k]+' level');bm.title=`Mute ${STEM_NAMES[k]}`;bs.title=`Solo ${STEM_NAMES[k]}`;
  r.oninput=()=>{const p=M.project;p.bus={...G.busOf(p),[k]:+r.value};o.textContent=dB(+r.value);applyMix();};
  const flip=(field,btn)=>{const p=M.project;p[field]={...(p[field]||{}),[k]:!p[field]?.[k]};ch.sync();syncMixer();applyMix();};
  bm.onclick=()=>flip('busMute',bm);bs.onclick=()=>flip('busSolo',bs);
  r.ondblclick=()=>{r.value=.8;r.oninput();};ch.sync=()=>{const p=M.project;r.value=G.busOf(p)[k];o.textContent=dB(+r.value);bm.classList.toggle('on',!!p.busMute?.[k]);bs.classList.toggle('on',!!p.busSolo?.[k]);ch.classList.toggle('off',G.busGains(p)[k]===0&&+r.value>0);};box.append(ch);}
}
function syncMixer(){for(const ch of $('mMixer').children)ch.sync?.();applyMix();}
function progress(f,label){const el=$('mProgress');if(f==null){el.classList.add('hidden');return;}el.classList.remove('hidden');el.querySelector('i').style.width=Math.round(f*100)+'%';el.querySelector('span').textContent=`${label} ${Math.round(f*100)}%`;}

/* ---------- Play ---------- */
function player(){if(!M.player)M.player=G.createPlayer(ctx(),mixer());return M.player;}
async function loop(){
 if(M.view==='song'){const k=G.songOrder(M.project)[M.sel];if(k)M.section=k;}
 if(M.section==='pre')M.section='drop';stopBuffer();M.paused=null;playLabel();window.Dropfather.stop();ctx();
 status('Preparing the voices …');await player().play(M.project,M.section);renderStrip();status(`Looping the ${G.labelOf(M.project,M.section).toLowerCase()} · edit the grid while it plays`);tick();
}
function stopBuffer(){if(M.src){try{M.src.stop();}catch(e){}M.src=null;}for(const s of M.extra||[])try{s.stop();}catch(e){}M.extra=[];}
function playLabel(){const b=$('mPlayAll');if(b)b.textContent=M.src?'❚❚ Pause':M.paused!=null?'▶ Resume':'▶ Play all';}
// Start Play all at a part of the arrangement (the pre-drop: one bar before it).
function playFrom(sec){const tl=G.timeline(M.project),part=tl.parts.find(x=>x.name===(sec==='pre'?'build':sec));if(!part)return;M.paused=sec==='pre'?Math.max(0,tl.gapOut-tl.bar):part.start;M.player?.stop();playAll(false).then(()=>status(`Playing from the ${sec==='pre'?'pre-drop':G.NAMES[sec].toLowerCase()}`));}
function pause(){if(!M.src)return;M.paused=ctx().currentTime-M.srcStart;stopBuffer();cancelAnimationFrame(M.raf);markNow(-1);playLabel();status('Paused · press Resume to play on from here');}
function stop(){M.paused=null;M.player?.stop();stopBuffer();playLabel();clearTimeout(M.replay);cancelAnimationFrame(M.raf);markNow(-1);setStripHead(null);}
async function renderAllParts(){const song=M.view==='song';if(M.full&&M.full.song===song)return M.full;const p=M.project;status('Rendering '+G.timeline(p,song).parts.map(x=>G.labelOf(p,x.name).toLowerCase()).join(' → ')+' …');const t=performance.now(),r=await G.render(p,{sr:ctx().sampleRate,song,samples:Object.fromEntries(Object.entries(M.samples).map(([k,v])=>[k,v.buffer])),progress:f=>progress(f,'Rendering')});progress(null);if(M.project!==p||(M.view==='song')!==song)return renderAllParts();M.full=r;const gr=20*Math.log10(r.reduction||1);status(`Rendered in ${((performance.now()-t)/1000).toFixed(1)} s${gr<-.1?` · limiter ${gr.toFixed(1)} dB`:''}`);return r;}
async function playAll(resume){
 const at=resume&&M.src?ctx().currentTime-M.srcStart:M.paused??0;const back=M.paused!=null;M.paused=null;M.player?.stop();window.Dropfather.stop();
 const r=await renderAllParts();stopBuffer();const c=ctx(),s=c.createBufferSource(),split=c.createChannelSplitter(G.STEMS.length*2),mx=mixer();s.buffer=r.stems;s.connect(split);
 const from=Math.min(at,r.buffer.duration-.1),t0=c.currentTime+.05,auto=r.song?{bar:r.tl.bar,from:from+r.t0,t0}:null;
 G.STEMS.forEach((k,i)=>{const m=c.createChannelMerger(2);split.connect(m,2*i,0);split.connect(m,2*i+1,1);m.connect(G.autoChain(c,mx[k],M.project,k,auto));});const audioIn=G.autoChain(c,mx.audio,M.project,'audio',auto);if(from<r.stems.duration)s.start(t0,from);M.src=s;M.srcStart=t0-from;
 // Audio tracks: one source each, through its own gain (mute, solo, volume) into the mixer's audio channel.
 const tg=G.trackGains(M.project);M.trackNodes=(r.audio||[]).map((b,i)=>{const n=c.createGain();n.gain.value=tg[i]??1;n.connect(audioIn);if(from<b.duration){const a=c.createBufferSource();a.buffer=b;a.connect(n);a.start(t0,from);M.extra.push(a);}return n;});
 s.onended=()=>{if(M.src===s){M.src=null;setStripHead(null);markNow(-1);playLabel();}};playLabel();status(resume?'Updated · playing on from the same spot':back?'Playing on from where you paused':'Playing '+r.parts.map(x=>G.labelOf(M.project,x.name).toLowerCase()).join(' → '));tick();
}
function markNow(step){if(!M.cells)return;if(M.now!=null&&M.cells[M.now])for(const c of M.cells[M.now])c.classList.remove('now');M.now=step>=0&&M.cells.length?step%M.cells.length:null;if(M.now!=null)for(const c of M.cells[M.now])c.classList.add('now');}
function setStripHead(t){for(const b of $('strip').querySelectorAll('button')){const i=b.querySelector('i'),a=+b.dataset.a,e=+b.dataset.e;const on=t!=null&&t>=a&&t<e;i.style.display=on?'block':'none';if(on)i.style.left=((t-a)/Math.max(1e-6,e-a)*100)+'%';}}
function tick(){
 cancelAnimationFrame(M.raf);
 if(M.view==='song'){if(!M.src&&!M.player?.playing()){songHead(M.paused??null);return;}if(M.src){const t=ctx().currentTime-M.srcStart+(M.full?.t0||0);songHead(t);prPlayhead(t);}M.raf=requestAnimationFrame(tick);return;}
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
// Audio clips or tracks changed: only the audio tracks render again (fast); playback carries on from the same spot.
async function clipChanged(){
 renderSong();remember();const r=M.full;if(!r||!r.song)return;const job=M.audioJob=(M.audioJob||0)+1;
 const audio=await G.renderAudio(M.project,Object.fromEntries(Object.entries(M.samples).map(([k,v])=>[k,v.buffer])),ctx().sampleRate,r.t0);
 if(job!==M.audioJob||M.full!==r)return;r.audio=audio;if(M.src)playAll(true);
}
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
  for(const [li,ln,rows,col] of [[1,'bass',G.ROWS.bass,'#e3201b'],[2,'lead',G.ROWS.lead,'#f3efe4']]){const d=G2[ln][i];if(d==null)continue;let len=1;while(len<16&&k+len<N&&G2[ln][(i+len)%n]==null)len++;const L=sec.len?.[ln]?.[i];g.fillStyle=col;g.fillRect(k*w,li*lane+lane-4-(d/rows)*(lane-8),Math.max(2,(L||len*(sec.gate?.[ln]??p.gate?.[ln]??.6))*w),3);}
 }
 g.fillStyle='rgba(255,74,61,.7)';
 if(x.type==='build'){g.beginPath();g.moveTo(0,H);g.lineTo(Math.min(W,gapFrom*w),3*lane+3);g.lineTo(Math.min(W,gapFrom*w),H);g.fill();}
 if(x.type==='drop'){g.fillRect(0,3*lane+2,Math.max(4,w*6),lane-4);}
 if(x.pre){g.fillStyle='#000';g.fillRect(gapFrom*w,0,W-gapFrom*w,H);g.fillStyle='#ff4a3d';g.font=`${Math.round(lane*.6)}px sans-serif`;g.fillText('pre',gapFrom*w+2,lane*.8);}
}
// A clip's waveform as it plays in the song (bars of the clip's own tempo).
const TRACK_COLORS=['#3d6a9e','#8a4fb0','#3f8a5a','#b07a2f','#2f8f8f','#b03f62','#6a7a2f'];
const trackColor=i=>{const t=M.project.audio?.tracks?.[i];return t?.color||TRACK_COLORS[i%TRACK_COLORS.length];};
function drawWave(cv,buf,c){
 const g=cv.getContext('2d'),W=cv.width,H=cv.height,d=buf.getChannelData(0),sr=buf.sampleRate,secPerBar=240/(c.warp==='off'||!c.bpm?M.project.bpm:c.bpm),total=d.length/sr-(c.offset||0);
 g.clearRect(0,0,W,H);
 const beatPx=W/(c.len*4);g.fillStyle='rgba(0,0,0,.45)';if(c.fadeIn){g.beginPath();g.moveTo(0,0);g.lineTo(c.fadeIn*beatPx,0);g.lineTo(0,H);g.fill();}if(c.fadeOut){g.beginPath();g.moveTo(W,0);g.lineTo(W-c.fadeOut*beatPx,0);g.lineTo(W,H);g.fill();}
 g.fillStyle='rgba(243,239,228,.75)';
 for(let x=0;x<W;x++){let t=((c.phase||0)+x/W*c.len)*secPerBar;if(c.loop&&total>0)t%=total;if(t>total)break;const a=Math.floor((t+(c.offset||0))*sr),b=Math.min(d.length,a+Math.max(1,Math.floor(c.len*secPerBar*sr/W)));let lo=0,hi=0;for(let i=a;i<b;i+=8){const v=d[i];if(v<lo)lo=v;if(v>hi)hi=v;}g.fillRect(x,H/2-hi*H/2,1,Math.max(1,(hi-lo)*H/2));}
}
function clipEl(c,tl,span){
 const d=document.createElement('div'),bar=tl.bar;d.className='clip'+(M.clip===c.id?' on':'');d.style.left=(c.start*bar/span*100)+'%';d.style.width=`calc(${c.len*bar/span*100}% - 1px)`;d.tabIndex=0;
 d.innerHTML='<canvas height="34"></canvas><span></span><i class="h l" title="Drag to trim the start"></i><i class="h r" title="Drag to trim the end"></i>';d.style.setProperty('--clip',trackColor(c.track));d.querySelector('span').textContent=c.name+(c.semis?` (${c.semis>0?'+':''}${c.semis})`:'')+(c.loop?' ↻':'');
 const smp=M.samples[c.sample],cv=d.querySelector('canvas');cv.width=Math.max(24,Math.round(c.len*24));if(smp)drawWave(cv,smp.buffer,c);else{d.classList.add('missing');d.title='Sample missing: load the collected project (.zip) to bring it back';}
 // Drag to move: whole bars (Shift: beats); up or down onto another audio track.
 d.onpointerdown=e=>{
  if(e.button)return;e.preventDefault();M.clip=c.id;M.sel=null;const x0=e.clientX,orig=c.start,origTrack=c.track,barPx=d.parentElement.getBoundingClientRect().width/(span/bar);let moved=false;d.setPointerCapture(e.pointerId);d.classList.add('on');
  // Trim: the left handle moves the start and skips into the clip (its phase), the right handle sets the length.
  const edge=e.target.classList.contains('h')?(e.target.classList.contains('l')?'l':'r'):null;
  if(edge){const o={start:c.start,len:c.len,phase:c.phase||0};d.onpointermove=ev=>{const q=ev.shiftKey?.25:1,dx=Math.round((ev.clientX-x0)/barPx/q)*q;moved=dx!==0;
    if(edge==='r'){c.len=Math.max(q,o.len+dx);d.style.width=`calc(${c.len*bar/span*100}% - 1px)`;}else{const ddx=Math.max(-o.phase,Math.min(o.len-q,dx));c.start=o.start+ddx;c.len=o.len-ddx;c.phase=o.phase+ddx;d.style.left=(c.start*bar/span*100)+'%';d.style.width=`calc(${c.len*bar/span*100}% - 1px)`;}};
   d.onpointerup=()=>{d.onpointermove=d.onpointerup=null;moved?clipChanged():renderSong();};return;}
  d.onpointermove=ev=>{const q=ev.shiftKey?.25:1,ns=Math.max(0,Math.round((orig+(ev.clientX-x0)/barPx)/q)*q);if(Math.abs(ev.clientX-x0)>3)moved=true;c.start=ns;d.style.left=(ns*bar/span*100)+'%';const row=document.elementsFromPoint(ev.clientX,ev.clientY).find(el=>el.classList?.contains('arow'));if(row&&!row.classList.contains('add'))c.track=+row.dataset.track;};
  d.onpointerup=()=>{d.onpointermove=d.onpointerup=null;if(moved||c.track!==origTrack)clipChanged();else renderSong();};
 };
 d.ondblclick=()=>seek(c.start*bar);
 return d;
}
function renderSong(){
 const p=M.project,el=$('song');if(!el)return;G.ensureSongParts(p);p.audio=p.audio||{tracks:[],clips:[]};if(!p.audio.tracks.length)p.audio.tracks.push({name:'Audio 1'});
 const tl=G.timeline(p,true),order=G.songOrder(p),span=songSpan(p,tl),spanBars=span/tl.bar,pct=t=>(t/span*100)+'%';el.replaceChildren();
 if(M.sel!=null&&M.sel>=order.length)M.sel=order.length-1;
 const lanes=document.createElement('div');lanes.className='lanes';
 lanes.innerHTML='<span class="rl">bar</span><span class="pl"></span>'+G.STEMS.slice(0,4).map(k=>`<span>${STEM_NAMES[k]}</span>`).join('')+'<span class="sp"></span>'+p.audio.tracks.map(t=>`<span class="al"></span>`).join('')+'<span class="au"></span><span class="al add">+ Audio</span>';
 lanes.style.gridTemplateRows=`22px 41px repeat(4,24px) 1px ${p.audio.tracks.length?`repeat(${p.audio.tracks.length},45px)`:''} 79px 45px`;
 lanes.querySelectorAll('.al:not(.add)').forEach((s2,i)=>{const t=p.audio.tracks[i];s2.innerHTML='<i class="sw" title="Track colour (click to change)"></i><em title="Double-click to rename"></em><button type="button" class="m" title="Mute">M</button><button type="button" class="s" title="Solo">S</button>';
  s2.querySelector('em').textContent=t.name;s2.querySelector('.sw').style.background=trackColor(i);s2.querySelector('.m').classList.toggle('on',!!t.mute);s2.querySelector('.s').classList.toggle('on',!!t.solo);
  s2.querySelector('.m').onclick=()=>{t.mute=!t.mute;renderSong();applyMix();};s2.querySelector('.s').onclick=()=>{t.solo=!t.solo;renderSong();applyMix();};
  s2.querySelector('.sw').onclick=()=>{const cur=TRACK_COLORS.indexOf(trackColor(i));t.color=TRACK_COLORS[(cur+1)%TRACK_COLORS.length];renderSong();};
  s2.querySelector('em').ondblclick=()=>{const n=prompt('Track name',t.name);if(n){t.name=n.slice(0,24);renderSong();}};});
 autoLabel(lanes.querySelector('.au'));el.append(lanes);
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
 col.append(autoRow(tl,span));
 const add=document.createElement('div');add.className='arow add';add.dataset.track=p.audio.tracks.length;add.textContent='Drop audio files here or anywhere on the timeline: WAV, AIFF, MP3, M4A, FLAC … They land on the bar you drop them on and follow the tempo.';col.append(add);
 const head=document.createElement('i');head.className='songhead';head.id='songHead';col.append(head);
 if(M.paused!=null&&!M.src)songHead(M.paused);
 $('songInfo').textContent=`${tl.parts.length} parts · ${Math.round(tl.total/tl.bar)} bars · ${fmtTime(tl.total)} at ${p.bpm} BPM${p.audio.clips.length?` · ${p.audio.clips.length} audio clip${p.audio.clips.length>1?'s':''}`:''}`;
 renderSongSel(tl);
}
function renderSongSel(tl){
 const p=M.project,sel=$('sSel');sel.replaceChildren();
 const c=p.audio.clips.find(x=>x.id===M.clip);if(c){renderPianoRoll(null);return renderClipSel(c,tl,sel);}
 const x=tl.parts[M.sel];if(!x){renderPianoRoll(null);return;}const key=x.name,a=p.arrangement;renderPianoRoll(key);
 const info=document.createElement('span');info.className='selinfo';info.textContent=`${G.labelOf(p,key)} · bar ${Math.round(x.start/tl.bar)+1}`;sel.append(info);
 button(sel,'▶ Play from here',()=>playFromTime(x.start));
 button(sel,'✎ Edit grid',()=>editPart(M.sel)).title='Open this part in the drop view';
 button(sel,'◀ Move',()=>moveTo(M.sel,M.sel-1));button(sel,'Move ▶',()=>moveTo(M.sel,M.sel+1));
 button(sel,'⧉ Repeat',()=>insertPart(key)).title='The same part again right after (edits change both)';
 button(sel,'␣ Insert space',()=>{const id=G.insertSpace(p,M.sel,p[key].bars);M.sel=M.sel+1;songChanged();status(`Inserted ${p[id].bars} empty bars after ${G.labelOf(p,key).toLowerCase()}: room for a new part or audio. Audio after it moved along.`);}).title='Push everything after this part along by its length and leave the room empty (Ableton: Insert Time)';
 button(sel,'↗ Open up',()=>autoGesture(x,1)).title='Automation on the lane below: the filter (or volume) rises over this part';button(sel,'↘ Close down',()=>autoGesture(x,-1)).title='Automation: falls over this part';
 button(sel,'✦ Variation',()=>{const id=G.variation(p,key,seed());a[M.sel]=id;songChanged();status(`${G.labelOf(p,id)}: its own copy${['drop','build'].includes(x.type)?' with a new lead riff':''}. Edit it without touching the others.`);}).title='Make this one its own copy (drops and build-ups get a new lead riff)';
 if(['breakdown','drop','build'].includes(x.type)||p[key].grid.lead.some(v=>v!=null))button(sel,'🎲 New melody',()=>{const name=G.newPartMelody(p,key,seed());songChanged();status(`New melody in ${name.toLowerCase()}${a.filter(k=>k===key).length>1?' (and its repeats)':''}`);}).title='A new lead line for this part, on the same chords';
 const snd=document.createElement('label');snd.className='sellen';snd.innerHTML='<span>Lead</span><select aria-label="Lead sound of this part"></select>';const ss=snd.querySelector('select');ss.add(new Option('Same as the drop',''));for(const q of (window.DropLead?.list()||[]))ss.add(new Option('Dropfather · '+q.n,'dl:'+q.id));ss.value=p[key].sounds?.lead||'';ss.onchange=()=>{if(ss.value)p[key].sounds={...(p[key].sounds||{}),lead:ss.value};else delete p[key].sounds;songChanged();};sel.append(snd);
 const len=document.createElement('label');len.className='sellen';len.innerHTML='<span>Length</span><select aria-label="Part length"></select>';const ls=len.querySelector('select');for(const n of x.type==='space'?[...new Set([1,2,4,8,16,32,p[key].bars])].sort((a,b)=>a-b):x.type==='build'?[2,4,8,16,32]:x.type==='drop'?[8,16,32]:[4,8,16,32])ls.add(new Option(n+(n>1?' bars':' bar'),n));ls.value=p[key].bars;ls.onchange=()=>{p[key].bars=+ls.value;songChanged();};sel.append(len);
 button(sel,'✕ Remove',()=>{if(a.length<2)return;a.splice(M.sel,1);M.sel=Math.min(M.sel,a.length-1);songChanged();}).classList.add('danger');
}
/* ---------- Piano roll: the selected part's notes (lead, bass) or hits (drums) ----------
   Click an empty spot to add a note (drag to set its length); drag a note to move it, its right edge to change its
   length; Shift+drag on empty space selects several; double-click deletes. Keys: arrows move (Shift: a beat),
   ↑↓ change pitch (Shift: an octave), Ctrl/Cmd+D duplicates, Ctrl/Cmd+A selects all, Delete clears. One note per
   step per lane, in the song's scale. */
const PR_ROW=18,PR_STEP=22;
function prNotes(sec,lane){const n=G.steps(sec),g=sec.grid[lane],out=[];for(let i=0;i<n;i++){const d=g[i];if(d==null)continue;let gap=1;while(gap<Math.min(n,16)&&g[(i+gap)%n]==null)gap++;const L=sec.len?.[lane]?.[i];out.push({i,d,L:L||Math.max(1,Math.round(gap*(sec.gate?.[lane]??M.project.gate[lane])*4)/4),explicit:!!L});}return out;}
function prLenArr(sec,lane){const n=G.steps(sec);sec.len=sec.len||{};if(!sec.len[lane]||sec.len[lane].length!==n)sec.len[lane]=Array.from({length:n},(_,i)=>sec.len?.[lane]?.[i]??null);return sec.len[lane];}
function prCommit(msg){M.prFocus=true;songChanged();if(msg)status(msg);}
function prApply(key,lane,moves){
 // moves: [{i,d,L}] → [{i2,d2,L2}] for the selected notes; clear them first, then write (one note per step).
 const sec=M.project[key],n=G.steps(sec),g=sec.grid[lane],len=prLenArr(sec,lane),max=G.ROWS[lane]-1,sel=new Set();
 for(const m of moves){g[m.i]=null;len[m.i]=null;}
 for(const m of moves){const i=((m.i2%n)+n)%n;g[i]=Math.max(0,Math.min(max,m.d2));len[i]=m.L2!=null?Math.max(.25,Math.min(n,m.L2)):null;sel.add(i);}
 M.prSel=sel;
}
function renderPianoRoll(key){
 const box=$('proll');if(!box)return;box.replaceChildren();M.prKey=key;if(!key){box.classList.add('hidden');return;}box.classList.remove('hidden');
 const p=M.project,sec=p[key],n=G.steps(sec),lane=M.prLane||'lead',drums=lane==='drums';if(!(M.prSel instanceof Set)||M.prSelFor!==key+lane){M.prSel=new Set();M.prSelFor=key+lane;}
 const head=document.createElement('div');head.className='prhead rowbtns';{const t=document.createElement('b');t.className='prtitle';t.textContent='NOTES';head.append(t);}
 for(const [k,label] of [['lead','Lead'],['bass','Bass'],['drums','Drums']]){const b=button(head,label,()=>{M.prLane=k;renderPianoRoll(key);});b.classList.toggle('on',k===lane);}
 const info=document.createElement('span');info.className='hint';info.textContent=`${G.labelOf(p,key)} · ${sec.patternBars}-bar pattern${G.songOrder(p).filter(k=>k===key).length>1?' · repeats change too':''}`;head.append(info);
 if(!drums){button(head,'Select all',()=>{M.prSel=new Set(prNotes(sec,lane).map(x=>x.i));renderPianoRoll(key);});button(head,'⧉ Duplicate',()=>prKey({key:'d',ctrlKey:true,preventDefault(){}}));button(head,'✕ Delete',()=>prKey({key:'Delete',preventDefault(){}}));}
 box.append(head);
 const rows=drums?G.DRUMS.map(([k,l])=>({k,label:l})):Array.from({length:G.ROWS[lane]},(_,r)=>{const d=G.ROWS[lane]-1-r;return {d,label:G.rowLabel(p,lane,d),root:d%7===0};});
 const wrap=document.createElement('div');wrap.className='prwrap';box.append(wrap);
 const keys=document.createElement('div');keys.className='prkeys';for(const r of rows){const k=document.createElement('span');k.textContent=r.label;if(r.root)k.className='root';keys.append(k);}wrap.append(keys);
 const area=document.createElement('div');area.className='prarea'+(drums?' drums':'');area.tabIndex=0;area.style.width=n*PR_STEP+'px';area.style.height=rows.length*PR_ROW+'px';area.setAttribute('aria-label',`Notes: ${lane} of ${G.labelOf(p,key)}`);wrap.append(area);
 for(const [r,row] of rows.entries())if(row.root){const band=document.createElement('i');band.className='rootband';band.style.top=r*PR_ROW+'px';area.append(band);}
 if(drums){for(const [r,row] of rows.entries())for(let i=0;i<n;i++){const v=sec.grid[row.k][i];if(!v)continue;const h=document.createElement('b');h.className='hit'+(v===2?' acc':'');h.style.left=i*PR_STEP+1+'px';h.style.top=r*PR_ROW+2+'px';area.append(h);}}
 else for(const x of prNotes(sec,lane)){const e=document.createElement('b');e.className='note'+(M.prSel.has(x.i)?' sel':'')+(x.explicit?'':' auto');e.dataset.i=x.i;e.style.left=x.i*PR_STEP+'px';e.style.top=(G.ROWS[lane]-1-x.d)*PR_ROW+1+'px';e.style.width=Math.max(6,x.L*PR_STEP-1)+'px';e.innerHTML='<i class="rh"></i>';area.append(e);}
 const playhead=document.createElement('i');playhead.className='prplay';playhead.id='prPlay';area.append(playhead);
 const at=e=>{const r=area.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top,i:Math.max(0,Math.min(n-1,Math.floor((e.clientX-r.left)/PR_STEP))),r:Math.max(0,Math.min(rows.length-1,Math.floor((e.clientY-r.top)/PR_ROW)))};};
 area.onpointerdown=e=>{
  if(e.button)return;e.preventDefault();area.focus();M.prFocus=true;const a=at(e);area.setPointerCapture(e.pointerId);
  if(drums){const k=rows[a.r].k;sec.grid[k][a.i]=(sec.grid[k][a.i]+1)%3;return prCommit();}
  const g=sec.grid[lane],noteEl=e.target.closest('.note'),resize=e.target.classList.contains('rh');
  if(!noteEl&&e.shiftKey){const box2=document.createElement('i');box2.className='marquee';area.append(box2);area.onpointermove=ev=>{const b=at(ev),x0=Math.min(a.x,b.x),y0=Math.min(a.y,b.y);Object.assign(box2.style,{left:x0+'px',top:y0+'px',width:Math.abs(b.x-a.x)+'px',height:Math.abs(b.y-a.y)+'px'});};
   area.onpointerup=ev=>{area.onpointermove=area.onpointerup=null;const b=at(ev),i0=Math.min(a.i,b.i),i1=Math.max(a.i,b.i),r0=Math.min(a.r,b.r),r1=Math.max(a.r,b.r);M.prSel=new Set(prNotes(sec,lane).filter(x=>x.i>=i0&&x.i<=i1&&G.ROWS[lane]-1-x.d>=r0&&G.ROWS[lane]-1-x.d<=r1).map(x=>x.i));renderPianoRoll(key);};return;}
  let notes=prNotes(sec,lane);
  if(!noteEl){// new note, then drag sets its length
   const d=rows[a.r].d;prApply(key,lane,[{i:a.i,d,i2:a.i,d2:d,L2:M.prLen||1}]);notes=prNotes(sec,lane);renderPianoRoll(key);
   const el=$('proll').querySelector(`.note[data-i="${a.i}"]`),area2=$('proll').querySelector('.prarea');area2.setPointerCapture(e.pointerId);
   area2.onpointermove=ev=>{const L=Math.max(1,Math.round((ev.clientX-area2.getBoundingClientRect().left-a.i*PR_STEP)/PR_STEP));if(el)el.style.width=L*PR_STEP-1+'px';el.dataset.L=L;};
   area2.onpointerup=()=>{area2.onpointermove=area2.onpointerup=null;const L=+(el?.dataset.L||M.prLen||1);M.prLen=L;prLenArr(sec,lane)[a.i]=L;prCommit(`Note ${G.rowLabel(p,lane,d)} added`);};return;}
  const i=+noteEl.dataset.i;if(e.shiftKey){M.prSel.has(i)?M.prSel.delete(i):M.prSel.add(i);return renderPianoRoll(key);}if(!M.prSel.has(i))M.prSel=new Set([i]);
  const sel=notes.filter(x=>M.prSel.has(x.i)),els=[...area.querySelectorAll('.note')].filter(el=>M.prSel.has(+el.dataset.i));els.forEach(el=>el.classList.add('sel'));
  let di=0,dd=0,dl=0;
  area.onpointermove=ev=>{const b=at(ev);if(resize){dl=Math.round((b.x-a.x)/PR_STEP);els.forEach((el,k)=>el.style.width=Math.max(6,(sel[k].L+dl)*PR_STEP-1)+'px');}else{di=Math.round((b.x-a.x)/PR_STEP);dd=-Math.round((b.y-a.y)/PR_ROW);els.forEach(el=>el.style.transform=`translate(${di*PR_STEP}px,${-dd*PR_ROW}px)`);}};
  area.onpointerup=()=>{area.onpointermove=area.onpointerup=null;if(!di&&!dd&&!dl)return renderPianoRoll(key);
   prApply(key,lane,sel.map(x=>({i:x.i,d:x.d,i2:x.i+di,d2:x.d+dd,L2:resize?Math.max(1,x.L+dl):x.explicit?x.L:null})));prCommit(`${sel.length} note${sel.length>1?'s':''} ${resize?'resized':'moved'}`);};
 };
 area.ondblclick=e=>{const el=e.target.closest('.note');if(!el)return;const i=+el.dataset.i;sec.grid[lane][i]=null;if(sec.len?.[lane])sec.len[lane][i]=null;M.prSel.delete(i);prCommit('Note deleted');};
 if(M.prFocus)requestAnimationFrame(()=>area.focus({preventScroll:true}));
}
// Keys while the piano roll has focus.
function prKey(e){
 const key=M.prKey,lane=M.prLane||'lead';if(!key||lane==='drums')return false;const p=M.project,sec=p[key],n=G.steps(sec),mod=e.ctrlKey||e.metaKey,k=e.key,notes=prNotes(sec,lane),sel=notes.filter(x=>M.prSel.has(x.i));
 const go=(fn,msg)=>{e.preventDefault();if(!sel.length&&k!=='a')return true;fn();prCommit(msg);return true;};
 if(mod&&k.toLowerCase()==='a'){e.preventDefault();M.prSel=new Set(notes.map(x=>x.i));renderPianoRoll(key);return true;}
 if(k==='Escape'){M.prSel=new Set();renderPianoRoll(key);return true;}
 if(k==='ArrowLeft'||k==='ArrowRight'){const s=(k==='ArrowLeft'?-1:1)*(e.shiftKey?4:1);return go(()=>prApply(key,lane,sel.map(x=>({...x,i2:x.i+s,d2:x.d,L2:x.explicit?x.L:null}))),'Moved');}
 if(k==='ArrowUp'||k==='ArrowDown'){const s=(k==='ArrowUp'?1:-1)*(e.shiftKey?7:1);return go(()=>prApply(key,lane,sel.map(x=>({...x,i2:x.i,d2:x.d+s,L2:x.explicit?x.L:null}))),'Transposed');}
 if(k==='Delete'||k==='Backspace')return go(()=>{for(const x of sel){sec.grid[lane][x.i]=null;if(sec.len?.[lane])sec.len[lane][x.i]=null;}M.prSel=new Set();},`${sel.length} deleted`);
 if(mod&&k.toLowerCase()==='d'){const w=Math.max(...sel.map(x=>x.i+Math.ceil(x.L)))-Math.min(...sel.map(x=>x.i));return go(()=>{const len=prLenArr(sec,lane),add=new Set();for(const x of sel){const i=(x.i+w)%n;sec.grid[lane][i]=x.d;len[i]=x.explicit?x.L:null;add.add(i);}M.prSel=add;},'Duplicated');}
 return false;
}
function prPlayhead(t){const el=$('prPlay');if(!el)return;const tl=G.timeline(M.project,true),part=tl.parts.find(x=>t>=x.start&&t<x.end);if(!part||part.name!==M.prKey){el.style.display='none';return;}const n=G.steps(M.project[M.prKey]);el.style.display='block';el.style.left=(((t-part.start)/tl.step)%n)*PR_STEP+'px';}
/* ---------- Automation lane: one target at a time (volume or filter of a mixer channel) ----------
   Click to add a point (it follows the pointer while you hold), drag points, double-click one to delete it.
   Points snap to beats; hold Alt for free placement. */
const AUTO_TARGETS=()=>G.MIXER.flatMap(k=>Object.entries(G.AUTO_KINDS).map(([kind,n])=>[k+'.'+kind,`${STEM_NAMES[k]} · ${n}`]));
function autoPoints(){const p=M.project;p.auto=p.auto||{};return p.auto[M.autoTarget]||(p.auto[M.autoTarget]=[]);}
function autoChanged(msg){M.autoDirty=true;renderSong();remember();if(M.src)playAll(true);if(msg)status(msg);}
function autoLabel(box){
 box.innerHTML='<span>Automation</span><select aria-label="Automation target"></select><button type="button" title="Clear this lane">Clear</button>';
 const sel=box.querySelector('select'),p=M.project;for(const [k,n] of AUTO_TARGETS())sel.add(new Option((p.auto?.[k]?.length?'● ':'')+n,k));sel.value=M.autoTarget;
 sel.onchange=()=>{M.autoTarget=sel.value;renderSong();};box.querySelector('button').onclick=()=>{if(p.auto)delete p.auto[M.autoTarget];autoChanged('Lane cleared');};
}
function autoRow(tl,span){
 const row=document.createElement('div');row.className='autorow';const spanBars=span/tl.bar,pts=(M.project.auto?.[M.autoTarget]||[]),H=70,kind=M.autoTarget.split('.')[1];
 const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox',`0 0 ${spanBars} 1`);svg.setAttribute('preserveAspectRatio','none');
 const line=document.createElementNS(svg.namespaceURI,'polyline'),xy=pts.length?[[0,pts[0][1]],...pts,[spanBars,pts[pts.length-1][1]]]:[[0,1],[spanBars,1]];
 line.setAttribute('points',xy.map(([b,v])=>`${b},${1-v}`).join(' '));line.setAttribute('vector-effect','non-scaling-stroke');line.setAttribute('class',pts.length?'on':'');svg.append(line);row.append(svg);
 const lab=document.createElement('span');lab.className='autoname';lab.textContent=AUTO_TARGETS().find(t=>t[0]===M.autoTarget)[1]+(pts.length?'':' · click to draw');row.append(lab);
 pts.forEach((pt,i)=>{const d=document.createElement('i');d.className='apt';d.style.left=(pt[0]/spanBars*100)+'%';d.style.top=((1-pt[1])*H)+'px';d.title=`bar ${+(pt[0]+1).toFixed(2)} · ${kind==='filter'?Math.round(20*2**(pt[1]*10))+' Hz':Math.round(pt[1]*100)+'%'}`;d.dataset.i=i;row.append(d);});
 const at=(e,free)=>{const r=row.getBoundingClientRect(),b=(e.clientX-r.left)/r.width*spanBars,v=Math.max(0,Math.min(1,1-(e.clientY-r.top)/H));return [Math.max(0,free?+b.toFixed(3):Math.round(b*4)/4),+v.toFixed(3)];};
 row.onpointerdown=e=>{
  if(e.button)return;e.preventDefault();const list=autoPoints();let pt=e.target.classList.contains('apt')?list[+e.target.dataset.i]:null;
  if(!pt){pt=at(e,e.altKey);list.push(pt);list.sort((a,b)=>a[0]-b[0]);}
  row.setPointerCapture(e.pointerId);const el=()=>row.querySelectorAll('.apt')[list.indexOf(pt)];
  if(!e.target.classList.contains('apt'))renderSong();
  const target=M.autoTarget;
  const move=ev=>{const [b,v]=at(ev,ev.altKey);pt[0]=b;pt[1]=v;list.sort((x,y)=>x[0]-y[0]);const r2=document.querySelector('.autorow');if(r2){const d=r2.querySelectorAll('.apt')[list.indexOf(pt)];if(d){d.style.left=(b/spanBars*100)+'%';d.style.top=((1-v)*H)+'px';}}};
  const up=()=>{document.removeEventListener('pointermove',move);document.removeEventListener('pointerup',up);M.autoTarget=target;const l=autoPoints();for(let i=l.length-1;i>0;i--)if(Math.abs(l[i][0]-l[i-1][0])<1e-6)l.splice(i-1,1);autoChanged();};
  document.addEventListener('pointermove',move);document.addEventListener('pointerup',up);
 };
 row.ondblclick=e=>{if(!e.target.classList.contains('apt'))return;autoPoints().splice(+e.target.dataset.i,1);autoChanged('Point deleted');};
 return row;
}
// Ready-made moves for the selected part on the current lane: a sweep or swell in, or out.
function autoGesture(x,dir){
 const tl=G.timeline(M.project,true),a=x.start/tl.bar,b=x.end/tl.bar,kind=M.autoTarget.split('.')[1],low=kind==='filter'?.35:0,list=autoPoints().filter(([t])=>t<a||t>b);
 list.push(...(dir>0?[[a,low],[b,1]]:[[a,1],[b,low]]));list.sort((p,q)=>p[0]-q[0]);M.project.auto[M.autoTarget]=list;
 autoChanged(`${AUTO_TARGETS().find(t=>t[0]===M.autoTarget)[1]}: ${dir>0?'opens up':'closes down'} over ${G.labelOf(M.project,x.name).toLowerCase()}`);
}

/* ---------- Undo / redo: snapshots of the project after each change (Ctrl/Cmd+Z, Shift+Ctrl/Cmd+Z) ---------- */
function remember(){clearTimeout(M.remT);M.remT=setTimeout(()=>{const j=JSON.stringify(M.project);M.hist=M.hist||[];if(M.hist[M.hpos]===j)return;M.hist=M.hist.slice(0,(M.hpos??-1)+1);M.hist.push(j);if(M.hist.length>60)M.hist.shift();M.hpos=M.hist.length-1;undoLabels();},250);}
function undoLabels(){$('mUndo').disabled=!(M.hpos>0);$('mRedo').disabled=!(M.hist&&M.hpos<M.hist.length-1);}
function travel(step){
 clearTimeout(M.remT);const i=(M.hpos??0)+step;if(!M.hist||i<0||i>=M.hist.length)return;M.hpos=i;M.project=JSON.parse(M.hist[i]);M.full=null;stop();buildControls();renderAll();undoLabels();status(step<0?'Undone':'Redone');
}

// A dropped song's chords (ARP), for drops put into it: the four bars before the insertion point.
function songChords(bar){
 const p=M.project,tl=G.timeline(p,true);for(const c of p.audio?.clips||[]){const h=M.harmony?.[c.sample];if(!h||c.warp!=='off')continue;
  const from=Math.max(0,bar-4);if(from<c.start||from>=c.start+c.len)continue;const barSec=tl.bar,at=b=>(c.offset||0)+((from+b)-c.start+(c.phase||0))*barSec;
  return G.chordsFromHarmony(p,h.segments,at,barSec,4);}
 return null;
}
async function listenForChords(buffer,id){
 const SR=22050,c=new OfflineAudioContext(1,Math.ceil(buffer.duration*SR),SR),s=c.createBufferSource();s.buffer=buffer;s.connect(c.destination);s.start();
 const mono=(await c.startRendering()).getChannelData(0);M.harmony=M.harmony||{};
 try{M.harmony[id]=await window.Dropfather.arpHarmony(mono,p=>{if(!M.src)status(`AVANTGARDIAN ARP is listening for the chords … ${Math.round(p*100)} %`);});status('ARP has the chords: a drop inserted now follows the song’s harmony.');}
 catch(e){status('ARP could not read the chords ('+e.message+'); drops use their own progression.',true);}
}
function renderClipSel(c,tl,sel){
 const p=M.project,info=document.createElement('span');info.className='selinfo';info.textContent=`${c.name} · bar ${+(c.start+1).toFixed(2)}`;sel.append(info);
 const upd=()=>{clipChanged();};
 button(sel,'▶ Play from here',()=>playFromTime(c.start*tl.bar));
 const wl=document.createElement('label');wl.className='sellen';wl.innerHTML='<span>Warp</span><select aria-label="Warp mode"></select>';const ws=wl.querySelector('select');for(const [k,v] of Object.entries(DropWarp.MODES))ws.add(new Option(v,k));ws.value=c.warp;ws.onchange=()=>{c.warp=ws.value;upd();};sel.append(wl);
 const bl=document.createElement('label');bl.className='sellen';bl.innerHTML='<span>Clip BPM</span><input type="number" min="40" max="250" step="0.01" aria-label="Clip tempo">';const bi=bl.querySelector('input');bi.value=c.bpm;bi.onchange=()=>{c.bpm=Math.max(40,Math.min(250,+bi.value||p.bpm));upd();};sel.append(bl);
 const tp=document.createElement('span');tp.className='sellen';tp.innerHTML='<span>Pitch</span>';sel.append(tp);
 button(tp,'−',()=>{c.semis=(c.semis||0)-1;upd();}).title='Down a semitone (Shift: an octave via the arrow keys)';const tv=document.createElement('b');tv.textContent=`${c.semis>0?'+':''}${c.semis||0} st`;tp.append(tv);button(tp,'+',()=>{c.semis=(c.semis||0)+1;upd();});
 const gl=document.createElement('label');gl.className='sellen';gl.innerHTML='<span>Gain</span><input type="range" min="0" max="1.5" step="0.01" aria-label="Clip gain">';const gi=gl.querySelector('input');gi.value=c.gain??.8;gi.onchange=()=>{c.gain=+gi.value;upd();};sel.append(gl);
 const ll=document.createElement('label');ll.className='sellen';ll.innerHTML='<span>Length</span><select aria-label="Clip length"></select>';const lsel=ll.querySelector('select');for(const n of [...new Set([1,2,4,8,16,32,64,c.len])].sort((a,b)=>a-b))lsel.add(new Option(n+(n===1?' bar':' bars'),n));lsel.value=c.len;lsel.onchange=()=>{c.len=+lsel.value;upd();};sel.append(ll);
 const lp=document.createElement('label');lp.className='sellen';lp.innerHTML='<input type="checkbox"> <span>Loop</span>';const lc=lp.querySelector('input');lc.checked=!!c.loop;lc.onchange=()=>{c.loop=lc.checked;upd();};sel.append(lp);
 for(const [field,label] of [['fadeIn','Fade in'],['fadeOut','Fade out']]){const fl=document.createElement('label');fl.className='sellen';fl.innerHTML=`<span>${label}</span><select aria-label="${label}"></select>`;const fs=fl.querySelector('select');for(const [v,n] of [[0,'none'],[.25,'1/16'],[.5,'1/8'],[1,'1 beat'],[2,'2 beats'],[4,'1 bar'],[8,'2 bars']])fs.add(new Option(n,v));fs.value=c[field]||0;fs.onchange=()=>{c[field]=+fs.value;upd();};sel.append(fl);}
 button(sel,'✂ Split',()=>splitClip(c)).title='Split at the playhead or start point (Ctrl/Cmd+E); in the middle if that is outside the clip';
 button(sel,'⧉ Duplicate',()=>duplicateClip(c)).title='A copy right after it (Ctrl/Cmd+D)';
 button(sel,'✕ Delete',()=>deleteClip(c)).classList.add('danger');
}
function duplicateClip(c){const n={...c,id:'c'+Math.random().toString(36).slice(2,9),start:c.start+c.len};M.project.audio.clips.push(n);M.clip=n.id;clipChanged();}
function deleteClip(c){const a=M.project.audio.clips;a.splice(a.indexOf(c),1);M.clip=null;clipChanged();}
// Split a clip at a bar position (the start point or playhead if it is inside the clip, else its middle).
function splitClip(c){
 const tl=G.timeline(M.project,true),t=M.src?ctx().currentTime-M.srcStart+(M.full?.t0||0):M.paused,at=t!=null?Math.round(t/tl.beat)/4:null;
 const s2=at!=null&&at>c.start+.01&&at<c.start+c.len-.01?at:c.start+Math.max(.25,Math.round(c.len/2*4)/4);if(s2<=c.start||s2>=c.start+c.len)return;
 const n={...c,id:'c'+Math.random().toString(36).slice(2,9),start:s2,len:+(c.start+c.len-s2).toFixed(4),phase:(c.phase||0)+(s2-c.start),fadeIn:0};
 c.len=+(s2-c.start).toFixed(4);c.fadeOut=0;M.project.audio.clips.push(n);M.clip=n.id;clipChanged();status(`Split at bar ${+(s2+1).toFixed(2)}`);
}
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
 if(placed)clipChanged();
}
// Drop a song: straight into song mode, the song on an audio track at its own tempo (tempo, bar 1 and key found),
// ready for a drop to be inserted where you want it.
async function openSong(file){
 open();document.body.dataset.mode='maker';status(`Reading ${file.name} …`);progress(.05,'Analysing');
 try{
  const buffer=await DropDecode.decode(ctx(),file);progress(.3,'Analysing');
  const t=await DropWarp.guess(buffer,124);progress(.7,'Analysing');const k=await DropWarp.key(buffer);progress(null);
  const bpm=+t.bpm.toFixed(2),style=bpm<110?'ambient':bpm<123?'house':bpm<131?'festival':'techno',p=G.generate(style,seed(),{key:k.key,scale:k.scale==='major'?'major':'minor'});
  p.bpm=bpm;const bars=Math.max(1,Math.ceil((buffer.duration-(t.offset||0))/(240/bpm))),id='s'+Date.now().toString(36);
  M.samples[id]={name:file.name,buffer,bytes:new Uint8Array(await file.arrayBuffer()),type:file.type};
  p.song1={type:'space',label:'SONG',bars,patternBars:1,grid:G.blank(16),fx:{filterFrom:1,filterTo:1,verb:0,pump:0}};p.arrangement=['song1'];
  p.audio={tracks:[{name:file.name.replace(/\.[^.]+$/,'').slice(0,24)}],clips:[{id:'c'+id,track:0,sample:id,name:file.name.replace(/\.[^.]+$/,''),start:0,len:bars,warp:'off',bpm,offset:t.offset||0,semis:0,gain:.8,loop:false}]};
  M.view='song';document.body.dataset.view='song';document.querySelectorAll('#mView button').forEach(b=>b.classList.toggle('on',b.dataset.view==='song'));M.sel=null;M.clip=null;M.paused=null;
  setProject(p,`${file.name}: ${bpm} BPM, ${G.NOTE[k.key]} ${k.scale}. Click the ruler where the drop should go, then ⤵ Insert a drop here. The drop is written in the song's key and tempo.`);
  $('mExAll').textContent='WAV · whole song';window.scrollTo({top:$('songPanel').offsetTop-10,behavior:'smooth'});
  listenForChords(buffer,id);
 }catch(e){progress(null);status(`${file.name}: ${e.message}`,true);}
}
function initSong(){
 const pal=$('sPalette'),make=button(pal,'🎲 Make a song from the drop',()=>makeSongNow());make.className='primary';make.title='Writes intro, groove, a breakdown with the song melody, a second build-up and drop, and an outro around your drop. Your drop and build-up stay as they are. Click again for another version.';
 const ins=button(pal,'⤵ Insert a drop here',()=>{const p=M.project,tl=G.timeline(p,true),bar=Math.round((M.paused??0)/tl.bar);const ch=songChords(bar);let prog='';if(ch)prog=G.setChords(p,ch,seed());const r=G.insertDropAt(p,bar);M.sel=G.songOrder(p).indexOf('build',0);M.clip=null;songChanged();status(`Build-up + drop inserted at bar ${r.bar+1} (${r.bars} bars)${prog?`, on the song’s chords: ${prog}`:''}. The song after it moved along.`);});ins.className='primary';ins.title='Click the ruler at a bar first. Puts the build-up and drop there; the song after it is split and moved along';
 for(const [type,label] of PART_TYPES)button(pal,label,()=>insertPart(G.partOfType(M.project,type))).title='Add after the selected part';
 const zoom=document.createElement('span');zoom.className='zoom';pal.append(zoom);
 button(zoom,'−',()=>{M.zoom=Math.max(.4,M.zoom/1.5);renderSong();}).title='Zoom out';button(zoom,'+',()=>{M.zoom=Math.min(5,M.zoom*1.5);renderSong();}).title='Zoom in';
 const fl=document.createElement('label');fl.className='sellen';fl.innerHTML='<input type="checkbox" checked> <span>Follow</span>';fl.querySelector('input').onchange=e=>M.follow=e.target.checked;fl.title='Scroll along with the playhead';pal.append(fl);
 document.querySelectorAll('#mView button').forEach(b=>b.onclick=()=>setView(b.dataset.view));
 $('mFurther').onclick=()=>{setView('song');window.scrollTo({top:$('songPanel').offsetTop-10,behavior:'smooth'});};
 $('openSongMode').onclick=()=>{open();setView('song');window.scrollTo({top:$('songPanel').offsetTop-10,behavior:'smooth'});};
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
async function exportAll(){const r=await renderAllParts(),whole=r.parts.length>2;if(await save(X.wav((await G.mix(r,M.project)).buffer,0,endOf(r)),name()+(M.view==='song'?' (song)':whole?' (song sketch)':'')+'.wav','audio/wav'))status(`Exported ${r.parts.map(x=>G.labelOf(M.project,x.name).toLowerCase()).join(' → ')} as 24-bit WAV.`);}
async function exportDrop(){const r=await renderAllParts();if(await save(X.wav((await G.mix(r,M.project)).buffer,r.tl.dropOut-r.t0,r.tl.dropEndOut-r.t0),name()+' (drop).wav','audio/wav'))status('Exported the drop alone, bar-exact, as 24-bit WAV.');}
async function exportMidi(){const r=await renderAllParts(),by=l=>r.events.filter(e=>l.includes(e[0])).map(e=>e.slice(1));if(await save(X.midiTracks([{name:'Bass',channel:0,notes:by(['bass'])},{name:'Lead',channel:1,notes:by(['lead'])},{name:'Drums',channel:9,notes:by(['kick','clap','snare','hat','open','roll'])}],M.project.bpm),name()+'.mid','audio/midi'))status('Exported MIDI: bass, lead and drums (GM drum notes), from the start of the arrangement.');}
// Stems: drums, bass, lead, fx and audio as 24-bit WAVs from the start of the arrangement, at their faders.
async function stemFiles(r){
 const end=endOf(r),files=[];status('Writing stems …');
 for(const [i,k] of G.STEMS.entries())files.push({name:`${i+1} ${STEM_NAMES[k]}.wav`,bytes:X.wav(await G.mixOffline(r,M.project,k),0,end)});
 for(const [i] of (r.audio||[]).entries())files.push({name:`${G.STEMS.length+i+1} ${M.project.audio.tracks[i].name}.wav`,bytes:X.wav(await G.mixOffline(r,M.project,'track:'+i),0,end)});
 return files;
}
async function exportStems(){
 const r=await renderAllParts(),files=await stemFiles(r);
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
 const files=[...(await stemFiles(r)).map(f=>({name:dir+'Audio/'+f.name,bytes:f.bytes})),{name:dir+'MIDI/'+name()+'.mid',bytes:midi},{name:dir+'project.dropfather.json',bytes:projectJson()},{name:dir+'HOW TO OPEN IN ABLETON.txt',bytes:new TextEncoder().encode(how)}];
 if(await save(DropFiles.zipFiles(files),name()+' (Ableton).zip','application/zip'))status(`Ableton pack: ${files.length-3} stems, MIDI (bass, lead, drums), the project and a how-to. Unzip, set Live to ${p.bpm} BPM and drag it in at bar 1.`);
}

/* ---------- Wiring ---------- */
function setProject(p,note){M.hist=[];M.hpos=-1;if(M.view==='song')G.ensureSongParts(p);M.project=p;M.full=null;buildControls();renderAll();changed();status(note||p.desc);}
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
 $('grid').onclick=e=>{if(M.skipClick){M.skipClick=false;return;}const c=e.target.closest('.c');if(!c)return;if(M.gsel){clearSel();}const ln=M.project[M.section].len?.[c.dataset.l];if(ln)ln[+c.dataset.i]=null;const g=M.project[M.section].grid,l=c.dataset.l,i=+c.dataset.i;if(c.dataset.d!=null){const d=+c.dataset.d;g[l][i]=g[l][i]===d?null:d;}else g[l][i]=(g[l][i]+1)%3;M.full=null;paint();if(M.src){clearTimeout(M.replay);M.replay=setTimeout(()=>playAll(true),700);}};
 $('makeDrop').onclick=open;
 $('mPlayAll').onclick=()=>M.src?pause():playAll(false);$('mRandom').onclick=()=>setProject(G.randomize(M.project,seed()));$('mLoop').onclick=loop;$('mStop').onclick=stop;$('mUndo').onclick=()=>travel(-1);$('mRedo').onclick=()=>travel(1);
 const now=()=>M.src?ctx().currentTime-M.srcStart+(M.full?.t0||0):(M.paused??0),barLen=()=>G.timeline(M.project,M.view==='song').bar;
 $('mHome').onclick=()=>seek(0);$('mBack').onclick=()=>seek(Math.round(now()/barLen()-4)*barLen());$('mFwd').onclick=()=>seek(Math.round(now()/barLen()+4)*barLen());$('mVolume').oninput=e=>{const g=out();if(g)g.gain.value=+e.target.value;};
 $('mExStems').onclick=exportStems;$('mExAbleton').onclick=exportAbleton;$('mExAll').onclick=exportAll;$('mExDrop').onclick=exportDrop;$('mExMidi').onclick=exportMidi;$('mSave').onclick=saveProject;$('mLoad').onchange=e=>e.target.files[0]&&loadProject(e.target.files[0]);
 document.addEventListener('pointerdown',e=>{if(!e.target.closest?.('#proll'))M.prFocus=false;});
 document.addEventListener('keydown',e=>{
  if(document.body.dataset.mode!=='maker'||/INPUT|SELECT|TEXTAREA/.test(e.target.tagName))return;
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();travel(e.shiftKey?1:-1);return;}
  if(M.view==='song'){
   if(document.activeElement?.closest?.('#proll')&&prKey(e))return;
   const c=M.project.audio?.clips.find(x=>x.id===M.clip),mod=e.ctrlKey||e.metaKey;
   if(e.code==='Space'&&e.target.tagName!=='BUTTON'){e.preventDefault();M.src?pause():playAll(false);return;}
   if(e.key==='Home'){e.preventDefault();seek(0);return;}
   if(!c)return;
   if(e.key==='Delete'||e.key==='Backspace'){e.preventDefault();deleteClip(c);}
   else if(mod&&e.key.toLowerCase()==='d'){e.preventDefault();duplicateClip(c);}
   else if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();c.start=Math.max(0,c.start+(e.key==='ArrowLeft'?-1:1)*(e.shiftKey?.25:1));clipChanged();}
   else if(e.key==='ArrowUp'||e.key==='ArrowDown'){e.preventDefault();c.semis=(c.semis||0)+(e.key==='ArrowUp'?1:-1)*(e.shiftKey?12:1);clipChanged();}
   else if(e.key.toLowerCase()==='e'&&mod){e.preventDefault();splitClip(c);}
   return;
  }
  if(gridKeys(e))return;
  if(e.code==='Space'&&e.target.tagName!=='BUTTON'){e.preventDefault();M.player?.playing()||M.src?stop():loop();}
 });
 window.DropMaker={M,stop,open,openSong,loop,playAll,render:renderAllParts};
}
init();preview();
})();
