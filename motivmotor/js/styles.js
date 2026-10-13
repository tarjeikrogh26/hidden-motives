/* Stiler: lærer av eksempler fra sjangeren du vil lage (lydutdrag eller MIDI).
   En stil husker tempo, kordeprogresjoner, hvor lenge kordene varer, rytmen kordene spilles i, om de holdes (strings)
   eller spilles (korder), bassrytmen og hvor tett melodien er. Alt lagres relativt til molltonika («mollramme»),
   så eksempler i ulike tonearter kan blandes. */
(function (MM) {
  'use strict';
  const T = MM.theory;
  const SPB = T.STEPS_PER_BAR;
  const mod = T.mod;

  function minorTonic(key) { return key.mode === 'major' ? mod(key.root + 9, 12) : key.root; }

  /* Gjør et analysert lydutdrag (eller MIDI-referanse) om til et stileksempel. */
  function exampleFrom(ref) {
    const key = ref.key;
    const mt = minorTonic(key);
    const rel = (c) => {
      const root = T.chordRootPc(key, c.chord);
      const iv = c.chord.iv || T.chordPcs(key, c.chord).map((pc) => mod(pc - root, 12)).sort((a, b) => a - b);
      return { t: c.t, len: c.len, r: mod(root - mt, 12), iv, q: c.chord.q || qualityName(iv) };
    };
    let chords = (ref.chords || []).map(rel);
    if (!chords.length && ref.kind === 'chords' && ref.notes && ref.notes.length) {
      const an = MM.features.analyzeChords(ref.notes, key, ref.bars, ref.chordSlot);
      chords = an.chords.map(rel);
    }
    const hits = ref.hits || hitsFromNotes(ref.notes || [], ref.bars);
    return {
      id: 'x' + MM.rng.newSeed().toString(36), name: ref.name, bpm: ref.bpm || null, bars: ref.bars, loop: ref.loop || ref.bars,
      mode: key.mode, chords, hits,
      bass: (ref.bass || []).map((n) => ({ t: n.t, d: n.d })),
      lead: (ref.lead || (ref.kind !== 'chords' ? ref.notes : []) || []).map((n) => ({ t: n.t, d: n.d })),
    };
  }

  function qualityName(iv) {
    const s = iv.join(',');
    return { '0,4,7': 'M', '0,3,7': 'm', '0,4,7,10': '7', '0,4,7,11': 'maj7', '0,3,7,10': 'm7', '0,5,7': 'sus4', '0,2,7': 'sus2', '0,3,6': 'dim' }[s] || 'm';
  }

  function hitsFromNotes(notes, bars) {
    const by = {};
    for (const n of notes) (by[n.t] = by[n.t] || []).push(n);
    const cnt = new Array(16).fill(0);
    let hits = 0;
    for (const [t, g] of Object.entries(by)) if (g.length >= 2) { cnt[mod(+t, 16)]++; hits++; }
    const pat = cnt.map((c) => (c >= Math.max(1.5, bars * 0.3) ? 1 : 0));
    return { pat, pad: hits / Math.max(1, bars) < 1.2 || !pat.some(Boolean) };
  }

  /* ---------- læring ---------- */
  function learn(style) {
    const EX = style.examples || [];
    const L = { bpm: null, progressions: [], hitPats: [], padShare: 0, chordLen: 16, bassPats: [], leadDensity: null, count: EX.length };
    if (!EX.length) return L;
    const bpms = EX.map((x) => x.bpm).filter(Boolean).sort((a, b) => a - b);
    if (bpms.length) L.bpm = Math.round(bpms[Math.floor(bpms.length / 2)]);
    const lens = [];
    const pats = {};
    let pads = 0;
    const bassP = {};
    let leadN = 0, leadBars = 0;
    for (const x of EX) {
      const loopLen = Math.max(1, Math.min(x.loop || x.bars, x.bars)) * SPB;
      const prog = x.chords.filter((c) => c.t < loopLen).map((c) => ({ len: Math.min(c.len, loopLen - c.t), r: c.r, q: c.q, iv: c.iv }));
      if (prog.length >= 2 || (prog.length === 1 && x.bars <= 2)) {
        const sig = prog.map((c) => c.r + c.q + ':' + c.len).join(' ');
        const have = L.progressions.find((p) => p.sig === sig);
        if (have) have.w++; else L.progressions.push({ sig, chords: prog, bars: loopLen / SPB, w: 1, from: x.name });
      }
      for (const c of x.chords) lens.push(c.len);
      if (x.hits) {
        if (x.hits.pad) pads++;
        else { const k = x.hits.pat.join(''); pats[k] = (pats[k] || 0) + 1; }
      }
      // bassrytme: posisjoner i takten som brukes i minst 30 % av taktene
      if (x.bass && x.bass.length) {
        const cnt = new Array(16).fill(0);
        for (const n of x.bass) cnt[mod(Math.round(n.t), 16)]++;
        const pat = cnt.map((c) => (c >= Math.max(1, x.bars * 0.3) ? 1 : 0));
        if (pat.some(Boolean)) { const k = pat.join(''); bassP[k] = (bassP[k] || 0) + 1; }
      }
      if (x.lead && x.lead.length) { leadN += x.lead.length; leadBars += x.bars; }
    }
    lens.sort((a, b) => a - b);
    if (lens.length) {
      const med = lens[Math.floor(lens.length / 2)];
      L.chordLen = [8, 16, 32, 64].reduce((b, v) => (Math.abs(v - med) < Math.abs(b - med) ? v : b), 16);
    }
    L.hitPats = Object.entries(pats).map(([k, w]) => ({ pat: k.split('').map(Number), w })).sort((a, b) => b.w - a.w);
    L.padShare = pads / EX.length;
    L.bassPats = Object.entries(bassP).map(([k, w]) => ({ pat: k.split('').map(Number), w })).sort((a, b) => b.w - a.w);
    if (leadBars) L.leadDensity = leadN / leadBars;
    return L;
  }

  /* Et lært forløp i måltonearten, gjentatt/kuttet til `bars`. */
  function progressionInKey(prog, key, bars) {
    const mt = minorTonic(key);
    const out = [];
    const total = bars * SPB;
    let t = 0;
    while (t < total) {
      for (const c of prog.chords) {
        if (t >= total) break;
        const rootPc = mod(mt + c.r, 12);
        const chord = absChordLocal(key, rootPc, c.q, c.iv);
        const len = Math.min(c.len, total - t);
        const prev = out[out.length - 1];
        if (prev && prev.chord.rs === chord.rs && prev.chord.q === chord.q) prev.len += len;
        else out.push({ t, len, chord });
        t += len;
      }
    }
    return out;
  }

  const QI = { M: [0, 4, 7], m: [0, 3, 7], '7': [0, 4, 7, 10], maj7: [0, 4, 7, 11], m7: [0, 3, 7, 10], sus4: [0, 5, 7], sus2: [0, 2, 7], dim: [0, 3, 6], add9: [0, 4, 7, 14], madd9: [0, 3, 7, 14], m9: [0, 3, 7, 10, 14] };
  function absChordLocal(key, rootPc, q, iv) {
    const rs = mod(rootPc - key.root, 12);
    const sc = T.MODES[key.mode].steps;
    let deg = 0, best = 99;
    sc.forEach((s, i) => { const d = Math.min(Math.abs(s - rs), 12 - Math.abs(s - rs)); if (d < best || (d === best && s > rs)) { best = d; deg = i; } });
    return { deg, q: q || 'm', rs, iv: (iv || QI[q] || QI.m).slice() };
  }

  function pickProgression(learned, key, bars, rng) {
    if (!learned || !learned.progressions.length) return null;
    const p = rng.weighted(learned.progressions, learned.progressions.map((x) => x.w));
    return progressionInKey(p, key, bars);
  }

  /* Rangér stilens forløp etter hvor godt de passer en melodi (for «behold melodien»). */
  function rankForMelody(learned, notes, key, bars) {
    if (!learned || !learned.progressions.length) return [];
    const out = [];
    for (const p of learned.progressions) {
      const ch = progressionInKey(p, key, bars);
      let s = 0;
      for (const c of ch) s += MM.harmony.slotFit(key, notes, c.t, c.len, c.chord) * (c.len / SPB);
      out.push({ chords: ch, score: Math.round((s + 0.3 * p.w) * 100) / 100, from: p.from });
    }
    return out.sort((a, b) => b.score - a.score);
  }

  function describe(learned, key) {
    if (!learned || !learned.count) return 'Ingen eksempler ennå.';
    const k = key || { root: 9, mode: 'minor' };
    const lines = [];
    if (learned.bpm) lines.push('Tempo rundt ' + learned.bpm + ' BPM');
    lines.push('Kordene skifter som regel hver ' + (learned.chordLen >= 16 ? (learned.chordLen / 16) + '. takt' : 'halve takt'));
    if (learned.hitPats.length) lines.push('Kordene spilles rytmisk (' + Math.round((1 - learned.padShare) * 100) + ' % av eksemplene)');
    if (learned.padShare > 0) lines.push('Holdte korder/strings i ' + Math.round(learned.padShare * 100) + ' %');
    if (learned.progressions.length) {
      lines.push('Progresjoner: ' + learned.progressions.slice(0, 4).map((p) => progressionInKey(p, k, p.bars).map((c) => T.roman(k, c.chord)).join('–')).join(' · '));
    }
    if (learned.leadDensity) lines.push('Melodien har ca. ' + learned.leadDensity.toFixed(1) + ' toner per takt');
    return lines.join('\n');
  }

  function patText(pat) { return pat.map((x, i) => (x ? 'x' : (i % 4 === 0 ? '|' : '·'))).join(''); }

  /* Stiler lagres på enheten (på tvers av prosjekter) og kopieres inn i prosjektet når de brukes. */
  const KEY = 'mm:styles';
  const store = {
    all() { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { return []; } },
    save(list) { try { localStorage.setItem(KEY, JSON.stringify(list)); return true; } catch (e) { return false; } },
    upsert(style) { const l = store.all().filter((s) => s.id !== style.id); l.unshift(style); return store.save(l); },
    remove(id) { store.save(store.all().filter((s) => s.id !== id)); },
  };

  MM.styles = { minorTonic, exampleFrom, hitsFromNotes, learn, progressionInKey, pickProgression, rankForMelody, describe, patText, store };
})(globalThis.MM = globalThis.MM || {});
