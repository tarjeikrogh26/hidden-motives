// Takes PUMP FICTION's engine into Dropfather as a master chain: its fat machine (three-band saturation, body,
// bite, glue, punch), smart EQ, clipper, limiter and sidechain pump, its analysis with the CLEAN / FAT / WILD
// variants, the one-click macros, presets and pump patterns. Functions are copied as they are, wrapped so each
// chain has its own settings. The page, player, chaos generator and preset files stay in PUMP FICTION.
// Usage: node tools/extract-pumpfiction.mjs pump_fiction_v05.html  → src/vendor/pumpfiction-engine.js
import fs from 'node:fs';
import path from 'node:path';

const src = fs.readFileSync(process.argv[2], 'utf8');
function block(from) {
  let depth = 0, quote = null;
  for (let i = from; i < src.length; i++) {
    const c = src[i];
    if (quote) { if (c === '\\') i++; else if (c === quote) quote = null; continue; }
    if (c === '"' || c === "'" || c === '`') quote = c;
    else if (c === '{' || c === '[') depth++;
    else if (c === '}' || c === ']') { depth--; if (!depth) return src.slice(from, i + 1); }
  }
  throw Error('unclosed block at ' + from);
}
const fn = name => { const at = src.indexOf(`function ${name}(`); if (at < 0) throw Error(name + ' not found'); return src.slice(at, at + block(src.indexOf('{', src.indexOf(')', at))).length + (src.indexOf('{', src.indexOf(')', at)) - at)); };
const lit = name => { const at = src.indexOf(`const ${name}=`); if (at < 0) throw Error(name + ' not found'); return block(src.slice(at).search(/[\[{]/) + at); };
const engine = ['unit', 'levelStepAt', 'gainAt', 'distortion', 'dryWet', 'smartClipCurve', 'makeNodes', 'applyNodes', 'fftSpectrum', 'analyzeBuffer', 'variantSet'].map(fn).join('\n');
const out = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'src', 'vendor', 'pumpfiction-engine.js');
fs.writeFileSync(out, `/* PUMP FICTION v0.5 by Tarjei Krogh: its engine functions, copied unchanged by tools/extract-pumpfiction.mjs.
   PumpFictionEngine(cfg) gives one chain bound to its own settings object. */
window.PumpFictionEngine=function(cfg){
const fclamp=(v,lo,hi)=>Math.min(hi,Math.max(lo,v)),round1=n=>Math.round(n*10)/10,dbfs=x=>20*Math.log10(Math.max(1e-10,x));
${engine}
return {makeNodes,applyNodes,gainAt,analyzeBuffer,variantSet};
};
window.PUMP_FICTION={defaults:${lit('cfg')},patterns:${lit('patterns')},presets:${lit('presets')},macros:${lit('macros')}};
`);
// Check that it loads and the pieces are there.
const win = {}; Function('window', fs.readFileSync(out, 'utf8'))(win);
const e = win.PumpFictionEngine({ ...win.PUMP_FICTION.defaults });
console.log(Object.keys(e).join(', '), '·', win.PUMP_FICTION.presets.length, 'presets ·', win.PUMP_FICTION.patterns.length, 'patterns ·', Object.keys(win.PUMP_FICTION.macros).join('/'), '→', out, fs.statSync(out).size, 'bytes');
