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


/* ---------- stil, lydreferanser og hiphop ---------- */
function songRef(name, keyRoot, mode, prog, pat, bpm) {
  // prog: [[rootPc, q, bars]]
  const k = { root: keyRoot, mode };
  const chords = []; let t = 0;
  for (const [r, q, b] of prog) { chords.push({ t, len: b * 16, chord: MM.listen.absChord(k, r, q) }); t += b * 16; }
  const bars = t / 16;
  const bass = []; for (let b = 0; b < bars; b++) for (const s of [2, 6, 10, 14]) bass.push({ t: b * 16 + s, d: 2, p: 33 });
  return Object.assign(P.makeReference({ name, kind: 'song', source: 'audio', key: k, bars, bpm, notes: hook.map((n) => Object.assign({}, n)) }),
    { chords, bass, hits: { pat, pad: false }, loop: bars });
}
const STAB = [1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0];

test('stil lærer tempo, kordelengde, korderytme og progresjon på tvers av tonearter', () => {
  const a = songRef('A', 9, 'minor', [[9, 'm', 2], [5, 'M', 2], [0, 'M', 2], [7, 'M', 2]], STAB, 124);
  const b = songRef('B', 2, 'minor', [[2, 'm', 2], [10, 'M', 2], [5, 'M', 2], [0, 'M', 2]], STAB, 122); // samme forløp i D-moll
  const style = { id: 's1', name: 'Prog', examples: [a, b].map(MM.styles.exampleFrom) };
  const L = MM.styles.learn(style);
  assert.strictEqual(L.chordLen, 32);
  assert.strictEqual(L.progressions.length, 1, 'samme forløp i to tonearter skal gjenkjennes som ett');
  assert.strictEqual(L.progressions[0].w, 2);
  assert.deepStrictEqual(L.hitPats[0].pat, STAB);
  assert.ok(L.bpm === 122 || L.bpm === 124);
  const inE = MM.styles.progressionInKey(L.progressions[0], { root: 4, mode: 'minor' }, 8);
  assert.deepStrictEqual(inE.map((c) => T.chordName({ root: 4, mode: 'minor' }, c.chord)), ['Em', 'C', 'G', 'D']);
});

test('ny melodi i stilen bruker stilens korder, og arrangementet stilens korderytme', () => {
  const p = P.newProject();
  const a = songRef('A', 9, 'minor', [[9, 'm', 2], [5, 'M', 2], [0, 'M', 2], [7, 'M', 2]], STAB, 124);
  p.style = { id: 's1', name: 'Prog', examples: [MM.styles.exampleFrom(a)] };
  P.makeVariants(p, 3);
  for (const v of p.variants) assert.deepStrictEqual(v.chords.map((c) => T.chordName(key, c.chord)), ['Am', 'F', 'C', 'G']);
  P.chooseVariant(p, 0); P.buildArrangement(p);
  const pl = p.arrangement.parts.pluck;
  assert.ok(pl.length > 0);
  assert.ok(pl.every((n) => STAB[n.t % 16] === 1), 'korder utenfor stilens rytme');
});

test('behold melodien: forslag fra stilen og låtens egne korder', () => {
  const p = P.newProject();
  const own = songRef('Pop', 9, 'minor', [[9, 'm', 1], [7, 'M', 1]], STAB, 100);
  own.bars = 2;
  p.references.unshift(own);
  p.gen.refId = own.id; p.gen.mode = 'keep'; p.gen.bars = 8;
  const st = songRef('Stil', 9, 'minor', [[5, 'M', 2], [7, 'M', 2], [9, 'm', 4]], STAB, 124);
  p.style = { id: 's', name: 'S', examples: [MM.styles.exampleFrom(st)] };
  const vs = P.makeVariants(p, 1);
  const d = vs.map((v) => v.desc).join(' | ');
  assert.ok(/fra stilen/.test(d) && /låtens egne korder/.test(d), d);
  for (const v of vs) assert.strictEqual(JSON.stringify(v.notes.map((n) => n.t)), JSON.stringify(vs[0].notes.map((n) => n.t)));
});

test('melodi-tempo ×2 gir dobbelt så lange toner', () => {
  const p = P.newProject();
  p.gen.mode = 'keep'; p.gen.bars = 4;
  const v1 = P.makeVariants(p, 1)[0];
  p.gen.melodyScale = 2;
  const v2 = P.makeVariants(p, 1)[0];
  assert.deepStrictEqual(v2.notes.slice(0, 5).map((n) => n.t), v1.notes.slice(0, 5).map((n) => n.t * 2));
});

test('halvtempo-hiphop: vers/hook, ingen 4-på-gulvet, 808 på kicken', () => {
  const p = P.newProject();
  p.settings.style = 'hiphop'; p.settings.bpm = 84; p.settings.lengthMin = 3;
  P.makeVariants(p, 2); P.chooseVariant(p, 0); P.buildArrangement(p);
  const a = p.arrangement;
  assert.ok(a.sections.some((s) => s.label === 'Vers') && a.sections.some((s) => s.label === 'Hook'));
  const vers = a.sections.find((s) => s.label === 'Vers');
  const kicksBar = a.parts.drums.filter((n) => n.p === 36 && n.t >= vers.start * 16 && n.t < vers.start * 16 + 16).map((n) => n.t % 16);
  assert.notDeepStrictEqual(kicksBar, [0, 4, 8, 12]);
  const kicks = new Set(a.parts.drums.filter((n) => n.p === 36).map((n) => n.t));
  assert.ok(a.parts.bass.every((n) => kicks.has(n.t)));
  assert.ok(a.report.messages.every((m) => m.level !== 'warn'), JSON.stringify(a.report.messages));
});


test('låtbit i C-dur inn i A-moll: samme toner og korder (parallelltoneart)', () => {
  const p = P.newProject();
  const own = songRef('Pop', 0, 'major', [[5, 'M', 1], [0, 'M', 1], [7, 'M', 1], [9, 'm', 1]], STAB, 100);
  own.bars = 4;
  p.references.unshift(own); p.gen.refId = own.id; p.gen.mode = 'keep'; p.gen.bars = 4;
  const vs = P.makeVariants(p, 1);
  const ownV = vs.find((v) => /låtens egne/.test(v.desc));
  assert.ok(ownV, vs.map((v) => v.desc).join(' | '));
  assert.deepStrictEqual(ownV.chords.map((c) => T.chordName(key, c.chord)), ['F', 'C', 'G', 'Am']);
  const pcs = (ns) => ns.map((n) => n.p % 12).join(',');
  assert.strictEqual(pcs(ownV.notes), pcs(own.notes));
});

test('toneartsbytte A-moll → D-moll flytter melodien en kvart opp/kvint ned', () => {
  const sh = MM.melody.keyShift({ root: 9, mode: 'minor' }, { root: 2, mode: 'minor' });
  assert.strictEqual(sh, 5);
  assert.strictEqual(MM.melody.keyShift({ root: 9, mode: 'minor' }, { root: 0, mode: 'major' }), 0);
  assert.strictEqual(MM.melody.keyShift({ root: 9, mode: 'minor' }, { root: 9, mode: 'major' }), null);
});

console.log('\n' + passed + ' tester bestått' + (process.exitCode ? ', noen feilet' : ''));
