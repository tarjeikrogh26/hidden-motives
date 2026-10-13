/* Kjør: node tests/ui-check.js [mappe-for-skjermbilder]
   Åpner Motivmotor.html (file://) i Chromium i Mac-størrelse og går gjennom hele flyten med ekte lydfiler:
   låtbit + vokal-stem + korde-stem → melodi, stil fra et eksempel, tre varianter, arrangement, MIDI og WAV. */
const { chromium } = require('playwright');
const path = require('path'), fs = require('fs'), os = require('os');
const root = path.join(__dirname, '..');
const shots = process.argv[2] || fs.mkdtempSync(path.join(os.tmpdir(), 'mm-'));
(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('file://' + path.join(root, 'Motivmotor.html'));
  await page.waitForSelector('nav.tabs button');

  // 1) lag testlyd: en låt med kjent fasit, som miks og stems
  const wavs = await page.evaluate(async () => {
    const key = { root: 9, mode: 'minor' };
    const p = MM.project.newProject();
    p.settings.bpm = 100; p.settings.style = 'house'; p.settings.energy = 3;
    const v = MM.melody.generateVariants({ mode: 'chords', key, bars: 8, style: 'house', seed: 9,
      src: { chords: { key, bars: 4, chords: [0, 5, 2, 6].map((deg, i) => ({ t: i * 16, len: 16, chord: { deg, q: '' } })) } } })[0];
    const arr = MM.arrange.preview(p.settings, v, p.seeds, { withPluck: true });
    const out = {};
    for (const [name, solo] of [['sang-mix', null], ['sang-vocals', 'lead'], ['sang-other', 'pluck']]) {
      const b = await MM.synth.renderOffline(arr, { instruments: p.instruments, solo, sampleRate: 44100 });
      out[name] = MM.files.toBase64(MM.files.encodeWav(b, 16));
    }
    out.truth = v.notes.map((n) => n.t + ':' + n.p).join(' ');
    return out;
  });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mmwav-'));
  for (const n of ['sang-mix', 'sang-vocals', 'sang-other']) fs.writeFileSync(path.join(dir, n + '.wav'), Buffer.from(wavs[n], 'base64'));

  const shot = async (n) => page.screenshot({ path: path.join(shots, n + '.png'), fullPage: true });
  const tab = (name) => page.click('nav.tabs button:has-text("' + name + '")');
  const pick = async (buttonLocator, file) => {
    const [fc] = await Promise.all([page.waitForEvent('filechooser'), buttonLocator.click()]);
    await fc.setFiles(file);
  };

  // 2) Melodier: miks + vokal + korder
  await tab('Melodier');
  const rows = page.locator('#panel-mel .card').first().locator('.item');
  await pick(rows.nth(0).locator('button:has-text("Velg fil")'), path.join(dir, 'sang-mix.wav'));
  await page.waitForTimeout(400);
  await pick(page.locator('#panel-mel .card').first().locator('.item').nth(1).locator('button:has-text("Velg fil")'), path.join(dir, 'sang-vocals.wav'));
  await page.waitForTimeout(400);
  await pick(page.locator('#panel-mel .card').first().locator('.item').nth(2).locator('button:has-text("Velg fil")'), path.join(dir, 'sang-other.wav'));
  await page.waitForTimeout(400);
  await shot('1-melodier-import');
  await page.click('#panel-mel button:has-text("Analyser")');
  await page.waitForFunction(() => MM.app.project.references.some((r) => r.source === 'audio'), null, { timeout: 900000, polling: 3000 });
  await page.waitForTimeout(500);
  const heard = await page.locator('#panel-mel .card.sel').innerText();
  await shot('2-melodier-analysert');

  // 3) Stil: lag stil og legg låtbiten til som eksempel
  await tab('Stil');
  await page.fill('#panel-sty input[placeholder^="For eksempel"]', 'Test prog');
  await page.click('#panel-sty button:has-text("+ Ny stil")');
  await page.selectOption('#panel-sty select', { index: 1 });
  await page.click('#panel-sty button:has-text("Bruk i prosjektet")');
  const styleTxt = await page.locator('#panel-sty .card.sel').innerText();
  await shot('3-stil');

  // 4) Lag: bruk låtbiten, behold melodien, tre varianter
  await tab('Lag');
  await page.selectOption('#panel-lag select >> nth=0', { index: 1 });
  await page.click('#panel-lag .seg button:has-text("Behold melodien")');
  await page.click('#panel-lag button:has-text("Lag 3 varianter")');
  await page.waitForSelector('#panel-lag .grid3 .card');
  const variants = await page.locator('#panel-lag .grid3 .card p.faint').allInnerTexts();
  await page.locator('#panel-lag .grid3 .card').first().locator('button:has-text("Velg")').click();
  await shot('4-lag');
  await page.click('#panel-lag button:has-text("Bygg arrangement")');
  await page.waitForSelector('#panel-arr .arrview canvas');
  const report = await page.locator('#panel-arr .msg').allInnerTexts();
  const sections = await page.locator('#panel-arr .chip').allInnerTexts();
  await shot('5-arrangement');
  await page.click('#panel-arr button:has-text("3 alternativer") >> nth=2');
  await page.waitForSelector('#panel-arr .card.sel .grid3');
  await shot('6-alternativer');

  // 5) Eksport: MIDI-zip
  await tab('Eksport');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#panel-exp button:has-text("Alle stemmer (ZIP)")')]);
  const zipPath = path.join(dir, dl.suggestedFilename());
  await dl.saveAs(zipPath);
  await shot('7-eksport');
  await tab('Lyd');
  await shot('8-lyd');

  console.log(JSON.stringify({ errors, heard: heard.slice(0, 600), style: styleTxt.slice(0, 400), variants, report, sections, zip: dl.suggestedFilename() + ' ' + fs.statSync(zipPath).size + ' B', shots }, null, 1));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
