/* Lager én selvstendig HTML-fil (alt JavaScript innebygd) for forhåndsvisning i Claude.
   Bruk: node vokalypse/verktoy/bygg-forhandsvisning.js <utfil.html> */
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
html = html.replace(/<script src="(js\/[^"]+)"><\/script>/g, (m, src) => {
  const code = fs.readFileSync(path.join(root, src), 'utf8').replace(/<\/script/gi, '<\\/script');
  return '<script>\n/* ' + src + ' */\n' + code + '\n</script>';
});
// Claude legger på sitt eget dokumentskjelett; behold bare innholdet
html = html
  .replace(/<!doctype html>\s*/i, '')
  .replace(/<html[^>]*>\s*/i, '').replace(/<\/html>\s*/i, '')
  .replace(/<head>\s*/i, '').replace(/<\/head>\s*/i, '')
  .replace(/<meta charset="utf-8">\s*/i, '').replace(/<meta name="viewport"[^>]*>\s*/i, '')
  .replace(/<body>\s*/i, '').replace(/<\/body>\s*/i, '');
const out = process.argv[2] || path.join(root, 'forhandsvisning.html');
fs.writeFileSync(out, html);
console.log('Skrev', out, Math.round(html.length / 1024) + ' kB');
