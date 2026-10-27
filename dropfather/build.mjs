// Builds the single-file app Dropfather.html from src/ (logo and Chordino WASM inlined).
import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const here=dirname(fileURLToPath(import.meta.url)),src=join(here,'src'),read=p=>readFileSync(join(src,p));
let html=read('index.html').toString();
// Bass Invaders: same script order as its index.html; app.js is replaced by the extracted sound host.
// Recordings are embedded the same way Bass-Invaders.html does it (window.BASS_EMBEDDED_ASSETS).
const bassFiles=['bass-core','bass-body','note-engine','bass-patterns','sound-design','bass-palette','bass-samples','bass-level-data','bass-levels','bass-factory','bass-space','bass-host','bass-balance'];
const wavs=readdirSync(join(src,'vendor/bass-invaders/bass-assets')).filter(f=>f.endsWith('.wav')).sort();
const assets=Object.fromEntries(wavs.map(f=>['bass-assets/'+f,'data:audio/wav;base64,'+read('vendor/bass-invaders/bass-assets/'+f).toString('base64')]));
const bassScripts=[`<script>window.BASS_EMBEDDED_ASSETS=${JSON.stringify(assets)};</script>`,...bassFiles.map(f=>{let code=read(`vendor/bass-invaders/${f}.js`).toString();if(f==='bass-samples'){const before=code;code=code.replace("fetch('bass-assets/'+z.file)","fetch(window.BASS_EMBEDDED_ASSETS['bass-assets/'+z.file])");if(code===before)throw Error('bass-samples fetch patch did not apply');}return '<script>'+code.replace(/<\/script/gi,'<\\/script')+'</script>';})].join('\n');
html=html.replace('<!--BASS-INVADERS-->',()=>bassScripts);
// AVANTGARDIAN ARP lead: same script order as its index.html. The ladder worklet loads from an embedded copy
// (blob URL, data URL as fallback) instead of 'nb-ladder.js'; Bass Invaders registers the same DSP under the same name.
const arpFiles=['performance','voice-output','engine','nb46-presets','nb46-bank','studio-fx','nb-voice','sound-match'],ladder=read('vendor/arp/nb-ladder.js').toString('base64');
const arpScripts=[`<script>window.BassInvadersNoteEngine=window.NoteEngine;window.NB_LADDER_DATA='data:text/javascript;base64,${ladder}';try{window.NB_LADDER_URL=URL.createObjectURL(new Blob([atob('${ladder}')],{type:'text/javascript'}));}catch(e){window.NB_LADDER_URL=window.NB_LADDER_DATA;}</script>`,
 ...arpFiles.map(f=>{let code=read(`vendor/arp/${f}.js`).toString();if(f==='nb-voice'){const before=code;code=code.replace("c.audioWorklet.addModule('nb-ladder.js?v=09')","c.audioWorklet.addModule(window.NB_LADDER_URL).catch(()=>c.audioWorklet.addModule(window.NB_LADDER_DATA))");if(code===before)throw Error('nb-voice ladder patch did not apply');}return '<script>'+code.replace(/<\/script/gi,'<\\/script')+'</script>';}),
 `<script type="application/json" id="arp-patterns">${read('vendor/arp/patterns-4bars.json').toString().replace(/</g,'\\u003c')}</script>`].join('\n');
html=html.replace('<!--ARP-->',()=>arpScripts);
html=html.replace(/\/\*INLINE:([^*]+)\*\//g,(_,p)=>read(p).toString().replace(/<\/script/gi,'<\\/script'));
html=html.replace(/\/\*INLINE-B64:([^*]+)\*\//g,(_,p)=>read(p).toString('base64'));
html=html.replace(/\/\*INLINE-IMG:([^*]+)\*\//g,(_,p)=>'data:image/webp;base64,'+read(p).toString('base64'));
writeFileSync(join(here,'Dropfather.html'),html);
console.log('Dropfather.html',(html.length/1024).toFixed(0),'KB');
