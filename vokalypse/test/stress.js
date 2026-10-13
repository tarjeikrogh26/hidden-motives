/* Stresstest: mange tilfeldige variasjoner, alle stiler/tettheter/effekter, tørr og behandlet.
   Sjekker eksakt lengde, ingen NaN, ingen klipping og at hvert innslag faktisk gir lyd.
   Kjør: NODE_PATH=$(npm root -g) node vokalypse/test/stress.js [antall] */
const { chromium } = require('playwright');
const path = require('path');
const N = +process.argv[2] || 60;

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  const warn = [];
  p.on('console', (m) => { if (m.type() === 'warning' || m.type() === 'error') warn.push(m.text()); });
  p.on('pageerror', (e) => warn.push('pageerror ' + e.message));
  await p.goto('file://' + path.resolve(__dirname, '..', 'index.html'));
  await p.waitForFunction(() => window.VK && VK.App);
  await p.evaluate(() => VK.App.synthPack());
  // talefil som importert materiale
  await p.setInputFiles('#file', path.join(__dirname, 'out', 'mock_voice.wav'));
  await p.waitForFunction(() => VK.Pool.clips.length >= 7);
  const res = await p.evaluate(async (N) => {
    const styles = ['house', 'techno', 'ebm', 'free'];
    const problems = [];
    let silentEvents = 0, totalEvents = 0;
    const t0 = performance.now();
    for (let s = 1; s <= N; s++) {
      const bpm = [118, 122, 124.5, 127, 130, 133, 138, 145][s % 8];
      const settings = {
        bpm: bpm, root: s % 12, scale: Object.keys(VK.SCALES)[s % 6], style: styles[s % 4], density: s % 5,
        swing: (s % 3) * 0.1, fx: (s % 4) / 3, fold: s % 2 === 0,
        ingredients: { phrase: true, chop: true, stutter: true, choir: true, whisper: true, reverse: true, dive: true, robot: true }
      };
      const a = VK.Arranger.arrange(settings, VK.Pool.enabled(), s * 7919, s * 104729);
      const v = { settings: settings, events: a.events, colorSeed: s };
      const exp = VK.timing(bpm).totalSamples;
      for (const wet of [true, false]) {
        const r = await VK.Render.render(v, VK.Pool.byId(), { wet: wet, fold: settings.fold });
        let bad = 0, peak = 0;
        for (const c of r.channels) for (let i = 0; i < c.length; i++) { if (!isFinite(c[i])) bad++; else peak = Math.max(peak, Math.abs(c[i])); }
        if (r.channels[0].length !== exp || r.channels[1].length !== exp) problems.push(s + (wet ? ' wet' : ' dry') + ': feil lengde');
        if (bad) problems.push(s + (wet ? ' wet' : ' dry') + ': ' + bad + ' NaN');
        if (peak > 1) problems.push(s + ': klipping ' + peak);
        if (r.silent) problems.push(s + (wet ? ' wet' : ' dry') + ': stille');
        // hvert innslag skal høres (sjekk energi i innslagets tidsrom, kun tørr)
        if (!wet) {
          const t = VK.timing(bpm);
          for (const ev of a.events) {
            totalEvents++;
            const s0 = Math.floor(VK.stepTime(ev.step, t, settings.swing) * VK.SR);
            const s1 = Math.min(exp, s0 + Math.floor(ev.lenSteps * t.stepSec * VK.SR));
            let e = 0;
            for (let i = s0; i < s1; i++) e = Math.max(e, Math.abs(r.channels[0][i]) + Math.abs(r.channels[1][i]));
            if (e < 0.01) silentEvents++;
          }
        }
      }
    }
    return { problems: problems, silentEvents: silentEvents, totalEvents: totalEvents, ms: performance.now() - t0 };
  }, N);
  console.log('Variasjoner:', N, '(× tørr og behandlet) på', Math.round(res.ms / 1000), 's');
  console.log('Innslag uten hørbar lyd:', res.silentEvents, 'av', res.totalEvents);
  console.log('Problemer:', res.problems.length ? res.problems : 'ingen');
  console.log('Advarsler i konsollen:', warn.length ? warn.slice(0, 10) : 'ingen');
  await b.close();
  process.exit(res.problems.length || warn.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
