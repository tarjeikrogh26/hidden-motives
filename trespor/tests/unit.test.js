/* Enhetstester for de rene delene: sequencer, variasjon, utvikling, modulasjon og filformater.
   Kjør: node tests/unit.test.js */
require('../js/core.js'); require('../js/sequencer.js'); require('../js/files.js'); require('../js/render.js');
const TS = globalThis.TS;
let failed = 0;
function ok(c, m) { console.log((c ? 'ok   ' : 'FEIL ') + m); if (!c) failed++; }

function simulate(state, bars) {
  const evos = [], notes = { drums: [], bass: [], synth: [] };
  for (let n = 0; n < bars * 16; n++) {
    const e = TS.seq.conduct(state, n); if (e) evos.push(e);
    const ev = TS.seq.stepEvents(state, n);
    ev.drums.forEach(d => notes.drums.push({ n, id: d.id }));
    TS.MELODIC.forEach(id => ev[id].forEach(x => notes[id].push({ n, midi: x.midi, idx: x.idx, varied: x.varied })));
  }
  return { evos, notes };
}

/* 1. utvikling: høyst én endring per takt, ett spor om gangen, begrenset avstand fra grunnideen */
{
  const s = TS.defaultState();
  TS.TRACKS.forEach(id => s.tracks[id].macros.movement = 1);
  const r = simulate(s, 400);
  const bars = r.evos.map(e => e.bar);
  ok(new Set(bars).size === bars.length, 'høyst én utviklingsendring per takt (' + r.evos.length + ' endringer på 400 takter)');
  let gaps = bars.slice(1).map((b, i) => b - bars[i]);
  ok(Math.min(...gaps) >= 2, 'minst 2 takter mellom endringene');
  let repeat = r.evos.slice(1).filter((e, i) => e.track === r.evos[i].track).length;
  ok(repeat === 0, 'samme spor endres aldri to ganger på rad');
  ok(TS.MELODIC.every(id => s.tracks[id].mutations.length <= 6) && s.tracks.drums.mutations.length <= 4, 'antall endringer holdes nær grunnideen');
  const dm = s.tracks.drums.mutations.every(m => ['hat', 'open', 'perc'].includes(m.v));
  ok(dm, 'utviklingen rører aldri kick og klapp');
}

/* 2. grunnpuls: kick på alle fire slag uansett tetthet og bevegelse */
{
  for (const d of [0, 0.5, 1]) {
    const s = TS.defaultState();
    s.tracks.drums.macros.density = d;
    s.tracks.drums.macros.movement = 1;
    const r = simulate(s, 64);
    const kicks = r.notes.drums.filter(x => x.id === 'kick');
    const onBeats = kicks.filter(x => x.n % 4 === 0).length;
    ok(onBeats === 64 * 4, 'kick på alle slag ved tetthet ' + d + ' (' + onBeats + '/256)');
  }
}

/* 3. tetthet er hørbar: flere noter ved høy tetthet */
{
  const count = d => { const s = TS.defaultState(); TS.TRACKS.forEach(id => s.tracks[id].macros.density = d); s.song.evolve = false; const r = simulate(s, 32); return r.notes.bass.length + r.notes.synth.length + r.notes.drums.length; };
  const lo = count(0.1), mid = count(0.5), hi = count(0.95);
  ok(lo < mid && mid < hi, 'tetthet øker antall slag: ' + lo + ' < ' + mid + ' < ' + hi);
}

/* 4. låst spor: identisk hver runde */
{
  const s = TS.defaultState();
  s.tracks.bass.lock = true; s.tracks.bass.macros.movement = 1;
  const r = simulate(s, 32);
  const perBar = b => JSON.stringify(r.notes.bass.filter(x => Math.floor(x.n / 16) === b).map(x => [x.n % 16, x.midi]));
  ok([...Array(31).keys()].every(b => perBar(b + 1) === perBar(0)), 'låst bass spiller likt i alle 32 takter');
  ok(s.tracks.bass.mutations.length === 0, 'låst spor utvikles ikke');
}

/* 5. fryst tilfeldighet: samme variasjon hver runde */
{
  const s = TS.defaultState(); s.song.freeze = true; s.tracks.synth.macros.movement = 1;
  const r = simulate(s, 36);
  const L = s.tracks.synth.seq.length;
  const cyc = c => JSON.stringify(r.notes.synth.filter(x => Math.floor(x.n / L) === c).map(x => [x.n % L, x.midi]));
  ok(cyc(1) === cyc(5) && cyc(5) === cyc(20), 'fryst tilfeldighet gjentar synthsekvensen likt');
}

/* 6. alle toner er i skala */
{
  const s = TS.defaultState(); TS.TRACKS.forEach(id => { s.tracks[id].macros.movement = 1; s.tracks[id].macros.density = 1; });
  s.modulation.variation.synth.nabo = 1;
  const r = simulate(s, 200);
  const pcs = TS.allowedPcs(s.song).map(p => (p + s.song.root) % 12);
  const all = r.notes.bass.concat(r.notes.synth);
  ok(all.every(x => pcs.includes(((x.midi % 12) + 12) % 12)), 'alle ' + all.length + ' noter ligger i D-moll');
  ok(all.some(x => x.varied), 'kontrollert variasjon forekommer');
  ok(r.notes.bass.every(x => x.midi >= 26 && x.midi <= 62) && r.notes.synth.every(x => x.midi >= 40 && x.midi <= 96), 'noter holder seg i sporets register');
}

