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
html=html.replace(/\/\*INLINE:([^*]+)\*\//g,(_,p)=>read(p).toString().replace(/<\/script/gi,'<\\/script'));
html=html.replace(/\/\*INLINE-B64:([^*]+)\*\//g,(_,p)=>read(p).toString('base64'));
html=html.replace(/\/\*INLINE-IMG:([^*]+)\*\//g,(_,p)=>'data:image/webp;base64,'+read(p).toString('base64'));
writeFileSync(join(here,'Dropfather.html'),html);
console.log('Dropfather.html',(html.length/1024).toFixed(0),'KB');
