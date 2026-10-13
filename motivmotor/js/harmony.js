/* Harmonikk: progresjonsbank, harmonisering av melodi, stemmeføring for pad og akkorder. */
(function (MM) {
  'use strict';
  const T = MM.theory;
  const SPB = T.STEPS_PER_BAR;

  /* Trinn i skalaen (0 = i). Navn vises i moll; samme trinn gir riktige akkorder i dorisk/frygisk. */
  const BANK_MINOR = [
    { degs: [0, 5, 2, 6], w: { house: 1, trance: 1.3, driving: 1.3 } }, // i–VI–III–VII
    { degs: [5, 2, 6, 0], w: { house: 0.9, trance: 1.3, driving: 1.2 } }, // VI–III–VII–i
    { degs: [0, 5, 6, 4], w: { house: 1, trance: 1, driving: 1 } }, // i–VI–VII–v
    { degs: [0, 3, 5, 6], w: { house: 1.1, trance: 1, driving: 1 } }, // i–iv–VI–VII
    { degs: [0, 6, 5, 6], w: { house: 0.9, trance: 1.1, driving: 1.2 } }, // i–VII–VI–VII
    { degs: [3, 5, 0, 6], w: { house: 1.2, trance: 1, driving: 0.9 } }, // iv–VI–i–VII
    { degs: [0, 2, 5, 6], w: { house: 1, trance: 1.1, driving: 1 } }, // i–III–VI–VII
    { degs: [5, 6, 0, 4], w: { house: 1, trance: 1, driving: 1.1 } }, // VI–VII–i–v
    { degs: [0, 0, 5, 6], w: { house: 1.2, trance: 0.8, driving: 0.8 } }, // i–i–VI–VII
    { degs: [0, 5, 3, 6], w: { house: 1.1, trance: 1, driving: 0.9 } }, // i–VI–iv–VII
  ];
  const BANK_MAJOR = [
    { degs: [0, 4, 5, 3], w: { house: 1, trance: 1, driving: 1 } }, // I–V–vi–IV
    { degs: [5, 3, 0, 4], w: { house: 1, trance: 1.2, driving: 1.2 } }, // vi–IV–I–V
    { degs: [0, 5, 3, 4], w: { house: 1, trance: 1, driving: 1 } }, // I–vi–IV–V
    { degs: [3, 0, 4, 5], w: { house: 1.1, trance: 1, driving: 1 } }, // IV–I–V–vi
    { degs: [0, 3, 5, 4], w: { house: 1, trance: 1, driving: 1 } }, // I–IV–vi–V
  ];

  function bankFor(key) { return key.mode === 'major' ? BANK_MAJOR : BANK_MINOR; }

  function isDim(key, deg) { return T.triadQuality(key, { deg, q: '' }) === 'dim'; }

  /* Lag akkordliste [{t,len,chord}] fra trinnliste og luke-lengde, slått sammen ved gjentakelse. */
  function toChordList(degs, slot, quals) {
    const out = [];
    degs.forEach((deg, i) => {
      const q = quals ? quals[i] || '' : '';
      const prev = out[out.length - 1];
      if (prev && prev.chord.deg === deg && prev.chord.q === q) prev.len += slot;
      else out.push({ t: i * slot, len: slot, chord: { deg, q } });
    });
    return out;
  }

  function tile(seq, n) { const out = []; for (let i = 0; i < n; i++) out.push(seq[i % seq.length]); return out; }

  function pickProgression(key, bars, style, rng, slot) {
    const bank = bankFor(key);
    const entry = rng.weighted(bank, bank.map((b) => b.w[style] || 1));
    const s = slot || defaultSlot(bars);
    const n = Math.max(1, Math.round(bars * SPB / s));
    return toChordList(tile(entry.degs, n), s);
  }

  function defaultSlot(bars) { return bars >= 8 ? SPB * 2 : SPB; }

  /* Hvor godt passer en akkord til melodinotene i en tidsluke? */
  function slotFit(key, notes, t0, len, chord) {
    const pcs = T.chordPcs(key, chord);
    const colors = T.colorPcs(key, chord);
    let s = 0, tot = 0;
    for (const n of notes) {
      const ov = Math.min(n.t + n.d, t0 + len) - Math.max(n.t, t0);
      if (ov <= 0) continue;
      const starts = n.t >= t0 && n.t < t0 + len;
      const w = Math.min(ov, 8) * (starts ? 1 + MM.features.metricWeight(n.t - t0) : 0.6);
      const pc = T.mod(n.p, 12);
      s += w * (pcs.includes(pc) ? 1 : colors.includes(pc) ? 0.2 : -0.9);
      tot += w;
    }
    return tot ? s / tot : 0;
  }

  function transitionScore(a, b) {
    if (a === b) return -0.25;
    const d = T.mod(b - a, 7);
    if (d === 3) return 0.25; // kvartsprang opp / kvint ned
    if (d === 1 || d === 6) return 0.15; // trinnvis
    if (d === 5 || d === 2) return 0.1; // ters
    return 0;
  }

  /* Foreslår opptil `count` harmoniseringer av en melodi, best først. */
  function harmonize(notes, key, bars, opts) {
    const o = opts || {};
    const slot = o.slot || defaultSlot(bars);
    const n = Math.max(1, Math.round(bars * SPB / slot));
    const style = o.style || 'trance';
    const degsAll = [0, 1, 2, 3, 4, 5, 6].filter((d) => !isDim(key, d));
    const fit = [];
    for (let i = 0; i < n; i++) {
      const row = {};
      for (const d of degsAll) {
        let f = notes.length ? slotFit(key, notes, i * slot, slot, { deg: d, q: '' }) * 2 : 0;
        if (o.bassRoots && o.bassRoots[i] !== undefined && o.bassRoots[i] !== null) {
          const pcs = T.chordPcs(key, { deg: d, q: '' });
          f += pcs[0] === o.bassRoots[i] ? 1.6 : pcs.includes(o.bassRoots[i]) ? 0.3 : -4;
        }
        row[d] = f;
      }
      fit.push(row);
    }
    const scoreSeq = (seq, bonus) => {
      let s = bonus || 0;
      for (let i = 0; i < n; i++) {
        if (fit[i][seq[i]] === undefined) return -Infinity;
        s += fit[i][seq[i]];
        if (i) s += transitionScore(seq[i - 1], seq[i]);
      }
      if ([0, 5, 3].includes(seq[0])) s += 0.3;
      if ([6, 4, 0].includes(seq[n - 1])) s += 0.25;
      const distinct = new Set(seq).size;
      if (n >= 4 && distinct < 3) s -= (3 - distinct) * 0.5 * n; // to akkorder fram og tilbake blir fort statisk
      return s;
    };
    const cands = [];
    for (const b of bankFor(key)) {
      for (let r = 0; r < 4; r++) {
        const rot = b.degs.slice(r).concat(b.degs.slice(0, r));
        const seq = tile(rot, n);
        cands.push({ seq, score: scoreSeq(seq, 0.35 * (b.w[style] || 1) - r * 0.05) });
      }
    }
    // Fri Viterbi-sti som sikkerhetsnett. Uten låst bass søkes en firetakters sløyfe som gjentas,
    // slik at også frie forslag får sjangerens sirkulære form.
    const L = !o.bassRoots && n > 4 && n % 4 === 0 ? 4 : n;
    const lf = [];
    for (let j = 0; j < L; j++) {
      const row = {};
      for (const d of degsAll) { row[d] = 0; for (let i = j; i < n; i += L) row[d] += fit[i][d]; }
      lf.push(row);
    }
    let best = degsAll.map((d) => ({ s: lf[0][d] + ([0, 5, 3].includes(d) ? 0.3 : 0), path: [d] }));
    for (let i = 1; i < L; i++) {
      best = degsAll.map((d) => {
        let top = null;
        for (const p of best) {
          const s2 = p.s + lf[i][d] + transitionScore(p.path[p.path.length - 1], d);
          if (!top || s2 > top.s) top = { s: s2, path: p.path.concat(d) };
        }
        return top;
      });
    }
    for (const b of best) cands.push({ seq: tile(b.path, n), score: scoreSeq(tile(b.path, n), -0.3) });

    cands.sort((a, b) => b.score - a.score);
    // Alternativene skal være tydelig forskjellige: minst halvparten av lukene må skille seg ut
    const minDiff = Math.max(1, Math.ceil(n / 2));
    const out = [];
    const picked = [];
    for (const relax of [minDiff, 1]) {
      for (const c of cands) {
        if (out.length >= (o.count || 3)) break;
        if (!Number.isFinite(c.score)) continue;
        const differs = picked.every((p) => {
          let d = 0;
          for (let i = 0; i < n; i++) if (p[i] !== c.seq[i]) d++;
          return d >= relax;
        });
        if (!differs) continue;
        picked.push(c.seq);
        out.push({ chords: toChordList(c.seq, slot), score: Math.round(c.score * 100) / 100 });
      }
    }
    return out;
  }

  /* Tilpass et akkordforløp fra en annen toneart (trinn bevares). Gjentas til `bars` er fylt. */
  function fitChordsToBars(chords, srcBars, bars) {
    const srcLen = srcBars * SPB;
    const out = [];
    for (let off = 0; off < bars * SPB; off += srcLen) {
      for (const c of chords) {
        const t = off + c.t;
        if (t >= bars * SPB) break;
        out.push({ t, len: Math.min(c.len, bars * SPB - t), chord: { deg: c.chord.deg, q: c.chord.q || '' } });
      }
    }
    return out;
  }

  function chordAt(chords, t, loopLen) {
    const tt = loopLen ? T.mod(t, loopLen) : t;
    for (const c of chords) if (tt >= c.t && tt < c.t + c.len) return c;
    return chords[chords.length - 1];
  }

  /* Stemmeføring: velg toner for akkorden innenfor [lo, hi] nær forrige voicing. */
  function voice(key, chord, prev, lo, hi, extra) {
    let pcs = T.chordPcs(key, chord);
    if (extra === 'add9' && pcs.length === 3) pcs = pcs.concat(T.degPc(key, chord.deg + 1));
    if (extra === '7' && pcs.length === 3) pcs = pcs.concat(T.degPc(key, chord.deg + 6));
    const options = pcs.map((pc) => {
      const arr = [];
      for (let p = lo; p <= hi; p++) if (T.mod(p, 12) === pc) arr.push(p);
      return arr;
    });
    if (options.some((o) => !o.length)) return pcs.map((pc) => lo + T.mod(pc - lo, 12)).sort((a, b) => a - b);
    const center = prev && prev.length ? prev.reduce((s, x) => s + x, 0) / prev.length : (lo + hi) / 2;
    let best = null;
    const rec = (i, acc) => {
      if (i === options.length) {
        const v = acc.slice().sort((a, b) => a - b);
        let cost = 0;
        for (let k = 1; k < v.length; k++) {
          const gap = v[k] - v[k - 1];
          if (gap < 2) cost += 6;
          else if (gap < 3 && k === 1) cost += 2; // sekund i bunnen gjør det grumsete
          if (gap > 9) cost += (gap - 9) * 0.6;
        }
        if (prev && prev.length === v.length) for (let k = 0; k < v.length; k++) cost += Math.abs(v[k] - prev[k]) * 0.5;
        else cost += Math.abs(v.reduce((s, x) => s + x, 0) / v.length - center) * 0.4;
        if (T.mod(v[0], 12) !== pcs[0]) cost += 0.8; // grunnstilling foretrekkes litt
        if (!best || cost < best.cost) best = { cost, v };
        return;
      }
      for (const p of options[i]) rec(i + 1, acc.concat(p));
    };
    rec(0, []);
    return best.v;
  }

  function progressionLabel(key, chords) {
    return chords.map((c) => T.chordName(key, c.chord)).join(' – ');
  }
  function progressionRoman(key, chords) {
    return chords.map((c) => T.roman(key, c.chord)).join(' – ');
  }

  MM.harmony = {
    BANK_MINOR, BANK_MAJOR, bankFor, toChordList, tile, pickProgression, defaultSlot,
    slotFit, harmonize, fitChordsToBars, chordAt, voice, progressionLabel, progressionRoman,
  };
})(globalThis.MM = globalThis.MM || {});
