/* Musikkteori: tonearter, skalatrinn, akkorder og tonearts-gjenkjenning.
   Tid måles overalt i steg (sekstendeler). 16 steg = én takt i 4/4. */
(function (MM) {
  'use strict';

  const STEPS_PER_BAR = 16;
  const NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

  const MODES = {
    minor: { name: 'moll', steps: [0, 2, 3, 5, 7, 8, 10] },
    major: { name: 'dur', steps: [0, 2, 4, 5, 7, 9, 11] },
    dorian: { name: 'dorisk', steps: [0, 2, 3, 5, 7, 9, 10] },
    phrygian: { name: 'frygisk', steps: [0, 1, 3, 5, 7, 8, 10] },
    harmonic: { name: 'harmonisk moll', steps: [0, 2, 3, 5, 7, 8, 11] },
  };

  const mod = (n, m) => ((n % m) + m) % m;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

  function noteName(p) { return NAMES[mod(p, 12)] + (Math.floor(p / 12) - 1); }
  function keyName(key) { return NAMES[key.root] + ' ' + MODES[key.mode].name; }

  /* Grunntonen i oktav `oct` (C4 = 60). */
  function tonic(key, oct) { return 12 * (oct + 1) + key.root; }

  /* Diatonisk trinn (0 = grunntone, 7 = oktav, -1 = trinnet under) til MIDI-tone. */
  function degToPitch(key, deg, oct) {
    const sc = MODES[key.mode].steps;
    const o = Math.floor(deg / 7);
    return tonic(key, oct === undefined ? 4 : oct) + o * 12 + sc[deg - o * 7];
  }

  /* MIDI-tone til nærmeste skalatrinn under, pluss kromatisk avvik (0 når tonen er i skalaen). */
  function pitchToDeg(key, pitch, oct) {
    const sc = MODES[key.mode].steps;
    const rel = pitch - tonic(key, oct === undefined ? 4 : oct);
    const o = Math.floor(rel / 12);
    const pc = rel - o * 12;
    let i = 6;
    while (i > 0 && sc[i] > pc) i--;
    return { deg: o * 7 + i, alt: pc - sc[i] };
  }

  function inScale(key, pitch) { return MODES[key.mode].steps.includes(mod(pitch - key.root, 12)); }

  function degPc(key, deg) { return mod(degToPitch(key, deg, 4), 12); }

  /* Akkord: { deg: skalatrinn for roten, q: '' | '7' | 'sus2' | 'sus4' | 'add9' | 'M' } */
  function chordDegs(chord) {
    const d = chord.deg;
    switch (chord.q) {
      case 'sus2': return [d, d + 1, d + 4];
      case 'sus4': return [d, d + 3, d + 4];
      case '7': return [d, d + 2, d + 4, d + 6];
      case 'add9': return [d, d + 2, d + 4, d + 8];
      default: return [d, d + 2, d + 4];
    }
  }

  function chordPcs(key, chord) {
    const pcs = chordDegs(chord).map((g) => degPc(key, g));
    if (chord.q === 'M') pcs[1] = mod(degPc(key, chord.deg) + 4, 12); // f.eks. dur-V i moll
    return pcs;
  }

  function chordRootPc(key, chord) { return degPc(key, chord.deg); }

  /* Fargetoner som låter bra holdt over akkorden (9 og 11) uten å være akkordtoner. */
  function colorPcs(key, chord) { return [degPc(key, chord.deg + 1), degPc(key, chord.deg + 3)]; }

  function triadQuality(key, chord) {
    const pcs = chordPcs(key, Object.assign({}, chord, { q: chord.q === 'M' ? 'M' : '' }));
    const third = mod(pcs[1] - pcs[0], 12);
    const fifth = mod(pcs[2] - pcs[0], 12);
    if (fifth === 6) return 'dim';
    return third === 4 ? 'maj' : 'min';
  }

  function chordName(key, chord) {
    const root = NAMES[chordRootPc(key, chord)];
    if (chord.q === 'sus2' || chord.q === 'sus4') return root + chord.q;
    const tq = triadQuality(key, chord);
    let s = root + (tq === 'min' ? 'm' : tq === 'dim' ? '°' : '');
    if (chord.q === '7') {
      const sev = mod(degPc(key, chord.deg + 6) - chordRootPc(key, chord), 12);
      s += tq === 'maj' && sev === 11 ? 'maj7' : '7';
    }
    if (chord.q === 'add9') s += 'add9';
    return s;
  }

  const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'];
  function roman(key, chord) {
    const tq = triadQuality(key, chord);
    let r = ROMAN[mod(chord.deg, 7)];
    if (tq !== 'maj') r = r.toLowerCase();
    if (tq === 'dim') r += '°';
    if (chord.q && chord.q !== 'M') r += chord.q === '7' ? '7' : chord.q;
    return r;
  }

  /* Krumhansl–Kessler-profiler for tonearts-gjenkjenning. */
  const KK_MAJ = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
  const KK_MIN = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

  function corr(a, b) {
    const n = a.length;
    const ma = a.reduce((s, x) => s + x, 0) / n;
    const mb = b.reduce((s, x) => s + x, 0) / n;
    let num = 0, da = 0, db = 0;
    for (let i = 0; i < n; i++) {
      num += (a[i] - ma) * (b[i] - mb);
      da += (a[i] - ma) ** 2;
      db += (b[i] - mb) ** 2;
    }
    return da && db ? num / Math.sqrt(da * db) : 0;
  }

  function pcProfile(notes) {
    const prof = new Array(12).fill(0);
    for (const n of notes) {
      const w = Math.max(0.5, n.d) * (n.t % 4 === 0 ? 1.5 : 1) * (n.conf === undefined ? 1 : n.conf);
      prof[mod(n.p, 12)] += w;
    }
    return prof;
  }

  /* Rangerte tonearts-kandidater fra en tonehøydeprofil (12 verdier). */
  function detectKeyFromProfile(prof, lastPc) {
    const out = [];
    for (let r = 0; r < 12; r++) {
      const rot = prof.map((_, i) => prof[mod(i + r, 12)]);
      const bonus = lastPc === r ? 0.06 : 0; // siste tone på grunntonen veier litt
      out.push({ root: r, mode: 'major', score: corr(rot, KK_MAJ) + bonus });
      out.push({ root: r, mode: 'minor', score: corr(rot, KK_MIN) + bonus + 0.02 }); // sjangeren heller mot moll
    }
    out.sort((a, b) => b.score - a.score);
    return out;
  }

  function detectKey(notes) {
    if (!notes.length) return { key: { root: 9, mode: 'minor' }, confidence: 0, candidates: [] };
    const sorted = notes.slice().sort((a, b) => a.t - b.t);
    const cands = detectKeyFromProfile(pcProfile(notes), mod(sorted[sorted.length - 1].p, 12));
    const gap = cands[0].score - cands[1].score;
    const confidence = clamp(0.35 + gap * 4 + Math.max(0, cands[0].score - 0.5) * 0.6, 0, 1);
    return { key: { root: cands[0].root, mode: cands[0].mode }, confidence, candidates: cands.slice(0, 4) };
  }

  /* Akkordgjenkjenning for én tidsluke: vektet tonehøydeprofil mot diatoniske akkordmaler. */
  function matchChord(prof, key) {
    const total = prof.reduce((s, x) => s + x, 0) || 1;
    const results = [];
    const quals = ['', '7', 'sus2', 'sus4', 'M'];
    for (let deg = 0; deg < 7; deg++) {
      for (const q of quals) {
        if (q === 'M' && !(key.mode !== 'major' && deg === 4)) continue;
        const ch = { deg, q };
        if (triadQuality(key, ch) === 'dim' && q === '') continue;
        const pcs = chordPcs(key, ch);
        let s = 0;
        for (let pc = 0; pc < 12; pc++) s += prof[pc] * (pcs.includes(pc) ? 1 : -0.7);
        s = s / total;
        s += prof[pcs[0]] / total * 0.25; // roten i bunn/mest til stede
        if (q === '7') s -= 0.04;
        if (q === 'sus2' || q === 'sus4') s -= 0.06;
        results.push({ chord: ch, score: s });
      }
    }
    results.sort((a, b) => b.score - a.score);
    return results;
  }

  MM.theory = {
    STEPS_PER_BAR, NAMES, MODES, ROMAN, mod, clamp,
    noteName, keyName, tonic, degToPitch, pitchToDeg, inScale, degPc,
    chordDegs, chordPcs, chordRootPc, colorPcs, triadQuality, chordName, roman,
    pcProfile, detectKey, detectKeyFromProfile, matchChord,
  };
})(globalThis.MM = globalThis.MM || {});
