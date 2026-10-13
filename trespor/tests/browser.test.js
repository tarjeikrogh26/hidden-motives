/* Røyktest i ekte nettleser (headless Chromium via Playwright):
   laster appen, spiller, tar opp en fremføring med kontrollendringer, rendrer og sjekker lyd, stems og MIDI.
   Kjør: node tests/browser.test.js   (krever playwright) */
const path = require('path');
let pw;
try { pw = require('playwright'); } catch (e) { pw = require('/opt/node22/lib/node_modules/playwright'); }
/* BROWSER=webkit tester med samme motor som Safari på Mac og iPhone */
const engineName = process.env.BROWSER || 'chromium';
const chromium = pw[engineName];

const url = process.env.URL || ('file://' + path.resolve(__dirname, '..', 'index.html'));
const shots = process.env.SHOTS || '';
let failed = 0;
function ok(cond, msg) { console.log((cond ? 'ok   ' : 'FEIL ') + msg); if (!cond) failed++; }

(async () => {
  const exe = process.env.CHROMIUM || undefined;
  const browser = await chromium.launch(engineName === 'chromium' ? { executablePath: exe, args: ['--autoplay-policy=no-user-gesture-required'] } : {});
  console.log('nettlesermotor: ' + engineName + ' ' + browser.version());
  const page = await browser.newPage({ viewport: { width: 1400, height: 950 } });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error' && !/manifest|favicon|ERR_FILE/.test(m.text())) errors.push(m.text()); });
  await page.goto(url);
  await page.waitForSelector('.top');
  ok(errors.length === 0, 'laster uten feil ' + errors.join(' | '));

  /* spill i 3 sekunder */
  await page.click('.play');
  await page.waitForTimeout(3000);
  const st = await page.evaluate(() => ({ playing: TS.app.playing, step: TS.app.engine.nextStep, ctx: TS.app.ctx.state }));
  ok(st.playing && st.step > 20, 'spiller (steg ' + st.step + ', ctx ' + st.ctx + ')');
  if (shots) await page.screenshot({ path: shots + '/desktop.png', fullPage: true });

  /* opptak: start, skru på kontroller, stopp */
  const rec = await page.evaluate(async () => {
    const A = TS.app, wait = ms => new Promise(r => setTimeout(r, ms));
    A.toggleRec();
    while (!A.rec) await wait(20);
    await wait(500);
    A.commit(['tracks', 'synth', 'macros', 'intensity'], 0.9);
    A.commit(['song', 'bpm'], 128);
    await wait(700);
    A.commit(['tracks', 'bass', 'macros', 'density'], 0.85);
    A.commit(['synths', 'synth', 'cutoff'], 3000);
    await wait(900);
    A.undo();
    await wait(600);
    A.toggleRec();
    const r = A.recordings[A.recordings.length - 1];
    return { n: A.recordings.length, steps: r.steps, changes: r.changes.length };
  });
  ok(rec.n === 1 && rec.steps > 16 && rec.changes >= 4, 'opptak lagret: ' + JSON.stringify(rec));

  /* render opptaket to ganger: skal bli identisk */
  const res = await page.evaluate(async () => {
    const A = TS.app;
    function rms(a) { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * a[i]; return Math.sqrt(s / a.length); }
    function peak(a) { let m = 0; for (let i = 0; i < a.length; i++) m = Math.max(m, Math.abs(a[i])); return m; }
    const r1 = await A.renderRecording(0);
    const f = r1.files;
    const out = {};
    for (const k of ['mix', 'drums', 'bass', 'synth']) {
      const d = f[k].data;
      out[k] = { bytes: d.length, riff: String.fromCharCode(d[0], d[1], d[2], d[3]) };
    }
    out.midiHead = String.fromCharCode(...f.midi.data.slice(0, 4));
    out.midiLen = f.midi.data.length;
    /* lydnivå per stem, og to renderinger av samme opptak: notene skal være identiske,
       lyden lik ned til nettleserens avrundingsstøy (under -80 dB) */
    const job = () => TS.render({ startState: A.recordings[0].startState, startStep: A.recordings[0].startStep, steps: A.recordings[0].steps, changes: A.recordings[0].changes, samples: A.drumBuffers(), loop: null });
    const raw = await job(), raw2 = await job();
    let md = 0; const x = raw.audio.mix[0], y = raw2.audio.mix[0];
    for (let i = 0; i < x.length; i++) md = Math.max(md, Math.abs(x[i] - y[i]));
    out.deterministic = JSON.stringify(raw.notes) === JSON.stringify(raw2.notes) && x.length === y.length && md < 1e-4;
    out.maxDiff = md;
    out.levels = {};
    for (const k of ['mix', 'drums', 'bass', 'synth']) out.levels[k] = { rms: +rms(raw.audio[k][0]).toFixed(4), peak: +peak(raw.audio[k][0]).toFixed(3) };
    out.notes = raw.notes.length;
    out.tempos = raw.tempos;
    out.zip = A.zipExport().length;
    return out;
  });
  ok(res.mix.riff === 'RIFF' && res.mix.bytes > 100000, 'WAV miks ' + res.mix.bytes + ' byte');
  ok(['drums', 'bass', 'synth'].every(k => res.levels[k].rms > 0.005), 'alle stems har lyd ' + JSON.stringify(res.levels));
  ok(res.levels.mix.peak <= 1.0, 'miksen klipper ikke (topp ' + res.levels.mix.peak + ')');
  ok(res.midiHead === 'MThd' && res.notes > 20, 'MIDI ' + res.midiLen + ' byte, ' + res.notes + ' noter');
  ok(res.tempos.length >= 2, 'tempoendring med i opptaket ' + JSON.stringify(res.tempos));
  ok(res.deterministic, 'samme opptak gir samme noter og lyd (avvik ' + res.maxDiff.toExponential(1) + ')');
  ok(res.zip > res.mix.bytes, 'zip ' + res.zip + ' byte');

  /* løkke-eksport med samme frø = samme resultat; nytt frø = annet resultat */
  const loop = await page.evaluate(async () => {
    const A = TS.app;
    const s = TS.clone(A.state);
    s.tracks.bass.macros.movement = 1; s.tracks.synth.macros.movement = 1;
    const job = st => TS.render({ startState: st, startStep: 0, steps: 16 * 12, samples: A.drumBuffers(), tail: 0.5 });
    const a = await job(TS.clone(s)), b = await job(TS.clone(s));
    const s2 = TS.clone(s); s2.song.seed = 4242;
    const c = await job(s2);
    const md = (x, y) => { let m = 0; for (let i = 0; i < Math.min(x.length, y.length); i++) m = Math.max(m, Math.abs(x[i] - y[i])); return m; };
    const n = r => JSON.stringify(r.notes);
    return { same: n(a) === n(b) && md(a.audio.mix[0], b.audio.mix[0]) < 1e-4, diff: n(a) !== n(c) && md(a.audio.mix[0], c.audio.mix[0]) > 0.01 };
  });
  ok(loop.same, 'samme frø gir samme lyd');
  ok(loop.diff, 'nytt frø gir annen lyd');

  /* importert trommeloop: lag en WAV, last den inn som fil og spill */
  const lp = await page.evaluate(async () => {
    const A = TS.app, sr = 44100, len = sr * 2, d = new Float32Array(len);
    for (let b = 0; b < 4; b++) for (let i = 0; i < 4000; i++) d[b * sr / 2 + i] = Math.sin(i / 10) * Math.exp(-i / 800);
    const wav = TS.files.wav([d, d], sr);
    const file = new File([wav], 'testloop.wav', { type: 'audio/wav' });
    const buf = await A.loadSample('loop', file);
    A.commit(['tracks', 'drums', 'mode'], 'loop');
    A.commit(['tracks', 'drums', 'loopBars'], 1);
    const r = await TS.render({ startState: TS.clone(A.state), startStep: 0, steps: 32, samples: A.drumBuffers(), loop: A.loopBuffer(), tail: 0.2 });
    let s = 0; const a = r.audio.drums[0]; for (let i = 0; i < a.length; i++) s += a[i] * a[i];
    A.commit(['tracks', 'drums', 'mode'], 'kit');
    return { dur: buf.duration, rms: Math.sqrt(s / a.length) };
  });
  ok(Math.abs(lp.dur - 2) < 0.01 && lp.rms > 0.003, 'importert loop spilles i takt ' + JSON.stringify(lp));

  /* angre / snapshot */
  const us = await page.evaluate(() => {
    const A = TS.app;
    const before = A.state.synths.bass.cutoff;
    A.lastEdit = 0; A.commit(['synths', 'bass', 'cutoff'], 2222);
    A.undo();
    const undone = A.state.synths.bass.cutoff === before;
    A.saveSnapshot();
    A.lastEdit = 0; A.commit(['song', 'root'], 7);
    A.stop();
    A.recallSnapshot(A.snapshots.length - 1);
    return { undone, snap: A.state.song.root !== 7 };
  });
  ok(us.undone, 'angre virker');
  ok(us.snap, 'snapshot hentes tilbake');

  /* prosjektfil rundtur */
  const pj = await page.evaluate(() => {
    const A = TS.app, obj = JSON.parse(JSON.stringify(A.projectObject(true)));
    const ok1 = obj.synths && obj.modulation && obj.sequences && obj.samples.loop && obj.samples.loop.base64.length > 1000;
    A.commit(['synths', 'synth', 'res'], 13);
    return A.loadProject(obj).then(() => ({ ok1, res: A.state.synths.synth.res !== 13, loop: !!A.custom.loop }));
  });
  ok(pj.ok1 && pj.res && pj.loop, 'prosjektfil lagres og åpnes med synth, modulasjon og samples ' + JSON.stringify(pj));

  /* tastatur (Mac) */
  await page.evaluate(() => { TS.app.stop(); TS.app.newProject(); });
  await page.mouse.click(5, 900);
  const k = async (key) => { await page.keyboard.press(key); await page.waitForTimeout(30); };
  const get = () => page.evaluate(() => ({
    focus: TS.ui.focus, target: TS.ui.macroTarget, bpm: TS.app.state.song.bpm,
    s2: TS.app.state.tracks.bass.seq.steps[2], s4: TS.app.state.tracks.bass.seq.steps[4],
    dens: TS.TRACKS.map(id => TS.app.state.tracks[id].macros.density), lock: TS.app.state.tracks.bass.lock,
    snaps: TS.app.snapshots.length, playing: TS.app.playing, kick1: TS.app.state.tracks.drums.voices[0].steps[1].on,
    help: !document.querySelector('.keyhelp') ? false : !document.querySelector('.keyhelp').hidden,
    focusCls: document.getElementById('track-bass').classList.contains('focus')
  }));
  const k0 = await get();
  await k('2');
  let ks = await get();
  ok(ks.focus === 'bass' && ks.target === 'bass' && ks.focusCls, 'tast 2 velger bass og retter hovedkontrollene mot bass');
  await k('ArrowRight'); await k('ArrowRight'); await k('Enter');
  ks = await get();
  ok(ks.s2.on !== k0.s2.on, 'piltaster + Enter slår et basssteg av/på');
  await k('ArrowRight'); await k('ArrowRight'); await k('ArrowUp'); await k('ArrowUp');
  ks = await get();
  ok(ks.s4.on && ks.s4.deg === k0.s4.deg + 2, '↑ to ganger hever tonen to skalatrinn (' + k0.s4.deg + ' → ' + ks.s4.deg + ')');
  await k('.'); await k('.'); await k('ArrowUp');
  ks = await get();
  ok(ks.s4.oct === k0.s4.oct + 1, 'punktum bytter felt til Oktav, ↑ øker oktaven');
  await k('t'); await k('t');
  ks = await get();
  ok(Math.abs(ks.dens[1] - k0.dens[1] - 0.1) < 1e-6 && ks.dens[0] === k0.dens[0] && ks.dens[2] === k0.dens[2], 'T øker tetthet bare på bass ' + JSON.stringify(ks.dens));
  await k('Shift+T');
  ks = await get();
  ok(Math.abs(ks.dens[1] - k0.dens[1] - 0.05) < 1e-6, '⇧T senker tettheten');
  await k('+'); await k('+'); await k('-');
  ks = await get();
  ok(ks.bpm === k0.bpm + 1, '+ og − endrer tempo');
  await k('l');
  ks = await get();
  ok(ks.lock === true, 'L låser valgt spor');
  await k('l');
  await k('s');
  ks = await get();
  ok(ks.snaps === k0.snaps + 1, 'S lagrer snapshot');
  await k('1'); await k('ArrowRight'); await k('Enter');
  ks = await get();
  ok(ks.focus === 'drums' && ks.kick1 !== k0.kick1, 'tast 1 + Enter redigerer trommene');
  await page.click('#track-bass .tog.lock'); await page.click('#track-bass .tog.lock');
  const lockBefore = (await get()).lock;
  await k('Space');
  ks = await get();
  ok(ks.playing && ks.lock === lockBefore, 'mellomrom spiller selv rett etter et klikk på en knapp');
  await k('Space');
  await k('Control+z');
  ks = await get();
  ok(ks.snaps >= 1, 'angre med ⌘/Ctrl+Z gir ingen feil');
  await k('h');
  ks = await get();
  ok(ks.help, 'H viser tastaturoversikten');
  if (shots) await page.screenshot({ path: shots + '/taster.png' });
  await k('Escape');
  ks = await get();
  ok(!ks.help, 'Esc lukker oversikten');
  await k('2');
  if (shots) { await page.evaluate(() => window.scrollTo(0, 0)); await page.screenshot({ path: shots + '/mac-fokus.png' }); }

  /* mobil */
  const mob = await browser.newPage(Object.assign({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true }, engineName === 'chromium' ? { isMobile: true } : {}));
  mob.on('pageerror', e => errors.push(String(e)));
  await mob.goto(url);
  await mob.waitForSelector('.top');
  const overflow = await mob.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  ok(overflow <= 0, 'ingen sidelengs scrolling på telefon (' + overflow + ')');
  const cellW = await mob.evaluate(() => document.querySelector('#track-bass .big-grid .cell').getBoundingClientRect().width);
  ok(cellW >= 38, 'stegruter er store nok for fingre (' + Math.round(cellW) + ' px)');
  if (shots) {
    await mob.screenshot({ path: shots + '/mobil.png', fullPage: true });
    await page.click('.icon.wide');
    await page.waitForTimeout(200);
    await page.screenshot({ path: shots + '/eksport.png' });
  }
  ok(errors.length === 0, 'ingen feil underveis ' + errors.join(' | '));
  await browser.close();
  console.log(failed ? failed + ' feil' : 'alt ok');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
