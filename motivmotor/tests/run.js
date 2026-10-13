/* Kjør: node tests/run.js  – tester musikkmotoren uten nettleser. */
const assert = require('assert');
const MM = require('./load.js');
const T = MM.theory, P = MM.project;
let passed = 0;
const test = (name, fn) => { try { fn(); passed++; console.log('ok   ' + name); } catch (e) { console.log('FEIL ' + name + '\n     ' + e.stack.split('\n').slice(0, 3).join('\n     ')); process.exitCode = 1; } };
const key = { root: 9, mode: 'minor' };
const hook = P.DEMO_HOOK.map(([t, d, p]) => ({ t, d, p, v: 0.8 }));

test('MIDI skrives og leses tilbake likt', () => {
  const bytes = MM.midi.writeMidi({ bpm: 132, tracks: [{ name: 'Melodi', channel: 0, notes: hook }] });
  const m = MM.midi.parseMidi(bytes.buffer);
  assert.strictEqual(m.bpm, 132);
  assert.strictEqual(m.tracks.length, 1);
  assert.deepStrictEqual(m.tracks[0].notes.map((n) => [n.t, n.d, n.p]), hook.map((n) => [n.t, n.d, n.p]));
});

test('toneart gjenkjennes (A-moll-hook)', () => {
  const k = T.detectKey(hook);
  assert.strictEqual(T.keyName(k.key), 'A moll');
});

test('akkordforløp gjenkjennes fra MIDI-akkorder', () => {
  const ref = P.demoReferences()[1];
  const ch = MM.features.analyzeChords(ref.notes, ref.key, ref.bars);
  assert.deepStrictEqual(ch.chords.map((c) => T.chordName(key, c.chord)), ['Am', 'F', 'C', 'G']);
});

test('samme frø gir identiske varianter', () => {
  const p = P.newProject();
  const a = JSON.stringify(P.makeVariants(p, 42));
  const b = JSON.stringify(P.makeVariants(p, 42));
  assert.strictEqual(a, b);
});

for (const mode of ['inspire', 'rhythm', 'chords', 'keep']) {
  test('modus ' + mode + ': tre ulike, spillbare varianter i tonearten', () => {
    const p = P.newProject();
    p.gen.mode = mode;
    if (mode === 'chords') p.gen.chordRefId = 'demo-chords';
    const vs = P.makeVariants(p, 99);
    assert.strictEqual(vs.length, 3);
    for (const v of vs) {
      assert.ok(v.notes.length >= 4, 'for få noter');
      const out = v.notes.filter((n) => !T.inScale(key, n.p));
      assert.strictEqual(out.length, 0, 'toner utenfor skalaen');
      assert.ok(v.notes.every((n) => n.t >= 0 && n.t + n.d <= v.bars * 16 + 0.01), 'noter utenfor frasen');
      const ps = v.notes.map((n) => n.p);
      assert.ok(Math.max(...ps) - Math.min(...ps) <= 19, 'for stort omfang');
    }
    const sigs = new Set(vs.map((v) => JSON.stringify([v.notes.map((n) => n.p), v.chords.map((c) => c.chord.deg)])));
    assert.strictEqual(sigs.size, 3, 'variantene er like');
  });
}

test('inspirasjon lager nye motiver, ikke transponert referanse', () => {
  const p = P.newProject();
  for (const seed of [1, 2, 3, 4, 5]) {
    for (const v of P.makeVariants(p, seed)) {
      const first = v.notes.filter((n) => n.t < 32).map((n) => n.p);
      const ref = hook.map((n) => n.p);
      const rel = (a) => a.map((x) => x - a[0]).join(',');
      assert.notStrictEqual(rel(first), rel(ref));
    }
  }
});

test('rytmemodus beholder rytmen nøyaktig', () => {
  const p = P.newProject();
  p.gen.mode = 'rhythm'; p.gen.bars = 2;
  for (const v of P.makeVariants(p, 7)) assert.deepStrictEqual(v.notes.map((n) => n.t), hook.map((n) => n.t));
});

test('akkordmodus beholder akkordforløpet', () => {
  const p = P.newProject();
  p.gen.mode = 'chords'; p.gen.chordRefId = 'demo-chords'; p.gen.bars = 4;
  for (const v of P.makeVariants(p, 11)) assert.deepStrictEqual(v.chords.map((c) => T.chordName(key, c.chord)), ['Am', 'F', 'C', 'G']);
});

test('melodien har svarfrase som løser seg mot tonika-akkorden', () => {
  const p = P.newProject();
  let resolved = 0, total = 0;
  for (const seed of [10, 20, 30, 40]) for (const v of P.makeVariants(p, seed)) {
    const last = v.notes[v.notes.length - 1];
    total++;
    if ([0, 2, 4].includes(T.mod(T.pitchToDeg(key, last.p).deg, 7))) resolved++;
    assert.ok(last.d >= 4, 'siste tone bør holdes');
  }
  assert.ok(resolved / total >= 0.8, 'for få oppløsninger: ' + resolved + '/' + total);
});

