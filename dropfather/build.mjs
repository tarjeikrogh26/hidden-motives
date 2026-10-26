// Builds the single-file app Dropfather.html from src/ (logo and Chordino WASM inlined).
import {readFileSync,writeFileSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const here=dirname(fileURLToPath(import.meta.url)),src=join(here,'src'),read=p=>readFileSync(join(src,p));
let html=read('index.html').toString();
html=html.replace(/\/\*INLINE:([^*]+)\*\//g,(_,p)=>read(p).toString().replace(/<\/script/gi,'<\\/script'));
html=html.replace(/\/\*INLINE-B64:([^*]+)\*\//g,(_,p)=>read(p).toString('base64'));
html=html.replace(/\/\*INLINE-IMG:([^*]+)\*\//g,(_,p)=>'data:image/webp;base64,'+read(p).toString('base64'));
writeFileSync(join(here,'Dropfather.html'),html);
console.log('Dropfather.html',(html.length/1024).toFixed(0),'KB');
