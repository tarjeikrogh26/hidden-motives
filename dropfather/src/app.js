/* Dropfather UI: load a song, place the drop, shape build-up / pre-drop / drop, listen and export. */
(()=>{'use strict';
const $=id=>document.getElementById(id),A=DropAnalysis,X=DropDSP,NOTE=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const S={ctx:null,gain:null,buffer:null,name:'',mono:null,an:null,harmony:null,plan:X.defaultPlan(),preview:null,full:null,src:null,play:null,dirty:true,token:0,timer:null,taps:[],autoRoot:null};
const fmt=t=>{t=Math.max(0,t);const m=Math.floor(t/60),s=t-m*60;return m+':'+(s<10?'0':'')+s.toFixed(1);};
const status=(text,bad)=>{$('status').textContent=text;$('status').style.color=bad?'#ff6a5e':'';};

function audio(){if(!S.ctx){S.ctx=new (window.AudioContext||window.webkitAudioContext)();S.gain=S.ctx.createGain();S.gain.gain.value=+$('volume').value;S.gain.connect(S.ctx.destination);}if(S.ctx.state==='suspended')S.ctx.resume();return S.ctx;}

/* ---------- Loading and analysis ---------- */
async function load(file){
 stop();status('Reading '+file.name+' …');
 try{
  const ctx=audio(),data=await file.arrayBuffer(),buffer=await ctx.decodeAudioData(data);
  S.buffer=buffer;S.name=file.name.replace(/\.[^.]+$/,'');S.harmony=null;S.preview=S.full=null;
  status('Finding tempo, bars and drop points …');await new Promise(r=>setTimeout(r,30));
  const off=new OfflineAudioContext(1,Math.ceil(buffer.duration*A.SR),A.SR),s=off.createBufferSource();s.buffer=buffer;s.connect(off.destination);s.start();
  S.mono=(await off.startRendering()).getChannelData(0).slice();
  S.an=A.analyse(S.mono);S.plan.bpm=S.an.bpm;S.plan.offset=S.an.offset;
  const c=S.an.candidates[0];S.plan.dropBar=Math.max(S.plan.buildBars,c?c.bar:Math.min(S.an.bars.length-8,32));clampPlan();
  $('trackName').textContent=S.name;$('trackMeta').textContent=`${fmt(buffer.duration)} · ${buffer.sampleRate} Hz · ${S.an.bars.length} bars`;
  for(const id of ['trackPanel','planPanel','machines','dock'])$(id).classList.remove('hidden');$('dropzone').classList.add('loaded');$('dropzone').querySelector('b').textContent='Change song';
  syncUI();drawOverview();invalidate();
  status(`${S.an.bpm} BPM · ${S.an.candidates.length} drop suggestion${S.an.candidates.length===1?'':'s'}. Check that bar 1 sits on the downbeat, then press Play drop.`);
  harmony();
 }catch(e){console.error(e);status('Could not read this file: '+e.message,true);}
}

// AVANTGARDIAN ARP's Chordino engine, off the UI thread when the browser allows it.
function harmony(){
 const lib=$('chordino-lib').textContent,b64=window.DROPFATHER_WASM_B64,bytes=Uint8Array.from(atob(b64),c=>c.charCodeAt(0)),samples=S.mono.slice(),duration=S.mono.length/A.SR,name=S.name;
 $('harmonyStatus').textContent='AVANTGARDIAN analysis …';
 const done=h=>{if(name!==S.name)return;S.harmony=h;const tl=X.timeline(S.plan,S.buffer.duration),pc=A.dominantBass(h,tl.D,tl.D+4*tl.bar);if(pc!=null){S.autoRoot=pc;S.plan.root=pc;}const key=A.dominantBass(h,0,duration);$('harmonyStatus').textContent=`bass at drop ${pc!=null?NOTE[pc]:'?'} · most common bass ${key!=null?NOTE[key]:'?'}`;syncUI();drawOverview();invalidate();};
 const fail=m=>{$('harmonyStatus').textContent='Harmony analysis unavailable ('+m+'). Choose the root by ear.';};
 const onProgress=p=>{$('harmonyStatus').textContent=`AVANTGARDIAN analysis … ${Math.round(p*100)} %`;};
 try{
  const code=lib+`\nonmessage=async e=>{try{const raw=await Chordino.analyse(e.data.samples,22050,p=>postMessage({progress:p}),e.data.wasm);postMessage({result:HarmonyEngine.finish(raw,{bpm:60,offset:0,duration:e.data.duration})});}catch(err){postMessage({error:err.message});}};`;
  const url=URL.createObjectURL(new Blob([code],{type:'text/javascript'})),w=new Worker(url);
  w.onmessage=e=>{if(e.data.progress!=null)onProgress(e.data.progress);if(e.data.error){fail(e.data.error);w.terminate();}if(e.data.result){done(e.data.result);w.terminate();URL.revokeObjectURL(url);}};
  w.onerror=e=>{e.preventDefault();w.terminate();mainThread();};
  w.postMessage({samples,duration,wasm:bytes.buffer},[samples.buffer,bytes.buffer]);
 }catch(e){mainThread();}
 async function mainThread(){try{const raw=await Chordino.analyse(S.mono,22050,onProgress,Uint8Array.from(atob(b64),c=>c.charCodeAt(0)).buffer);done(HarmonyEngine.finish(raw,{bpm:60,offset:0,duration}));}catch(e){fail(e.message);}}
}
const lookupBass=t=>S.harmony?A.bassAt(S.harmony,t):null;

/* ---------- Plan and controls ---------- */
const BUILD=[['hp','High-pass sweep'],['riser','Noise riser'],['pitch','Pitch riser'],['roll','Roll',X.ROLLS],['rollAmt','Roll level'],['stutter','Stutter'],['verb','Reverb wash'],['swell','Volume swell']];
const DELAYSY=Object.fromEntries((window.Delaysy?.presets||[]).map((v,i)=>[i,`${i+1}. ${v.name} · ${v.cat}`])),BASSES=Object.fromEntries(X.bassCatalog().map((v,i)=>[v.id,`${i+1}. ${v.name}`]));
const PRE=[['throw','Echo throw'],['delaysy','DELAYSY preset',DELAYSY],['throwLen','Throw',{0.5:'Last 1/2 beat',1:'Last beat',2:'Last 2 beats',4:'Last bar'}],['reverse','Reverse suck']];
const DROP=[['kick','Kick'],['bassPattern','Bass pattern',Object.fromEntries(Object.entries(X.PATTERNS).map(([k,v])=>[k,v.name]))],['bassPreset','Bass Invaders sound',BASSES],['bassOct','Bass octave',{low:'Low · E1–D♯2',mid:'Mid · one octave up'}],['bass','Bass level'],['follow','Bass follows the song’s bass map',true],['pump','Pump'],['impact','Impact'],['lift','Air'],['song','Song level'],['replaceBass','Replace the song’s own bass',true]];
function controls(box,group,defs){
 const el=$(box);el.replaceChildren();
 for(const [key,label,opt] of defs){
  const id=group+'-'+key,row=document.createElement('div');
  if(opt===true){row.className='check';row.innerHTML=`<input type="checkbox" id="${id}"><label for="${id}"></label>`;row.querySelector('label').textContent=label;row.querySelector('input').onchange=e=>{S.plan[group][key]=e.target.checked;changed();};}
  else if(opt){const long=Object.keys(opt).length>20;row.className='pick'+(long?' browse':'');row.innerHTML=`<label for="${id}"></label><div class="nav">${long?'<button type="button" aria-label="Back 10">«</button><button type="button" aria-label="Previous">‹</button>':''}<select id="${id}"></select>${long?'<button type="button" aria-label="Next">›</button><button type="button" aria-label="Forward 10">»</button>':''}</div>`;row.querySelector('label').textContent=label;const sel=row.querySelector('select');for(const [v,n] of Object.entries(opt))sel.add(new Option(n,v));const set=v=>{S.plan[group][key]=isNaN(+v)?v:+v;changed();};sel.onchange=e=>set(e.target.value);
   if(long)row.querySelectorAll('.nav button').forEach((b,i)=>b.onclick=()=>{const n=sel.options.length,step=[-10,-1,1,10][i];sel.selectedIndex=((sel.selectedIndex+step)%n+n)%n;set(sel.value);});}
  else{row.className='knob';row.innerHTML=`<label for="${id}"></label><input type="range" id="${id}" min="0" max="1" step="0.01"><output></output>`;row.querySelector('label').textContent=label;const r=row.querySelector('input');r.oninput=()=>{S.plan[group][key]=+r.value;row.querySelector('output').textContent=Math.round(r.value*100)+'%';changed(true);};r.onchange=()=>changed();}
  el.append(row);
 }
}
function syncControls(group,defs){for(const [key,,opt] of defs){const el=$(group+'-'+key),v=S.plan[group][key];if(opt===true)el.checked=!!v;else if(opt)el.value=String(v);else{el.value=v;el.nextElementSibling.textContent=Math.round(v*100)+'%';}}}

function clampPlan(){const p=S.plan,max=S.an?S.an.bars.length-2:999;p.dropBar=Math.max(p.buildBars,Math.min(max,p.dropBar));}
function syncUI(){
 const p=S.plan;$('bpm').value=p.bpm;$('dropBar').textContent=p.dropBar+1;$('buildBars').value=p.buildBars;$('gapBeats').value=p.gapBeats;$('dropBars').value=p.dropBars;
 document.querySelectorAll('[data-mode]').forEach(b=>b.classList.toggle('on',b.dataset.mode===p.mode));
 document.querySelectorAll('[data-style]').forEach(b=>b.classList.toggle('on',b.dataset.style===p.style));
 $('root').value=p.root;syncControls('build',BUILD);syncControls('pre',PRE);syncControls('drop',DROP);
 if(S.buffer){const tl=X.timeline(p,S.buffer.duration);$('dropTime').textContent=fmt(tl.D);planText(tl);}
 renderCandidates();
}
function planText(tl){
 const p=S.plan,b=p.build,d=p.drop,first=p.dropBar-p.buildBars+1,parts=[];
 if(b.hp>0)parts.push(`high-pass up to ${Math.round(20*2**(b.hp*6.6))} Hz`);if(b.roll!=='off'&&b.rollAmt>0)parts.push(X.ROLLS[b.roll].toLowerCase());if(b.riser>0)parts.push('noise riser');if(b.pitch>0)parts.push(`pitch riser in ${NOTE[p.root]}`);if(b.stutter>0)parts.push('stutter');
 const gap=p.gapBeats?`${p.gapBeats===4?'one bar':p.gapBeats+' beat'+(p.gapBeats>1?'s':'')} of air`:'no gap';
 const head=p.mode==='replace'?`Bars ${first}–${p.dropBar} become a ${p.buildBars}-bar build-up`:`A new ${p.buildBars}-bar build-up is inserted before bar ${p.dropBar+1} (song +${fmt(tl.shift)})`;
 $('planText').textContent=`${head} (${parts.join(', ')||'plain'}). Pre-drop: ${gap}${p.pre.throw>0?` with DELAYSY echo throw (${(DELAYSY[p.pre.delaysy]||'').replace(/^\d+\. /,'')})`:''}${p.pre.reverse>0?', reverse suck':''}. Drop at bar ${p.dropBar+1}: ${d.kick>0?'kick + ':''}${d.bass>0?X.PATTERNS[d.bassPattern].name.toLowerCase()+' on '+(BASSES[d.bassPreset]||d.bassPreset).replace(/^\d+\. /,'')+(d.follow&&S.harmony?' following the song’s bass':' on '+NOTE[p.root]):'no extra bass'}, pump ${Math.round(d.pump*100)}%, ${p.dropBars} bars.`;
}
function renderCandidates(){
 const box=$('candidates');box.replaceChildren();if(!S.an)return;
 for(const c of S.an.candidates){const b=document.createElement('button');b.textContent=`Bar ${c.bar+1} · ${fmt(c.time)} ${'★'.repeat(c.strength)}${c.fallback?' (loudest part)':''}`;b.classList.toggle('on',c.bar===S.plan.dropBar);b.onclick=()=>{S.plan.dropBar=c.bar;clampPlan();updateRootFromDrop();changed();};box.append(b);}
 if(!S.an.candidates.length)box.textContent='None found. Click the map where the chorus or the big part starts.';
}
function updateRootFromDrop(){if(!S.harmony)return;const tl=X.timeline(S.plan,S.buffer.duration),pc=A.dominantBass(S.harmony,tl.D,tl.D+4*tl.bar);if(pc!=null){S.plan.root=pc;S.autoRoot=pc;}}
function applyStyle(key){const st=JSON.parse(JSON.stringify(X.STYLES[key])),root=S.plan.root;delete st.name;Object.assign(S.plan,st,{style:key,root});clampPlan();changed();}
function changed(light){if(!light)syncUI();else if(S.buffer)planText(X.timeline(S.plan,S.buffer.duration));drawOverview();invalidate();}
function invalidate(){S.dirty=true;S.full=null;clearTimeout(S.timer);S.timer=setTimeout(()=>renderPreview(),350);}

function setTempo(bpm,offset=S.plan.offset){
 if(!S.an||!(bpm>=50&&bpm<=220))return;const oldTime=S.plan.offset+S.plan.dropBar*240/S.plan.bpm,bar=240/bpm;
 offset=((offset%bar)+bar)%bar;S.an=A.regrid(S.an,bpm,offset);S.plan.bpm=bpm;S.plan.offset=offset;S.plan.dropBar=Math.round((oldTime-offset)/bar);clampPlan();changed();
}

/* ---------- Rendering and playback ---------- */
function previewRange(){const tl=X.timeline(S.plan,S.buffer.duration);return {tl,from:Math.max(0,tl.buildOut-2*tl.bar),to:Math.min(tl.outDuration,tl.dropOut+Math.min(S.plan.dropBars,8)*tl.bar+tl.bar)};}
async function renderPreview(){
 if(!S.buffer)return null;const token=++S.token,{from,to}=previewRange();
 try{const r=await X.render(S.buffer,S.plan,{from,to,lookupBass});if(token!==S.token)return null;S.preview=r;S.dirty=false;drawZoom();const pk=20*Math.log10(r.peak||1e-9);const gr=20*Math.log10(r.reduction||1);if(!S.play)status(`Ready · peak ${pk.toFixed(1)} dBFS${gr<-.1?` · drop limiter ${gr.toFixed(1)} dB${gr<-6?' (a lot: lower Kick, Bass or Song level)':''}`:''}`);return r;}
 catch(e){console.error(e);status('Render failed: '+e.message,true);return null;}
}
async function playBuffer(buffer,at,mode,base){
 stop();const ctx=audio(),s=ctx.createBufferSource();s.buffer=buffer;s.connect(S.gain);s.start(ctx.currentTime+.03,Math.max(0,at));
 S.src=s;S.play={start:ctx.currentTime+.03-at,mode,base};s.onended=()=>{if(S.src===s)stop();};tick();
}
function stop(){if(S.src){try{S.src.stop();}catch(e){}S.src=null;}S.play=null;cancelAnimationFrame(S.raf);if(S.preview)drawZoom();drawOverview();}
function position(){return S.play?S.ctx.currentTime-S.play.start:0;}
function tick(){if(!S.play)return;drawZoom();drawOverview();S.raf=requestAnimationFrame(tick);}
async function playDrop(at=0){status('Rendering …');let r=S.preview;if(S.dirty||!r)r=await renderPreview();if(!r)return;playBuffer(r.buffer,at,'preview',r.from);status(`Playing build-up and drop · ${S.plan.mode==='insert'?'insert':'replace'} mode`);}
async function fullRender(){if(S.full)return S.full;status('Rendering the whole song …');S.full=await X.renderSong(S.buffer,S.plan,{lookupBass});return S.full;}
async function playSong(){const r=await fullRender();playBuffer(r.buffer,0,'full',0);status('Playing the whole song with Dropfather');}
function playOriginal(){const {tl}=previewRange();const from=Math.max(0,X.outToSrc(tl,Math.max(0,tl.buildOut-2*tl.bar)));playBuffer(S.buffer,from,'orig',0);status('Playing the original from the same place (A/B)');}

/* ---------- Drawing ---------- */
function sizeCanvas(c){const dpr=window.devicePixelRatio||1,w=c.clientWidth,h=c.clientHeight;if(c.width!==Math.round(w*dpr)||c.height!==Math.round(h*dpr)){c.width=Math.round(w*dpr);c.height=Math.round(h*dpr);}const g=c.getContext('2d');g.setTransform(dpr,0,0,dpr,0,0);return {g,w,h};}
function drawOverview(){
 if(!S.an)return;const c=$('overview'),{g,w,h}=sizeCanvas(c),dur=S.buffer.duration,x=t=>t/dur*w,an=S.an,tl=X.timeline(S.plan,dur),f=an.feat;
 g.clearRect(0,0,w,h);
 for(const b of an.bars){g.fillStyle=b.kind==='break'?'#14243a':b.kind==='silence'?'#000':'#0d0d0d';g.fillRect(x(b.time),0,x(b.time+240/an.bpm)-x(b.time)+1,h);}
 // Regions in song time.
 if(S.plan.mode==='replace'){g.fillStyle='#f3efe433';g.fillRect(x(tl.buildSrc),0,x(tl.D-tl.gap)-x(tl.buildSrc),h);g.fillStyle='#000';g.fillRect(x(tl.D-tl.gap),0,Math.max(2,x(tl.D)-x(tl.D-tl.gap)),h);}
 else{g.fillStyle='#f3efe41c';g.fillRect(x(tl.buildSrc),0,x(tl.D)-x(tl.buildSrc),h);}
 g.fillStyle='#e3201b40';g.fillRect(x(tl.D),0,x(tl.dropEndSrc)-x(tl.D),h);
 // Bar grid.
 for(const b of an.bars){if(b.index%4)continue;g.fillStyle=b.index%16===0?'#ffffff40':'#ffffff18';g.fillRect(Math.round(x(b.time)),0,1,h);if(b.index%16===0&&w>500){g.fillStyle='#ffffff70';g.font='10px Inter,sans-serif';g.fillText(String(b.index+1),x(b.time)+3,11);}}
 // Waveform from frame RMS, low band in red.
 const mid=h*.55,step=Math.max(1,Math.floor(f.frames/w));let maxR=0;for(let i=0;i<f.frames;i++)maxR=Math.max(maxR,f.rms[i]);
 for(let px=0;px<w;px++){const a=Math.floor(px/w*f.frames);let r=0,l=0;for(let i=a;i<a+step&&i<f.frames;i++){r=Math.max(r,f.rms[i]);l=Math.max(l,f.low[i]);}const hr=r/maxR*h*.42,hl=l/maxR*h*.42;g.fillStyle='#bdb8ad';g.fillRect(px,mid-hr,1,hr*2);g.fillStyle='#8a1a16';g.fillRect(px,mid-hl*.6,1,hl*1.2);}
 // Candidates and drop line.
 for(const cd of an.candidates){const cx=x(cd.time);g.fillStyle='#f3efe4';g.beginPath();g.moveTo(cx-6,16);g.lineTo(cx+6,16);g.lineTo(cx,25);g.fill();}
 g.fillStyle='#ff4a3d';g.fillRect(x(tl.D)-1,0,3,h);g.font='bold 12px Inter,sans-serif';g.fillText('DROP',Math.min(w-40,x(tl.D)+5),h-26);
 if(S.plan.mode==='insert'){g.fillStyle='#f3efe4';g.fillText(`+${S.plan.buildBars} bars build`,Math.max(4,x(tl.D)-96),h-26);}
 // Bass lane from ARP analysis.
 if(S.harmony&&w>400){g.font='10px Inter,sans-serif';let last=-1,lastX=-99;for(const s of S.harmony.bassSegments){const sx=x(s.start);if(s.bass!==last&&sx-lastX>18&&s.end-s.start>.4){g.fillStyle='#ffb3ad';g.fillText(NOTE[s.bass],sx+1,h-6);lastX=sx;last=s.bass;}}}
 if(S.play){const t=S.play.mode==='orig'?position():X.outToSrc(tl,S.play.base+position());g.fillStyle='#fff';g.fillRect(x(t),0,2,h);}
}
function drawZoom(){
 const r=S.preview;if(!r)return;const c=$('zoom'),{g,w,h}=sizeCanvas(c),tl=r.tl,len=r.to-r.from,x=t=>(t-r.from)/len*w,d0=r.buffer.getChannelData(0),d1=r.buffer.getChannelData(1),n=r.buffer.length;
 g.clearRect(0,0,w,h);
 const regions=[[tl.buildOut,tl.gapOut,'#f3efe41a','BUILD-UP'],[tl.gapOut,tl.dropOut,'#000','PRE'],[tl.dropOut,tl.dropEndOut,'#e3201b26','DROP']];
 for(const [a,b,col] of regions){g.fillStyle=col;g.fillRect(x(a),0,x(b)-x(a),h);}
 for(let t=tl.dropOut-Math.ceil((tl.dropOut-r.from)/tl.bar)*tl.bar;t<r.to;t+=tl.bar){if(t<r.from)continue;g.fillStyle='#ffffff1c';g.fillRect(Math.round(x(t)),0,1,h);}
 const mid=h/2;
 for(let px=0;px<w;px++){const a=Math.floor(px/w*n),b=Math.floor((px+1)/w*n);let mx=0;for(let i=a;i<b;i+=2)mx=Math.max(mx,Math.abs(d0[i]),Math.abs(d1[i]));const t=r.from+px/w*len,col=t>=tl.dropOut&&t<tl.dropEndOut?'#ff4a3d':t>=tl.buildOut&&t<tl.gapOut?'#f3efe4':'#7c776d';g.fillStyle=col;const hh=Math.min(1,mx)*h*.46;g.fillRect(px,mid-hh,1,hh*2||1);}
 g.font='bold 11px Inter,sans-serif';for(const [a,b,,label] of regions){if(x(b)-x(a)>34){g.fillStyle=label==='DROP'?'#ff4a3d':'#f3efe4';g.fillText(label,x(a)+5,13);}}
 if(S.play&&S.play.mode==='preview'){const t=r.from+position();g.fillStyle='#fff';g.fillRect(x(t),0,2,h);}
}

/* ---------- Export ---------- */
function download(bytes,name,type){const url=URL.createObjectURL(new Blob([bytes],{type})),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),4000);}
const fileBase=()=>`${S.name||'song'} - Dropfather bar ${S.plan.dropBar+1}`;
async function exportSong(){const r=await fullRender();download(X.wav(r.buffer),fileBase()+'.wav','audio/wav');status('Exported the whole song as 24-bit WAV.');}
async function exportSection(){const r=await fullRender(),tl=r.tl;download(X.wav(r.buffer,Math.max(0,tl.buildOut-tl.bar),Math.min(r.buffer.duration,tl.dropEndOut+tl.bar)),fileBase()+' (section).wav','audio/wav');status('Exported build-up + drop (one bar of song on each side).');}
async function exportLayers(){status('Rendering layers …');const r=await X.renderSong(S.buffer,S.plan,{lookupBass,original:false});download(X.wav(r.buffer),fileBase()+' (layers).wav','audio/wav');status('Exported only the Dropfather layers. Line it up with the start of the exported song.');}
async function exportMidi(){const r=await fullRender();download(X.midi(r.events,S.plan.bpm),fileBase()+'.mid','audio/midi');status('Exported MIDI: bass, kick and roll, from the start of the rendered song.');}
function exportPlan(){download(new TextEncoder().encode(JSON.stringify({app:'Dropfather 0.2',track:S.name,plan:S.plan},null,1)),fileBase()+'.json','application/json');}

