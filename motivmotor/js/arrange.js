/* Arrangement: lange spor bygget av 8-takters fraser. Intro, oppbygging, hovedpartier, breakdown, løft og avslutning.
   Hver stemme genereres fra sitt eget frø, slik at én del kan låses mens andre regenereres. */
(function (MM) {
  'use strict';
  const T = MM.theory;
  const H = MM.harmony;
  const SPB = T.STEPS_PER_BAR;

  const STYLES = {
    house: { label: 'Progressive house', bpm: 124, swing: 0.1 },
    trance: { label: 'Progressive trance', bpm: 130, swing: 0 },
    driving: { label: 'Drivende melodisk trance', bpm: 138, swing: 0 },
  };

  const DRUM = { kick: 36, clap: 39, snare: 38, hat: 42, open: 46, ride: 51, crash: 49, perc: 70 };
  const PARTS = ['drums', 'bass', 'pad', 'pluck', 'lead'];
  const PART_LABELS = { drums: 'Trommer', bass: 'Bass', pad: 'Pad', pluck: 'Akkordrytme', lead: 'Hovedmelodi' };
  /* Låsegrupper: det brukeren låser/regenererer. */
  const GROUPS = { melody: ['lead'], chords: ['pad', 'pluck'], bass: ['bass'], drums: ['drums'] };
  const GROUP_LABELS = { melody: 'Melodi', chords: 'Akkorder/pad', bass: 'Bass', drums: 'Trommer' };

  const SECTION_LABELS = {
    intro: 'Intro', build: 'Oppbygging', main1: 'Hovedparti 1', breakdown: 'Breakdown',
    lift: 'Løft', main2: 'Hovedparti 2', main3: 'Hovedparti 3', outro: 'Avslutning',
  };

  /* ---------- seksjonsplan ---------- */

  function totalBarsFor(lengthMin, bpm) {
    return Math.max(64, Math.round(lengthMin * bpm / 4 / 8) * 8);
  }

  function planSections(totalBars, style, energy, breakdown) {
    const bdW = style === 'house' ? 1.5 : style === 'driving' ? 2.4 : 2;
    let defs = [
      { type: 'intro', w: 2, min: 2 },
      { type: 'build', w: 1.5, min: 1 },
      { type: 'main1', w: 2, min: 2 },
    ];
    if (breakdown) defs.push({ type: 'breakdown', w: bdW, min: 2 }, { type: 'lift', w: energy >= 4 ? 1.2 : 1, min: 1 });
    defs.push({ type: 'main2', w: 2.5, min: 2 });
    if (totalBars >= 216) defs.push({ type: 'main3', w: 1.5, min: 1 });
    defs.push({ type: 'outro', w: 2, min: 2 });
    let units = Math.round(totalBars / 8);
    let need = defs.reduce((s, d) => s + d.min, 0);
    while (need > units) {
      // korte spor: krymp introen/avslutningen først, så dropp ekstra hovedparti
      const shrink = defs.find((d) => (d.type === 'intro' || d.type === 'outro' || d.type === 'main1' || d.type === 'main2' || d.type === 'breakdown') && d.min > 1);
      if (shrink) shrink.min--; else break;
      need = defs.reduce((s, d) => s + d.min, 0);
    }
    units = Math.max(units, need);
    const alloc = defs.map((d) => d.min);
    let rest = units - need;
    const wsum = defs.reduce((s, d) => s + d.w, 0);
    const exact = defs.map((d) => rest * d.w / wsum);
    const floor = exact.map(Math.floor);
    floor.forEach((f, i) => { alloc[i] += f; rest -= f; });
    const order = exact.map((e, i) => [e - floor[i], i]).sort((a, b) => b[0] - a[0]);
    for (let k = 0; k < rest; k++) alloc[order[k % order.length][1]]++;
    let start = 0;
    return defs.map((d, i) => {
      const s = { type: d.type, label: SECTION_LABELS[d.type], start, bars: alloc[i] * 8 };
      start += s.bars;
      return s;
    });
  }

  const ENERGY = { intro: 0.3, build: 0.5, main1: 0.75, breakdown: 0.35, lift: 0.65, main2: 1, main3: 0.95, outro: 0.4 };

  /* Filterkurver (0–1) per buss og seksjon: [start, slutt]. */
  const FILTERS = {
    intro: { bass: [0.45, 0.6], pad: [0.3, 0.4], pluck: [0.3, 0.4], lead: [0.4, 0.5] },
    build: { bass: [0.55, 0.85], pad: [0.3, 0.6], pluck: [0.3, 0.7], lead: [0.35, 0.6] },
    main1: { bass: [0.9, 0.9], pad: [0.75, 0.8], pluck: [0.8, 0.85], lead: [0.8, 0.85] },
    breakdown: { bass: [0.5, 0.6], pad: [0.45, 0.9], pluck: [0.5, 0.7], lead: [0.6, 0.9] },
    lift: { bass: [0.4, 0.9], pad: [0.55, 1], pluck: [0.3, 1], lead: [0.5, 1] },
    main2: { bass: [1, 1], pad: [0.9, 0.9], pluck: [1, 1], lead: [1, 1] },
    main3: { bass: [1, 1], pad: [0.9, 0.9], pluck: [1, 1], lead: [1, 1] },
    outro: { bass: [0.9, 0.5], pad: [0.7, 0.3], pluck: [0.8, 0.3], lead: [0.7, 0.3] },
  };

  /* ---------- hjelpere ---------- */

  function chordAtSong(theme, t) { return H.chordAt(theme.chords, t, theme.bars * SPB); }

  function forEachChordSpan(theme, from, to, fn) {
    const loop = theme.bars * SPB;
    for (let base = Math.floor(from / loop) * loop; base < to; base += loop) {
      for (const c of theme.chords) {
        const s = Math.max(from, base + c.t), e = Math.min(to, base + c.t + c.len);
        if (e > s) fn(c.chord, s, e);
      }
    }
  }

  function bassPitch(key, chord) {
    const pc = T.chordRootPc(key, chord);
    let p = 24 + pc;
    if (p < 28) p += 12;
    return p;
  }

  function pct(arr, q) {
    if (!arr.length) return null;
    const s = arr.slice().sort((a, b) => a - b);
    return s[Math.min(s.length - 1, Math.floor(q * s.length))];
  }

  /* ---------- trommer ---------- */

  const PERC_PATTERNS = {
    house: [[3, 7, 11, 15], [2, 3, 6, 7, 10, 11, 14, 15], [3, 6, 10, 13, 15], [1, 3, 7, 9, 11, 15]],
    trance: [[3, 7, 11, 15], [2, 6, 10, 14], [3, 11], [1, 3, 5, 7, 9, 11, 13, 15]],
  };
  PERC_PATTERNS.driving = PERC_PATTERNS.trance;

  const FILLS = [
    [[12, 0.55], [14, 0.7], [15, 0.85]],
    [[12, 0.5], [13, 0.6], [14, 0.75], [15, 0.9]],
    [[10, 0.5], [12, 0.6], [14, 0.8]],
    [[13, 0.6], [14, 0.7], [15, 0.85]],
  ];

  function genDrums(ctx) {
    const { sections, style, energy, rng } = ctx;
    const notes = [];
    const add = (t, p, v, d) => notes.push({ t, d: d || 1, p, v: Math.round(T.clamp(v, 0.05, 1) * 100) / 100 });
    const perc = rng.pick(PERC_PATTERNS[style] || PERC_PATTERNS.trance);
    const fill = rng.pick(FILLS);
    const hatAccent = rng.pick([[0.45, 0.25, 0.7, 0.3], [0.5, 0.3, 0.8, 0.35], [0.4, 0.4, 0.75, 0.4]]);
    const openOnOff = style !== 'house' || rng.chance(0.5);
    const useRide = style === 'driving' || (energy >= 4 && rng.chance(0.5));
    const fillEvery = energy >= 4 ? 8 : 16;

    for (const sec of sections) {
      const end = sec.start + sec.bars;
      for (let bar = sec.start; bar < end; bar++) {
        const b = bar * SPB;
        const local = bar - sec.start;
        const lastBar = bar === end - 1;
        const prog = local / sec.bars;
        const type = sec.type;
        let kick = type !== 'breakdown' && type !== 'lift';
        if ((type === 'build') && lastBar) kick = false; // ett takts kick-pause før hovedpartiet
        let clap = !(type === 'intro' && (local < sec.bars / 2 || energy < 3)) && type !== 'breakdown' && type !== 'lift';
        if (type === 'outro' && prog >= 0.75) clap = false;
        const hats = !(type === 'intro' && local < 8) && type !== 'breakdown' && !(type === 'outro' && prog >= 0.875);
        const main = type.indexOf('main') === 0;
        const full16 = main && energy >= 3;
        const percOn = (main || type === 'build' || (type === 'intro' && local >= sec.bars / 2 && energy >= 4)) && energy >= 2;

        if (kick) for (let q = 0; q < 4; q++) add(b + q * 4, DRUM.kick, q === 0 ? 1 : 0.95);
        if (clap) { add(b + 4, DRUM.clap, 0.85); add(b + 12, DRUM.clap, 0.85); }
        if (hats) {
          for (let q = 0; q < 4; q++) {
            if (openOnOff && (main || type === 'build')) add(b + q * 4 + 2, DRUM.open, 0.6, 2);
            else add(b + q * 4 + 2, DRUM.hat, 0.7);
            if (full16) { add(b + q * 4, DRUM.hat, hatAccent[0]); add(b + q * 4 + 1, DRUM.hat, hatAccent[1]); add(b + q * 4 + 3, DRUM.hat, hatAccent[3]); }
          }
        }
        if (useRide && (type === 'main2' || type === 'main3')) for (let q = 0; q < 4; q++) add(b + q * 4 + 2, DRUM.ride, 0.45, 2);
        if (percOn) for (const s of perc) add(b + s, DRUM.perc, 0.35 + (s % 4 === 3 ? 0.15 : 0));
        // innfyll ved fraseslutt i hovedpartiene
        if ((main || type === 'build') && energy >= 2 && (local + 1) % fillEvery === 0 && !lastBar) {
          for (const [s, v] of fill) add(b + s, DRUM.snare, v * 0.85);
        }
        // crash ved starten av store partier
        if (local === 0 && (main || type === 'breakdown')) add(b, DRUM.crash, 0.75, 8);
        // virvel i løftet: kvartnoter → åttendeler → sekstendeler → trettitoendeler
        if (type === 'lift' || (type === 'build' && !ctx.hasLift && local >= sec.bars - 4)) {
          const rp = type === 'lift' ? prog : (local - (sec.bars - 4)) / 4;
          const step = rp < 0.25 ? 4 : rp < 0.5 ? 2 : rp < 0.875 ? 1 : 0.5;
          for (let s = 0; s < SPB; s += step) add(b + s, DRUM.snare, 0.3 + 0.65 * (rp + s / SPB / sec.bars), step < 1 ? 0.5 : 1);
        }
      }
    }
    return notes.sort((a, b) => a.t - b.t || a.p - b.p);
  }

  /* ---------- bass ---------- */

  const BASS_PATTERNS = {
    trance: [
      { name: 'rullende', steps: [1, 2, 3], oct: [] },
      { name: 'galopp', steps: [2, 3], oct: [] },
      { name: 'rullende med oktav', steps: [1, 2, 3], oct: [3] },
    ],
    driving: [
      { name: 'rullende med oktav', steps: [1, 2, 3], oct: [3] },
      { name: 'rullende', steps: [1, 2, 3], oct: [] },
      { name: 'oktavhopp', steps: [1, 2, 3], oct: [2] },
    ],
    house: [
      { name: 'offbeat', steps: [2], len: 2, oct: [] },
      { name: 'synkopert', bar: [[2, 2], [6, 1], [7, 2], [10, 2], [14, 2]], oct: [] },
      { name: 'offbeat med oktav', steps: [2, 3], oct: [3] },
    ],
  };

  function genBass(ctx) {
    const { sections, style, energy, key, theme, rng } = ctx;
    const pats = BASS_PATTERNS[style] || BASS_PATTERNS.trance;
    let pat = rng.pick(energy <= 2 ? pats.slice(0, 2) : pats);
    const approach = energy >= 3 && rng.chance(0.75);
    const notes = [];
    const add = (t, p, v, d) => notes.push({ t, d, p, v: Math.round(v * 100) / 100 });
    for (const sec of sections) {
      const s0 = sec.start * SPB, s1 = (sec.start + sec.bars) * SPB;
      let mode = null;
      if (sec.type === 'intro') mode = energy >= 3 ? 'late' : null;
      else if (sec.type === 'breakdown') mode = 'sub';
      else if (sec.type === 'outro') mode = 'early';
      else mode = 'on';
      if (!mode) continue;
      forEachChordSpan(theme, s0, s1, (chord, a, b) => {
        const root = bassPitch(key, chord);
        if (mode === 'late' && a < s0 + (sec.bars / 2) * SPB) return;
        if (mode === 'early' && a >= s0 + (sec.bars / 2) * SPB) return;
        if (mode === 'sub') {
          if (a < s0 + (sec.bars / 2) * SPB) return;
          add(a, root, 0.6, b - a);
          return;
        }
        const nextChord = chordAtSong(theme, b);
        const nextRoot = bassPitch(key, nextChord.chord);
        for (let t = a; t < b; t += pat.bar ? SPB : 4) {
          const hits = pat.bar ? pat.bar : pat.steps.map((s) => [s, pat.len || 1]);
          for (const [s, len] of hits) {
            const tt = t + s;
            if (tt >= b) continue;
            let p = root;
            const pos = pat.bar ? hits.findIndex((h) => h[0] === s) + 1 : pat.steps.indexOf(s) + 1;
            if (pat.oct.includes(pos)) p += 12;
            const isLast = tt + len >= b && nextChord.chord.deg !== chord.deg;
            if (approach && isLast) {
              // gjennomgangstone mot neste rot: kvint eller trinnet under
              const fifth = root + 7;
              p = Math.abs(nextRoot - root) <= 2 ? fifth : nextRoot + (nextRoot > root ? -1 : 1) * (T.inScale(key, nextRoot - 2) ? 2 : 1);
              while (p > 45) p -= 12;
              while (p < 26) p += 12;
            }
            add(tt, p, s === 1 || s === 2 ? 0.85 : 0.75, Math.min(len, b - tt));
          }
        }
      });
    }
    return { notes: notes.sort((a, b) => a.t - b.t), pattern: pat.name };
  }

  /* ---------- pad og akkordrytme ---------- */

  function registerPlan(theme, style) {
    const lp = theme.notes.map((n) => n.p);
    const leadLow = lp.length ? pct(lp, 0.1) : 72;
    const pluckHi = Math.max(64, leadLow - 1);
    const pluckLo = pluckHi - 13;
    const padHi = Math.max(60, Math.min(pluckHi - 2, 69));
    const padLo = Math.max(48, padHi - 17);
    return { leadLow, pluckLo, pluckHi, padLo, padHi, style };
  }

  const ARPS = {
    trance: [
      { name: 'arpeggio opp', fn: (v, i) => v[i % v.length] },
      { name: 'arpeggio opp/ned', fn: (v, i) => { const k = i % (2 * v.length - 2 || 1); return v[k < v.length ? k : 2 * v.length - 2 - k]; } },
      { name: 'brutt akkord', fn: (v, i) => v[[0, 2, 1, 2][i % 4] % v.length] },
      { name: 'trancegate', gate: [1, 0, 1, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 1, 1] },
    ],
    house: [
      { name: 'offbeat-stabs', hits: [[2, 1], [6, 1], [10, 1], [14, 1]] },
      { name: 'synkoperte stabs', hits: [[0, 2], [3, 2], [6, 2], [10, 2], [12, 1]] },
      { name: 'lange stabs', hits: [[0, 3], [6, 2], [10, 3]] },
    ],
  };
  ARPS.driving = ARPS.trance;

  function genChords(ctx) {
    const { sections, style, energy, key, theme, rng } = ctx;
    const reg = registerPlan(theme, style);
    const pad = [], pluck = [];
    const colorP = style === 'house' ? 0.7 : 0.3;
    const colors = {};
    for (let d = 0; d < 7; d++) colors[d] = rng.chance(colorP) ? rng.pick(style === 'house' ? ['7', 'add9'] : ['add9', '']) : '';
    const arp = rng.pick(ARPS[style] || ARPS.trance);
    let prevPad = null, prevPl = null;
    for (const sec of sections) {
      const s0 = sec.start * SPB, s1 = (sec.start + sec.bars) * SPB;
      const t = sec.type;
      const half = s0 + (sec.bars / 2) * SPB;
      const padOn = t !== 'intro' || energy >= 4;
      const padVel = { intro: 0.4, build: 0.5, main1: 0.6, breakdown: 0.85, lift: 0.7, main2: 0.65, main3: 0.65, outro: 0.5 }[t];
      const pluckOn = ((t === 'main1' || t === 'main2' || t === 'main3') && energy >= 2) || (t === 'lift' && style !== 'house') || (t === 'build' && energy >= 3) || (t === 'outro');
      forEachChordSpan(theme, s0, s1, (chord, a, b) => {
        if (padOn && !(t === 'intro' && a < half) && !(t === 'outro' && a >= s0 + sec.bars * SPB * 0.5)) {
          const v = H.voice(key, chord, prevPad, reg.padLo, reg.padHi, colors[chord.deg]);
          prevPad = v;
          for (const p of v) pad.push({ t: a, d: b - a, p, v: padVel });
        }
        if (pluckOn && !(t === 'build' && a < half) && !(t === 'outro' && a >= half)) {
          const v = H.voice(key, chord, prevPl, reg.pluckLo, reg.pluckHi, '');
          prevPl = v;
          if (arp.fn) {
            for (let s = a, i = 0; s < b; s++, i++) pluck.push({ t: s, d: 1, p: arp.fn(v, i), v: s % 4 === 0 ? 0.8 : s % 2 === 0 ? 0.65 : 0.55 });
          } else if (arp.gate) {
            for (let s = a; s < b; s++) if (arp.gate[T.mod(s, 16)]) for (const p of v) pluck.push({ t: s, d: 1, p, v: s % 4 === 0 ? 0.75 : 0.6 });
          } else {
            for (let bar = a; bar < b; bar += SPB) for (const [hs, hl] of arp.hits) {
              if (bar + hs >= b) continue;
              for (const p of v) pluck.push({ t: bar + hs, d: hl, p, v: 0.7 });
            }
          }
        }
      });
    }
    return { pad, pluck, arp: arp.name, register: reg };
  }

  /* ---------- melodiens utvikling gjennom sporet ---------- */

  function leadVersion(theme, kind, key) {
    const P = theme.bars * SPB;
    const notes = theme.notes;
    if (kind === 'full') return notes.map((n) => Object.assign({}, n));
    if (kind === 'tease') {
      const unit = theme.bars >= 8 ? 2 * SPB : SPB;
      return notes.filter((n) => n.t < unit).slice(0, 4).map((n) => Object.assign({}, n, { v: n.v * 0.7 }));
    }
    if (kind === 'call') return notes.filter((n) => n.t < P / 2).map((n) => Object.assign({}, n));
    if (kind === 'reduced') {
      // skjelett: tunge toner holdt til neste tunge tone
      const kept = notes.filter((n, i) => n.t % 8 === 0 || n.d >= 6 || i === 0);
      return kept.map((n, i) => {
        const next = i < kept.length - 1 ? kept[i + 1].t : P;
        return Object.assign({}, n, { d: Math.max(n.d, Math.min(next - n.t, 16)), v: n.v * 0.8 });
      });
    }
    if (kind === 'octave') {
      const out = notes.map((n) => Object.assign({}, n));
      for (const n of notes) out.push(Object.assign({}, n, { p: n.p + 12 <= 96 ? n.p + 12 : n.p - 12, v: n.v * 0.55 }));
      return out;
    }
    if (kind === 'harmony') {
      const out = notes.map((n) => Object.assign({}, n));
      const oct = MM.melody.leadOct(key);
      for (const n of notes) {
        const { deg, alt } = T.pitchToDeg(key, n.p, oct);
        if (alt) continue;
        const chord = chordAtSong(theme, n.t).chord;
        const pcs = T.chordPcs(key, chord);
        let h = T.degToPitch(key, deg - 2, oct) + (n.p - T.degToPitch(key, deg, oct));
        if ((n.t % 4 === 0 || n.d >= 4) && !pcs.includes(T.mod(h, 12))) h = T.degToPitch(key, deg - 5, oct) + (n.p - T.degToPitch(key, deg, oct));
        out.push(Object.assign({}, n, { p: h, v: n.v * 0.6 }));
      }
      return out;
    }
    return [];
  }

  const LEAD_PLAN = {
    intro: [],
    build: [{ from: 0.5, kind: 'tease' }],
    main1: [{ from: 0, kind: 'call' }],
    breakdown: [{ from: 0, kind: 'reduced' }, { from: 0.5, kind: 'full' }],
    lift: [{ from: 0, kind: 'full' }],
    main2: [{ from: 0, kind: 'octave' }],
    main3: [{ from: 0, kind: 'harmony' }],
    outro: [{ from: 0, kind: 'call', until: 0.5 }],
  };
  const LEAD_KIND_LABELS = { tease: 'antydning', call: 'bare spørsmålet', reduced: 'skjelett', full: 'hel melodi', octave: 'med oktav', harmony: 'med ters-stemme' };

  function genLead(ctx) {
    const { sections, theme, key, energy } = ctx;
    const P = theme.bars * SPB;
    const notes = [];
    const plan = [];
    for (const sec of sections) {
      const s0 = sec.start * SPB, s1 = (sec.start + sec.bars) * SPB;
      for (const step of LEAD_PLAN[sec.type] || []) {
        let kind = step.kind;
        if (kind === 'octave' && energy <= 2) kind = 'full';
        if (sec.type === 'main1' && energy >= 5) kind = 'full';
        const a = s0 + Math.round(step.from * sec.bars / (theme.bars)) * P;
        const b = step.until ? s0 + Math.round(step.until * sec.bars / theme.bars) * P : s1;
        const nextStart = (LEAD_PLAN[sec.type].find((x) => x.from > step.from) || {}).from;
        const end = nextStart !== undefined ? s0 + Math.round(nextStart * sec.bars / theme.bars) * P : b;
        const ver = leadVersion(theme, kind, key);
        let first = true;
        for (let o = a; o + 1 <= end; o += P) {
          if (kind === 'tease' && !first && ((o - a) / P) % 2 === 1) { first = false; continue; }
          for (const n of ver) if (o + n.t < end) notes.push(Object.assign({}, n, { t: o + n.t, d: Math.min(n.d, end - o - n.t) }));
          first = false;
        }
        if (end > a) plan.push({ section: sec.type, from: a, to: end, kind });
      }
    }
    return { notes: notes.sort((a, b) => a.t - b.t || a.p - b.p), plan };
  }

  /* ---------- effekter og automasjon ---------- */

  function genFx(sections) {
    const fx = [];
    for (const sec of sections) {
      const s0 = sec.start * SPB, s1 = (sec.start + sec.bars) * SPB;
      if (sec.type === 'lift') fx.push({ kind: 'riser', t: s0, d: s1 - s0 });
      if (sec.type === 'build') fx.push({ kind: 'riser', t: Math.max(s0, s1 - 8 * SPB), d: Math.min(8 * SPB, s1 - s0) });
      if (sec.type === 'breakdown' || sec.type.indexOf('main') === 0) fx.push({ kind: 'impact', t: s0, d: 4 * SPB });
    }
    return fx;
  }

  function automation(sections) {
    const auto = { bass: [], pad: [], pluck: [], lead: [] };
    for (const sec of sections) {
      const f = FILTERS[sec.type];
      for (const bus of Object.keys(auto)) {
        auto[bus].push({ t: sec.start * SPB, v: f[bus][0] });
        auto[bus].push({ t: (sec.start + sec.bars) * SPB - 0.01, v: f[bus][1] });
      }
    }
    return auto;
  }

  /* ---------- kontroll: register og kick/bass ---------- */

  function report(parts) {
    const msgs = [];
    const stats = {};
    for (const name of ['bass', 'pad', 'pluck', 'lead']) {
      const ps = (parts[name] || []).map((n) => n.p);
      if (!ps.length) continue;
      stats[name] = { lo: pct(ps, 0.1), med: pct(ps, 0.5), hi: pct(ps, 0.9) };
    }
    const pairs = [['bass', 'pad'], ['pad', 'lead'], ['pluck', 'lead'], ['bass', 'pluck']];
    for (const [a, b] of pairs) {
      if (!stats[a] || !stats[b]) continue;
      const overlap = stats[a].hi - stats[b].lo;
      if (stats[a].med >= stats[b].med - 2) msgs.push({ level: 'warn', text: PART_LABELS[a] + ' og ' + PART_LABELS[b].toLowerCase() + ' ligger i samme leie.' });
      else if (overlap > 7) msgs.push({ level: 'info', text: PART_LABELS[a] + ' og ' + PART_LABELS[b].toLowerCase() + ' overlapper litt (' + overlap + ' halvtoner).' });
    }
    const kicks = new Set((parts.drums || []).filter((n) => n.p === DRUM.kick).map((n) => n.t));
    const clash = (parts.bass || []).filter((n) => kicks.has(n.t) && n.d < 8).length;
    if (clash) msgs.push({ level: 'warn', text: clash + ' basstoner treffer samtidig med kicken.' });
    if (!msgs.length) msgs.push({ level: 'ok', text: 'Stemmene har egne leier, og bassen spiller mellom kickslagene.' });
    return { stats, kickBassClashes: clash, messages: msgs };
  }

  /* ---------- hovedfunksjon ---------- */

  function sectionSig(sections) { return sections.map((s) => s.type + s.bars).join('|'); }

  /* opts: { settings, theme, seeds: {drums,bass,chords}, locked: {drums,bass,chords,melody}, previous } */
  function build(opts) {
    const st = opts.settings;
    const theme = opts.theme;
    const totalBars = totalBarsFor(st.lengthMin, st.bpm);
    const sections = planSections(totalBars, st.style, st.energy, st.breakdown !== false);
    const sig = sectionSig(sections);
    const prev = opts.previous && opts.previous.sig === sig ? opts.previous : null;
    const locked = opts.locked || {};
    const base = { sections, style: st.style, energy: st.energy, key: st.key, theme, hasLift: sections.some((s) => s.type === 'lift') };
    const ctx = (seed, salt) => Object.assign({}, base, { rng: MM.rng.make(seed, salt) });

    const parts = {};
    const info = {};
    if (locked.drums && prev) parts.drums = prev.parts.drums;
    else parts.drums = genDrums(ctx(opts.seeds.drums, 'trommer'));
    if (locked.bass && prev) { parts.bass = prev.parts.bass; info.bassPattern = prev.info && prev.info.bassPattern; }
    else { const b = genBass(ctx(opts.seeds.bass, 'bass')); parts.bass = b.notes; info.bassPattern = b.pattern; }
    if (locked.chords && prev) { parts.pad = prev.parts.pad; parts.pluck = prev.parts.pluck; info.arp = prev.info && prev.info.arp; }
    else { const c = genChords(ctx(opts.seeds.chords, 'akkorder')); parts.pad = c.pad; parts.pluck = c.pluck; info.arp = c.arp; }
    if (locked.melody && prev) { parts.lead = prev.parts.lead; info.leadPlan = prev.info && prev.info.leadPlan; }
    else { const l = genLead(ctx(1, 'lead')); parts.lead = l.notes; info.leadPlan = l.plan; }

    return {
      sig, totalBars, sections, parts, info,
      fx: genFx(sections),
      automation: automation(sections),
      report: report(parts),
      bpm: st.bpm, key: st.key, style: st.style, energy: st.energy,
    };
  }

  /* Basstonenes rot per akkordluke – brukes når bassen er låst og akkordene skal regenereres. */
  function bassRootsPerSlot(bassNotes, theme, sections) {
    const main = sections.find((s) => s.type === 'main2') || sections[0];
    const P = theme.bars * SPB;
    const slot = theme.chords.length ? theme.chords[0].len : SPB;
    const n = Math.round(P / slot);
    const roots = [];
    for (let i = 0; i < n; i++) {
      const counts = {};
      const s0 = main.start * SPB;
      for (const nt of bassNotes) {
        const rel = T.mod(nt.t - s0, P);
        if (nt.t >= s0 && nt.t < s0 + main.bars * SPB && rel >= i * slot && rel < (i + 1) * slot) counts[T.mod(nt.p, 12)] = (counts[T.mod(nt.p, 12)] || 0) + nt.d;
      }
      const best = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
      roots.push(best === undefined ? null : +best);
    }
    return { roots, slot };
  }

  /* Kort sløyfe for forhåndslytting av en melodivariant: tema + akkorder + enkel beat. */
  function preview(settings, theme, seeds, opts) {
    const o = opts || {};
    const bars = Math.max(4, theme.bars);
    const sections = [{ type: o.sectionType || 'main1', label: '', start: 0, bars }];
    const base = { sections, style: settings.style, energy: Math.min(3, settings.energy), key: settings.key, theme, hasLift: true };
    const ctx = (seed, salt) => Object.assign({}, base, { rng: MM.rng.make(seed, salt) });
    const drums = genDrums(ctx(seeds.drums, 'trommer')).filter((n) => n.p !== DRUM.crash && n.p !== DRUM.snare);
    const bass = genBass(ctx(seeds.bass, 'bass')).notes;
    const ch = genChords(ctx(seeds.chords, 'akkorder'));
    const lead = [];
    for (let o2 = 0; o2 < bars * SPB; o2 += theme.bars * SPB) for (const n of theme.notes) lead.push(Object.assign({}, n, { t: n.t + o2 }));
    const parts = { drums, bass, pad: ch.pad, pluck: o.withPluck ? ch.pluck : [], lead };
    return { sig: 'preview', totalBars: bars, sections, parts, info: {}, fx: [], automation: null, bpm: settings.bpm, key: settings.key, style: settings.style, energy: settings.energy };
  }

  function secondsPerStep(bpm) { return 60 / bpm / 4; }

  MM.arrange = {
    STYLES, DRUM, PARTS, PART_LABELS, GROUPS, GROUP_LABELS, SECTION_LABELS, LEAD_KIND_LABELS, ENERGY,
    totalBarsFor, planSections, genDrums, genBass, genChords, genLead, leadVersion, registerPlan,
    build, preview, report, bassRootsPerSlot, secondsPerStep, chordAtSong,
  };
})(globalThis.MM = globalThis.MM || {});
