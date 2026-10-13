/* Prosjektmodell: referanser, egenskapsbibliotek, varianter, valgt tema, frø, låser, arrangement og lyd.
   Alt som trengs for å åpne en versjon nøyaktig igjen lagres, også de genererte notene. */
(function (MM) {
  'use strict';
  const T = MM.theory;
  const SPB = T.STEPS_PER_BAR;
  const VERSION = 1;

  const DEMO_HOOK = [[0, 3, 76], [3, 3, 72], [6, 2, 74], [8, 3, 76], [11, 3, 79], [14, 2, 77], [16, 3, 76], [19, 3, 74], [22, 2, 72], [24, 6, 69]];
  const DEMO_CHORDS = [[0, [57, 60, 64]], [16, [53, 57, 60]], [32, [55, 60, 64]], [48, [55, 59, 62]]];

  function uid(prefix) { return (prefix || 'r') + MM.rng.newSeed().toString(36); }

  function makeReference(o) {
    const notes = (o.notes || []).map((n) => ({ t: n.t, d: n.d, p: n.p, v: n.v === undefined ? 0.8 : n.v, conf: n.conf }));
    const ref = {
      id: o.id || uid('r'), name: o.name || 'Referanse', kind: o.kind || MM.features.guessKind(notes),
      source: o.source || 'midi', notes, bpm: o.bpm || null, created: Date.now(),
    };
    const kd = T.detectKey(notes);
    ref.key = o.key || kd.key;
    ref.keyConfidence = o.key ? 1 : kd.confidence;
    ref.keyCandidates = kd.candidates.map((c) => ({ root: c.root, mode: c.mode }));
    ref.bars = o.bars || MM.features.phraseBars(MM.features.normalizeStart(notes));
    ref.chordSlot = o.chordSlot || SPB;
    if (o.analysis) ref.analysis = o.analysis;
    return ref;
  }

  function demoReferences() {
    return [
      makeReference({ id: 'demo-hook', name: 'Demo: trancehook i A-moll', kind: 'melody', source: 'drawn', key: { root: 9, mode: 'minor' }, bars: 2, notes: DEMO_HOOK.map(([t, d, p]) => ({ t, d, p, v: t % 8 === 0 ? 0.95 : 0.8 })) }),
      makeReference({
        id: 'demo-chords', name: 'Demo: Am – F – C – G', kind: 'chords', source: 'drawn', key: { root: 9, mode: 'minor' }, bars: 4,
        notes: DEMO_CHORDS.flatMap(([t, ps]) => ps.map((p) => ({ t, d: 16, p, v: 0.7 }))),
      }),
    ];
  }

  const INSTRUMENT_PRESETS = {
    house: { lead: 'pluck', pluck: 'stab', pad: 'warm', bass: 'deep' },
    trance: { lead: 'supersaw', pluck: 'pluck', pad: 'airy', bass: 'roll' },
    driving: { lead: 'hard-saw', pluck: 'pluck', pad: 'airy', bass: 'roll' },
  };

  function defaultInstruments(style) {
    const p = INSTRUMENT_PRESETS[style] || INSTRUMENT_PRESETS.trance;
    return {
      lead: { preset: p.lead, vol: 0.8, bright: 0.7, release: 0.35 },
      pluck: { preset: p.pluck, vol: 0.6, bright: 0.6, release: 0.2 },
      pad: { preset: p.pad, vol: 0.55, bright: 0.5, release: 0.6 },
      bass: { preset: p.bass, vol: 0.85, bright: 0.45, release: 0.1 },
      drums: { preset: 'synth', vol: 0.9, bright: 0.6, release: 0.3 },
      master: { vol: 0.85 },
    };
  }

  function newProject() {
    const style = 'trance';
    return {
      version: VERSION, id: uid('p'), name: 'Nytt prosjekt', created: Date.now(), modified: Date.now(),
      settings: { bpm: MM.arrange.STYLES[style].bpm, key: { root: 9, mode: 'minor' }, energy: 3, style, lengthMin: 7, breakdown: true },
      rules: Object.assign({}, MM.melody.DEFAULT_RULES),
      gen: { mode: 'inspire', refId: 'demo-hook', chordRefId: null, sources: {}, bars: 8, seed: MM.rng.newSeed() },
      references: demoReferences(),
      library: [],
      variants: [],
      theme: null,
      seeds: { drums: MM.rng.newSeed(), bass: MM.rng.newSeed(), chords: MM.rng.newSeed() },
      locked: { melody: false, chords: false, bass: false, drums: false },
      arrangement: null,
      instruments: defaultInstruments(style),
      samples: {},
      mixer: { mute: {}, solo: null },
    };
  }

  /* ---------- kilder for generering ---------- */

  function refById(project, id) { return project.references.find((r) => r.id === id) || null; }
  function libById(project, id) { return project.library.find((x) => x.id === id) || null; }

  function sourcesFromRef(ref) {
    if (!ref) return {};
    if (ref.kind === 'chords') {
      const ch = MM.features.analyzeChords(ref.notes, ref.key, ref.bars, ref.chordSlot);
      return { chords: { key: ref.key, bars: ch.bars, chords: ch.chords } };
    }
    const a = MM.features.analyzeMelody(ref.notes, ref.key, ref.bars);
    return {
      melody: { key: ref.key, bars: a.bars, notes: a.notes },
      rhythm: a.rhythm, contour: a.contour, intervals: a.intervals, phrase: a.phrase, rests: a.rests, accents: a.accents,
    };
  }

  /* Samler kildene: hovedreferanse, eventuell akkordreferanse og enkeltegenskaper fra biblioteket. */
  function resolveSources(project) {
    const g = project.gen;
    const src = sourcesFromRef(refById(project, g.refId));
    if (g.chordRefId) {
      const cr = refById(project, g.chordRefId);
      if (cr) {
        const s2 = sourcesFromRef(Object.assign({}, cr, { kind: 'chords' }));
        src.chords = s2.chords;
      }
    }
    for (const [type, id] of Object.entries(g.sources || {})) {
      if (!id) continue;
      if (id === 'none') { delete src[type]; continue; }
      const item = libById(project, id);
      if (item && item.type === type) src[type] = item.data;
    }
    return src;
  }

  function genSpec(project, seed, overrides) {
    const st = project.settings;
    const g = project.gen;
    const spec = {
      mode: g.mode, key: st.key, bars: g.bars, style: st.style, rules: project.rules,
      seed: seed >>> 0, src: resolveSources(project), count: 3,
    };
    if (project.locked.chords && project.theme) { spec.chords = project.theme.chords; spec.chordsBars = project.theme.bars; }
    return Object.assign(spec, overrides || {});
  }

  function makeVariants(project, seed) {
    const s = seed === undefined ? MM.rng.newSeed() : seed;
    project.gen.seed = s;
    const vs = MM.melody.generateVariants(genSpec(project, s));
    project.variants = vs.map((v, i) => Object.assign(v, { seed: s, index: i, label: 'ABC'[i] }));
    return project.variants;
  }

  function chooseVariant(project, i) {
    const v = project.variants[i];
    if (!v) return;
    project.theme = JSON.parse(JSON.stringify(v));
  }

  /* ---------- arrangement ---------- */

  function buildArrangement(project, opts) {
    if (!project.theme) throw new Error('Velg en melodi først.');
    const o = opts || {};
    project.arrangement = MM.arrange.build({
      settings: project.settings, theme: project.theme, seeds: project.seeds,
      locked: o.respectLocks === false ? {} : project.locked, previous: project.arrangement,
    });
    project.modified = Date.now();
    return project.arrangement;
  }

  function clone(x) { return JSON.parse(JSON.stringify(x)); }

  /* Tre sammenlignbare alternativer for én låsegruppe (eller alle ulåste: 'all'). */
  function alternatives(project, group) {
    if (!project.theme) throw new Error('Bygg et arrangement først.');
    const groups = group === 'all' ? Object.keys(MM.arrange.GROUPS).filter((g) => !project.locked[g]) : [group];
    if (!groups.length) throw new Error('Alle deler er låst.');
    const base = project.arrangement;
    const key = project.settings.key;
    const theme = project.theme;
    const alts = [];

    let melodyVariants = null;
    if (groups.includes('melody')) {
      const seed = MM.rng.newSeed();
      const overrides = { chords: theme.chords, chordsBars: theme.bars, bars: theme.bars };
      if (project.gen.mode === 'keep') {
        // melodien er beholdt: nye forslag bygges med det nåværende temaet som inspirasjon
        const a = MM.features.analyzeMelody(theme.notes, key, theme.bars);
        overrides.mode = 'inspire';
        overrides.src = { melody: { key, bars: theme.bars, notes: a.notes }, rhythm: a.rhythm, contour: a.contour, intervals: a.intervals };
      }
      if (groups.includes('chords') && !project.locked.chords) delete overrides.chords;
      melodyVariants = MM.melody.generateVariants(genSpec(project, seed, overrides));
    }
    let harmonies = null;
    if (groups.includes('chords') && !groups.includes('melody')) {
      const slot = theme.chords.length ? theme.chords[0].len : SPB;
      let bassRoots;
      if (project.locked.bass && base) {
        const br = MM.arrange.bassRootsPerSlot(base.parts.bass, theme, base.sections);
        bassRoots = br.roots;
      }
      const cur = theme.chords.map((c) => c.chord.deg + c.chord.q).join(',');
      harmonies = MM.harmony.harmonize(theme.notes, key, theme.bars, { count: 6, style: project.settings.style, slot, bassRoots })
        .filter((h) => h.chords.map((c) => c.chord.deg + c.chord.q).join(',') !== cur);
      if (harmonies.length < 3) {
        for (let k = 0; harmonies.length < 3 && k < 12; k++) {
          const ch = MM.harmony.pickProgression(key, theme.bars, project.settings.style, MM.rng.make(MM.rng.newSeed(), 'prog'), slot);
          const sig = ch.map((c) => c.chord.deg).join(',');
          if (!harmonies.some((h) => h.chords.map((c) => c.chord.deg).join(',') === sig)) harmonies.push({ chords: ch, score: 0 });
        }
      }
    }

    for (let i = 0; i < 3; i++) {
      const p = {
        settings: project.settings, theme: clone(theme), seeds: Object.assign({}, project.seeds),
        locked: {}, gen: project.gen,
      };
      const descr = [];
      for (const g of groups) {
        if (g === 'drums') p.seeds.drums = MM.rng.newSeed();
        if (g === 'bass') p.seeds.bass = MM.rng.newSeed();
        if (g === 'chords') p.seeds.chords = MM.rng.newSeed();
      }
      if (melodyVariants) {
        const v = melodyVariants[i % melodyVariants.length];
        p.theme = Object.assign(clone(v), { seed: v.seed });
        descr.push(v.desc);
      }
      if (harmonies && harmonies[i]) {
        p.theme.chords = harmonies[i].chords;
        descr.push('Akkorder: ' + MM.harmony.progressionLabel(key, p.theme.chords));
      } else if (groups.includes('chords') && melodyVariants) {
        descr.push('Akkorder: ' + MM.harmony.progressionLabel(key, p.theme.chords));
      }
      // Låste grupper gjenbrukes nøyaktig; de som skal endres bygges på nytt
      const locked = {};
      for (const g of Object.keys(MM.arrange.GROUPS)) locked[g] = !groups.includes(g);
      // bass og akkordrytme følger nye akkorder dersom de ikke er låst av brukeren
      if (groups.includes('chords') || groups.includes('melody')) {
        if (!project.locked.bass) locked.bass = false;
        if (!project.locked.chords) locked.chords = false;
      }
      p.arrangement = MM.arrange.build({ settings: project.settings, theme: p.theme, seeds: p.seeds, locked, previous: base });
      if (groups.includes('bass')) descr.push('Bass: ' + p.arrangement.info.bassPattern);
      if (groups.includes('chords')) descr.push('Akkordrytme: ' + p.arrangement.info.arp);
      if (groups.includes('drums')) descr.push('Nye trommemønstre og innfyll');
      alts.push({ label: 'ABC'[i], group, theme: p.theme, seeds: p.seeds, arrangement: p.arrangement, desc: descr.join(' · ') });
    }
    return alts;
  }

  function applyAlternative(project, alt) {
    project.theme = clone(alt.theme);
    project.seeds = Object.assign({}, alt.seeds);
    project.arrangement = alt.arrangement;
    project.modified = Date.now();
  }

  /* ---------- lagring ---------- */

  const packNotes = (ns) => ns.map((n) => [n.t, n.d, n.p, n.v]);
  const unpackNotes = (a) => a.map((x) => (Array.isArray(x) ? { t: x[0], d: x[1], p: x[2], v: x[3] } : x));

  function serialize(project) {
    const p = clone(project);
    p.version = VERSION;
    if (p.arrangement) {
      for (const k of Object.keys(p.arrangement.parts)) p.arrangement.parts[k] = packNotes(p.arrangement.parts[k]);
      p.arrangement.packed = true;
    }
    return JSON.stringify(p);
  }

  function deserialize(text) {
    const p = typeof text === 'string' ? JSON.parse(text) : text;
    if (!p || !p.settings || !p.references) throw new Error('Filen er ikke et Motivmotor-prosjekt.');
    if (p.arrangement && p.arrangement.packed) {
      for (const k of Object.keys(p.arrangement.parts)) p.arrangement.parts[k] = unpackNotes(p.arrangement.parts[k]);
      delete p.arrangement.packed;
    }
    const fresh = newProject();
    for (const k of Object.keys(fresh)) if (p[k] === undefined) p[k] = fresh[k];
    p.instruments = Object.assign(defaultInstruments(p.settings.style), p.instruments || {});
    p.rules = Object.assign({}, MM.melody.DEFAULT_RULES, p.rules || {});
    return p;
  }

  /* ---------- eksport av MIDI per stemme ---------- */

  function midiTracks(project) {
    const a = project.arrangement;
    if (!a) return [];
    const L = MM.arrange.PART_LABELS;
    return [
      { id: 'drums', name: L.drums, channel: 9, notes: a.parts.drums },
      { id: 'bass', name: L.bass, channel: 1, program: 38, notes: a.parts.bass },
      { id: 'pad', name: L.pad, channel: 2, program: 89, notes: a.parts.pad },
      { id: 'pluck', name: L.pluck, channel: 3, program: 81, notes: a.parts.pluck },
      { id: 'lead', name: L.lead, channel: 4, program: 81, notes: a.parts.lead },
    ].filter((t) => t.notes.length);
  }

  function midiFor(project, partId) {
    const tracks = midiTracks(project).filter((t) => !partId || t.id === partId);
    return MM.midi.writeMidi({ bpm: project.settings.bpm, title: project.name, tracks });
  }

  function themeMidi(project) {
    const t = project.theme;
    const key = project.settings.key;
    const chordNotes = [];
    for (const c of t.chords) for (const p of MM.harmony.voice(key, c.chord, null, 52, 67)) chordNotes.push({ t: c.t, d: c.len, p, v: 0.7 });
    return MM.midi.writeMidi({ bpm: project.settings.bpm, title: project.name + ' tema', tracks: [
      { name: 'Melodi', channel: 4, notes: t.notes }, { name: 'Akkorder', channel: 2, notes: chordNotes },
    ] });
  }

  MM.project = {
    VERSION, DEMO_HOOK, INSTRUMENT_PRESETS, uid, makeReference, demoReferences, defaultInstruments, newProject,
    refById, libById, sourcesFromRef, resolveSources, genSpec, makeVariants, chooseVariant, buildArrangement,
    alternatives, applyAlternative, serialize, deserialize, midiTracks, midiFor, themeMidi,
  };
})(globalThis.MM = globalThis.MM || {});