/* ---------- Wiring ---------- */
function init(){
 controls('buildCtl','build',BUILD);controls('preCtl','pre',PRE);controls('dropCtl','drop',DROP);
 NOTE.forEach((n,i)=>$('root').add(new Option(n,i)));$('root').onchange=e=>{S.plan.root=+e.target.value;changed();};
 const st=$('styles');for(const [k,v] of Object.entries(X.STYLES)){const b=document.createElement('button');b.textContent=v.name;b.dataset.style=k;b.onclick=()=>applyStyle(k);st.append(b);}
 const rnd=document.createElement('button');rnd.textContent='Randomize';rnd.dataset.style='random';rnd.onclick=()=>{const root=S.plan.root;S.plan=X.randomize(S.plan,(Math.random()*2**31)|0);S.plan.root=root;clampPlan();changed();};st.append(rnd);
 const file=$('file'),dz=$('dropzone');file.onchange=()=>file.files[0]&&load(file.files[0]);
 for(const ev of ['dragenter','dragover'])document.addEventListener(ev,e=>{e.preventDefault();dz.classList.add('over');});
 for(const ev of ['dragleave','drop'])document.addEventListener(ev,e=>{e.preventDefault();dz.classList.remove('over');});
 document.addEventListener('drop',e=>{const f=e.dataTransfer.files[0];if(f)load(f);});
 $('bpm').onchange=e=>setTempo(+e.target.value);$('bpmDown').onclick=()=>setTempo(Math.round((S.plan.bpm-1)*100)/100);$('bpmUp').onclick=()=>setTempo(Math.round((S.plan.bpm+1)*100)/100);
 $('bpmHalf').onclick=()=>setTempo(S.plan.bpm/2);$('bpmDouble').onclick=()=>setTempo(S.plan.bpm*2);
 $('tap').onclick=()=>{const now=performance.now();S.taps=S.taps.filter(t=>now-t<3000);S.taps.push(now);if(S.taps.length>=4){const d=(S.taps[S.taps.length-1]-S.taps[0])/(S.taps.length-1);setTempo(Math.round(60000/d*10)/10);}};
 const beat=()=>60/S.plan.bpm;$('gridBeatBack').onclick=()=>setTempo(S.plan.bpm,S.plan.offset-beat());$('gridBeatFwd').onclick=()=>setTempo(S.plan.bpm,S.plan.offset+beat());$('gridBack').onclick=()=>setTempo(S.plan.bpm,S.plan.offset-.01);$('gridFwd').onclick=()=>setTempo(S.plan.bpm,S.plan.offset+.01);
 document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{S.plan.mode=b.dataset.mode;changed();});
 $('barDown').onclick=()=>{S.plan.dropBar--;clampPlan();updateRootFromDrop();changed();};$('barUp').onclick=()=>{S.plan.dropBar++;clampPlan();updateRootFromDrop();changed();};
 for(const k of ['buildBars','gapBeats','dropBars'])$(k).onchange=e=>{S.plan[k]=+e.target.value;clampPlan();changed();};
 $('overview').onclick=e=>{if(!S.an)return;const rect=e.currentTarget.getBoundingClientRect(),t=(e.clientX-rect.left)/rect.width*S.buffer.duration;S.plan.dropBar=Math.round((t-S.plan.offset)/(240/S.plan.bpm));clampPlan();updateRootFromDrop();changed();};
 $('zoom').onclick=e=>{const r=S.preview;if(!r)return;const rect=e.currentTarget.getBoundingClientRect();playDrop((e.clientX-rect.left)/rect.width*(r.to-r.from));};
 $('playDrop').onclick=()=>playDrop(0);$('playSong').onclick=playSong;$('playOrig').onclick=playOriginal;$('stop').onclick=stop;
 $('volume').oninput=e=>{if(S.gain)S.gain.gain.value=+e.target.value;};
 $('exSong').onclick=exportSong;$('exSection').onclick=exportSection;$('exLayers').onclick=exportLayers;$('exMidi').onclick=exportMidi;$('exPlan').onclick=exportPlan;
 document.addEventListener('keydown',e=>{if(e.code==='Space'&&S.buffer&&!/INPUT|SELECT|TEXTAREA|BUTTON/.test(e.target.tagName)){e.preventDefault();S.play?stop():playDrop(0);}});
 window.addEventListener('resize',()=>{drawOverview();drawZoom();});
 syncUI();
 window.Dropfather={S,load};
}
init();
})();
