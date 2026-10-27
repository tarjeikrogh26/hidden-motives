/* Dropfather UI: load a song, choose where the new part goes and which bars the drop is made of, listen and export. */
(()=>{'use strict';
const $=id=>document.getElementById(id),A=DropAnalysis,X=DropDSP,NOTE=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const S={ctx:null,gain:null,buffer:null,name:'',mono:null,an:null,harmony:null,roots:null,arpDone:false,pick:'insert',plan:X.defaultPlan(),preview:null,full:null,src:null,play:null,dirty:true,token:0,timer:null,taps:[]};
const fmt=t=>{t=Math.max(0,t);const m=Math.floor(t/60),s=t-m*60;return m+':'+(s<10?'0':'')+s.toFixed(1);};
const status=(text,bad)=>{$('status').textContent=text;$('status').style.color=bad?'#ff6a5e':'';};

function audio(){if(!S.ctx){S.ctx=new (window.AudioContext||window.webkitAudioContext)();S.gain=S.ctx.createGain();S.gain.gain.value=+$('volume').value;S.gain.connect(S.ctx.destination);}if(S.ctx.state==='suspended')S.ctx.resume();return S.ctx;}

/* ---------- Loading and analysis ---------- */
async function load(file){
 stop();status('Reading '+file.name+' …');
 try{
  const ctx=audio(),data=await file.arrayBuffer(),buffer=await ctx.decodeAudioData(data);
  S.buffer=buffer;S.name=file.name.replace(/\.[^.]+$/,'');S.harmony=S.roots=null;S.arpDone=false;S.preview=S.full=null;
  status('Finding tempo, bars and drop points …');await new Promise(r=>setTimeout(r,30));
  const off=new OfflineAudioContext(1,Math.ceil(buffer.duration*A.SR),A.SR),s=off.createBufferSource();s.buffer=buffer;s.connect(off.destination);s.start();
  S.mono=(await off.startRendering()).getChannelData(0).slice();
  S.an=A.analyse(S.mono);S.plan.bpm=S.an.bpm;S.plan.offset=S.an.offset;
  const c=S.an.candidates[0],bar=c?c.bar:Math.min(S.an.bars.length-8,32);S.plan.insertBar=bar;S.plan.srcBar=bar;clampPlan();
  $('trackName').textContent=S.name;$('trackMeta').textContent=`${fmt(buffer.duration)} · ${buffer.sampleRate} Hz · ${S.an.bars.length} bars`;
  for(const id of ['trackPanel','planPanel','machines','dock'])$(id).classList.remove('hidden');$('dropzone').classList.add('loaded');$('dropzone').querySelector('b').textContent='Change song';
  syncUI();drawOverview();invalidate();
  status(`${S.an.bpm} BPM · waiting for the ARP analysis: the bass follows it, so nothing renders before it is done.`);
  harmony();
 }catch(e){console.error(e);status('Could not read this file: '+e.message,true);}
}

// AVANTGARDIAN ARP's Chordino engine, off the UI thread when the browser allows it.
function harmony(){
 const lib=$('chordino-lib').textContent,b64=window.DROPFATHER_WASM_B64,bytes=Uint8Array.from(atob(b64),c=>c.charCodeAt(0)),samples=S.mono.slice(),duration=S.mono.length/A.SR,name=S.name;
 $('harmonyStatus').textContent='analysing …';
 // ARP's own root notes: the chord sections' roots, silent sections left out (as its "listen to roots only").
 const done=h=>{if(name!==S.name)return;S.harmony=h;S.roots=h.segments.filter(s=>!s.silent&&s.end>s.start).map(s=>({start:s.start,end:s.end,root:s.root}));S.arpDone=true;$('harmonyStatus').textContent='ready';syncUI();drawOverview();invalidate();};
 const fail=m=>{if(name!==S.name)return;S.arpDone=true;S.roots=null;$('harmonyStatus').textContent='failed: no bass ('+m+')';syncUI();invalidate();};
 const onProgress=p=>{$('harmonyStatus').textContent=`analysing … ${Math.round(p*100)} %`;};
 try{
  const code=lib+`\nonmessage=async e=>{try{const raw=await Chordino.analyse(e.data.samples,22050,p=>postMessage({progress:p}),e.data.wasm);postMessage({result:HarmonyEngine.finish(raw,{bpm:60,offset:0,duration:e.data.duration})});}catch(err){postMessage({error:err.message});}};`;
  const url=URL.createObjectURL(new Blob([code],{type:'text/javascript'})),w=new Worker(url);
  w.onmessage=e=>{if(e.data.progress!=null)onProgress(e.data.progress);if(e.data.error){fail(e.data.error);w.terminate();}if(e.data.result){done(e.data.result);w.terminate();URL.revokeObjectURL(url);}};
  w.onerror=e=>{e.preventDefault();w.terminate();mainThread();};
  w.postMessage({samples,duration,wasm:bytes.buffer},[samples.buffer,bytes.buffer]);
 }catch(e){mainThread();}
 async function mainThread(){try{const raw=await Chordino.analyse(S.mono,22050,onProgress,Uint8Array.from(atob(b64),c=>c.charCodeAt(0)).buffer);done(HarmonyEngine.finish(raw,{bpm:60,offset:0,duration}));}catch(e){fail(e.message);}}
}

/* ---------- Plan and controls ---------- */
const BUILD=[['hp','High-pass sweep'],['riser','Noise riser'],['pitch','Pitch riser'],['roll','Roll',X.ROLLS],['rollAmt','Roll level'],['stutter','Stutter'],['verb','Reverb wash'],['swell','Volume swell']];
const DELAYSY=Object.fromEntries((window.Delaysy?.presets||[]).map((v,i)=>[i,`${i+1}. ${v.name} · ${v.cat}`])),BASSES=Object.fromEntries(X.bassCatalog().map((v,i)=>[v.id,`${i+1}. ${v.name}`]));
const PRE=[['throw','Echo throw'],['delaysy','DELAYSY preset',DELAYSY],['throwLen','Throw',{0.5:'Last 1/2 beat',1:'Last beat',2:'Last 2 beats',4:'Last bar'}],['reverse','Reverse suck']];
const DROP=[['kick','Kick'],['bassPattern','Bass pattern',Object.fromEntries(Object.entries(X.PATTERNS).map(([k,v])=>[k,v.name]))],['bassPreset','Bass Invaders sound',BASSES],['bassOct','Bass octave',{low:'Low · E1–D♯2',mid:'Mid · one octave up'}],['bass','Bass level'],['pump','Pump'],['impact','Impact'],['lift','Air'],['song','Material level'],['cutBass','Cut the material’s own bass',true]];
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

function clampPlan(){const p=S.plan,n=S.an?S.an.bars.length:999;p.insertBar=Math.max(p.buildBars,Math.min(n,p.insertBar));p.srcBar=Math.max(0,Math.min(n-1,p.srcBar));}
const rootsIn=(a,b)=>{if(!S.roots)return [];const out=[];for(const r of S.roots)if(r.end>a&&r.start<b&&out[out.length-1]!==r.root)out.push(r.root);return out;};
function syncUI(){
 const p=S.plan;$('bpm').value=p.bpm;$('insertBar').textContent=p.insertBar+1;$('srcBar').textContent=`${p.srcBar+1}–${p.srcBar+p.srcBars}`;$('srcBars').value=p.srcBars;$('buildBars').value=p.buildBars;$('gapBeats').value=p.gapBeats;$('dropBars').value=p.dropBars;
 document.querySelectorAll('[data-pick]').forEach(b=>b.classList.toggle('on',b.dataset.pick===S.pick));
 document.querySelectorAll('[data-style]').forEach(b=>b.classList.toggle('on',b.dataset.style===p.style));
 syncControls('build',BUILD);syncControls('pre',PRE);syncControls('drop',DROP);
 if(S.buffer){const tl=X.timeline(p,S.buffer.duration);$('insTime').textContent=fmt(tl.D);planText(tl);}
 renderCandidates();
}
function planText(tl){
 const p=S.plan,b=p.build,d=p.drop,parts=[],roots=rootsIn(tl.srcStart,tl.srcEnd).map(r=>NOTE[r]).join(' · ');
 if(b.hp>0)parts.push(`high-pass up to ${Math.round(20*2**(b.hp*6.6))} Hz`);if(b.roll!=='off'&&b.rollAmt>0)parts.push(X.ROLLS[b.roll].toLowerCase());if(b.riser>0)parts.push('noise riser');if(b.pitch>0&&S.roots)parts.push('pitch riser on the first ARP root');if(b.stutter>0)parts.push('stutter');
 const gap=p.gapBeats?`${p.gapBeats===4?'one bar':p.gapBeats+' beat'+(p.gapBeats>1?'s':'')} of air`:'no gap';
 const bass=!S.arpDone?'bass waits for the ARP analysis':!S.roots?'no bass (the ARP analysis failed)':d.bass>0?`${X.PATTERNS[d.bassPattern].name.toLowerCase()} on ${(BASSES[d.bassPreset]||d.bassPreset).replace(/^\d+\. /,'')}, playing ARP's roots ${roots||'(none found in these bars)'}`:'no bass';
 $('planText').textContent=`The song plays to bar ${p.insertBar+1}, then the new part: a ${p.buildBars}-bar build-up from bars ${p.insertBar-p.buildBars+1}–${p.insertBar} (${parts.join(', ')||'plain'}), pre-drop with ${gap}${p.pre.throw>0?` and a DELAYSY echo throw (${(DELAYSY[p.pre.delaysy]||'').replace(/^\d+\. /,'')})`:''}, then a ${p.dropBars}-bar drop made of bars ${p.srcBar+1}–${p.srcBar+p.srcBars}: ${d.kick>0?'kick, ':''}${bass}. After it the song carries on from bar ${p.insertBar+1}. The song gets ${fmt(tl.shift)} longer.`;
}
function renderCandidates(){
 const box=$('candidates');box.replaceChildren();if(!S.an)return;
 for(const c of S.an.candidates){const b=document.createElement('button');b.textContent=`Bar ${c.bar+1} · ${fmt(c.time)} ${'★'.repeat(c.strength)}${c.fallback?' (loudest part)':''}`;b.title='New part here, made of the bars that start here';b.classList.toggle('on',c.bar===S.plan.insertBar&&c.bar===S.plan.srcBar);b.onclick=()=>{S.plan.insertBar=c.bar;S.plan.srcBar=c.bar;clampPlan();changed();};box.append(b);}
 if(!S.an.candidates.length)box.textContent='None found. Click the map where the chorus or the big part starts.';
}
function applyStyle(key){const st=JSON.parse(JSON.stringify(X.STYLES[key]));delete st.name;Object.assign(S.plan,st,{style:key});clampPlan();changed();}
function changed(light){if(!light)syncUI();else if(S.buffer)planText(X.timeline(S.plan,S.buffer.duration));drawOverview();invalidate();}
function invalidate(){S.dirty=true;S.full=null;clearTimeout(S.timer);if(S.arpDone)S.timer=setTimeout(()=>renderPreview(),350);}

function setTempo(bpm,offset=S.plan.offset){
 if(!S.an||!(bpm>=50&&bpm<=220))return;const old=240/S.plan.bpm,ins=S.plan.offset+S.plan.insertBar*old,src=S.plan.offset+S.plan.srcBar*old,bar=240/bpm;
 offset=((offset%bar)+bar)%bar;S.an=A.regrid(S.an,bpm,offset);S.plan.bpm=bpm;S.plan.offset=offset;S.plan.insertBar=Math.round((ins-offset)/bar);S.plan.srcBar=Math.round((src-offset)/bar);clampPlan();changed();
}

/* ---------- Rendering and playback ---------- */
function previewRange(){const tl=X.timeline(S.plan,S.buffer.duration);return {tl,from:Math.max(0,tl.buildOut-2*tl.bar),to:Math.min(tl.outDuration,tl.dropOut+Math.min(S.plan.dropBars,8)*tl.bar+tl.bar)};}
async function renderPreview(){
 if(!S.buffer)return null;const token=++S.token,{from,to}=previewRange();
 try{const r=await X.render(S.buffer,S.plan,{from,to,roots:S.roots});if(token!==S.token)return null;S.preview=r;S.dirty=false;drawZoom();const pk=20*Math.log10(r.peak||1e-9);const gr=20*Math.log10(r.reduction||1);if(!S.play)status(`Ready · peak ${pk.toFixed(1)} dBFS${gr<-.1?` · drop limiter ${gr.toFixed(1)} dB${gr<-6?' (a lot: lower Kick, Bass or Song level)':''}`:''}`);return r;}
 catch(e){console.error(e);status('Render failed: '+e.message,true);return null;}
}
async function playBuffer(buffer,at,mode,base){
 stop();const ctx=audio(),s=ctx.createBufferSource();s.buffer=buffer;s.connect(S.gain);s.start(ctx.currentTime+.03,Math.max(0,at));
 S.src=s;S.play={start:ctx.currentTime+.03-at,mode,base};s.onended=()=>{if(S.src===s)stop();};tick();
}
function stop(){if(S.src){try{S.src.stop();}catch(e){}S.src=null;}S.play=null;cancelAnimationFrame(S.raf);if(S.preview)drawZoom();drawOverview();}
function position(){return S.play?S.ctx.currentTime-S.play.start:0;}
function tick(){if(!S.play)return;drawZoom();drawOverview();S.raf=requestAnimationFrame(tick);}
async function playDrop(at=0){if(!S.arpDone){status('Still waiting for the ARP analysis. The bass follows it, so the new part is not rendered yet.');return;}status('Rendering …');let r=S.preview;if(S.dirty||!r)r=await renderPreview();if(!r)return;playBuffer(r.buffer,at,'preview',r.from);status('Playing the new part: build-up, pre-drop and drop');}
async function fullRender(){if(S.full)return S.full;status('Rendering the whole song …');if(!S.arpDone)throw Error('waiting for the ARP analysis');S.full=await X.renderSong(S.buffer,S.plan,{roots:S.roots});return S.full;}
async function playSong(){if(!S.arpDone){status('Still waiting for the ARP analysis.');return;}const r=await fullRender();playBuffer(r.buffer,0,'full',0);status('Playing the whole song with Dropfather');}
function playOriginal(){const tl=X.timeline(S.plan,S.buffer.duration);playBuffer(S.buffer,tl.srcStart,'orig',0);status(`Playing the original bars ${S.plan.srcBar+1}–${S.plan.srcBar+S.plan.srcBars}, the drop material, as they are in the song`);}

/* ---------- Drawing ---------- */
function sizeCanvas(c){const dpr=window.devicePixelRatio||1,w=c.clientWidth,h=c.clientHeight;if(c.width!==Math.round(w*dpr)||c.height!==Math.round(h*dpr)){c.width=Math.round(w*dpr);c.height=Math.round(h*dpr);}const g=c.getContext('2d');g.setTransform(dpr,0,0,dpr,0,0);return {g,w,h};}
function drawOverview(){
 if(!S.an)return;const c=$('overview'),{g,w,h}=sizeCanvas(c),dur=S.buffer.duration,x=t=>t/dur*w,an=S.an,tl=X.timeline(S.plan,dur),f=an.feat;
 g.clearRect(0,0,w,h);
 for(const b of an.bars){g.fillStyle=b.kind==='break'?'#14243a':b.kind==='silence'?'#000':'#0d0d0d';g.fillRect(x(b.time),0,x(b.time+240/an.bpm)-x(b.time)+1,h);}
 // Regions in song time: build-up material, drop material, and the insert point.
 g.fillStyle='#f3efe41c';g.fillRect(x(tl.buildSrc),0,x(tl.D)-x(tl.buildSrc),h);
 g.fillStyle='#e3201b40';g.fillRect(x(tl.srcStart),0,x(tl.srcEnd)-x(tl.srcStart),h);g.strokeStyle='#ff4a3d';g.lineWidth=2;g.strokeRect(x(tl.srcStart)+1,1,x(tl.srcEnd)-x(tl.srcStart)-2,h-2);
 // Bar grid.
 for(const b of an.bars){if(b.index%4)continue;g.fillStyle=b.index%16===0?'#ffffff40':'#ffffff18';g.fillRect(Math.round(x(b.time)),0,1,h);if(b.index%16===0&&w>500){g.fillStyle='#ffffff70';g.font='10px Inter,sans-serif';g.fillText(String(b.index+1),x(b.time)+3,11);}}
 // Waveform from frame RMS, low band in red.
 const mid=h*.55,step=Math.max(1,Math.floor(f.frames/w));let maxR=0;for(let i=0;i<f.frames;i++)maxR=Math.max(maxR,f.rms[i]);
 for(let px=0;px<w;px++){const a=Math.floor(px/w*f.frames);let r=0,l=0;for(let i=a;i<a+step&&i<f.frames;i++){r=Math.max(r,f.rms[i]);l=Math.max(l,f.low[i]);}const hr=r/maxR*h*.42,hl=l/maxR*h*.42;g.fillStyle='#bdb8ad';g.fillRect(px,mid-hr,1,hr*2);g.fillStyle='#8a1a16';g.fillRect(px,mid-hl*.6,1,hl*1.2);}
 // Candidates and drop line.
 for(const cd of an.candidates){const cx=x(cd.time);g.fillStyle='#f3efe4';g.beginPath();g.moveTo(cx-6,16);g.lineTo(cx+6,16);g.lineTo(cx,25);g.fill();}
 g.font='bold 12px Inter,sans-serif';g.fillStyle='#ff4a3d';g.fillText('DROP MATERIAL',Math.min(w-110,x(tl.srcStart)+5),h-40);
 g.fillStyle='#f3efe4';g.fillRect(x(tl.D)-1,0,3,h);g.fillText('NEW PART',Math.min(w-75,x(tl.D)+5),38);
 // ARP roots lane: the notes the drop bass may play.
 if(S.roots&&w>400){g.font='10px Inter,sans-serif';let last=-1,lastX=-99;for(const s of S.roots){const sx=x(s.start);if(s.root!==last&&sx-lastX>18&&s.end-s.start>.4){g.fillStyle='#ffb3ad';g.fillText(NOTE[s.root],sx+1,h-6);lastX=sx;last=s.root;}}}
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
// Inside a claude.ai artifact files go through the downloads capability, which takes zip but not wav/mid,
// so those are packed into a zip there. Opened as a local file, the browser saves them directly.
const saver=window.claude?.use?window.claude.use('downloads').catch(()=>null):Promise.resolve(null);
const CRC=Array.from({length:256},(_,n)=>{for(let k=0;k<8;k++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
function zip(name,bytes){
 let crc=~0;for(let i=0;i<bytes.length;i++)crc=CRC[(crc^bytes[i])&255]^(crc>>>8);crc=~crc>>>0;
 const n=new TextEncoder().encode(name),head=(sig,extra)=>{const h=new DataView(new ArrayBuffer(extra));h.setUint32(0,sig,true);return h;};
 const local=head(0x04034b50,30+n.length);local.setUint16(4,20,true);local.setUint16(6,0x800,true);local.setUint32(14,crc,true);local.setUint32(18,bytes.length,true);local.setUint32(22,bytes.length,true);local.setUint16(26,n.length,true);new Uint8Array(local.buffer).set(n,30);
 const central=head(0x02014b50,46+n.length);central.setUint16(4,20,true);central.setUint16(6,20,true);central.setUint16(8,0x800,true);central.setUint32(16,crc,true);central.setUint32(20,bytes.length,true);central.setUint32(24,bytes.length,true);central.setUint16(28,n.length,true);new Uint8Array(central.buffer).set(n,46);
 const end=head(0x06054b50,22);end.setUint16(8,1,true);end.setUint16(10,1,true);end.setUint32(12,central.byteLength,true);end.setUint32(16,local.byteLength+bytes.length,true);
 return new Blob([local.buffer,bytes,central.buffer,end.buffer]);
}
async function download(bytes,name,type){
 const downloads=await saver;
 if(downloads){const packed=!/\.(json|txt|csv|zip)$/.test(name);try{await downloads.save({filename:packed?name.replace(/\.[^.]+$/,'')+'.zip':name,data:packed?zip(name,bytes):new Blob([bytes])});return true;}catch(e){status(e?.code==='declined'?'Save cancelled.':'Could not save: '+(e?.message||e?.code||e),e?.code!=='declined');return false;}}
 const url=URL.createObjectURL(new Blob([bytes],{type})),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),4000);return true;
}
const fileBase=()=>`${S.name||'song'} - Dropfather bar ${S.plan.insertBar+1}`;
async function exportSong(){const r=await fullRender();if(await download(X.wav(r.buffer),fileBase()+'.wav','audio/wav'))status('Exported the whole song as 24-bit WAV.');}
async function exportSection(){const r=await fullRender(),tl=r.tl;if(await download(X.wav(r.buffer,tl.buildOut,tl.dropEndOut),fileBase()+' (new part).wav','audio/wav'))status('Exported the new part alone: build-up, pre-drop and drop, bar-exact.');}
async function exportLayers(){status('Rendering layers …');if(!S.arpDone){status('Still waiting for the ARP analysis.');return;}const r=await X.renderSong(S.buffer,S.plan,{roots:S.roots,original:false});if(await download(X.wav(r.buffer),fileBase()+' (layers).wav','audio/wav'))status('Exported only the Dropfather layers. Line it up with the start of the exported song.');}
async function exportMidi(){const r=await fullRender();if(await download(X.midi(r.events,S.plan.bpm),fileBase()+'.mid','audio/midi'))status('Exported MIDI: bass, kick and roll, from the start of the rendered song.');}
function exportPlan(){return download(new TextEncoder().encode(JSON.stringify({app:'Dropfather 0.3',track:S.name,plan:S.plan},null,1)),fileBase()+'.json','application/json');}

/* ---------- Wiring ---------- */
function init(){
 controls('buildCtl','build',BUILD);controls('preCtl','pre',PRE);controls('dropCtl','drop',DROP);
 const st=$('styles');for(const [k,v] of Object.entries(X.STYLES)){const b=document.createElement('button');b.textContent=v.name;b.dataset.style=k;b.onclick=()=>applyStyle(k);st.append(b);}
 const rnd=document.createElement('button');rnd.textContent='Randomize';rnd.dataset.style='random';rnd.onclick=()=>{S.plan=X.randomize(S.plan,(Math.random()*2**31)|0);clampPlan();changed();};st.append(rnd);
 const file=$('file'),dz=$('dropzone');file.onchange=()=>file.files[0]&&load(file.files[0]);
 for(const ev of ['dragenter','dragover'])document.addEventListener(ev,e=>{e.preventDefault();dz.classList.add('over');});
 for(const ev of ['dragleave','drop'])document.addEventListener(ev,e=>{e.preventDefault();dz.classList.remove('over');});
 document.addEventListener('drop',e=>{const f=e.dataTransfer.files[0];if(f)load(f);});
 $('bpm').onchange=e=>setTempo(+e.target.value);$('bpmDown').onclick=()=>setTempo(Math.round((S.plan.bpm-1)*100)/100);$('bpmUp').onclick=()=>setTempo(Math.round((S.plan.bpm+1)*100)/100);
 $('bpmHalf').onclick=()=>setTempo(S.plan.bpm/2);$('bpmDouble').onclick=()=>setTempo(S.plan.bpm*2);
 $('tap').onclick=()=>{const now=performance.now();S.taps=S.taps.filter(t=>now-t<3000);S.taps.push(now);if(S.taps.length>=4){const d=(S.taps[S.taps.length-1]-S.taps[0])/(S.taps.length-1);setTempo(Math.round(60000/d*10)/10);}};
 const beat=()=>60/S.plan.bpm;$('gridBeatBack').onclick=()=>setTempo(S.plan.bpm,S.plan.offset-beat());$('gridBeatFwd').onclick=()=>setTempo(S.plan.bpm,S.plan.offset+beat());$('gridBack').onclick=()=>setTempo(S.plan.bpm,S.plan.offset-.01);$('gridFwd').onclick=()=>setTempo(S.plan.bpm,S.plan.offset+.01);
 document.querySelectorAll('[data-pick]').forEach(b=>b.onclick=()=>{S.pick=b.dataset.pick;syncUI();});
 const nudge=(k,d)=>()=>{S.plan[k]+=d;clampPlan();changed();};$('insDown').onclick=nudge('insertBar',-1);$('insUp').onclick=nudge('insertBar',1);$('srcDown').onclick=nudge('srcBar',-1);$('srcUp').onclick=nudge('srcBar',1);
 for(const k of ['buildBars','gapBeats','dropBars','srcBars'])$(k).onchange=e=>{S.plan[k]=+e.target.value;clampPlan();changed();};
 $('overview').onclick=e=>{if(!S.an)return;const rect=e.currentTarget.getBoundingClientRect(),t=(e.clientX-rect.left)/rect.width*S.buffer.duration;S.plan[S.pick==='src'?'srcBar':'insertBar']=Math.floor((t-S.plan.offset)/(240/S.plan.bpm)+.5);clampPlan();changed();};
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
