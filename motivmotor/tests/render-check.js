/* Kjør: node tests/render-check.js – renderer et helt spor i headless Chromium og måler nivåer. */
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--autoplay-policy=no-user-gesture-required'] }).catch(() => chromium.launch());
  const page = await browser.newPage();
  page.on('console', (m) => console.log('[side]', m.text()));
  page.on('pageerror', (e) => console.log('[sidefeil]', e.message));
  await page.setContent('<html><body></body></html>');
  for (const f of ['theory', 'rng', 'midi', 'features', 'harmony', 'melody', 'arrange', 'project', 'synth', 'files']) await page.addScriptTag({ path: path.join(__dirname, '..', 'js', f + '.js') });
  const res = await page.evaluate(async () => {
    const out = {};
    for (const style of ['house', 'trance', 'driving']) {
      const p = MM.project.newProject();
      p.settings.style = style; p.settings.bpm = MM.arrange.STYLES[style].bpm; p.settings.energy = 4; p.settings.lengthMin = 7;
      p.instruments = MM.project.defaultInstruments(style);
      MM.project.makeVariants(p, 3); MM.project.chooseVariant(p, 0); MM.project.buildArrangement(p);
      const t0 = performance.now();
      const buf = await MM.synth.renderOffline(p.arrangement, { instruments: p.instruments, sampleRate: 44100 });
      const ms = performance.now() - t0;
      const d = buf.getChannelData(0);
      // RMS per seksjon
      const secs = p.arrangement.sections.map((s) => {
        const a = Math.floor(s.start * 16 * MM.arrange.secondsPerStep(p.settings.bpm) * 44100);
        const b = Math.floor((s.start + s.bars) * 16 * MM.arrange.secondsPerStep(p.settings.bpm) * 44100);
        let sum = 0, peak = 0;
        for (let i = a; i < b; i += 4) { sum += d[i] * d[i]; peak = Math.max(peak, Math.abs(d[i])); }
        return s.label + ' ' + (20 * Math.log10(Math.sqrt(sum / ((b - a) / 4)) + 1e-9)).toFixed(1) + 'dB';
      });
      let peak = 0, nan = 0, clip = 0;
      for (let i = 0; i < d.length; i++) { const x = d[i]; if (x !== x) nan++; const a = Math.abs(x); if (a > peak) peak = a; if (a >= 0.999) clip++; }
      const wav = MM.files.encodeWav(buf, 16);
      out[style] = { seconds: (buf.length / 44100).toFixed(1), renderMs: Math.round(ms), peak: peak.toFixed(3), clip, nan, wavMB: (wav.byteLength / 1e6).toFixed(1), secs };
    }
    return out;
  });
  console.log(JSON.stringify(res, null, 1));
  await browser.close();
})();
