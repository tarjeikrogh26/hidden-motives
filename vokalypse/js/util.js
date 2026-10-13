/* Vokalypse – felles hjelpefunksjoner: tilfeldighet med frø, musikkteori, timing. */
(function (VK) {
  'use strict';

  VK.SR = 48000;            // all intern bearbeiding og eksport skjer i 48 kHz
  VK.BARS = 16;
  VK.STEPS_PER_BAR = 16;    // 16-deler
  VK.TOTAL_STEPS = VK.BARS * VK.STEPS_PER_BAR;

  // ---------- Tilfeldighet med frø (gjør variasjoner reproduserbare) ----------
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  VK.makeRng = function (seed) {
    const r = mulberry32(seed);
    const rng = {
      seed: seed,
      next: r,
      range: (a, b) => a + (b - a) * r(),
      int: (a, b) => a + Math.floor(r() * (b - a + 1)),
      chance: (p) => r() < p,
      pick: (arr) => arr[Math.floor(r() * arr.length)],
      // items: [[verdi, vekt], ...]
      weighted: (items) => {
        let sum = 0;
        for (const it of items) sum += Math.max(0, it[1]);
        if (sum <= 0) return items.length ? items[0][0] : undefined;
        let x = r() * sum;
        for (const it of items) {
          x -= Math.max(0, it[1]);
          if (x <= 0) return it[0];
        }
        return items[items.length - 1][0];
      },
      shuffle: (arr) => {
        const a = arr.slice();
        for (let i = a.length - 1; i > 0; i--) {
          const j = Math.floor(r() * (i + 1));
          const t = a[i]; a[i] = a[j]; a[j] = t;
        }
        return a;
      },
      gauss: () => {
        let u = 0, v = 0;
        while (u === 0) u = r();
        while (v === 0) v = r();
        return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
      }
    };
    return rng;
  };

  VK.newSeed = function () {
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      const a = new Uint32Array(1);
      crypto.getRandomValues(a);
      return a[0] % 1000000;
    }
    return Math.floor(Math.random() * 1000000);
  };

  // ---------- Musikkteori ----------
  VK.NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  VK.SCALES = {
    minor:     { name: 'Moll (aeolisk)', short: 'moll', iv: [0, 2, 3, 5, 7, 8, 10] },
    dorian:    { name: 'Dorisk',         short: 'dorisk', iv: [0, 2, 3, 5, 7, 9, 10] },
    phrygian:  { name: 'Frygisk',        short: 'frygisk', iv: [0, 1, 3, 5, 7, 8, 10] },
    harmminor: { name: 'Harmonisk moll', short: 'harmmoll', iv: [0, 2, 3, 5, 7, 8, 11] },
    major:     { name: 'Dur',            short: 'dur', iv: [0, 2, 4, 5, 7, 9, 11] },
    minpent:   { name: 'Mollpentaton',   short: 'mollpent', iv: [0, 3, 5, 7, 10] }
  };

  VK.midiToHz = (m) => 440 * Math.pow(2, (m - 69) / 12);
  VK.hzToMidi = (f) => 69 + 12 * Math.log2(f / 440);

  VK.inScale = function (midi, root, scaleKey) {
    const iv = VK.SCALES[scaleKey].iv;
    const pc = (((Math.round(midi) - root) % 12) + 12) % 12;
    return iv.indexOf(pc) >= 0;
  };

  // Nærmeste skalatone (heltall-MIDI) til en (mulig desimal) MIDI-verdi
  VK.snapToScale = function (midi, root, scaleKey) {
    let best = Math.round(midi), bestD = Infinity;
    for (let m = Math.floor(midi) - 7; m <= Math.ceil(midi) + 7; m++) {
      if (!VK.inScale(m, root, scaleKey)) continue;
      const d = Math.abs(m - midi);
      if (d < bestD) { bestD = d; best = m; }
    }
    return best;
  };

  // Flytt en skalatone et antall skalatrinn opp/ned
  VK.scaleStep = function (midi, steps, root, scaleKey) {
    let m = VK.snapToScale(midi, root, scaleKey);
    const dir = steps >= 0 ? 1 : -1;
    let n = Math.abs(steps);
    while (n > 0) {
      m += dir;
      if (VK.inScale(m, root, scaleKey)) n--;
    }
    return m;
  };

  VK.keyLabel = function (root, scaleKey) {
    return VK.NOTE_NAMES[root] + ' ' + VK.SCALES[scaleKey].short;
  };

  // ---------- Timing ----------
  // Lengden rundes til nærmeste hele sample. Ved de fleste BPM-verdier går det opp eksakt;
  // ellers er avviket under en halv sample (≈ 0,01 ms).
  VK.timing = function (bpm) {
    const beatSec = 60 / bpm;
    const stepSec = beatSec / 4;
    const barSec = beatSec * 4;
    const exactSamples = (VK.BARS * 4 * 60 * VK.SR) / bpm;
    const totalSamples = Math.round(exactSamples);
    return {
      bpm: bpm, beatSec: beatSec, stepSec: stepSec, barSec: barSec,
      totalSec: totalSamples / VK.SR,
      exactSamples: exactSamples,
      totalSamples: totalSamples,
      isExact: Math.abs(exactSamples - totalSamples) < 1e-6
    };
  };

  // Tid (sekunder) for et 16-delssteg, med swing på annenhver 16-del
  VK.stepTime = function (step, t, swing) {
    const base = step * t.stepSec;
    const isOff = (Math.floor(step) % 2) === 1;
    return isOff ? base + (swing || 0) * t.stepSec : base;
  };

  VK.fmtNum = function (n, dec) {
    return n.toLocaleString('nb-NO', { minimumFractionDigits: dec || 0, maximumFractionDigits: dec || 0 });
  };

  VK.clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  VK.dbToGain = (db) => Math.pow(10, db / 20);

  VK.uid = (function () {
    let n = 0;
    return function (prefix) { n++; return (prefix || 'id') + '_' + Date.now().toString(36) + '_' + n; };
  })();
})(window.VK = window.VK || {});
