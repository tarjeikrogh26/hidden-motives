/* Lagrer syntetiske klipp og noen variasjoner som WAV i test/out for lytting/spektrogram. */
const { chromium } = require('playwright');
const path = require('path'); const fs = require('fs');
(async () => {
  const b = await chromium.launch(); const p = await b.newPage();
  await p.goto('file://' + path.resolve(__dirname, '..', 'index.html'));
  await p.waitForFunction(() => window.VK && VK.App);
  await p.evaluate(() => VK.App.synthPack());
  await p.setInputFiles('#file', path.join(__dirname, 'out', 'mock_voice.wav'));
  await p.waitForFunction(() => VK.Pool.clips.length >= 7);
  const files = await p.evaluate(async () => {
    const toB64 = (ab) => { let s = ''; const u = new Uint8Array(ab); for (let i = 0; i < u.length; i += 32768) s += String.fromCharCode.apply(null, u.subarray(i, i + 32768)); return btoa(s); };
    const out = [];
    VK.Pool.clips.forEach((c, i) => { if (c.origin === 'synth') out.push(['synth_' + i + '.wav', toB64(VK.encodeWav([c.buffer.getChannelData(0), c.buffer.getChannelData(c.buffer.numberOfChannels - 1)], 48000, 24))]); });
    for (const [n, st] of [[1, 'house'], [2, 'techno'], [3, 'ebm']]) {
      const settings = Object.assign({}, VK.App.state.settings, { style: st, density: 2, bpm: 125, fx: 0.6 });
      const a = VK.Arranger.arrange(settings, VK.Pool.enabled(), n * 11, n * 13);
      for (const wet of [true, false]) {
        const r = await VK.Render.render({ settings: settings, events: a.events, colorSeed: n }, VK.Pool.byId(), { wet: wet, fold: true });
        out.push(['var' + n + '_' + st + (wet ? '_wet' : '_dry') + '.wav', toB64(VK.encodeWav(r.channels, 48000, 24))]);
      }
    }
    return out;
  });
  for (const [n, d] of files) fs.writeFileSync(path.join(__dirname, 'out', n), Buffer.from(d, 'base64'));
  console.log(files.map((f) => f[0]).join(' '));
  await b.close();
})();
