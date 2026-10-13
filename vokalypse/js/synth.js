/* Vokalypse – SYNTETISK formantstemme.
   Dette er en enkel, klassisk vokalsynth: en pulsbølge (stemmebånd) eller støy (hvisk)
   sendes gjennom resonansfiltre som etterligner vokaler. Det er IKKE AI og IKKE menneskelig sang.
   Den forstår ikke språk; bokstaver tolkes grovt som vokaler og konsonantlyder. */
(function (VK) {
  'use strict';

  const S = VK.Synth = {};

  // Formanttabeller (frekvens Hz, nivå dB, båndbredde Hz) – klassiske verdier for sang
  const F = {
    bass: {
      a: [[600, 1040, 2250, 2450, 2750], [0, -7, -9, -9, -20], [60, 70, 110, 120, 130]],
      e: [[400, 1620, 2400, 2800, 3100], [0, -12, -9, -12, -18], [40, 80, 100, 120, 120]],
      i: [[250, 1750, 2600, 3050, 3340], [0, -30, -16, -22, -28], [60, 90, 100, 120, 120]],
      o: [[400, 750, 2400, 2600, 2900], [0, -11, -21, -20, -40], [40, 80, 100, 120, 120]],
      u: [[350, 600, 2400, 2675, 2950], [0, -20, -32, -28, -36], [40, 80, 100, 120, 120]]
    },
    tenor: {
      a: [[650, 1080, 2650, 2900, 3250], [0, -6, -7, -8, -22], [80, 90, 120, 130, 140]],
      e: [[400, 1700, 2600, 3200, 3580], [0, -14, -12, -14, -20], [70, 80, 100, 120, 120]],
      i: [[290, 1870, 2800, 3250, 3540], [0, -15, -18, -20, -30], [40, 90, 100, 120, 120]],
      o: [[400, 800, 2600, 2800, 3000], [0, -10, -12, -12, -26], [40, 80, 100, 120, 120]],
      u: [[350, 600, 2700, 2900, 3300], [0, -20, -17, -14, -26], [40, 60, 100, 120, 120]]
    },
    alto: {
      a: [[800, 1150, 2800, 3500, 4950], [0, -4, -20, -36, -60], [80, 90, 120, 130, 140]],
      e: [[400, 1600, 2700, 3300, 4950], [0, -24, -30, -35, -60], [60, 80, 120, 150, 200]],
      i: [[350, 1700, 2700, 3700, 4950], [0, -20, -30, -36, -60], [50, 100, 120, 150, 200]],
      o: [[450, 800, 2830, 3500, 4950], [0, -9, -16, -28, -55], [70, 80, 100, 130, 135]],
      u: [[325, 700, 2530, 3500, 4950], [0, -12, -30, -40, -64], [50, 60, 170, 180, 200]]
    },
    soprano: {
      a: [[800, 1150, 2900, 3900, 4950], [0, -6, -32, -20, -50], [80, 90, 120, 130, 140]],
      e: [[350, 2000, 2800, 3600, 4950], [0, -20, -15, -40, -56], [60, 100, 120, 150, 200]],
      i: [[270, 2140, 2950, 3900, 4950], [0, -12, -26, -26, -44], [60, 90, 100, 120, 120]],
      o: [[450, 800, 2830, 3800, 4950], [0, -11, -22, -22, -50], [40, 80, 100, 120, 120]],
      u: [[325, 700, 2700, 3800, 4950], [0, -16, -35, -40, -60], [50, 60, 170, 180, 200]]
    }
  };
  // Nasal "m/n": lav, dempet resonans
  for (const v in F) F[v].m = [[260, 1100, 2300, 3000, 3600], [0, -28, -34, -40, -50], [50, 120, 150, 200, 200]];

  S.VOICES = {
    bass: { name: 'Bass', range: [40, 60] },
    tenor: { name: 'Tenor', range: [48, 67] },
    alto: { name: 'Alt', range: [55, 74] },
    soprano: { name: 'Sopran', range: [60, 81] }
  };

  // Konsonantstøy: [senterfrekvens, Q, varighet s, nivå]
  const CONS = {
    s: [6500, 1.6, 0.09, 0.5], sh: [2800, 1.4, 0.1, 0.55], f: [3500, 0.5, 0.07, 0.25],
    h: [1500, 0.4, 0.06, 0.25], t: [4200, 1.2, 0.025, 0.8], k: [1900, 1.5, 0.035, 0.75],
    p: [900, 0.9, 0.02, 0.7], ts: [5500, 1.4, 0.06, 0.6], ch: [3000, 1.3, 0.07, 0.6]
  };

  // ---------- Tekst -> stavelser (grovt, ikke ekte uttale) ----------
  const VMAP = { a: 'a', e: 'e', i: 'i', y: 'i', o: 'o', u: 'u', 'å': 'o', 'æ': 'a', 'ø': 'e', 'ä': 'e', 'ö': 'e', 'ü': 'i' };
  function consOf(cl) {
    if (!cl) return null;
    if (/sch|sh|sj|skj|kj|tj/.test(cl)) return 'sh';
    if (/ch/.test(cl)) return 'ch';
    if (/ts|z|tz/.test(cl)) return 'ts';
    if (/[sc]/.test(cl)) return 's';
    if (/[tdq]/.test(cl)) return 't';
    if (/[kgx]/.test(cl)) return 'k';
    if (/[pb]/.test(cl)) return 'p';
    if (/[fvw]/.test(cl)) return 'f';
    if (/h/.test(cl)) return 'h';
    if (/[mn]/.test(cl)) return 'm';
    if (/[lrj]/.test(cl)) return 'l';
    return null;
  }

  S.parseText = function (text) {
    const words = (text || '').toLowerCase().replace(/[^a-zæøåäöüß\s'-]/g, ' ').split(/[\s-]+/).filter(Boolean);
    const out = [];
    for (let w = 0; w < words.length; w++) {
      const word = words[w];
      const re = /([^aeiouyæøåäöü]*)([aeiouyæøåäöü]+)/g;
      let m, last = 0, first = true;
      const syl = [];
      while ((m = re.exec(word))) {
        syl.push({ onset: consOf(m[1]), vowel: VMAP[m[2][0]] || 'a', coda: null, wordStart: first });
        first = false;
        last = re.lastIndex;
      }
      const tail = word.slice(last);
      if (syl.length === 0) {
        // ord uten vokal, f.eks. "sss" eller "mm"
        const c = consOf(tail);
        if (c === 'm') syl.push({ onset: null, vowel: 'm', coda: null, wordStart: true });
        else if (c) syl.push({ onset: c, vowel: null, coda: null, wordStart: true });
      } else if (tail) {
        syl[syl.length - 1].coda = consOf(tail);
      }
      for (const s of syl) out.push(s);
    }
    return out;
  };

  // ---------- Biquad båndpass (RBJ, 0 dB topp) ----------
  function bpCoefs(f, q, sr) {
    const w0 = 2 * Math.PI * Math.min(f, sr * 0.45) / sr;
    const alpha = Math.sin(w0) / (2 * q);
    const a0 = 1 + alpha;
    return [alpha / a0, 0, -alpha / a0, (-2 * Math.cos(w0)) / a0, (1 - alpha) / a0];
  }
  function makeBP() { return { c: [0, 0, 0, 0, 0], x1: 0, x2: 0, y1: 0, y2: 0 }; }
  function runBP(st, x) {
    const c = st.c;
    const y = c[0] * x + c[1] * st.x1 + c[2] * st.x2 - c[3] * st.y1 - c[4] * st.y2;
    st.x2 = st.x1; st.x1 = x; st.y2 = st.y1; st.y1 = y;
    return y;
  }

  /* Gjengi én stemme.
     notes: [{vowel|null, onset, coda, midi, start (s), dur (s)}]
     opts: {voice, whisper (0..1), breath, vibrato, detuneCents, formantShift} */
  function renderVoice(notes, totalSec, opts, rng, sr) {
    const n = Math.ceil(totalSec * sr);
    const out = new Float32Array(n);
    const table = F[opts.voice] || F.tenor;
    const formantShift = opts.formantShift || 1;
    const bps = [makeBP(), makeBP(), makeBP(), makeBP(), makeBP()];
    const cbp = makeBP();
    const det = Math.pow(2, (opts.detuneCents || 0) / 1200);
    const whisper = VK.clamp(opts.whisper || 0, 0, 1);
    const breath = opts.breath != null ? opts.breath : 0.08;
    const vibDepth = opts.vibrato != null ? opts.vibrato : 0.25;
    const vibRate = 4.8 + rng.next() * 1.4;
    let phase = rng.next(), prevFlow = 0, f0s = 0, jitter = 0;
    const BLOCK = 32;

    for (const note of notes) {
      const s0 = Math.floor(note.start * sr);
      const consDur = note.onset && CONS[note.onset] ? CONS[note.onset][2] : 0;
      const vowelStart = s0 + Math.floor(consDur * sr * 0.8);
      const s1 = Math.min(n, Math.floor((note.start + note.dur) * sr));
      const codaDur = note.coda && CONS[note.coda] ? CONS[note.coda][2] : 0;
      const vowelEnd = Math.max(vowelStart + 1, s1 - Math.floor(codaDur * sr));
      const targetHz = VK.midiToHz(note.midi) * det;
      if (!f0s) f0s = targetHz;
      const vName = note.vowel || 'a';
      const vt = table[vName] || table.a;
      const nextV = note.nextVowel && table[note.nextVowel] ? table[note.nextVowel] : vt;
      const coefsFor = function (frac) {
        // glid mot neste vokal i siste 25 % av tonen
        const g = frac > 0.75 ? (frac - 0.75) / 0.25 * 0.5 : 0;
        for (let k = 0; k < 5; k++) {
          const f = (vt[0][k] * (1 - g) + nextV[0][k] * g) * formantShift;
          const bw = vt[2][k] * (1 - g) + nextV[2][k] * g;
          bps[k].c = bpCoefs(f, Math.max(1, f / (bw * (whisper > 0.5 ? 1.8 : 1))), sr);
        }
      };
      const gains = vt[1].map((db) => VK.dbToGain(db));
      const voiced = note.vowel !== null && note.vowel !== undefined;

      // konsonant ved start
      if (note.onset && CONS[note.onset]) {
        const c = CONS[note.onset];
        cbp.c = bpCoefs(c[0] * (0.9 + 0.2 * rng.next()), c[1], sr);
        const len = Math.floor(c[2] * sr);
        for (let i = 0; i < len && s0 + i < n; i++) {
          const env = Math.sin(Math.PI * Math.min(1, i / (len * 0.3))) * (1 - i / len);
          out[s0 + i] += runBP(cbp, rng.next() * 2 - 1) * c[3] * env * 1.6;
        }
      }
      if (note.onset === 'l') { /* flytende: myk innsving, håndteres av attack */ }

      // vokal
      if (voiced) {
        const att = Math.floor(0.018 * sr), rel = Math.floor(0.035 * sr);
        const len = vowelEnd - vowelStart;
        for (let b = vowelStart; b < vowelEnd && b < n; b += BLOCK) {
          coefsFor((b - vowelStart) / Math.max(1, len));
          const end = Math.min(vowelEnd, b + BLOCK, n);
          for (let i = b; i < end; i++) {
            const t = (i - s0) / sr;
            f0s += (targetHz - f0s) * 0.0025; // portamento
            jitter += ((rng.next() * 2 - 1) * 0.002 - jitter) * 0.01;
            const vib = vibDepth * Math.min(1, Math.max(0, (t - 0.15) / 0.3)) * Math.sin(2 * Math.PI * vibRate * t);
            const f0 = f0s * Math.pow(2, vib / 12) * (1 + jitter);
            phase += f0 / sr;
            if (phase >= 1) phase -= 1;
            // Rosenberg-glottispuls; derivasjonen er eksitasjonen
            const tp = 0.42, tn = 0.18;
            let flow;
            if (phase < tp) flow = 0.5 * (1 - Math.cos(Math.PI * phase / tp));
            else if (phase < tp + tn) flow = Math.cos(0.5 * Math.PI * (phase - tp) / tn);
            else flow = 0;
            let exc = (flow - prevFlow) * sr / f0 * 0.12;
            prevFlow = flow;
            const noise = rng.next() * 2 - 1;
            exc = exc * (1 - whisper) + noise * (breath * flow + whisper * 0.9);
            let y = 0;
            for (let k = 0; k < 5; k++) y += runBP(bps[k], exc) * gains[k];
            const ia = i - vowelStart, ir = vowelEnd - i;
            const env = Math.min(1, ia / att) * Math.min(1, ir / rel);
            const trem = note.onset === 'l' ? (0.7 + 0.3 * Math.min(1, ia / (0.06 * sr))) : 1;
            out[i] += y * env * trem * (whisper > 0.5 ? 2.2 : 1);
          }
        }
      }

      // konsonant ved slutt
      if (note.coda && CONS[note.coda]) {
        const c = CONS[note.coda];
        cbp.c = bpCoefs(c[0], c[1], sr);
        const len = Math.floor(c[2] * sr * 1.3);
        const st = vowelEnd - Math.floor(len * 0.2);
        for (let i = 0; i < len && st + i < n; i++) {
          if (st + i < 0) continue;
          const env = Math.min(1, i / (len * 0.2)) * Math.pow(1 - i / len, 1.5);
          out[st + i] += runBP(cbp, rng.next() * 2 - 1) * c[3] * env * 1.4;
        }
      }
    }
    return out;
  }

  /* Hoved-API: lag et syntetisk klipp.
     spec: { text, voice ('bass'|'tenor'|'alto'|'soprano'|'mixed'), whisper (bool),
             melody ('mono'|'fall'|'rise'|'scale'), stepsPerSyl, voices (antall), bpm, root, scale, seed } */
  S.render = function (spec) {
    const sr = VK.SR;
    const rng = VK.makeRng(spec.seed || 1);
    const t = VK.timing(spec.bpm || 124);
    const syls = S.parseText(spec.text || 'a');
    if (!syls.length) throw new Error('Fant ingen stavelser i teksten.');
    const stepsPer = spec.stepsPerSyl || 2;
    const root = spec.root || 0, scale = spec.scale || 'minor';
    const voiceKey = spec.voice === 'mixed' ? 'tenor' : (spec.voice || 'tenor');
    const range = S.VOICES[voiceKey].range;
    // grunntone i stemmens leie
    let base = root + 12 * Math.floor((range[0] + 4 - root) / 12);
    if (base < range[0]) base += 12;
    const notes = [];
    let cur = base;
    for (let i = 0; i < syls.length; i++) {
      const s = syls[i];
      let midi = cur;
      if (spec.melody === 'fall') midi = VK.scaleStep(base + 7, -i, root, scale);
      else if (spec.melody === 'rise') midi = VK.scaleStep(base, i, root, scale);
      else if (spec.melody === 'scale') {
        cur = VK.scaleStep(cur, rng.pick([-2, -1, 0, 1, 1, 2, 3]), root, scale);
        if (cur > range[1]) cur -= 12;
        if (cur < range[0]) cur += 12;
        midi = cur;
      }
      const lenSteps = (s.vowel ? stepsPer : 1) * (i === syls.length - 1 && spec.holdLast ? 3 : 1);
      notes.push({
        vowel: s.vowel, onset: s.onset, coda: s.coda, midi: midi, start: 0,
        dur: lenSteps * t.stepSec
      });
    }
    // starttider: tonene etter hverandre, med valgfri pause mellom ord
    let pos = 0.02;
    for (let i = 0; i < notes.length; i++) {
      if (syls[i].wordStart && i > 0) pos += t.stepSec * (spec.wordGap || 0);
      notes[i].start = pos;
      notes[i].nextVowel = notes[i + 1] ? notes[i + 1].vowel : null;
      pos += notes[i].dur;
    }
    const total = pos + 0.25;
    const nVoices = Math.max(1, Math.min(8, spec.voices || 1));
    const L = new Float32Array(Math.ceil(total * sr)), R = new Float32Array(L.length);
    const voiceTypes = spec.voice === 'mixed' ? ['bass', 'tenor', 'alto', 'soprano'] : [voiceKey];
    for (let v = 0; v < nVoices; v++) {
      const vtype = voiceTypes[v % voiceTypes.length];
      const octave = spec.voice === 'mixed' ? ({ bass: -12, tenor: 0, alto: 0, soprano: 12 }[vtype]) : 0;
      const shifted = notes.map((nn) => Object.assign({}, nn, {
        midi: nn.midi + octave,
        start: nn.start + (v === 0 ? 0 : rng.range(0, 0.03))
      }));
      const mono = renderVoice(shifted, total, {
        voice: vtype,
        whisper: spec.whisper ? 1 : 0,
        breath: spec.whisper ? 0 : 0.06 + rng.next() * 0.06,
        vibrato: nVoices > 1 ? 0.15 + rng.next() * 0.2 : 0.22,
        detuneCents: v === 0 ? 0 : rng.range(-14, 14),
        formantShift: 1 + (v === 0 ? 0 : rng.range(-0.04, 0.04))
      }, VK.makeRng((spec.seed || 1) * 31 + v * 7919), sr);
      const pan = nVoices === 1 ? 0 : (v / (nVoices - 1)) * 1.6 - 0.8;
      const gl = Math.cos((pan + 1) * Math.PI / 4), gr = Math.sin((pan + 1) * Math.PI / 4);
      for (let i = 0; i < mono.length; i++) { L[i] += mono[i] * gl; R[i] += mono[i] * gr; }
    }
    VK.DSP.normalizePeak([L, R], 0.8);
    VK.DSP.fade(L, 64, 2400); VK.DSP.fade(R, 64, 2400);
    return { channels: [L, R], notes: notes };
  };

  // ---------- Tekstfragmenter: rare, konkrete, ikke klubbklisjeer ----------
  S.FRAGMENTS = {
    no: ['kald strøm', 'tell baklengs', 'under lysrøret', 'saltet glass', 'hvem eier gulvet', 'ståltråd i munnen',
      'stille fabrikk', 'nummer sju svarer ikke', 'ekko fra kjelleren', 'vask maskinen', 'jern og ozon',
      'kartet brenner', 'ikke rør antennen', 'blekk i vannet', 'sov med lyset på', 'ventilasjon',
      'feil frekvens', 'tannhjul', 'hvit støy', 'speilet teller'],
    en: ['sodium light', 'count it backwards', 'nobody owns the floor', 'copper in the mouth', 'wash the machine',
      'teeth of the radio', 'the room is listening', 'ozone and iron', 'quiet factory', 'wrong frequency',
      'carry the static', 'number seven is silent', 'glass hymn', 'ink in the water', 'feed the relay',
      'concrete choir', 'leave the antenna', 'paper lungs', 'the mirror counts', 'slow procession'],
    de: ['kaltes Licht', 'rückwärts zählen', 'Kupfer im Mund', 'falsche Frequenz', 'leise Fabrik',
      'der Raum hört zu', 'Glas und Ozon', 'Nummer sieben schweigt', 'Tinte im Wasser', 'Papierlunge'],
    syl: ['ta ka tsi ka', 'oh ah oh', 'mm na mm', 'ki ri ki', 'sha ta', 'oo eh', 'dum ta dum', 'hah', 'tsk tsk ah', 'lo lo li']
  };

  // Ord som ofte gir generiske EDM-tekster – appen advarer, men hindrer ikke
  S.CLICHES = ['tonight', 'feel the', 'hands up', 'let go', 'the night', 'higher', 'dance floor', 'dancefloor', 'party',
    'fire', 'heart', 'love', 'forever', 'free', 'alive', 'baby', 'together', 'get down', 'drop', 'euphoria', 'lose control',
    'i natt', 'kjærlighet', 'hjertet', 'for alltid', 'sammen'];
  S.clicheHits = function (text) {
    const t = ' ' + (text || '').toLowerCase() + ' ';
    return S.CLICHES.filter((c) => t.indexOf(c) >= 0);
  };
})(window.VK = window.VK || {});
