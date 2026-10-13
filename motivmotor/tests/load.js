// Laster appens moduler i Node (de fester seg på globalThis.MM).
const path = require('path');
for (const f of ['theory', 'rng', 'midi', 'features', 'harmony', 'melody', 'arrange', 'styles', 'listen', 'project']) {
  try { require(path.join(__dirname, '..', 'js', f + '.js')); } catch (e) { if (e.code !== 'MODULE_NOT_FOUND') throw e; }
}
module.exports = globalThis.MM;
