/* Musikalske egenskaper fra en referanse: kontur, intervaller, rytme, fraselengde, pauser, aksenter, akkorder. */
(function (MM) {
  'use strict';
  const T = MM.theory;
  const SPB = T.STEPS_PER_BAR;

  function metricWeight(t) {
    const s = T.mod(Math.round(t * 2) / 2, SPB);
    if (s === 0) return 1;
    if (s === 8) return 0.8;
    if (s % 4 === 0) return 0.6;
    if (s % 2 === 0) return 0.35;
    return 0.15;
  }

  function quantize(notes, grid) {
    const g = grid || 1;
    return notes.map((n) => Object.assign({}, n, {
      t: Math.max(0, Math.round(n.t / g) * g),
      d: Math.max(g, Math.round(n.d / g) * g),
    }));
  }

  /* Flytt slik at første takt med noter blir takt 0. */
  function normalizeStart(notes) {
    if (!notes.length) return notes;
    const minT = Math.min.apply(null, notes.map((n) => n.t));
    const shift = Math.floor(minT / SPB) * SPB;
    return notes.map((n) => Object.assign({}, n, { t: n.t - shift }));
  }

  /* Høyeste tone vinner når noter starter samtidig; varighet kuttes ved neste anslag. */
  function monophonize(notes) {
    const sorted = notes.slice().sort((a, b) => a.t - b.t || b.p - a.p);
    const out = [];
    for (const n of sorted) {
      if (out.length && Math.abs(out[out.length - 1].t - n.t) < 0.25) continue;
      out.push(Object.assign({}, n));
    }
    for (let i = 0; i < out.length - 1; i++) out[i].d = Math.min(out[i].d, out[i + 1].t - out[i].t);
    return out;
  }

  function maxPolyphony(notes) {
    const ev = [];
    for (const n of notes) { ev.push([n.t, 1]); ev.push([n.t + n.d - 0.01, -1]); }
    ev.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    let c = 0, m = 0;
    for (const e of ev) { c += e[1]; m = Math.max(m, c); }
    return m;
  }

  function phraseBars(notes) {
    if (!notes.length) return 4;
    const end = Math.max.apply(null, notes.map((n) => n.t + n.d));
    const bars = Math.ceil((end - 0.5) / SPB);
    for (const b of [1, 2, 4, 8, 16]) if (bars <= b) return b;
    return Math.ceil(bars / 8) * 8;
  }

  function analyzeMelody(notesIn, key, barsIn) {
    const notes = monophonize(normalizeStart(notesIn));
    const bars = barsIn || phraseBars(notes);
    const len = bars * SPB;
    const n = notes.length;
    const degs = notes.map((x) => T.pitchToDeg(key, x.p, 4).deg);
    const ps = notes.map((x) => x.p);
    const lo = Math.min.apply(null, ps), hi = Math.max.apply(null, ps);
    const span = Math.max(1, hi - lo);
    const vmax = Math.max.apply(null, notes.map((x) => x.v || 0.8));
    const dmax = Math.max.apply(null, notes.map((x) => x.d));

    const accents = notes.map((x) => {
      const vel = (x.v || 0.8) / (vmax || 1);
      return Math.round((0.45 * vel + 0.35 * metricWeight(x.t) + 0.2 * (x.d / dmax)) * 100) / 100;
    });

    const gaps = [];
    for (let i = 0; i < n; i++) {
      const end = notes[i].t + notes[i].d;
      const next = i < n - 1 ? notes[i + 1].t : len;
      if (next - end >= 0.99) gaps.push({ t: end, d: next - end });
    }
    if (n && notes[0].t >= 1) gaps.unshift({ t: 0, d: notes[0].t });

    // Fraser deles ved pauser på minst et halvt slag eller lange toner
    const phrases = [];
    let start = 0;
    for (let i = 0; i < n; i++) {
      const end = notes[i].t + notes[i].d;
      const next = i < n - 1 ? notes[i + 1].t : null;
      if (next === null || next - end >= 2 || notes[i].d >= 6) {
        phrases.push({ from: start, to: i, t: notes[start].t, end });
        start = i + 1;
      }
    }

    return {
      bars,
      notes,
      rhythm: { len, onsets: notes.map((x) => x.t), durs: notes.map((x) => x.d), accents },
      contour: {
        shape: ps.map((p) => Math.round((p - lo) / span * 100) / 100),
        dirs: ps.slice(1).map((p, i) => Math.sign(p - ps[i])),
        degs: degs.map((d) => d - degs[0]),
      },
      intervals: { semis: ps.slice(1).map((p, i) => p - ps[i]), steps: degs.slice(1).map((d, i) => d - degs[i]) },
      rests: { gaps, len },
      accents: { values: accents, onsets: notes.map((x) => x.t), len },
      phrase: { bars, phrases, noteCount: n, density: n / bars },
      range: { lo, hi },
    };
  }

  /* Akkordforløp fra (polyfone) noter. slot = steg per akkordluke. */
  function analyzeChords(notesIn, key, barsIn, slot) {
    const notes = normalizeStart(notesIn);
    const bars = barsIn || phraseBars(notes);
    const len = bars * SPB;
    const s = slot || SPB;
    const out = [];
    for (let t0 = 0; t0 < len; t0 += s) {
      const prof = new Array(12).fill(0);
      let lowest = null;
      for (const n of notes) {
        const ov = Math.min(n.t + n.d, t0 + s) - Math.max(n.t, t0);
        if (ov <= 0) continue;
        prof[T.mod(n.p, 12)] += ov * (n.t >= t0 && n.t < t0 + 1 ? 1.3 : 1);
        if (lowest === null || n.p < lowest) lowest = n.p;
      }
      if (lowest !== null) prof[T.mod(lowest, 12)] += s * 0.4; // basstonen hinter om roten
      const total = prof.reduce((a, b) => a + b, 0);
      if (!total) { if (out.length) out[out.length - 1].len += s; continue; }
      const m = T.matchChord(prof, key);
      const conf = T.clamp(0.4 + (m[0].score - m[1].score) * 2 + m[0].score * 0.4, 0, 1);
      const prev = out[out.length - 1];
      if (prev && prev.chord.deg === m[0].chord.deg && prev.chord.q === m[0].chord.q) { prev.len += s; continue; }
      out.push({ t: t0, len: s, chord: m[0].chord, conf: Math.round(conf * 100) / 100, alts: m.slice(1, 4).map((x) => x.chord) });
    }
    return { bars, chords: out };
  }

  /* Gjetter referansetypen ut fra MIDI-innholdet. */
  function guessKind(notes) {
    const poly = maxPolyphony(notes);
    if (poly >= 3) return 'chords';
    return 'melody';
  }

  /* Lager separate bibliotekselementer av en referanse. */
  const FEATURE_TYPES = {
    melody: 'Melodi',
    rhythm: 'Rytme',
    contour: 'Kontur',
    intervals: 'Intervaller',
    phrase: 'Fraselengde',
    rests: 'Pauser',
    accents: 'Aksenter',
    chords: 'Akkordforløp',
  };

  function libraryItems(ref, types) {
    const items = [];
    const key = ref.key;
    const mel = ref.kind === 'chords' ? null : analyzeMelody(ref.notes, key, ref.bars);
    for (const type of types) {
      let data = null;
      if (type === 'chords') {
        const slot = ref.chordSlot || SPB;
        const ch = analyzeChords(ref.notes, key, ref.bars, slot);
        data = { key, bars: ch.bars, chords: ch.chords.map((c) => ({ t: c.t, len: c.len, chord: c.chord, conf: c.conf })) };
      } else if (mel) {
        if (type === 'melody') data = { key, bars: mel.bars, notes: mel.notes.map((n) => ({ t: n.t, d: n.d, p: n.p, v: n.v || 0.8 })) };
        else data = Object.assign({ key, bars: mel.bars }, mel[type]);
      }
      if (!data) continue;
      items.push({ id: 'f' + MM.rng.newSeed().toString(36), type, name: FEATURE_TYPES[type] + ' · ' + ref.name, refId: ref.id, data });
    }
    return items;
  }

  MM.features = {
    metricWeight, quantize, normalizeStart, monophonize, maxPolyphony, phraseBars,
    analyzeMelody, analyzeChords, guessKind, libraryItems, FEATURE_TYPES,
  };
})(globalThis.MM = globalThis.MM || {});
