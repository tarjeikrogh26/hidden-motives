/* Vokalypse – arrangør: bestemmer HVOR i de 16 taktene vokalen dukker opp, og hva som skjer med den.
   Mye luft er standard: vokalen samles i noen få motiver som gjentas med små endringer. */
(function (VK) {
  'use strict';

  const A = VK.Arranger = {};

  A.TYPES = {
    phrase:  { name: 'Frase',      color: '#d9c27a' },
    chop:    { name: 'Chops',      color: '#e0805a' },
    stutter: { name: 'Stutter',    color: '#e05a8a' },
    choir:   { name: 'Kor',        color: '#8fa6ff' },
    whisper: { name: 'Hvisk',      color: '#9ad0c2' },
    reverse: { name: 'Revers',     color: '#b48ce6' },
    dive:    { name: 'Pitch-dykk', color: '#7fc46a' },
    robot:   { name: 'Maskin',     color: '#c8c8c8' }
  };

  A.STYLES = {
    house:  { name: 'House',
      types: { phrase: 3, chop: 3, stutter: 1.5, choir: 2.5, whisper: 1, reverse: 1.5, dive: 0.6, robot: 0.3 },
      pos: { 0: 0.8, 2: 1.3, 4: 1.0, 6: 1.2, 8: 0.6, 10: 1.4, 12: 1.0, 14: 1.3 }, odd: 0.2, swing: 0.12 },
    techno: { name: 'Techno',
      types: { phrase: 1.5, chop: 2, stutter: 2, choir: 1.5, whisper: 3, reverse: 2, dive: 1, robot: 1 },
      pos: { 0: 0.4, 2: 0.9, 3: 0.7, 6: 0.9, 8: 0.4, 10: 1.1, 11: 0.7, 14: 1.0 }, odd: 0.35, swing: 0.0 },
    ebm:    { name: 'EBM',
      types: { phrase: 1, chop: 3, stutter: 2.5, choir: 0.7, whisper: 1, reverse: 1, dive: 1.5, robot: 3 },
      pos: { 0: 1.1, 4: 0.9, 8: 1.0, 12: 0.9, 3: 0.6, 6: 0.7, 11: 0.6, 14: 0.7 }, odd: 0.3, swing: 0.0 },
    free:   { name: 'Fritt',
      types: { phrase: 1.5, chop: 1.5, stutter: 1.5, choir: 1.5, whisper: 1.5, reverse: 1.5, dive: 1.5, robot: 1.5 },
      pos: {}, odd: 0.6, swing: 0.0 }
  };

  A.DENSITY = [
    { name: 'Glissen', perPhrase: 1.2, cap: 0.10, forms: ['_a_A', 'a__A', '_A__', '__a_', '_a__'] },
    { name: 'Luftig',  perPhrase: 2.0, cap: 0.16, forms: ['_A_A', 'a_aA', '_A_B', 'A__A', '_a_B'] },
    { name: 'Middels', perPhrase: 2.8, cap: 0.24, forms: ["aA_A'", '_ABA', 'A_AB', "aAaB'", "_ABA'"] },
    { name: 'Tett',    perPhrase: 3.6, cap: 0.34, forms: ["AA'BA", "ABAB'", 'aABA', "A_BA'"] },
    { name: 'Mye',     perPhrase: 4.6, cap: 0.48, forms: ['AABA', 'ABAB', "AA'BB'", "ABA'B"] }
  ];

  // 16-dels rytmer for chops (lengde 8 = to slag)
  const CHOP_PATTERNS = ['x.x.xx.x', 'xx.x..x.', 'x..x..x.', 'x.xx.x..', 'xxx.x...', 'x...x.x.', 'x.x..xx.', '.x.x.xx.'];
  const GATE_PATTERNS = ['x.x.x.x.', 'xx.xx.x.', 'x..x..x.', 'xxx.xxx.', 'x.xxx.x.'];

  function parseForm(f) {
    const out = [];
    for (let i = 0; i < f.length; i++) {
      const ch = f[i];
      if (ch === "'") { out[out.length - 1].mut = true; continue; }
      out.push({ k: ch, mut: false });
    }
    return out.slice(0, 4);
  }

  // ----- tonehøyde: hvor mange halvtoner må et utsnitt flyttes for å havne i tonearten? -----
  function pitchInfo(ctx, clip, offset, dur) {
    const key = clip.id + '|' + offset.toFixed(3) + '|' + Math.min(dur, 1.5).toFixed(3);
    if (!clip._pitch) clip._pitch = {};
    if (!(key in clip._pitch)) {
      const r = VK.DSP.detectPitch(clip.mono, VK.SR, offset, Math.min(dur, 1.5));
      clip._pitch[key] = r.f0 > 0 ? VK.hzToMidi(r.f0) : null;
    }
    return clip._pitch[key];
  }

  // Halvtoner fra kildens tone til en skalatone (skalatrinn 'degree' fra nærmeste skalatone)
  function semisToKey(ctx, clip, offset, dur, degree) {
    const m = pitchInfo(ctx, clip, offset, dur);
    if (m == null) return { semis: 0, pitched: false, baseMidi: null };
    const snapped = VK.snapToScale(m, ctx.root, ctx.scale);
    const target = VK.scaleStep(snapped, degree || 0, ctx.root, ctx.scale);
    let semis = target - m;
    while (semis > 14) semis -= 12;
    while (semis < -19) semis += 12;
    return { semis: semis, pitched: true, baseMidi: m + semis };
  }

  function pickClip(ctx, type) {
    const rng = ctx.rngC;
    const items = ctx.clips.map((c) => {
      let w = 1;
      const segs = c.analysis.segments;
      const noisy = segs.length ? segs.filter((s) => s.noisy).length / segs.length : 0;
      if (type === 'whisper') w = 0.6 + noisy * 2;
      if (type === 'choir' || type === 'robot') w = 1.4 - noisy;
      if (type === 'chop' || type === 'stutter') w = 0.6 + Math.min(1.4, c.analysis.onsets.length / 6);
      return [c, Math.max(0.05, w)];
    });
    return rng.weighted(items);
  }

  // Velg et startpunkt i klippet der det faktisk er lyd
  function pickOffset(ctx, clip, needSec) {
    const rng = ctx.rngC;
    const an = clip.analysis;
    const dur = an.duration;
    const cands = an.onsets.filter((o) => o + Math.min(needSec, 0.08) < dur);
    let off = cands.length ? rng.pick(cands) : 0;
    if (off + needSec > dur) off = Math.max(0, dur - needSec);
    return off;
  }

  function fxBase(ctx) {
    const amt = ctx.fx;
    const rng = ctx.rngC;
    return {
      filter: null,
      drive: rng.chance(0.25 * amt + (ctx.style === 'ebm' ? 0.2 : 0)) ? rng.range(0.2, 0.4 + 0.6 * amt) : 0,
      crush: rng.chance(0.12 * amt + (ctx.style === 'ebm' ? 0.1 : 0)) ? { hold: rng.pick([2, 3, 4, 6, 8]), bits: rng.pick([6, 7, 8, 10]) } : null,
      ring: rng.chance(0.1 * amt) ? { freq: rng.pick([30, 55, 90, 140, 220, 330]), mix: rng.range(0.3, 0.8) } : null,
      comb: rng.chance(0.15 * amt) ? { ms: rng.range(2.5, 11), fb: rng.range(0.4, 0.82) } : null,
      gate: null, whisper: false, robot: null, freeze: false, revSwell: false,
      reverb: rng.range(0.08, 0.3) * (0.4 + amt), delay: rng.chance(0.4) ? rng.range(0.1, 0.35) * (0.4 + amt) : 0
    };
  }

  // ----- Lag ett vokalinnslag av gitt type og lengde -----
  function makeEvent(ctx, type, lenSteps) {
    const rng = ctx.rngC;
    const t = ctx.t;
    const clip = pickClip(ctx, type);
    const fx = fxBase(ctx);
    const ev = { type: type, lenSteps: lenSteps, clipId: clip.id, hits: [], layers: [{ semis: 0, pan: 0, delay: 0, gain: 1 }], pan: 0, gain: 1, fx: fx, dive: null };
    const outSec = lenSteps * t.stepSec;

    if (type === 'phrase') {
      const off = pickOffset(ctx, clip, outSec);
      const p = semisToKey(ctx, clip, off, outSec, rng.pick([0, 0, 0, 2, -2, 4]));
      ev.hits.push({ step: 0, offset: off, dur: outSec, semis: p.semis, gain: 1 });
      if (rng.chance(0.45)) fx.filter = rng.chance(0.5) ? { type: 'bandpass', freq: rng.range(900, 2200), q: rng.range(0.7, 2) } : { type: 'lowpass', freq: rng.range(1800, 5000), q: 0.7 };
      fx.delay = Math.max(fx.delay, rng.range(0.15, 0.4));
      ev.pan = rng.range(-0.25, 0.25);
    } else if (type === 'chop') {
      const pat = rng.pick(CHOP_PATTERNS);
      const offs = [];
      const nSrc = rng.int(1, 3);
      for (let i = 0; i < nSrc; i++) offs.push(pickOffset(ctx, clip, t.stepSec * 2));
      const degs = rng.pick([[0], [0, 0, 2], [0, -2, 0, 3], [0, 4], [0, 0, -3]]);
      let k = 0;
      for (let s = 0; s < lenSteps; s++) {
        if (pat[s % pat.length] !== 'x') continue;
        const off = offs[k % offs.length];
        const p = semisToKey(ctx, clip, off, t.stepSec, degs[k % degs.length]);
        const semis = p.pitched ? p.semis : (degs[k % degs.length] * 2);
        ev.hits.push({ step: s, offset: off, dur: t.stepSec * (rng.chance(0.2) ? 0.5 : 0.92), semis: semis, gain: k === 0 ? 1 : rng.range(0.7, 1) });
        k++;
      }
      if (!ev.hits.length) ev.hits.push({ step: 0, offset: offs[0], dur: t.stepSec * 0.9, semis: 0, gain: 1 });
      if (rng.chance(0.5)) fx.filter = { type: 'highpass', freq: rng.range(150, 500), q: 0.8 };
      ev.pan = rng.range(-0.4, 0.4);
    } else if (type === 'stutter') {
      const off = pickOffset(ctx, clip, t.stepSec * 2);
      const unit = rng.pick([0.5, 0.5, 1]);
      const p = semisToKey(ctx, clip, off, t.stepSec * 2, 0);
      const rise = rng.chance(0.4);
      const n = Math.max(2, Math.floor((lenSteps - 1) / unit));
      for (let i = 0; i < n; i++) {
        ev.hits.push({
          step: i * unit, offset: off, dur: unit * t.stepSec * 0.85,
          semis: p.semis + (rise ? Math.floor(i / 2) : 0), gain: 0.55 + 0.45 * (i / n)
        });
      }
      ev.hits.push({ step: n * unit, offset: off, dur: Math.max(1, lenSteps - n * unit) * t.stepSec, semis: p.semis, gain: 1 });
      if (rng.chance(0.5)) fx.filter = { type: 'bandpass', freq: rng.range(700, 3000), q: rng.range(1, 4) };
      ev.pan = rng.range(-0.3, 0.3);
    } else if (type === 'choir') {
      const srcSec = Math.min(outSec, rng.range(0.25, 1.2));
      const off = pickOffset(ctx, clip, srcSec);
      const p = semisToKey(ctx, clip, off, srcSec, 0);
      ev.hits.push({ step: 0, offset: off, dur: outSec, semis: p.semis, gain: 1, srcSec: srcSec });
      fx.freeze = true; // granulær frysing gjør et kort utsnitt om til en flate
      const chord = rng.pick([[0, 2, 4], [0, 4, 7], [0, 2, 7], [0, 3, 6], [0, 4, 9], [-7, 0, 4]]);
      ev.layers = [];
      for (let i = 0; i < chord.length; i++) {
        let semis = 0;
        if (p.pitched) semis = VK.scaleStep(p.baseMidi, chord[i], ctx.root, ctx.scale) - p.baseMidi;
        else semis = [0, 7, 12, -5][i % 4];
        ev.layers.push({ semis: semis, pan: (i / Math.max(1, chord.length - 1)) * 1.4 - 0.7, delay: rng.range(0, 0.025), gain: 0.8, detune: rng.range(-12, 12) });
      }
      if (rng.chance(0.55)) ev.layers.push({ semis: -12, pan: 0, delay: 0.01, gain: 0.6, detune: rng.range(-6, 6) }); // munkeoktav
      if (rng.chance(0.3)) ev.layers.push({ semis: 12, pan: rng.range(-0.8, 0.8), delay: 0.03, gain: 0.35, detune: rng.range(-15, 15) });
      fx.reverb = rng.range(0.35, 0.7) * (0.5 + ctx.fx);
      fx.filter = { type: 'lowpass', freq: rng.range(2500, 6500), q: 0.6 };
      if (rng.chance(ctx.style === 'house' ? 0.4 : 0.25)) fx.gate = rng.pick(GATE_PATTERNS);
    } else if (type === 'whisper') {
      const off = pickOffset(ctx, clip, outSec);
      ev.hits.push({ step: 0, offset: off, dur: outSec, semis: rng.pick([0, 0, 0, -12]), gain: 1 });
      fx.whisper = true;
      fx.filter = { type: 'highpass', freq: rng.range(350, 900), q: 0.7 };
      fx.delay = rng.range(0.3, 0.6) * (0.6 + ctx.fx * 0.6);
      fx.reverb = Math.max(fx.reverb, 0.25);
      fx.drive = 0; fx.ring = null;
      ev.pan = rng.pick([-0.6, 0.6, -0.35, 0.35]);
    } else if (type === 'reverse') {
      const off = pickOffset(ctx, clip, outSec);
      const p = semisToKey(ctx, clip, off, outSec, rng.pick([0, 0, 4]));
      ev.hits.push({ step: 0, offset: off, dur: outSec, semis: p.semis, gain: 1, reverse: true });
      fx.revSwell = true;
      fx.reverb = rng.range(0.05, 0.2);
      ev.pan = rng.range(-0.2, 0.2);
    } else if (type === 'dive') {
      const off = pickOffset(ctx, clip, outSec);
      const p = semisToKey(ctx, clip, off, outSec, 0);
      ev.hits.push({ step: 0, offset: off, dur: outSec, semis: p.semis, gain: 1 });
      ev.dive = rng.chance(0.7) ? { to: p.semis - rng.pick([12, 19, 24]) } : { to: p.semis + rng.pick([7, 12]) };
      if (rng.chance(0.5)) fx.filter = { type: 'lowpass', freq: rng.range(1500, 4000), q: rng.range(0.7, 3) };
    } else if (type === 'robot') {
      const off = pickOffset(ctx, clip, outSec);
      ev.hits.push({ step: 0, offset: off, dur: outSec, semis: 0, gain: 1 });
      const m = ctx.root + 12 * rng.pick([3, 4]) + rng.pick([0, 0, 7]);
      fx.robot = { hz: VK.midiToHz(m) };
      fx.drive = Math.max(fx.drive, rng.range(0.3, 0.7));
      if (rng.chance(0.4)) fx.gate = rng.pick(GATE_PATTERNS);
      ev.pan = rng.range(-0.2, 0.2);
    }
    return ev;
  }

  const LEN = {
    phrase: [4, 6, 8, 12, 16], chop: [4, 8, 8], stutter: [2, 3, 4, 6], choir: [8, 12, 16, 24, 32],
    whisper: [4, 6, 8, 12], reverse: [4, 6, 8, 12], dive: [4, 6, 8], robot: [4, 6, 8]
  };

  function posWeight(ctx, stepInPhrase) {
    const st = A.STYLES[ctx.style];
    const bar = Math.floor(stepInPhrase / 16), s = stepInPhrase % 16;
    let w = st.pos[s] != null ? st.pos[s] : (s % 2 ? st.odd : 0.5);
    w *= [0.6, 1.0, 0.85, 1.6][bar];
    return w;
  }

  // Lag et motiv: innslag plassert innenfor en frase på 4 takter (64 steg)
  function makeMotif(ctx, nEvents, label) {
    const rng = ctx.rngS;
    const occ = new Uint8Array(64);
    const events = [];
    let used = 0;
    const capSteps = Math.max(4, Math.round(ctx.dens.cap * 64 * 1.3));
    const allowed = Object.keys(A.TYPES).filter((k) => ctx.ingredients[k]);
    if (!allowed.length) allowed.push('phrase');
    const st = A.STYLES[ctx.style];
    for (let e = 0; e < nEvents * 3 && events.length < nEvents; e++) {
      const type = rng.weighted(allowed.map((k) => [k, st.types[k]]));
      const fits = LEN[type].filter((l) => used + l <= capSteps);
      if (!fits.length) continue; // denne typen får ikke plass – prøv en annen
      const len = rng.pick(fits);
      // finn plass
      const cands = [];
      for (let p = 0; p + len <= 64; p++) {
        if (type === 'reverse' && (p + len) % 16 !== 0) continue; // revers skal suge inn mot en ener
        if (type === 'choir' && p % 4 !== 0) continue;
        let free = true;
        for (let i = Math.max(0, p - 1); i < Math.min(64, p + len + 1); i++) if (occ[i]) { free = false; break; }
        if (!free) continue;
        cands.push([p, posWeight(ctx, p)]);
      }
      if (!cands.length) continue;
      const pos = rng.weighted(cands);
      for (let i = pos; i < pos + len; i++) occ[i] = 1;
      used += len;
      const ev = makeEvent(ctx, type, len);
      ev.relStep = pos;
      ev.motif = label + (events.length + 1);
      events.push(ev);
    }
    return events;
  }

  function cloneEv(ev) { return JSON.parse(JSON.stringify(ev)); }

  // Liten endring ved gjentakelse, så motivet lever
  function mutate(ctx, events) {
    const rng = ctx.rngS;
    const evs = events.map(cloneEv);
    if (!evs.length) return evs;
    const target = rng.pick(evs);
    const what = rng.weighted([['reverse', 1], ['pitch', 1.5], ['stutterTail', 1], ['drop', evs.length > 1 ? 1 : 0], ['wash', 1]]);
    if (what === 'reverse') { for (const h of target.hits) h.reverse = !h.reverse; }
    else if (what === 'pitch') { const d = rng.pick([-5, -3, 3, 5, 7, -12]); for (const h of target.hits) h.semis += d; }
    else if (what === 'stutterTail' && target.hits.length) {
      const last = target.hits[target.hits.length - 1];
      const endStep = last.step + Math.max(1, Math.round(last.dur / ctx.t.stepSec));
      if (endStep < target.lenSteps + 2) {
        for (let i = 0; i < 3; i++) target.hits.push({ step: endStep + i * 0.5, offset: last.offset, dur: ctx.t.stepSec * 0.42, semis: last.semis, gain: 0.7 - i * 0.15 });
        target.lenSteps = Math.max(target.lenSteps, endStep + 2);
      }
    } else if (what === 'drop') { evs.splice(evs.indexOf(target), 1); }
    else if (what === 'wash') { target.fx.reverb = Math.min(1, target.fx.reverb + 0.35); target.fx.delay = Math.min(0.8, target.fx.delay + 0.3); }
    return evs;
  }

  /* settings: {bpm, root, scale, density (0..4), style, swing (0..0.5), ingredients{}, fx (0..1)}
     clips: [{id, mono, analysis, ...}] */
  A.arrange = function (settings, clips, seed, colorSeed) {
    if (!clips.length) throw new Error('Velg minst ett klipp med råmateriale.');
    const ctx = {
      t: VK.timing(settings.bpm), root: settings.root, scale: settings.scale, style: settings.style,
      dens: A.DENSITY[settings.density], ingredients: settings.ingredients, fx: settings.fx,
      clips: clips, rngS: VK.makeRng(seed), rngC: VK.makeRng((colorSeed * 2654435761) >>> 0)
    };
    const rng = ctx.rngS;
    const form = parseForm(rng.pick(ctx.dens.forms));
    const per = ctx.dens.perPhrase;
    const motifs = {};
    const getMotif = (k) => {
      const K = k.toUpperCase();
      if (!motifs[K]) motifs[K] = makeMotif(ctx, Math.max(1, Math.round(per + rng.range(-0.5, 0.6))), K);
      return motifs[K];
    };
    const events = [];
    form.forEach((slot, phrase) => {
      if (slot.k === '_') {
        // tomme fraser får av og til ett lite innslag helt på slutten
        if (rng.chance(0.25 + settings.density * 0.08)) {
          const allowed = ['stutter', 'reverse', 'chop', 'whisper'].filter((k) => ctx.ingredients[k]);
          if (allowed.length) {
            const type = rng.pick(allowed);
            const len = type === 'reverse' ? 4 : rng.pick([2, 3, 4]);
            const ev = makeEvent(ctx, type, len);
            ev.relStep = 64 - len - (type === 'reverse' ? 0 : rng.pick([0, 2, 4]));
            ev.motif = '·';
            ev.step = phrase * 64 + ev.relStep;
            events.push(ev);
          }
        }
        return;
      }
      let evs = getMotif(slot.k).map(cloneEv);
      if (slot.k === slot.k.toLowerCase()) evs = evs.length > 1 ? [rng.pick(evs)] : evs; // 'a' = bare et utdrag
      if (slot.mut) evs = mutate(ctx, evs);
      for (const ev of evs) {
        ev.step = phrase * 64 + ev.relStep;
        events.push(ev);
      }
    });
    events.sort((a, b) => a.step - b.step);
    events.forEach((e, i) => { e.id = i; });
    return { events: events, form: form.map((f) => f.k + (f.mut ? "'" : '')).join(' ') };
  };
})(window.VK = window.VK || {});
