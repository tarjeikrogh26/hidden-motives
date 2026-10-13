/* TRE SPOR – kjerne: navnerom, deterministisk tilfeldighet, skalaer og standardtilstand.
   Ren JavaScript uten DOM, slik at den også kan testes i Node. */
(function (root) {
  'use strict';
  var TS = root.TS = root.TS || {};

  TS.VERSION = 1;
  TS.TRACKS = ['drums', 'bass', 'synth'];
  TS.MELODIC = ['bass', 'synth'];
  TS.TRACK_NAMES = { drums: 'Trommer', bass: 'Bass', synth: 'Synth' };

  /* ---------- små hjelpere ---------- */
  TS.clamp = function (v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; };
  TS.lerp = function (a, b, t) { return a + (b - a) * t; };
  TS.clone = function (o) { return o === undefined ? undefined : JSON.parse(JSON.stringify(o)); };

  TS.getPath = function (obj, path) {
    var o = obj;
    for (var i = 0; i < path.length; i++) { if (o == null) return undefined; o = o[path[i]]; }
    return o;
  };
  TS.setPath = function (obj, path, value) {
    var o = obj;
    for (var i = 0; i < path.length - 1; i++) o = o[path[i]];
    o[path[path.length - 1]] = value;
  };

  /* ---------- deterministisk tilfeldighet ----------
     Alle tilfeldige valg er en ren funksjon av (frø, spor, steg, runde, formål).
     Samme frø gir derfor samme musikk, uansett når eller hvor ofte det spilles av. */
  function strHash(s) {
    var h = 2166136261;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function mix(h, v) {
    v = Math.imul(v | 0, 0xcc9e2d51); v = (v << 15) | (v >>> 17); v = Math.imul(v, 0x1b873593);
    h ^= v; h = (h << 13) | (h >>> 19); return (Math.imul(h, 5) + 0xe6546b64) | 0;
  }
  TS.hash = function () {
    var h = 0x9747b28c;
    for (var i = 0; i < arguments.length; i++) {
      var a = arguments[i];
      h = mix(h, typeof a === 'string' ? strHash(a) : Math.floor(a));
    }
    h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
    return h >>> 0;
  };
  TS.rand = function () { return TS.hash.apply(null, arguments) / 4294967296; };

  /* ---------- toner ---------- */
  TS.NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'H'];
  TS.SCALES = {
    moll:      { name: 'Moll',             pcs: [0, 2, 3, 5, 7, 8, 10] },
    dur:       { name: 'Dur',              pcs: [0, 2, 4, 5, 7, 9, 11] },
    dorisk:    { name: 'Dorisk',           pcs: [0, 2, 3, 5, 7, 9, 10] },
    frygisk:   { name: 'Frygisk',          pcs: [0, 1, 3, 5, 7, 8, 10] },
    mixolydisk:{ name: 'Mixolydisk',       pcs: [0, 2, 4, 5, 7, 9, 10] },
    harmmoll:  { name: 'Harmonisk moll',   pcs: [0, 2, 3, 5, 7, 8, 11] },
    mollpenta: { name: 'Moll-pentaton',    pcs: [0, 3, 5, 7, 10] },
    durpenta:  { name: 'Dur-pentaton',     pcs: [0, 2, 4, 7, 9] },
    egen:      { name: 'Egne toner',       pcs: null }
  };
  TS.scaleAllowed = function (scaleId) {
    var a = []; var pcs = TS.SCALES[scaleId].pcs;
    for (var i = 0; i < 12; i++) a.push(pcs.indexOf(i) >= 0);
    return a;
  };
  /* tillatte toner som halvtoner over grunntonen, stigende */
  TS.allowedPcs = function (song) {
    var out = [];
    for (var i = 0; i < 12; i++) if (song.allowed[i]) out.push(i);
    return out.length ? out : [0];
  };
  /* skalatrinn → halvtoner over grunntonen (trinn kan gå over flere oktaver) */
  TS.degreeToSemis = function (song, deg) {
    var pcs = TS.allowedPcs(song), n = pcs.length;
    var oct = Math.floor(deg / n), i = ((deg % n) + n) % n;
    return oct * 12 + pcs[i];
  };
  TS.DEG_MAX = 14;
  /* grunnleie: bass E1–D#2, synth E3–D#4, slik at alle tonearter ligger i et godt register */
  TS.trackBaseMidi = function (song, id) {
    var off = ((song.root - 4) % 12 + 12) % 12;
    return (id === 'bass' ? 28 : 52) + off;
  };
  TS.midiName = function (m) {
    return TS.NOTE_NAMES[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1);
  };
  TS.mtof = function (m) { return 440 * Math.pow(2, (m - 69) / 12); };

  /* ---------- tid ---------- */
  TS.stepDur = function (song) { return 60 / song.bpm / 4; };            // én sekstendedel
  TS.swingOffset = function (song, n, dur) {                             // forsinkelse for oddetallssteg
    return (n % 2 === 1) ? (song.swing - 0.5) * 2 * dur : 0;
  };

  /* ---------- standardtilstand ---------- */
  function drumSteps(on, acc, prob) {
    var s = [];
    for (var i = 0; i < 16; i++) {
      s.push({ on: on.indexOf(i) >= 0, acc: (acc || []).indexOf(i) >= 0, prob: (prob && prob[i] != null) ? prob[i] : 1 });
    }
    return s;
  }
  function melSteps(def) {
    var s = [];
    for (var i = 0; i < 16; i++) {
      var d = def[i];
      s.push(d ? { on: true, deg: d[0], oct: d[1] || 0, gate: d[2] != null ? d[2] : 0.5, prob: d[3] != null ? d[3] : 1 }
               : { on: false, deg: 0, oct: 0, gate: 0.5, prob: 1 });
    }
    return s;
  }

  TS.DRUM_VOICES = [
    { id: 'kick',  name: 'Kick',     gm: 36 },
    { id: 'clap',  name: 'Klapp',    gm: 39 },
    { id: 'hat',   name: 'Hihat',    gm: 42 },
    { id: 'open',  name: 'Åpen hat', gm: 46 },
    { id: 'perc',  name: 'Perk',     gm: 37 }
  ];
  /* stemmene som bærer grunnpulsen; tetthet tynner dem aldri ut */
  TS.DRUM_ANCHORS = ['kick', 'clap'];

  TS.defaultState = function () {
    var hatProb = {}; [1, 3, 5, 7, 9, 11, 13, 15].forEach(function (i) { hatProb[i] = 0.35; });
    return {
      v: TS.VERSION,
      song: {
        bpm: 122, swing: 0.54, root: 2, scale: 'moll', allowed: TS.scaleAllowed('moll'),
        seed: 1977, freeze: false, evolve: true
      },
      tracks: {
        drums: {
          lock: false, mute: false, vol: 0.8,
          macros: { density: 0.5, movement: 0.3, intensity: 0.5 },
          mode: 'kit', loopBars: 2, loopLevel: 0.8,
          voices: [
            { id: 'kick', level: 0.95, pitch: 0, decay: 1, steps: drumSteps([0, 4, 8, 12], [0, 8]) },
            { id: 'clap', level: 0.6,  pitch: 0, decay: 1, steps: drumSteps([4, 12], [12]) },
            { id: 'hat',  level: 0.38, pitch: 0, decay: 1, steps: drumSteps([1, 2, 3, 5, 6, 7, 9, 10, 11, 13, 14, 15], [2, 6, 10, 14], hatProb) },
            { id: 'open', level: 0.3,  pitch: 0, decay: 0.7, steps: drumSteps([10], [], { 10: 0.5 }) },
            { id: 'perc', level: 0.4,  pitch: 0, decay: 1, steps: drumSteps([7, 13], [], { 7: 0.45, 13: 0.6 }) }
          ],
          mutations: []
        },
        bass: {
          lock: false, mute: false, vol: 0.8,
          macros: { density: 0.5, movement: 0.5, intensity: 0.5 },
          seq: {
            length: 16, rate: 1, rotate: 0, reset: 0,
            steps: melSteps({
              2: [0, 0, 0.55], 3: [0, 0, 0.3, 0.5], 6: [0, 0, 0.55], 7: [7, 0, 0.25, 0.4],
              10: [0, 0, 0.55], 11: [2, 0, 0.3, 0.6], 14: [3, 0, 0.6], 15: [4, 0, 0.3, 0.35]
            })
          },
          mutations: []
        },
        synth: {
          lock: false, mute: false, vol: 0.62,
          macros: { density: 0.5, movement: 0.6, intensity: 0.5 },
          seq: {
            length: 12, rate: 1, rotate: 0, reset: 0,
            steps: melSteps({
              0: [4, 0, 0.5], 2: [7, 0, 0.4], 3: [6, 0, 0.3, 0.5], 5: [4, 0, 0.5],
              6: [2, 0, 0.4, 0.7], 8: [4, 0, 0.6], 9: [9, 0, 0.3, 0.4], 10: [7, 0, 0.5]
            })
          },
          mutations: []
        }
      },
      /* Synthinnstillinger og modulasjon ligger i hver sin egen del av prosjektet */
      synths: {
        drums: { tone: 16000, drive: 0.15, reverb: 0.08, delay: 0, pan: 0 },
        bass: {
          wave: 'sawtooth', wave2: 'square', color: 0.25, detune: 7, sub: 0.45, octave: 0,
          cutoff: 380, res: 7, envAmt: 2.6, attack: 0.003, decay: 0.18, sustain: 0.35, release: 0.09,
          fdecay: 0.16, glide: 0, drive: 0.35, reverb: 0.04, delay: 0, pan: 0, mono: true
        },
        synth: {
          wave: 'square', wave2: 'sawtooth', color: 0.45, detune: 11, sub: 0, octave: 0,
          cutoff: 1500, res: 4, envAmt: 1.6, attack: 0.006, decay: 0.32, sustain: 0.25, release: 0.35,
          fdecay: 0.25, glide: 0, drive: 0.15, reverb: 0.32, delay: 0.24, pan: 0, mono: false
        }
      },
      modulation: {
        lfo: { shape: 'sine', bars: 2 },
        drift: { bars: 16 },
        chance: { bars: 1 },
        routes: [
          { on: true,  src: 'lfo',    track: 'bass',  dest: 'filter', depth: 0.3 },
          { on: true,  src: 'lfo',    track: 'synth', dest: 'filter', depth: 0.45 },
          { on: true,  src: 'drift',  track: 'synth', dest: 'klang',  depth: 0.5 },
          { on: true,  src: 'drift',  track: 'bass',  dest: 'env',    depth: 0.45 },
          { on: true,  src: 'chance', track: 'synth', dest: 'pan',    depth: 0.35 },
          { on: false, src: 'lfo',    track: 'drums', dest: 'filter', depth: -0.3 }
        ],
        variation: {
          bass:  { rate: 0.12, oct: 0.6, len: 0.4, rest: 0.4, nabo: 0 },
          synth: { rate: 0.2,  oct: 0.5, len: 0.5, rest: 0.3, nabo: 0.3 }
        }
      },
      runtime: { evoCount: 0, barsSince: 0, lastTrack: null }
    };
  };

  /* Fyller inn manglende felter (eldre prosjektfiler) fra standardtilstanden */
  TS.migrate = function (s) {
    var d = TS.defaultState();
    function fill(dst, src) {
      for (var k in src) {
        if (!(k in dst)) dst[k] = TS.clone(src[k]);
        else if (src[k] && typeof src[k] === 'object' && !Array.isArray(src[k]) && dst[k] && typeof dst[k] === 'object') fill(dst[k], src[k]);
      }
    }
    fill(s, d);
    return s;
  };
})(typeof window !== 'undefined' ? window : globalThis);