function built(style, energy, len) {
  const p = P.newProject();
  p.settings.style = style; p.settings.energy = energy || 3; p.settings.lengthMin = len || 7;
  p.settings.bpm = MM.arrange.STYLES[style].bpm;
  P.makeVariants(p, 5); P.chooseVariant(p, 0); P.buildArrangement(p);
  return p;
}

for (const style of ['house', 'trance', 'driving']) {
  test('arrangement ' + style + ': lengde, seksjoner, kick/bass og register', () => {
    const p = built(style, 4, 7);
    const a = p.arrangement;
    const min = a.totalBars * 4 / p.settings.bpm;
    assert.ok(Math.abs(min - 7) < 0.6, 'lengde ' + min);
    assert.deepStrictEqual(a.sections.map((s) => s.type).slice(0, 3), ['intro', 'build', 'main1']);
    assert.ok(a.sections.every((s) => s.bars % 8 === 0));
    assert.strictEqual(a.report.kickBassClashes, 0);
    assert.ok(a.report.messages.every((m) => m.level !== 'warn'), JSON.stringify(a.report.messages));
    // melodien skal ikke spille i introen, men være med i hovedpartiene
    const intro = a.sections[0];
    assert.strictEqual(a.parts.lead.filter((n) => n.t < (intro.start + intro.bars) * 16).length, 0);
    const m2 = a.sections.find((s) => s.type === 'main2');
    assert.ok(a.parts.lead.some((n) => n.t >= m2.start * 16 && n.t < (m2.start + m2.bars) * 16));
    // ingen kick i breakdown
    const bd = a.sections.find((s) => s.type === 'breakdown');
    assert.strictEqual(a.parts.drums.filter((n) => n.p === 36 && n.t >= bd.start * 16 && n.t < (bd.start + bd.bars) * 16).length, 0);
  });
}

test('lengdevalg: 3 og 10 minutter', () => {
  for (const len of [3, 10]) {
    const p = built('trance', 3, len);
    const min = p.arrangement.totalBars * 4 / p.settings.bpm;
    assert.ok(Math.abs(min - len) < 0.6, len + ' → ' + min);
  }
});

test('låst bass forblir uendret når akkordene regenereres', () => {
  const p = built('trance', 4, 6);
  p.locked.bass = true;
  const before = JSON.stringify(p.arrangement.parts.bass);
  const alts = P.alternatives(p, 'chords');
  assert.strictEqual(alts.length, 3);
  for (const alt of alts) assert.strictEqual(JSON.stringify(alt.arrangement.parts.bass), before);
  const progs = new Set(alts.map((x) => x.theme.chords.map((c) => c.chord.deg + c.chord.q).join(',')));
  assert.strictEqual(progs.size, 3);
});

test('låst melodi forblir uendret når alt ulåst regenereres', () => {
  const p = built('house', 3, 6);
  p.locked.melody = true;
  const lead = JSON.stringify(p.arrangement.parts.lead);
  const theme = JSON.stringify(p.theme.notes);
  for (const alt of P.alternatives(p, 'all')) {
    assert.strictEqual(JSON.stringify(alt.theme.notes), theme);
    assert.strictEqual(JSON.stringify(alt.arrangement.parts.lead), lead);
  }
});

test('nye melodialternativer beholder akkordene', () => {
  const p = built('trance', 3, 6);
  const chords = JSON.stringify(p.theme.chords);
  const alts = P.alternatives(p, 'melody');
  for (const alt of alts) assert.strictEqual(JSON.stringify(alt.theme.chords), chords);
  assert.strictEqual(new Set(alts.map((a) => JSON.stringify(a.theme.notes))).size, 3);
});

test('prosjekt lagres og åpnes nøyaktig likt', () => {
  const p = built('driving', 5, 5);
  const q = P.deserialize(P.serialize(p));
  assert.deepStrictEqual(q.arrangement.parts, p.arrangement.parts);
  assert.deepStrictEqual(q.theme, p.theme);
  assert.deepStrictEqual(q.seeds, p.seeds);
  // og arrangementet kan gjenskapes fra frøene
  const r = P.deserialize(P.serialize(p));
  r.arrangement = null; P.buildArrangement(r);
  assert.deepStrictEqual(r.arrangement.parts, p.arrangement.parts);
});

test('MIDI per stemme: trommer på kanal 10 med GM-noter', () => {
  const p = built('trance', 3, 4);
  const m = MM.midi.parseMidi(P.midiFor(p, 'drums').buffer);
  assert.strictEqual(m.tracks.length, 1);
  assert.ok(m.tracks[0].isDrum);
  assert.ok(m.tracks[0].notes.some((n) => n.p === 36));
  const all = MM.midi.parseMidi(P.midiFor(p).buffer);
  assert.strictEqual(all.tracks.length, 5);
});

console.log('\n' + passed + ' tester bestått' + (process.exitCode ? ', noen feilet' : ''));