/* 7. polymeter: synth med 12 steg forskyves mot 16-stegs trommer og møtes igjen hver 3. takt */
{
  const s = TS.defaultState();
  const p = n => TS.seq.trackPos(s.tracks.synth, n, 0).idx;
  ok(p(0) === 0 && p(16) === 4 && p(32) === 8 && p(48) === 0, 'synth 12 steg mot 16: møtes hver 3. takt');
  s.tracks.synth.seq.reset = 1;
  ok(p(16) === 0 && p(40) === 8, 'start på nytt hver takt låser sekvensen til takten');
}

/* 8. modulasjon: innenfor grenser og null ved null bevegelse */
{
  const s = TS.defaultState();
  let maxAbs = 0;
  for (let n = 0; n < 16 * 64; n++) { const m = TS.seq.modsAt(s, n); TS.TRACKS.forEach(id => Object.values(m[id]).forEach(v => maxAbs = Math.max(maxAbs, Math.abs(v)))); }
  ok(maxAbs > 0.1 && maxAbs <= 2, 'modulasjon har utslag innenfor grenser (maks ' + maxAbs.toFixed(2) + ')');
  TS.TRACKS.forEach(id => s.tracks[id].macros.movement = 0);
  const z = TS.seq.modsAt(s, 37);
  ok(TS.TRACKS.every(id => Object.values(z[id]).every(v => v === 0)), 'bevegelse 0 stopper modulasjonen');
  let jump = 0; const s2 = TS.defaultState();
  for (let n = 1; n < 16 * 32; n++) jump = Math.max(jump, Math.abs(TS.seq.sourcesAt(s2, n).drift - TS.seq.sourcesAt(s2, n - 1).drift));
  ok(jump < 0.05, 'drift beveger seg jevnt (største sprang per steg ' + jump.toFixed(3) + ')');
}

/* 9. samme frø → samme forløp, annet frø → annet */
{
  const run = seed => { const s = TS.defaultState(); s.song.seed = seed; TS.TRACKS.forEach(id => s.tracks[id].macros.movement = 0.8); return JSON.stringify(simulate(s, 120)); };
  ok(run(5) === run(5), 'samme frø gir identisk forløp over 120 takter');
  ok(run(5) !== run(6), 'nytt frø gir nytt forløp');
}

/* 10. opptak: avspilling av endringer gir samme tilstand */
{
  const s = TS.defaultState(), start = TS.clone(s);
  const changes = [{ n: 3, op: 'set', path: ['song', 'bpm'], value: 130 }, { n: 9, op: 'set', path: ['synths', 'bass', 'cutoff'], value: 900 }];
  changes.forEach(c => TS.applyChange(s, c));
  const re = TS.clone(start); changes.forEach(c => TS.applyChange(re, c));
  ok(re.song.bpm === 130 && re.synths.bass.cutoff === 900, 'kontrollendringer spilles av på nytt');
  const snap = TS.clone(s); snap.tracks.bass.mutations = [{ type: 'rot', by: 1 }];
  s.tracks.bass.mutations = [];
  TS.applyChange(s, { op: 'restore', state: snap });
  ok(s.tracks.bass.mutations.length === 0, 'angre beholder utviklingens pågående endringer');
  TS.applyChange(s, { op: 'replace', state: snap });
  ok(s.tracks.bass.mutations.length === 1, 'snapshot tar med sine egne endringer');
}

/* 11. filformater */
{
  const w = TS.files.wav([new Float32Array([0, 1, -1]), new Float32Array([0.5, -0.5, 0])], 44100);
  const dv = new DataView(w.buffer);
  ok(String.fromCharCode(...w.slice(0, 4)) === 'RIFF' && dv.getUint16(22, true) === 2 && dv.getUint16(34, true) === 24 && w.length === 44 + 3 * 2 * 3, 'WAV-hode: stereo 24-bit');
  ok(w[47] === 0x00 && w[48] === 0x00 && w[49] === 0x40, 'WAV-verdi 0,5 kodes riktig');
  const notes = [{ tr: 'bass', n: 0, sw: 0, len: 2, midi: 40, vel: 0.8 }, { tr: 'drums', n: 1, sw: 0.08, len: 0.5, midi: 36, vel: 1 }];
  const m = TS.files.midi(notes, [{ n: 0, bpm: 120 }], 0, 'test');
  ok(String.fromCharCode(...m.slice(0, 4)) === 'MThd' && m[9] === 1 && m[11] === 4 && ((m[12] << 8) | m[13]) === 96, 'MIDI type 1, 4 spor, 96 ppq');
  let tracks = 0; for (let i = 14; i < m.length;) { ok(String.fromCharCode(...m.slice(i, i + 4)) === 'MTrk', 'MIDI-spor ' + tracks); const len = (m[i + 4] << 24) | (m[i + 5] << 16) | (m[i + 6] << 8) | m[i + 7]; i += 8 + len; tracks++; }
  const z = TS.files.zip([{ name: 'a.txt', data: new TextEncoder().encode('hei') }]);
  ok(z[0] === 0x50 && z[1] === 0x4b && z.length > 60, 'ZIP lages');
  const b = TS.files.toBase64(new Uint8Array([1, 2, 250]).buffer);
  ok(new Uint8Array(TS.files.fromBase64(b)).join() === '1,2,250', 'base64 rundtur');
  const p = TS.files.fromProject(JSON.parse(JSON.stringify(TS.files.toProject(TS.defaultState()))));
  ok(p.state.synths.bass.cutoff === 380 && p.state.modulation.routes.length === 6, 'prosjektfil rundtur');
}

console.log(failed ? failed + ' feil' : 'alt ok');
process.exit(failed ? 1 : 0);
