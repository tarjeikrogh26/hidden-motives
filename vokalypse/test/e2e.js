/* Ende-til-ende-test i ekte Chromium (headless), åpnet direkte som file:// – akkurat slik brukeren åpner appen.
   Kjør: NODE_PATH=$(npm root -g) node vokalypse/test/e2e.js
   Freesound og ElevenLabs simuleres med page.route (ingen ekte nøkler brukes). */
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const OUT = process.env.VK_OUT || path.join(ROOT, 'test', 'out');
fs.mkdirSync(OUT, { recursive: true });

let failures = 0;
function check(cond, msg) {
  if (cond) console.log('  ok  ', msg);
  else { console.log('  FEIL', msg); failures++; }
}

function wavInfo(file) {
  const b = fs.readFileSync(file);
  const fmt = b.indexOf('fmt ');
  const data = b.indexOf('data');
  const ch = b.readUInt16LE(fmt + 10), sr = b.readUInt32LE(fmt + 12), bits = b.readUInt16LE(fmt + 22);
  const bytes = b.readUInt32LE(data + 4);
  return { ch, sr, bits, frames: bytes / (ch * bits / 8), size: b.length };
}

(async () => {
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1360, height: 1000 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  // ---- simulerte tjenester ----
  const requests = [];
  const sampleMp3 = fs.readFileSync(path.join(OUT, 'mock_voice.mp3'));
  await page.route('https://freesound.org/apiv2/search/**', async (route) => {
    const u = new URL(route.request().url());
    requests.push({ svc: 'fs', url: u.toString() });
    const lic = u.searchParams.get('filter').includes('Attribution') ? 'Attribution' : 'Creative Commons 0';
    await route.fulfill({
      status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify({ count: 3, results: [
        { id: 101, name: 'whisper test ' + lic, username: 'tester', license: lic === 'Attribution' ? 'http://creativecommons.org/licenses/by/4.0/' : 'http://creativecommons.org/publicdomain/zero/1.0/', duration: 2.1, url: 'https://freesound.org/people/tester/sounds/101/', tags: ['voice'], previews: { 'preview-hq-mp3': 'https://cdn.freesound.org/previews/0/101-hq.mp3' } },
        { id: 102, name: 'skal filtreres bort', username: 'nc', license: 'http://creativecommons.org/licenses/by-nc/4.0/', duration: 2, url: 'https://freesound.org/s/102/', previews: { 'preview-hq-mp3': 'x' } }
      ] })
    });
  });
  await page.route('https://cdn.freesound.org/**', (route) => route.fulfill({ status: 200, contentType: 'audio/mpeg', headers: { 'access-control-allow-origin': '*' }, body: sampleMp3 }));
  await page.route('https://api.elevenlabs.io/**', async (route) => {
    const r = route.request();
    requests.push({ svc: 'el', url: r.url(), method: r.method(), headers: r.headers(), body: r.postData() });
    if (r.url().endsWith('/v1/voices')) {
      return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify({ voices: [{ voice_id: 'abc123', name: 'Testestemme', labels: { gender: 'female' } }] }) });
    }
    return route.fulfill({ status: 200, contentType: 'audio/mpeg', headers: { 'access-control-allow-origin': '*' }, body: sampleMp3 });
  });

  const url = 'file://' + path.join(ROOT, 'index.html');
  console.log('Åpner', url);
  await page.goto(url);
  await page.waitForFunction(() => window.VK && window.VK.App);
  check(errors.length === 0, 'ingen feil ved lasting');

  // ---- 1. syntetisk startpakke ----
  console.log('\n1. Syntetisk startpakke');
  await page.click('button[data-tab=t-synth]');
  let t0 = Date.now();
  await page.click('#synth-pack');
  await page.waitForFunction(() => VK.Pool.clips.length >= 6, null, { timeout: 60000 });
  console.log('     6 klipp på', Date.now() - t0, 'ms');
  const synthInfo = await page.evaluate(() => VK.Pool.clips.map((c) => ({ n: c.name, o: c.origin, d: c.analysis.duration, segs: c.analysis.segments.length, peak: c.analysis.peak })));
  for (const s of synthInfo) check(s.o === 'synth' && s.segs > 0 && s.peak > 0.1, 'klipp «' + s.n + '» ' + s.d.toFixed(2) + ' s, ' + s.segs + ' biter');

  // ---- 2. variasjon @124 ----
  console.log('\n2. Variasjon ved 124 BPM');
  t0 = Date.now();
  await page.click('#gen');
  await page.waitForFunction(() => VK.App.state.rendered && !VK.App.state.busy, null, { timeout: 60000 });
  console.log('     rendret på', Date.now() - t0, 'ms');
  let info = await page.evaluate(() => {
    const r = VK.App.state.rendered, v = VK.App.state.current;
    const pk = (c) => { let p = 0; for (const ch of c) for (let i = 0; i < ch.length; i++) p = Math.max(p, Math.abs(ch[i])); return p; };
    return { wetLen: r.wet.channels[0].length, dryLen: r.dry.channels[0].length, wetPeak: pk(r.wet.channels), dryPeak: pk(r.dry.channels), events: v.events.length, types: v.events.map((e) => e.type), steps: v.events.reduce((a, e) => a + e.lenSteps, 0), form: v.form };
  });
  check(info.wetLen === Math.round(16 * 4 * 60 * 48000 / 124), 'behandlet lengde ' + info.wetLen + ' = ' + Math.round(16 * 4 * 60 * 48000 / 124));
  check(info.dryLen === info.wetLen, 'tørr lengde lik behandlet');
  check(info.wetPeak > 0.8 && info.wetPeak <= 1, 'behandlet topp ' + info.wetPeak.toFixed(3));
  check(info.dryPeak > 0.8 && info.dryPeak <= 1, 'tørr topp ' + info.dryPeak.toFixed(3));
  check(info.events > 0, info.events + ' innslag (' + info.types.join(', ') + '), form ' + info.form + ', ' + Math.round(100 * info.steps / 256) + ' % dekning');

  // ---- 3. eksport ----
  console.log('\n3. Eksport');
  for (const [btn, suffix] of [['#dl-wet', 'behandlet'], ['#dl-dry', 'torr']]) {
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click(btn)]);
    const f = path.join(OUT, dl.suggestedFilename());
    await dl.saveAs(f);
    const wi = wavInfo(f);
    check(f.includes(suffix), 'filnavn ' + path.basename(f));
    check(wi.ch === 2 && wi.sr === 48000 && wi.bits === 24, 'format ' + wi.ch + ' kanaler, ' + wi.sr + ' Hz, ' + wi.bits + '-bit');
    check(wi.frames === Math.round(16 * 4 * 60 * 48000 / 124), 'frames ' + wi.frames);
    try {
      const probe = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_name,sample_rate,channels,bits_per_sample,duration_ts', '-of', 'compact', f]).toString().trim();
      check(/pcm_s24le/.test(probe) && /duration_ts=1486452/.test(probe), 'ffprobe: ' + probe);
    } catch (e) { check(false, 'ffprobe feilet: ' + e.message); }
  }
  const [dlc] = await Promise.all([page.waitForEvent('download'), page.click('#dl-credits')]);
  const cf = path.join(OUT, dlc.suggestedFilename()); await dlc.saveAs(cf);
  check(fs.readFileSync(cf, 'utf8').includes('SYNTETISK'), 'lisensliste skrevet (' + path.basename(cf) + ')');

  // ---- 4. mange BPM/tetthet/stil – lengde må alltid stemme ----
  console.log('\n4. Lengde ved ulike BPM, tetthet og stiler');
  const combos = [[120, 0, 'house'], [125, 2, 'techno'], [128, 4, 'ebm'], [133, 3, 'free'], [97.5, 1, 'techno'], [140, 4, 'ebm'], [174, 2, 'house']];
  for (const [bpm, dens, style] of combos) {
    const r = await page.evaluate(async ([bpm, dens, style]) => {
      Object.assign(VK.App.state.settings, { bpm: bpm, density: dens, style: style });
      for (const k in VK.App.state.settings.ingredients) VK.App.state.settings.ingredients[k] = true;
      await VK.App.generate({});
      const s = VK.App.state;
      const occ = s.current.events.reduce((a, e) => a + e.lenSteps, 0);
      return { len: s.rendered.wet.channels[0].length, dry: s.rendered.dry.channels[0].length, n: s.current.events.length, occ: occ, silent: s.rendered.wet.silent, err: document.getElementById('err').textContent };
    }, [bpm, dens, style]);
    const exp = Math.round(16 * 4 * 60 * 48000 / bpm);
    check(r.len === exp && r.dry === exp && !r.silent && !r.err, bpm + ' BPM, tetthet ' + dens + ', ' + style + ': ' + r.len + ' samples, ' + r.n + ' innslag, ' + Math.round(100 * r.occ / 256) + ' % dekning ' + (r.err || ''));
  }

  // ---- 5. tetthet skal faktisk styre mengden ----
  console.log('\n5. Tetthet styrer mengden vokal (snitt av 12 variasjoner)');
  const dens = await page.evaluate(() => {
    const out = [];
    const clips = VK.Pool.enabled();
    for (let d = 0; d < 5; d++) {
      let occ = 0, n = 0;
      for (let s = 1; s <= 12; s++) {
        const a = VK.Arranger.arrange(Object.assign({}, VK.App.state.settings, { density: d, style: 'house', bpm: 124 }), clips, s * 101, s * 7);
        occ += a.events.reduce((x, e) => x + e.lenSteps, 0); n += a.events.length;
      }
      out.push({ d: d, occ: occ / 12 / 256, n: n / 12 });
    }
    return out;
  });
  for (const d of dens) console.log('     ' + ['Glissen', 'Luftig', 'Middels', 'Tett', 'Mye'][d.d] + ': ' + d.n.toFixed(1) + ' innslag, ' + Math.round(d.occ * 100) + ' % av tiden');
  check(dens[0].occ < dens[2].occ && dens[2].occ < dens[4].occ, 'økende tetthet gir mer vokal');
  check(dens[1].occ < 0.3, 'standard (Luftig) har mye luft (' + Math.round(dens[1].occ * 100) + ' %)');

  // ---- 6. import av fil ----
  console.log('\n6. Import av lydfil');
  await page.click('button[data-tab=t-import]');
  await page.setInputFiles('#file', path.join(OUT, 'mock_voice.wav'));
  await page.waitForFunction(() => VK.Pool.clips.some((c) => c.origin === 'import'), null, { timeout: 20000 });
  const imp = await page.evaluate(() => { const c = VK.Pool.clips.find((c) => c.origin === 'import'); return { sr: c.buffer.sampleRate, d: c.analysis.duration, on: c.analysis.onsets.length }; });
  check(imp.sr === 48000, 'importert fil omregnet til 48 kHz (' + imp.d.toFixed(2) + ' s, ' + imp.on + ' anslag)');
  // bare importert klipp i bruk
  await page.evaluate(async () => {
    for (const c of VK.Pool.clips) c.enabled = c.origin === 'import';
    Object.assign(VK.App.state.settings, { bpm: 126, density: 2, style: 'techno' });
    await VK.App.generate({});
  });
  info = await page.evaluate(() => ({ clipIds: Array.from(new Set(VK.App.state.current.events.map((e) => VK.Pool.byId().get(e.clipId).origin))), len: VK.App.state.rendered.wet.channels[0].length, err: document.getElementById('err').textContent }));
  check(info.clipIds.length === 1 && info.clipIds[0] === 'import' && !info.err, 'variasjon av bare importert materiale (' + info.len + ' samples)');

  // ---- 7. Freesound (simulert) ----
  console.log('\n7. Freesound (simulert tjeneste)');
  await page.click('button[data-tab=t-fs]');
  await page.fill('#fs-key', 'TESTKEY');
  await page.check('input[name=fs-lic][value=by]');
  await page.click('#fs-search');
  await page.waitForSelector('#fs-results li', { timeout: 10000 });
  const nRes = await page.$$eval('#fs-results li', (l) => l.length);
  check(nRes === 2, 'NC-lisens filtrert bort, ' + nRes + ' treff vist (CC0 + CC BY)');
  const fsReq = requests.filter((r) => r.svc === 'fs');
  check(fsReq.length === 2 && fsReq.every((r) => r.url.includes('token=TESTKEY') && r.url.includes('/apiv2/search/')), 'søk sendt til /apiv2/search/ med token');
  await page.click('#fs-results li:nth-child(2) button');
  await page.waitForFunction(() => VK.Pool.clips.some((c) => c.origin === 'freesound'), null, { timeout: 10000 });
  const fsc = await page.evaluate(() => VK.Pool.clips.find((c) => c.origin === 'freesound').meta);
  check(fsc.licenseCode === 'CC BY' && fsc.attribution && /tester/.test(fsc.credit), 'CC BY-klipp lagt til med kreditering: ' + fsc.credit);

  // ---- 8. ElevenLabs (simulert) ----
  console.log('\n8. ElevenLabs (simulert tjeneste)');
  await page.click('button[data-tab=t-ai]');
  await page.fill('#el-key', 'sk_test');
  await page.click('#el-go');
  await page.waitForFunction(() => VK.Pool.clips.some((c) => c.origin === 'ai'), null, { timeout: 10000 });
  let el = requests.filter((r) => r.svc === 'el' && r.method === 'POST');
  let body = JSON.parse(el[0].body);
  check(el[0].url === 'https://api.elevenlabs.io/v1/music' && el[0].headers['xi-api-key'] === 'sk_test', 'sang: POST /v1/music med xi-api-key');
  check(body.model_id === 'music_v1' && body.composition_plan.sections[0].lines.length === 2 && body.composition_plan.sections[0].duration_ms === 10000, 'sang: komposisjonsplan med 2 linjer, 10 000 ms');
  await page.click('#el-mode button[data-v=tts]');
  await page.click('#el-load-voices');
  await page.waitForFunction(() => document.querySelector('#el-voice').value === 'abc123');
  await page.click('#el-go');
  await page.waitForFunction(() => VK.Pool.clips.filter((c) => c.origin === 'ai').length >= 2, null, { timeout: 10000 });
  el = requests.filter((r) => r.svc === 'el' && r.method === 'POST');
  check(el[1].url.startsWith('https://api.elevenlabs.io/v1/text-to-speech/abc123?output_format=mp3_44100_128'), 'tale: ' + el[1].url);
  await page.click('#el-mode button[data-v=sfx]');
  await page.click('#el-go');
  await page.waitForFunction(() => VK.Pool.clips.filter((c) => c.origin === 'ai').length >= 3, null, { timeout: 10000 });
  el = requests.filter((r) => r.svc === 'el' && r.method === 'POST');
  body = JSON.parse(el[2].body);
  check(el[2].url === 'https://api.elevenlabs.io/v1/sound-generation' && body.duration_seconds === 6 && body.prompt_influence === 0.5, 'tekstur: POST /v1/sound-generation');

  // ---- 9. alt materiale sammen, UI-knapper og avspilling ----
  console.log('\n9. Blandet materiale, avspilling og historikk');
  await page.evaluate(() => { for (const c of VK.Pool.clips) c.enabled = true; VK.Pool.emit(); });
  await page.click('#gen');
  await page.waitForFunction(() => !VK.App.state.busy && document.querySelectorAll('#history button').length >= 3);
  await page.click('#recolor');
  await page.waitForFunction(() => !VK.App.state.busy);
  await page.click('#play');
  await page.waitForTimeout(800);
  const playing = await page.evaluate(() => ({ p: VK.App.Player.playing, pos: VK.App.Player.position(), st: VK.App.Player.ctx.state }));
  check(playing.p && playing.pos > 0, 'avspilling går (posisjon ' + playing.pos.toFixed(2) + ' s, ' + playing.st + ')');
  await page.click('#listen button[data-v=dry]');
  await page.click('#play');
  check(!(await page.evaluate(() => VK.App.Player.playing)), 'stopp virker');
  await page.screenshot({ path: path.join(OUT, 'skjermbilde.png'), fullPage: true });

  // Lagre en behandlet + tørr fra blandet materiale for lytting
  await page.click('#listen button[data-v=wet]');
  for (const btn of ['#dl-wet', '#dl-dry']) {
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click(btn)]);
    await dl.saveAs(path.join(OUT, 'blandet_' + dl.suggestedFilename()));
  }

  console.log('\nKonsollfeil:', errors.length ? errors : 'ingen');
  check(errors.length === 0, 'ingen JavaScript-feil under hele testen');
  await browser.close();
  console.log(failures ? '\n' + failures + ' FEIL' : '\nALLE TESTER OK');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
