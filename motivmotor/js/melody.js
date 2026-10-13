/* Melodimotor. Bygger fraser av motiver med gjentakelse, svarfraser, spenning og oppløsning.
   Toner velges ved regelstyrt strålesøk (beam search): reglene gir poeng, frøet velger bare blant de beste. */
(function (MM) {
  'use strict';
  const T = MM.theory;
  const H = MM.harmony;
  const SPB = T.STEPS_PER_BAR;

  const DEFAULT_RULES = {
    chordTone: 0.75, // akkordtoner på tunge slag
    leap: 0.35, // 0 = trinnvis, 1 = store sprang
    repetition: 0.6, // hvor mye motivet gjentas
    tension: 0.5, // spenning i spørsmålsfrasen
    syncopation: 0.35, // forskyvninger før slaget
    density: 0.5, // tetthet
    similarity: 0.6, // hvor tett kontur og intervaller følger referansen
  };

  const MODE_LABELS = {
    keep: 'Behold melodien',
    inspire: 'Ny melodi i samme ånd',
    rhythm: 'Samme rytme, nye toner',
    chords: 'Nye melodier over kordene',
  };

  /* Rytmeceller (én takt) brukt når ingen rytmereferanse finnes. [start, lengde] i steg. */
  const CELLS = {
    trance: [
      [[0, 3], [3, 3], [6, 2], [8, 3], [11, 3], [14, 2]],
      [[0, 3], [3, 3], [6, 4], [10, 2], [12, 4]],
      [[0, 2], [2, 1], [3, 2], [6, 2], [8, 2], [10, 1], [11, 2], [14, 2]],
      [[0, 4], [4, 2], [6, 2], [8, 6], [14, 2]],
      [[0, 2], [3, 3], [6, 2], [8, 2], [10, 2], [12, 2], [14, 2]],
    ],
    house: [
      [[0, 3], [3, 3], [6, 6], [14, 2]],
      [[2, 2], [6, 2], [10, 4], [14, 2]],
      [[0, 2], [3, 3], [8, 2], [11, 3]],
      [[0, 6], [6, 2], [8, 6], [14, 2]],
      [[0, 3], [3, 2], [6, 2], [10, 3], [13, 3]],
    ],
  };
  CELLS.driving = CELLS.trance;

  const SHAPES = {
    bue: [0.2, 0.6, 1, 0.8, 0.5, 0.3, 0.1],
    stigende: [0, 0.2, 0.35, 0.5, 0.7, 0.85, 1],
    fallende: [1, 0.8, 0.7, 0.5, 0.4, 0.2, 0],
    bølge: [0.3, 0.8, 0.5, 1, 0.6, 0.9, 0.2],
    krok: [0.5, 0.5, 1, 0.5, 0.8, 0.3, 0.5],
  };

  /* ---------- hjelpere ---------- */

  function leadOct(key) {
    for (let o = 3; o <= 6; o++) { const t = T.tonic(key, o); if (t >= 64 && t <= 75) return o; }
    return 4;
  }

  function resample(arr, n) {
    if (!arr || !arr.length) return null;
    if (arr.length === n) return arr.slice();
    if (n === 1) return [arr[0]];
    const out = [];
    for (let i = 0; i < n; i++) {
      const x = i * (arr.length - 1) / (n - 1);
      const a = Math.floor(x), b = Math.min(arr.length - 1, a + 1);
      out.push(arr[a] + (arr[b] - arr[a]) * (x - a));
    }
    return out;
  }

  function isStrong(n) { return T.mod(n.t, 4) === 0 || n.d >= 4; }

  function chordInfo(key, chords, t, loopLen) {
    const c = H.chordAt(chords, t, loopLen);
    return { chord: c.chord, pcs: T.chordPcs(key, c.chord), colors: T.colorPcs(key, c.chord) };
  }

  function velFromAccents(t, accents, fallback) {
    if (accents && accents.onsets && accents.onsets.length) {
      const len = accents.len || SPB;
      const tt = T.mod(t, len);
      let best = 0, bd = Infinity;
      accents.onsets.forEach((o, i) => { const d = Math.abs(o - tt); if (d < bd) { bd = d; best = i; } });
      if (bd <= 1) return Math.round((0.55 + 0.45 * accents.values[best]) * 100) / 100;
    }
    return fallback !== undefined ? fallback : Math.round((0.68 + 0.3 * MM.features.metricWeight(t)) * 100) / 100;
  }

  /* ---------- tonevalg: regelstyrt strålesøk ---------- */

  function searchDegs(notes, c) {
    const r = c.rules;
    const lo = c.lo, hi = c.hi;
    const sim = c.contour || c.ivs ? r.similarity : 0;
    let shapeTarget = null;
    if (c.contour && c.contour.shape) {
      const sh = resample(c.contour.shape, notes.length);
      const base = c.prevDeg !== undefined ? c.prevDeg - 2 : (lo + hi) / 2 - 3;
      const span = 3 + Math.round(5 * r.leap) + 1;
      shapeTarget = sh.map((x) => base + x * span);
    }
    let dirs = null;
    if (c.contour && c.contour.dirs) {
      dirs = c.contour.dirs.length === notes.length - 1 ? c.contour.dirs.slice() : null;
      if (!dirs && shapeTarget) dirs = shapeTarget.slice(1).map((x, i) => (Math.abs(x - shapeTarget[i]) < 0.6 ? 0 : Math.sign(x - shapeTarget[i])));
    }
    if (dirs && c.invert) dirs = dirs.map((d) => -d);
    if (shapeTarget && c.invert) { const m = (Math.max.apply(null, shapeTarget) + Math.min.apply(null, shapeTarget)); shapeTarget = shapeTarget.map((x) => m - x); }

    let beams = [{ degs: [], score: 0 }];
    const width = 14;
    for (let i = 0; i < notes.length; i++) {
      const n = notes[i];
      const info = chordInfo(c.key, c.chords, n.t, c.loopLen);
      const strong = isStrong(n) || i === 0;
      const goal = c.goals && c.goals[i];
      const next = [];
      for (const b of beams) {
        const prev = i ? b.degs[i - 1] : c.prevDeg;
        const prevIv = i >= 2 ? b.degs[i - 1] - b.degs[i - 2] : (i === 1 && c.prevDeg !== undefined ? b.degs[0] - c.prevDeg : 0);
        for (let d = lo; d <= hi; d++) {
          let s = 0;
          const pc = T.degPc(c.key, d);
          const ct = info.pcs.includes(pc);
          const col = info.colors.includes(pc);
          if (strong) s += ct ? 2 * r.chordTone : col ? -0.6 * r.chordTone : -2.2 * r.chordTone;
          else s += ct ? 0.3 : 0;
          if (prev !== undefined) {
            const iv = d - prev, a = Math.abs(iv);
            if (!strong && !ct && a > 1) s -= 0.7; // ikke-akkordtoner bør være gjennomgangs-/nabotoner
            if (a === 0) {
              s += (r.repetition - 0.45) * 1.1;
              if (i >= 2 && b.degs[i - 2] === prev) s -= 0.9;
            } else if (a === 1) s += 0.55;
            else if (a === 2) s += 0.3 + 0.2 * r.leap;
            else if (a <= 4) s += -0.35 + 0.6 * r.leap;
            else if (a <= 6) s += -1 + 0.7 * r.leap;
            else if (a === 7) s += -0.6 + 0.9 * r.leap;
            else s -= 3;
            if (Math.abs(prevIv) >= 3) {
              if (Math.sign(iv) === -Math.sign(prevIv) && a <= 2) s += 0.7; // sprang tas igjen trinnvis
              else if (Math.sign(iv) === Math.sign(prevIv) && a >= 2) s -= 0.7;
            }
            if (dirs && i - 1 < dirs.length && i - 1 >= 0) {
              const want = dirs[i - 1];
              const got = Math.sign(iv);
              s += (got === want ? 1.3 : want === 0 || got === 0 ? -0.5 : -1.3) * sim;
            }
            if (c.ivs && c.ivs.length) {
              const want = Math.abs(c.ivs[(i - 1 + c.ivs.length) % c.ivs.length]);
              s -= 0.35 * sim * Math.abs(a - Math.min(want, 7));
            }
          } else {
            // første tone i frasen: grunntone, ters eller kvint i midtregisteret
            const cls = T.mod(d, 7);
            s += cls === 0 ? 0.6 : cls === 4 ? 0.45 : cls === 2 ? 0.35 : 0;
            s -= Math.abs(d - (lo + hi) / 2) * 0.12;
          }
          if (shapeTarget) s -= 0.28 * sim * Math.abs(d - shapeTarget[i]);
          if (d <= lo || d >= hi) s -= 0.5;
          if (goal) {
            const rank = goal.indexOf(T.mod(d, 7));
            s += rank === 0 ? 3.5 : rank > 0 ? 2.8 - rank * 0.4 : -3;
          }
          if (c.forbidLast && i === notes.length - 1 && d === c.forbidLast) s -= 2.5;
          s += c.rng.jitter(0.3);
          next.push({ degs: b.degs.concat(d), score: b.score + s });
        }
      }
      next.sort((a, b) => b.score - a.score);
      beams = next.slice(0, width);
    }
    if (c.avoid && c.avoid.length === notes.length) {
      for (const b of beams) {
        const rel = b.degs.map((d) => d - b.degs[0]);
        if (rel.every((x, i) => x === c.avoid[i])) b.score -= 4;
      }
    }
    const pick = c.rng.softmax(beams, (b) => b.score, 0.45);
    return pick ? pick.degs : notes.map(() => 0);
  }

  /* Gjenta et motiv over en ny akkord: behold tonene (felles toner) eller sekvenser etter akkordroten. */
  function adaptDegs(degs, notes, srcChords, dstChords, key, rules, how, lo, hi, srcLoop) {
    let shift = 0;
    if (how === 'sequence') {
      const a = H.chordAt(srcChords, notes[0].srcT, srcLoop).chord.deg;
      const b = H.chordAt(dstChords, notes[0].t, srcLoop).chord.deg;
      shift = T.mod(b - a + 3, 7) - 3;
    }
    return degs.map((d0, i) => {
      let d = d0 + shift;
      const n = notes[i];
      if (isStrong(n) || i === 0) {
        const info = chordInfo(key, dstChords, n.t, srcLoop);
        if (!info.pcs.includes(T.degPc(key, d)) && rules.chordTone > 0.3) {
          const dirNext = i < degs.length - 1 ? Math.sign(degs[i + 1] - d0) : 0;
          const order = dirNext >= 0 ? [1, -1, 2, -2] : [-1, 1, -2, 2];
          for (const o of order) {
            if (info.pcs.includes(T.degPc(key, d + o)) && d + o >= lo && d + o <= hi) { d += o; break; }
          }
        }
      }
      while (d > hi) d -= 7;
      while (d < lo) d += 7;
      return d;
    });
  }

  /* ---------- rytmeceller og transformasjoner ---------- */

  function cellFromNotes(notes, len, offset) {
    const off = offset || 0;
    return notes
      .filter((n) => n.t >= off && n.t < off + len)
      .map((n) => ({ t: n.t - off, d: Math.min(n.d, off + len - n.t), v: n.v }));
  }

  function rhythmNotesFromSource(src) {
    if (src.melody) return src.melody.notes.map((n) => ({ t: n.t, d: n.d, v: n.v }));
    if (src.rhythm) return src.rhythm.onsets.map((t, i) => ({ t, d: src.rhythm.durs[i], v: 0.6 + 0.4 * (src.rhythm.accents ? src.rhythm.accents[i] : 0.5) }));
    return null;
  }

  function sanitize(cell, len) {
    const s = cell.slice().sort((a, b) => a.t - b.t).filter((n, i, arr) => n.t >= 0 && n.t < len && (i === 0 || n.t > arr[i - 1].t));
    for (let i = 0; i < s.length; i++) {
      const lim = i < s.length - 1 ? s[i + 1].t - s[i].t : len - s[i].t;
      s[i] = Object.assign({}, s[i], { d: Math.max(1, Math.min(s[i].d, lim)) });
    }
    return s;
  }

  function transformCell(cell, kind, len, rules) {
    let c = cell.map((n) => Object.assign({}, n));
    if (kind === 'synkope') {
      // trekk et par tunge anslag en sekstendel fram (forskyvning)
      let moved = 0;
      c = c.map((n, i) => {
        if (i > 0 && n.t % 4 === 0 && n.t > 0 && moved < 2 && !c.some((m) => m.t === n.t - 1)) { moved++; return Object.assign({}, n, { t: n.t - 1, d: n.d + 1 }); }
        return n;
      });
    } else if (kind === 'fragment') {
      const half = cellFromNotes(c, len / 2, 0);
      c = half.concat(half.map((n) => Object.assign({}, n, { t: n.t + len / 2 })));
    } else if (kind === 'driv') {
      // fyll hull med drivende sekstendeler/åttendeler
      const add = [];
      for (let i = 0; i < c.length; i++) {
        const end = c[i].t + c[i].d;
        const nxt = i < c.length - 1 ? c[i + 1].t : len;
        if (nxt - c[i].t >= 4 && c[i].d >= 3) { c[i].d = 2; add.push({ t: c[i].t + 2, d: Math.min(2, nxt - c[i].t - 2), v: 0.7 }); }
        else if (nxt - end >= 3) add.push({ t: nxt - 2, d: 2, v: 0.65 });
      }
      c = c.concat(add);
    } else if (kind === 'tynn') {
      c = c.filter((n, i) => i === 0 || T.mod(n.t, 2) === 0 || n.d >= 3);
    }
    // tetthetsregel
    if (rules.density < 0.35 && c.length > 3) c = c.filter((n, i) => i === 0 || T.mod(n.t, 2) === 0);
    if (rules.density > 0.75) {
      const extra = [];
      for (let i = 0; i < c.length; i++) {
        const nxt = i < c.length - 1 ? c[i + 1].t : len;
        if (c[i].d >= 4 && nxt - c[i].t >= 4) { extra.push({ t: c[i].t + 2, d: nxt - c[i].t - 2, v: 0.65 }); c[i].d = 2; }
      }
      c = c.concat(extra);
    }
    return sanitize(c, len);
  }

  /* Kadensenhet: første halvdel av motivet, så en lang målnote og et pust. */
  function cadenceCell(cell, len, breath) {
    const half = len / 2;
    const first = cell.filter((n) => n.t < half - 1).map((n) => Object.assign({}, n, { d: Math.min(n.d, half - n.t) }));
    const goalT = len >= 32 ? 16 : 8;
    const pre = first.filter((n) => n.t < goalT);
    if (pre.length) {
      const last = pre[pre.length - 1];
      if (goalT - (last.t + last.d) > 3) pre.push({ t: goalT - 2, d: 2, v: 0.7 });
      else last.d = Math.min(last.d, goalT - last.t);
    } else pre.push({ t: goalT - 2, d: 2, v: 0.7 });
    const goalD = Math.max(2, len - goalT - breath);
    return { notes: pre.concat({ t: goalT, d: goalD, v: 0.95, goal: true }), goalIndex: pre.length };
  }

  /* ---------- frasemaler ---------- */

  function chooseTemplate(units, rules, rng, variantIdx) {
    const four = [
      { codes: ['A', 'Q', 'A', 'R'], label: 'spørsmål–svar' },
      { codes: ['A', 'A~', 'A', 'R'], label: 'A–A′–A–løsning' },
      { codes: ['A', 'B', 'A', 'R'], label: 'A–B–A–løsning' },
      { codes: ['A', 'A', 'A~', 'R'], label: 'A–A–A′–løsning' },
    ];
    const eight = [
      { codes: ['A', 'A~', 'A', 'Q', 'A', 'A~', 'B', 'R'], label: 'periode: forfrase + ettersetning' },
      { codes: ['A', 'Q', 'A', 'R', 'A', 'Q', 'B', 'R'], label: 'dobbelt spørsmål–svar' },
      { codes: ['A', 'A', 'A~', 'Q', 'A', 'A', 'B', 'R'], label: 'gjentakende hook med svar' },
    ];
    const two = [{ codes: ['A', 'R'], label: 'motiv–svar' }, { codes: ['A', 'A~'], label: 'motiv–variasjon' }];
    const pool = units >= 8 ? eight : units >= 4 ? four : two;
    // gjentakelsesregelen dytter mot maler med flere A-er
    const weights = pool.map((tpl, i) => {
      const reps = tpl.codes.filter((x) => x === 'A').length / tpl.codes.length;
      return 1 + (reps - 0.4) * (rules.repetition - 0.5) * 6 + (i === variantIdx % pool.length ? 2.5 : 0);
    });
    const tpl = rng.weighted(pool, weights);
    if (units > tpl.codes.length) {
      const codes = [];
      for (let i = 0; i < units; i++) codes.push(tpl.codes[i % tpl.codes.length]);
      return { codes, label: tpl.label };
    }
    return { codes: tpl.codes.slice(0, units), label: tpl.label };
  }

  function goalsFor(kind, rules, info) {
    let cands;
    if (kind === 'Q') cands = rules.tension > 0.66 ? [1, 6, 4, 3] : rules.tension > 0.33 ? [4, 1, 6] : [4, 2];
    else cands = rules.tension > 0.7 ? [0, 2, 4] : [0, 2];
    const fits = (g) => info.pcs.includes(g.pc) || info.colors.includes(g.pc);
    const withPc = cands.map((d) => ({ d, pc: info.degPc(d) }));
    const ok = withPc.filter(fits).map((g) => g.d);
    return ok.length ? ok.concat(cands.filter((d) => !ok.includes(d))) : cands;
  }

  /* ---------- frasebygging ---------- */

  function buildFromUnits(spec) {
    const { key, chords, bars, rules, rng, unitBars, codes, motifCell, contour, ivs, avoid, invertB, adaptHow, breath } = spec;
    const unitLen = unitBars * SPB;
    const loopLen = bars * SPB;
    const lo = -3, hi = 9;
    const out = [];
    let motif = null; // { notes, degs }
    let prevDeg;
    codes.forEach((code, ui) => {
      const off = ui * unitLen;
      let cellNotes, degs;
      const info = (t) => {
        const ci = chordInfo(key, chords, t, loopLen);
        ci.degPc = (d) => T.degPc(key, d);
        return ci;
      };
      if (code === 'A' || code === 'A~' || !motif) {
        cellNotes = motifCell.map((n) => ({ t: n.t + off, d: n.d, v: n.v, srcT: n.t }));
        if (!motif) {
          degs = searchDegs(cellNotes, { key, chords, loopLen, rules, rng, lo, hi, prevDeg, contour, ivs, avoid });
          motif = { degs, notes: cellNotes };
        } else {
          degs = adaptDegs(motif.degs, cellNotes, chords, chords, key, rules, adaptHow, lo, hi, loopLen);
          if (code === 'A~') {
            const k = Math.max(1, Math.round(cellNotes.length * 0.35));
            const tail = cellNotes.slice(cellNotes.length - k);
            const newTail = searchDegs(tail, {
              key, chords, loopLen, rules, rng, lo, hi, prevDeg: degs[cellNotes.length - k - 1],
              forbidLast: degs[degs.length - 1],
            });
            degs = degs.slice(0, cellNotes.length - k).concat(newTail);
          }
        }
      } else if (code === 'B') {
        const kinds = ['fragment', 'synkope', 'tynn'];
        const bCell = transformCell(motifCell, kinds[ui % kinds.length], unitLen, rules);
        cellNotes = bCell.map((n) => ({ t: n.t + off, d: n.d, v: n.v }));
        degs = searchDegs(cellNotes, { key, chords, loopLen, rules, rng, lo, hi, prevDeg, contour: motif ? { dirs: motif.degs.slice(1).map((d, i) => Math.sign(d - motif.degs[i])) } : contour, invert: invertB !== false });
      } else {
        // Q = spørsmål (spenning), R = svar (oppløsning)
        const cad = cadenceCell(motifCell, unitLen, breath);
        cellNotes = cad.notes.map((n) => ({ t: n.t + off, d: n.d, v: n.v, srcT: n.t }));
        const head = motif.notes.filter((m) => m.srcT < unitLen / 2 - 1).length;
        const goals = {};
        goals[cad.goalIndex] = goalsFor(code, rules, info(off + cellNotes[cad.goalIndex].t - off));
        const headDegs = adaptDegs(motif.degs.slice(0, Math.min(head, cad.goalIndex)), cellNotes.slice(0, Math.min(head, cad.goalIndex)), chords, chords, key, rules, adaptHow, lo, hi, loopLen);
        const restNotes = cellNotes.slice(headDegs.length);
        const restGoals = {};
        restGoals[cad.goalIndex - headDegs.length] = goals[cad.goalIndex];
        const restDegs = searchDegs(restNotes, {
          key, chords, loopLen, rules, rng, lo, hi,
          prevDeg: headDegs.length ? headDegs[headDegs.length - 1] : prevDeg, goals: restGoals,
        });
        degs = headDegs.concat(restDegs);
      }
      cellNotes.forEach((n, i) => {
        out.push({ t: n.t, d: n.d, deg: degs[i], v: n.v, unit: ui, code });
      });
      prevDeg = degs[degs.length - 1];
    });
    return out;
  }

  /* Rytmemodus: hele referanserytmen beholdes; like takter får samme motiv tilpasset akkorden. */
  function buildFromRhythm(spec) {
    const { key, chords, bars, rules, rng, rhythm, contour, invert } = spec;
    const loopLen = bars * SPB;
    const lo = -3, hi = 9;
    const units = [];
    for (let b = 0; b < bars; b++) units.push(cellFromNotes(rhythm, SPB, b * SPB));
    const sig = (u) => u.map((n) => n.t + ':' + n.d).join(',');
    const out = [];
    const memory = {};
    let prevDeg;
    let ci = 0;
    const half = bars / 2;
    units.forEach((u, bi) => {
      if (!u.length) return;
      const notes = u.map((n) => ({ t: n.t + bi * SPB, d: n.d, v: n.v, srcT: n.t }));
      const s = sig(u);
      const isHalfEnd = bars >= 2 && (bi === half - 1 || bi === bars - 1);
      let degs;
      if (memory[s] && !isHalfEnd) {
        degs = adaptDegs(memory[s].degs, notes, chords, chords, key, rules, 'common', lo, hi, loopLen);
      } else {
        const cShape = contour && contour.shape ? contour.shape.slice(ci, ci + notes.length) : null;
        const c = cShape && cShape.length === notes.length ? { shape: cShape, dirs: cShape.slice(1).map((x, i) => (Math.abs(x - cShape[i]) < 0.04 ? 0 : Math.sign(x - cShape[i]))) } : null;
        const goals = {};
        if (isHalfEnd) {
          const last = notes[notes.length - 1];
          const info = chordInfo(key, chords, last.t, loopLen);
          info.degPc = (d) => T.degPc(key, d);
          goals[notes.length - 1] = goalsFor(bi === bars - 1 ? 'R' : 'Q', rules, info);
        }
        degs = searchDegs(notes, { key, chords, loopLen, rules, rng, lo, hi, prevDeg, contour: c, invert, goals });
        if (!memory[s]) memory[s] = { degs };
      }
      ci += notes.length;
      notes.forEach((n, i) => out.push({ t: n.t, d: n.d, deg: degs[i], v: n.v, unit: bi, code: memory[s] && !isHalfEnd ? 'A' : 'N' }));
      prevDeg = degs[degs.length - 1];
    });
    return out;
  }

  /* ---------- toneart og register ---------- */

  /* Halvtoner å flytte for å komme fra én toneart til en annen uten å endre melodien, eller null når
     modusene er ulike og ikke paralleller (da må melodien tilpasses trinnvis). */
  function keyShift(fromKey, toKey) {
    const minorish = (k) => k.mode !== 'major';
    const mt = (k) => (k.mode === 'major' ? (k.root + 9) % 12 : k.root);
    let d;
    if (fromKey.mode === toKey.mode || (minorish(fromKey) && minorish(toKey))) d = toKey.root - fromKey.root;
    else if (mt(fromKey) === mt(toKey)) d = 0;
    else d = null;
    if (d === null) return null;
    d = ((d % 12) + 12) % 12;
    return d > 6 ? d - 12 : d;
  }

  function mapToKey(notes, fromKey, toKey) {
    if (!fromKey || (fromKey.root === toKey.root && fromKey.mode === toKey.mode)) return notes.map((n) => Object.assign({}, n));
    const sh = keyShift(fromKey, toKey);
    if (sh !== null) return notes.map((n) => Object.assign({}, n, { p: n.p + sh }));
    // finn transposisjonen som holder melodien nærmest originalt leie
    return notes.map((n) => {
      const { deg, alt } = T.pitchToDeg(fromKey, n.p, 4);
      let p = T.degToPitch(toKey, deg, 4) + alt;
      const diff = p - n.p;
      if (diff > 6) p -= 12; else if (diff < -6) p += 12;
      return Object.assign({}, n, { p });
    });
  }

  function placeRegister(notes, center) {
    if (!notes.length) return notes;
    const ps = notes.map((n) => n.p).sort((a, b) => a - b);
    const med = ps[Math.floor(ps.length / 2)];
    const shift = Math.round((center - med) / 12) * 12;
    return notes.map((n) => Object.assign({}, n, { p: n.p + shift }));
  }

  function degNotesToPitches(dn, key, accents) {
    const oct = leadOct(key);
    return dn.map((n) => ({
      t: n.t, d: n.d, p: T.degToPitch(key, n.deg, oct),
      v: accents ? velFromAccents(n.t, accents) : (n.v !== undefined ? Math.min(1, n.v) : velFromAccents(n.t)),
    }));
  }

  function applySyncopation(notes, rules, rng) {
    if (rules.syncopation < 0.15) return notes;
    const out = notes.map((n) => Object.assign({}, n));
    for (let i = 1; i < out.length; i++) {
      const n = out[i];
      if (n.t % 8 === 0 && n.t % SPB !== 0 && rng.chance(rules.syncopation * 0.6)) {
        const prevEnd = out[i - 1].t + out[i - 1].d;
        if (prevEnd <= n.t - 1 || out[i - 1].d >= 2) {
          out[i - 1].d = Math.min(out[i - 1].d, n.t - 1 - out[i - 1].t);
          if (out[i - 1].d < 1) continue;
          n.t -= 1; n.d += 1;
        }
      }
    }
    return out;
  }

  /* ---------- hovedfunksjon: tre sammenlignbare varianter ---------- */

  function resolveChords(spec, rng) {
    const { key, bars, style } = spec;
    if (spec.chords && spec.chords.length) return { chords: H.fitChordsToBars(spec.chords, spec.chordsBars || bars, bars), from: 'låst' };
    const srcCh = spec.src.chords && spec.src.chords.chords && spec.src.chords.chords.length;
    if (srcCh && spec.mode === 'chords') return { chords: H.fitChordsToBars(spec.src.chords.chords, spec.src.chords.bars, bars), from: 'referanse' };
    if (spec.learned && MM.styles) {
      const ch = MM.styles.pickProgression(spec.learned, key, bars, rng.child('stil'));
      if (ch) return { chords: ch, from: 'stilen' };
    }
    if (srcCh) return { chords: H.fitChordsToBars(spec.src.chords.chords, spec.src.chords.bars, bars), from: 'referanse' };
    return { chords: H.pickProgression(key, bars, style, rng.child('prog'), spec.slot), from: 'bank' };
  }

  function generateVariants(specIn) {
    const spec = Object.assign({ count: 3, style: 'trance' }, specIn);
    spec.rules = Object.assign({}, DEFAULT_RULES, spec.rules || {});
    spec.src = spec.src || {};
    const key = spec.key;
    const rng0 = MM.rng.make(spec.seed, 'melodi');
    const mode = spec.mode || 'inspire';
    if (spec.melodyScale && spec.melodyScale !== 1) spec.src = scaleSource(spec.src, spec.melodyScale);
    if (spec.src.chords && spec.src.chords.key && spec.src.chords.chords) {
      spec.src = Object.assign({}, spec.src, { chords: Object.assign({}, spec.src.chords, { chords: chordsToKey(spec.src.chords.chords, spec.src.chords.key, spec.key), key: spec.key }) });
    }
    const srcRhythm = rhythmNotesFromSource(spec.src);
    const srcBars = (spec.src.melody && spec.src.melody.bars) || (spec.src.rhythm && spec.src.rhythm.len / SPB) || (spec.src.phrase && spec.src.phrase.bars) || 4;
    let bars = spec.bars || srcBars;
    if (mode === 'keep' && !spec.bars) bars = Math.max(2, srcBars);
    spec.bars = bars;
    const breath = spec.src.rests && spec.src.rests.gaps && spec.src.rests.gaps.length
      ? T.clamp(Math.round(spec.src.rests.gaps.reduce((s, g) => s + g.d, 0) / spec.src.rests.gaps.length), 1, 6) : 2;
    const accents = spec.src.accents || null;
    const center = spec.style === 'house' ? 72 : 76;
    const variants = [];

    if (mode === 'keep') {
      if (!spec.src.melody) throw new Error('Velg en melodi-referanse for å beholde melodien.');
      let mel = mapToKey(spec.src.melody.notes, spec.src.melody.key, key);
      const mBars = spec.src.melody.bars;
      if (bars > mBars) { // gjenta melodien til frasen er fylt
        const reps = [];
        for (let o = 0; o < bars; o += mBars) for (const n of mel) reps.push(Object.assign({}, n, { t: n.t + o * SPB }));
        mel = reps;
      } else mel = mel.filter((n) => n.t < bars * SPB);
      mel = placeRegister(mel, center);
      let harms;
      if (spec.chords && spec.chords.length) harms = [{ chords: H.fitChordsToBars(spec.chords, spec.chordsBars || bars, bars), score: 0, label: 'låste korder' }];
      else {
        // forslag: stilens forløp som passer melodien best, låtens egne korder, og harmoniseringer fra banken
        const cands = [];
        if (spec.learned && MM.styles) for (const h of MM.styles.rankForMelody(spec.learned, mel, key, bars)) cands.push(Object.assign(h, { label: 'fra stilen' }));
        if (spec.src.chords && spec.src.chords.chords && spec.src.chords.chords.length) {
          cands.splice(Math.min(1, cands.length), 0, { chords: H.fitChordsToBars(spec.src.chords.chords, spec.src.chords.bars, bars), score: 0, label: 'låtens egne korder' });
        }
        const slot = spec.slot || (spec.learned && spec.learned.chordLen) || (mBars <= 4 ? SPB : 2 * SPB);
        for (const h of H.harmonize(mel, key, bars, { count: spec.count + 2, style: spec.style, slot, bassRoots: spec.bassRoots })) cands.push(Object.assign(h, { label: 'harmonisert' }));
        const seen = new Set();
        harms = [];
        for (const h of cands) {
          const sig = h.chords.map((c) => T.chordName(key, c.chord) + c.t).join(' ');
          if (seen.has(sig)) continue;
          seen.add(sig); harms.push(h);
          if (harms.length >= spec.count) break;
        }
      }
      for (let i = 0; i < spec.count; i++) {
        const h = harms[i % harms.length];
        variants.push({
          mode, bars, key, notes: mel.map((n) => Object.assign({}, n)), chords: h.chords,
          form: 'original',
          desc: 'Melodien beholdt. Korder (' + (h.label || 'harmonisert') + '): ' + H.progressionLabel(key, h.chords) + '.',
        });
      }
      return variants;
    }

    const { chords, from } = resolveChords(spec, rng0);

    for (let vi = 0; vi < spec.count; vi++) {
      const rng = MM.rng.make(MM.rng.derive(spec.seed, 'v' + vi), mode);
      let dn, form, desc;
      if (mode === 'rhythm') {
        if (!srcRhythm) throw new Error('Velg en referanse med rytme.');
        const len = Math.max(SPB, Math.round(srcBars) * SPB);
        const tiled = [];
        for (let o = 0; o < bars * SPB; o += len) for (const n of srcRhythm) if (n.t + o < bars * SPB) tiled.push({ t: n.t + o, d: n.d, v: n.v });
        const contourSrc = spec.src.contour ? Object.assign({}, spec.src.contour, { shape: tileArr(spec.src.contour.shape, tiled.length) }) : null;
        const plans = [
          { contour: contourSrc, invert: false, label: 'referansekonturen med nye intervaller' },
          { contour: contourSrc, invert: true, label: 'speilet kontur' },
          { contour: null, invert: false, label: 'fri kontur etter reglene' },
        ];
        const pl = plans[vi % plans.length];
        dn = buildFromRhythm({ key, chords, bars, rules: spec.rules, rng, rhythm: tiled, contour: pl.contour, invert: pl.invert });
        form = 'rytme beholdt';
        desc = 'Rytmen beholdt nøyaktig, ' + pl.label + '.';
      } else {
        // inspire og chords: nytt motiv bygget fra en rytmecelle
        const unitBars = bars >= 8 ? 2 : 1;
        const unitLen = unitBars * SPB;
        let baseCell, cellFrom;
        if (srcRhythm && srcRhythm.length) {
          let off = 0;
          while (off < srcBars * SPB && !cellFromNotes(srcRhythm, unitLen, off).length) off += SPB;
          baseCell = sanitize(cellFromNotes(srcRhythm, unitLen, off), unitLen);
          if (unitBars === 2 && baseCell.filter((n) => n.t >= SPB).length === 0) {
            const one = baseCell.slice();
            baseCell = one.concat(one.map((n) => Object.assign({}, n, { t: n.t + SPB })));
          }
          cellFrom = 'referanserytmen';
        } else {
          const bank = CELLS[spec.style] || CELLS.trance;
          const pickCell = (r) => r.pick(bank).map(([t, d]) => ({ t, d, v: 0.8 }));
          const c1 = pickCell(rng);
          baseCell = unitBars === 2 ? c1.concat(pickCell(rng).filter((n) => n.t < 12).map((n) => Object.assign({}, n, { t: n.t + SPB }))) : c1;
          cellFrom = 'en sjangercelle';
        }
        const transforms = mode === 'chords' ? ['', 'synkope', 'driv'] : ['', 'synkope', spec.rules.density > 0.5 ? 'driv' : 'fragment'];
        const tf = transforms[vi % transforms.length];
        const cell = transformCell(baseCell, tf, unitLen, spec.rules);
        let contour = null, contourLabel = 'konturen formet av reglene';
        if (spec.src.contour && spec.src.contour.shape && spec.src.contour.shape.length > 1) {
          const sh = spec.src.contour.shape.slice(0, Math.max(2, cell.length));
          contour = { shape: sh };
          if (vi === 1) contourLabel = 'speilet referansekontur';
          else contourLabel = 'referansekonturen';
        } else {
          const names = Object.keys(SHAPES);
          const nm = names[(vi + Math.floor(rng.next() * names.length)) % names.length];
          contour = { shape: SHAPES[nm] };
          contourLabel = nm + '-kontur';
        }
        const avoid = spec.src.melody ? (function () {
          const m = MM.features.analyzeMelody(spec.src.melody.notes, key, spec.src.melody.bars);
          return m.contour.degs.slice(0, cell.length);
        })() : null;
        const units = Math.max(1, Math.round(bars / unitBars));
        const tpl = chooseTemplate(units, spec.rules, rng, vi);
        dn = buildFromUnits({
          key, chords, bars, rules: spec.rules, rng, unitBars, codes: tpl.codes, motifCell: cell,
          contour: vi === 1 && spec.src.contour ? Object.assign({}, contour, { shape: contour.shape.map((x) => 1 - x) }) : contour, ivs: spec.src.intervals ? spec.src.intervals.steps : null, avoid,
          invertB: true, adaptHow: vi === 2 && spec.rules.repetition < 0.7 ? 'sequence' : 'common', breath,
        });
        form = tpl.label;
        desc = 'Motiv fra ' + cellFrom + (tf ? ' (' + tf + ')' : '') + ', ' + contourLabel + ', form ' + tpl.label + '.';
      }
      let notes = degNotesToPitches(dn, key, accents);
      if (mode !== 'rhythm') notes = applySyncopation(notes, spec.rules, rng);
      notes = placeRegister(notes, center);
      variants.push({ mode, bars, key, notes, chords, form, desc: desc + (from === 'bank' ? '' : ' Akkorder fra ' + from + '.') });
    }
    return variants;
  }

  /* Korder fra en annen toneart: flyttes like mye som melodien (se keyShift), ellers trinnvis. */
  function chordsToKey(chords, fromKey, toKey) {
    if (fromKey.root === toKey.root && fromKey.mode === toKey.mode) return chords.map((c) => Object.assign({}, c));
    const sh = keyShift(fromKey, toKey);
    return chords.map((c) => {
      if (sh === null) return Object.assign({}, c, { chord: { deg: c.chord.deg, q: c.chord.iv ? '' : c.chord.q } });
      const root = T.mod(T.chordRootPc(fromKey, c.chord) + sh, 12);
      const pcs = T.chordPcs(fromKey, c.chord);
      const iv = c.chord.iv ? c.chord.iv.slice() : pcs.map((pc) => T.mod(pc - T.chordRootPc(fromKey, c.chord), 12)).sort((a, b) => a - b);
      const rs = T.mod(root - toKey.root, 12);
      const sc = T.MODES[toKey.mode].steps;
      let deg = 0, best = 99;
      sc.forEach((st, i) => { const d = Math.min(Math.abs(st - rs), 12 - Math.abs(st - rs)); if (d < best || (d === best && st > rs)) { best = d; deg = i; } });
      const q = c.chord.iv ? c.chord.q : ({ '0,4,7': 'M', '0,3,7': 'm', '0,3,6': 'dim', '0,4,7,10': '7', '0,4,7,11': 'maj7', '0,3,7,10': 'm7', '0,5,7': 'sus4', '0,2,7': 'sus2' }[iv.join(',')] || 'M');
      return Object.assign({}, c, { chord: { deg, q, rs, iv } });
    });
  }

  /* Melodiens tempo inn i målsporet: ×2 gir lange toner (halv fart), ×0.5 dobbel fart. */
  function scaleSource(src, k) {
    const out = Object.assign({}, src);
    const sn = (ns) => ns.map((n) => Object.assign({}, n, { t: n.t * k, d: Math.max(1, n.d * k) }));
    if (src.melody) out.melody = Object.assign({}, src.melody, { notes: sn(src.melody.notes), bars: Math.max(1, Math.round(src.melody.bars * k)) });
    if (src.rhythm) out.rhythm = Object.assign({}, src.rhythm, { onsets: src.rhythm.onsets.map((t) => t * k), durs: src.rhythm.durs.map((d) => Math.max(1, d * k)), len: src.rhythm.len * k });
    if (src.accents) out.accents = Object.assign({}, src.accents, { onsets: src.accents.onsets.map((t) => t * k), len: src.accents.len * k });
    if (src.rests) out.rests = Object.assign({}, src.rests, { gaps: src.rests.gaps.map((g) => ({ t: g.t * k, d: g.d * k })), len: src.rests.len * k });
    if (src.phrase) out.phrase = Object.assign({}, src.phrase, { bars: Math.max(1, Math.round(src.phrase.bars * k)) });
    if (src.chords) out.chords = Object.assign({}, src.chords, { chords: src.chords.chords.map((c) => Object.assign({}, c, { t: c.t * k, len: c.len * k })), bars: Math.max(1, Math.round(src.chords.bars * k)) });
    return out;
  }

  function tileArr(arr, n) { if (!arr || !arr.length) return null; const out = []; for (let i = 0; i < n; i++) out.push(arr[i % arr.length]); return out; }

  MM.melody = {
    DEFAULT_RULES, MODE_LABELS, CELLS, SHAPES,
    leadOct, searchDegs, adaptDegs, transformCell, cadenceCell, chooseTemplate,
    buildFromUnits, buildFromRhythm, mapToKey, placeRegister, generateVariants, scaleSource, keyShift, chordsToKey,
  };
})(globalThis.MM = globalThis.MM || {});
