/* Kjør: node tests/listen-check.js
   Lager en låt med kjent fasit, renderer miks og stems, og sjekker hva Basic Pitch-analysen hører. */
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const server = http.createServer((req, res) => {
  const f = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': f.endsWith('.js') ? 'text/javascript' : 'text/html' });
  fs.createReadStream(f).pipe(res);
}).listen(0);
(async () => {
  const port = server.address().port;
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.log('[sidefeil]', e.message));
  await page.goto('http://localhost:' + port + '/tests/blank.html');
  for (const f of ['theory', 'rng', 'midi', 'features', 'harmony', 'melody', 'arrange', 'project', 'synth', 'files', 'listen']) await page.addScriptTag({ url: '/js/' + f + '.js' });
  await page.evaluate(() => { MM.listenBase = '/vendor/'; });
  const res = await page.evaluate(async () => {
    const key = { root: 9, mode: 'minor' };
    const p = MM.project.newProject();
    p.settings.bpm = 126; p.settings.style = 'trance'; p.settings.energy = 3;
    const v = MM.melody.generateVariants({ mode: 'chords', key, bars: 8, style: 'trance', seed: 4,
      src: { chords: { key, bars: 4, chords: [0, 5, 2, 6].map((deg, i) => ({ t: i * 16, len: 16, chord: { deg, q: '' } })) } } })[0];
    const arr = MM.arrange.preview(p.settings, v, p.seeds, { withPluck: true });
    // 2 takter innledning så tempoet kan høres før melodien
    const render = async (solo) => {
      const b = await MM.synth.renderOffline(arr, { instruments: p.instruments, solo, sampleRate: 44100 });
      return b;
    };
    const t0 = performance.now();
    const mix = await render(null), voc = await render('lead'), chd = await render('pluck');
    const log = [];
    const r1 = await MM.listen.analyzeSong({ mix, onProgress: () => {} });
    const r2 = await MM.listen.analyzeSong({ mix, vocal: voc, chords: chd, onProgress: () => {} });
    const r3 = await MM.listen.analyzeSong({ vocal: voc, bpm: 126, onProgress: () => {} });
    const truth = v.notes.map((n) => ({ t: n.t, p: n.p }));
    const score = (lead) => {
      // samsvar: andel fasit-toner med en funnet tone på samme 16-del (±1) og samme tonehøyde (±oktav)
      const P = 8 * 16;
      let hit = 0, total = 0;
      for (let rep = 0; rep < 1; rep++) for (const n of truth) {
        total++;
        if (lead.some((m) => Math.abs((m.t % P) - n.t) <= 1 && (m.p - n.p) % 12 === 0)) hit++;
      }
      const extra = lead.filter((m) => m.t < P && !truth.some((n) => Math.abs(n.t - (m.t % P)) <= 1)).length;
      return { hit: hit + '/' + total, extra };
    };
    const desc = (r) => ({
      bpm: r.bpm, key: MM.theory.keyName(r.key), bars: r.bars,
      chords: r.chords.slice(0, 8).map((c) => MM.theory.chordName(r.key, c.chord) + '@' + c.t / 16 + ':' + c.len / 16).join(' '),
      hits: r.hits && (r.hits.pad ? 'pad' : r.hits.pat.join('')), leadFrom: r.leadFrom, leadN: r.lead.length,
      score: score(r.lead), firstLead: r.lead.slice(0, 6).map((n) => n.t + ':' + MM.theory.noteName(n.p)).join(' '),
    });
    return { secs: Math.round((performance.now() - t0) / 1000), truthFirst: v.notes.slice(0, 6).map((n) => n.t + ':' + MM.theory.noteName(n.p)).join(' '),
      truthChords: MM.harmony.progressionLabel(key, v.chords), backend: window.BP.tf.getBackend(), miks: desc(r1), stems: desc(r2), barevokal: desc(r3), summary: r2.info.summary };
  });
  console.log(JSON.stringify(res, null, 1));
  await browser.close();
  server.close();
})().catch((e) => { console.error(e); process.exit(1); });
