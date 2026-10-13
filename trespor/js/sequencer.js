/* TRE SPOR – sequencer, variasjon, modulasjonskilder og utvikling.
   Alt her er rene funksjoner av (tilstand, globalt steg n). Lydmotoren og
   offline-eksporten kaller de samme funksjonene, så eksporten blir lik avspillingen. */
(function (root) {
  'use strict';
  var TS = root.TS;
  var S = TS.seq = {};

  /* ---------- mutasjoner (utvikling) ---------- */
  S.effectiveSteps = function (T) {
    var steps = T.seq.steps.map(function (s) { return Object.assign({}, s); });
    var rot = 0;
    (T.mutations || []).forEach(function (m) {
      if (m.type === 'rot') rot += m.by;
      else if (m.type === 'step' && steps[m.i]) steps[m.i][m.field] = m.value;
    });
    return { steps: steps, rot: rot };
  };
  S.effectiveDrums = function (D) {
    var voices = D.voices.map(function (v) { return v.steps.map(function (s) { return Object.assign({}, s); }); });
    (D.mutations || []).forEach(function (m) {
      var vi = TS.DRUM_VOICES.findIndex(function (x) { return x.id === m.v; });
      if (vi >= 0 && voices[vi][m.i]) voices[vi][m.i].on = m.on;
    });
    return voices;
  };
  S.mutatedSet = function (T, isDrums) {
    var set = {};
    (T.mutations || []).forEach(function (m) {
      if (isDrums) set[m.v + ':' + m.i] = true;
      else if (m.type === 'step') set[m.i] = true;
      else if (m.type === 'rot') set.rot = (set.rot || 0) + m.by;
    });
    return set;
  };

  /* ---------- posisjon i et spor ---------- */
  S.trackPos = function (T, n, rot) {
    var seq = T.seq, r = seq.rate || 1;
    if (n % r !== 0) return null;
    var base = n, resetBlock = 0;
    if (seq.reset > 0) { var span = seq.reset * 16; resetBlock = Math.floor(n / span); base = n - resetBlock * span; }
    var tick = Math.floor(base / r), len = seq.length;
    var idx = (((tick + seq.rotate + rot) % len) + len) % len;
    return { idx: idx, cycle: resetBlock * 100000 + Math.floor(tick / len) };
  };

  /* tetthet: under 0.5 tynnes usikre slag ut, over 0.5 får tomme steg en sjanse */
  function densityProb(p, d, idx) {
    var eff = p >= 1 ? 1 : TS.clamp(p * d * 2, 0, 1);
    if (d < 0.3 && idx !== 0) eff *= d / 0.3;
    return eff;
  }
  S.REGISTER = { bass: [26, 62], synth: [40, 96] };   // D1–D4 og E2–C7
  S.moveMult = function (T) { return T.macros.movement * 2; };

  /* ---------- hendelser for ett globalt steg ---------- */
  S.stepEvents = function (state, n) {
    var song = state.song, seed = song.seed;
    var out = { n: n, drums: [], bass: [], synth: [], pos: { drums: n % 16, bass: -1, synth: -1 }, loopBeat: -1 };

    /* trommer – alltid 16 steg, grunnpulsen */
    var D = state.tracks.drums;
    var di = n % 16, bar = Math.floor(n / 16);
    if (D.mode !== 'kit' && n % 4 === 0) out.loopBeat = Math.floor(n / 4) % (D.loopBars * 4);
    if (D.mode !== 'loop') {
      var dv = S.effectiveDrums(D);
      var dLocked = D.lock, dFrozen = dLocked || song.freeze;
      var cyc = dFrozen ? 0 : bar;
      var dd = D.macros.density;
      TS.DRUM_VOICES.forEach(function (voice, vi) {
        var s = dv[vi][di];
        var anchor = TS.DRUM_ANCHORS.indexOf(voice.id) >= 0;
        if (s.on) {
          var p = s.prob;
          if (!dLocked) p = anchor ? (p >= 1 ? 1 : TS.clamp(p * dd * 2, 0, 1)) : (p >= 1 ? TS.clamp(dd * 2.2, 0, 1) : TS.clamp(p * dd * 2, 0, 1));
          if (p >= 1 || TS.rand(seed, 'd', vi, di, cyc) < p) {
            var vel = s.acc ? 1 : 0.72;
            if (!dLocked) vel *= 0.94 + 0.12 * TS.rand(seed, 'dv', vi, di, cyc);
            out.drums.push({ v: vi, id: voice.id, vel: vel });
          }
        } else if (!dLocked && voice.id === 'hat' && dd > 0.55) {
          if (TS.rand(seed, 'dfill', di, cyc) < (dd - 0.55) * 1.2) out.drums.push({ v: vi, id: voice.id, vel: 0.38, fill: true });
        }
      });
    }

    /* bass og synth */
    TS.MELODIC.forEach(function (id) {
      var T = state.tracks[id];
      var eff = S.effectiveSteps(T);
      var pos = S.trackPos(T, n, eff.rot);
      if (!pos) return;
      out.pos[id] = pos.idx;
      var locked = T.lock, frozen = locked || song.freeze;
      var cyc = frozen ? 0 : pos.cycle, idx = pos.idx;
      var s = eff.steps[idx];
      var d = T.macros.density;
      var note = null;
      if (s.on) {
        var p = locked ? s.prob : densityProb(s.prob, d, idx);
        if (p >= 1 || TS.rand(seed, id, 'p', idx, cyc) < p) note = { deg: s.deg, oct: s.oct, gate: s.gate, vel: 0.85 };
      } else if (!locked && d > 0.55 && TS.rand(seed, id, 'fill', idx, cyc) < (d - 0.55) * 0.9) {
        /* utfylling: gjentar forrige tone kort og svakt, så den alltid er i skala */
        var len = T.seq.length;
        for (var k = 1; k < len; k++) {
          var ps = eff.steps[((idx - k) % len + len) % len];
          if (ps.on) { note = { deg: ps.deg, oct: ps.oct, gate: 0.35, vel: 0.55, fill: true }; break; }
        }
      }
      if (!note) return;
      /* kontrollert variasjon */
      var V = state.modulation.variation[id];
      if (!locked && V) {
        var rate = TS.clamp(V.rate * S.moveMult(T), 0, 0.9);
        if (TS.rand(seed, id, 'v', idx, cyc) < rate) {
          var w = [V.oct, V.len, idx === 0 ? 0 : V.rest, V.nabo], tot = w[0] + w[1] + w[2] + w[3];
          if (tot > 0) {
            var x = TS.rand(seed, id, 'vt', idx, cyc) * tot, type = 0;
            while (type < 3 && x >= w[type]) { x -= w[type]; type++; }
            var up = TS.rand(seed, id, 'vd', idx, cyc) < 0.5;
            if (type === 0) { note.oct = TS.clamp(note.oct + (up ? 1 : -1), -2, 2); note.varied = 'oktav'; }
            else if (type === 1) { note.gate = note.gate >= 0.5 ? 0.15 : 0.95; note.varied = 'lengde'; }
            else if (type === 2) { note = null; out[id + 'Rest'] = idx; }
            else { note.deg = TS.clamp(note.deg + (up ? 1 : -1), 0, TS.DEG_MAX); note.varied = 'nabotone'; }
          }
        }
      }
      if (!note) return;
      var patch = state.synths[id];
      var midi = TS.trackBaseMidi(song, id) + 12 * (patch.octave + note.oct) + TS.degreeToSemis(song, note.deg);
      /* musikalske grenser: tonen foldes inn i sporets register */
      var reg = S.REGISTER[id];
      while (midi < reg[0]) midi += 12;
      while (midi > reg[1]) midi -= 12;
      note.midi = midi;
      note.idx = idx;
      note.steps = T.seq.rate || 1;
      out[id].push(note);
    });
    return out;
  };

  /* ---------- modulasjonskilder ---------- */
  S.SOURCES = { lfo: 'LFO', drift: 'Drift', chance: 'Sjanse' };
  S.DESTS = {
    filter: { name: 'Filter',      what: 'filterets cutoff (±2 oktaver)' },
    env:    { name: 'Envelope',    what: 'decay-tiden i envelopen' },
    klang:  { name: 'Klang',       what: 'mengde romklang' },
    ekko:   { name: 'Ekko',        what: 'mengde ekko (delay)' },
    pan:    { name: 'Panorering',  what: 'plassering venstre–høyre' },
    farge:  { name: 'Farge',       what: 'blanding av oscillator 2' }
  };
  S.SHAPES = { sine: 'Sinus', tri: 'Trekant', ramp: 'Sagtann', square: 'Firkant (myk)', sh: 'Trinn (S&H)' };

  function smooth(a, b, f) { var t = (1 - Math.cos(f * Math.PI)) / 2; return a + (b - a) * t; }

  S.sourcesAt = function (state, n) {
    var M = state.modulation, seed = state.song.seed, frozen = state.song.freeze;
    var bars = n / 16;
    var lb = M.lfo.bars, ph = ((bars / lb) % 1 + 1) % 1, lfo;
    switch (M.lfo.shape) {
      case 'tri': lfo = 1 - 4 * Math.abs(ph - 0.5); break;
      case 'ramp': lfo = 1 - 2 * ph; break;
      case 'square': lfo = Math.tanh(4 * Math.sin(2 * Math.PI * ph)) / Math.tanh(4); break;
      case 'sh': var k0 = Math.floor(bars / lb); lfo = TS.rand(seed, 'lfosh', frozen ? k0 % 4 : k0) * 2 - 1; break;
      default: lfo = Math.sin(2 * Math.PI * ph);
    }
    /* drift: langsom, myk tilfeldig bevegelse. Fryst: veksler mellom to faste verdier */
    var db = M.drift.bars, dk = Math.floor(bars / db), df = bars / db - dk;
    var ka = frozen ? dk % 2 : dk, kb = frozen ? (dk + 1) % 2 : dk + 1;
    var drift = smooth(TS.rand(seed, 'drift', ka) * 2 - 1, TS.rand(seed, 'drift', kb) * 2 - 1, df);
    /* sjanse: ny verdi hver N takt. Fryst: samme fire verdier om igjen */
    var ck = Math.floor(bars / M.chance.bars);
    var chance = TS.rand(seed, 'chance', frozen ? ck % 4 : ck) * 2 - 1;
    return { lfo: lfo, drift: drift, chance: chance };
  };

  /* summerte modulasjonsbidrag per spor og mål, skalert av bevegelse */
  S.modsAt = function (state, n) {
    var src = S.sourcesAt(state, n);
    var out = { src: src, routes: [] };
    TS.TRACKS.forEach(function (id) { out[id] = { filter: 0, env: 0, klang: 0, ekko: 0, pan: 0, farge: 0 }; });
    state.modulation.routes.forEach(function (r, i) {
      var v = 0;
      if (r.on && out[r.track] && r.dest in out[r.track]) {
        v = r.depth * src[r.src] * S.moveMult(state.tracks[r.track]);
        out[r.track][r.dest] += v;
      }
      out.routes[i] = v;
    });
    return out;
  };

  /* ---------- utvikling: ett spor om gangen, små endringer, alltid i retur mot grunnideen ---------- */
  S.evoInterval = function (state) {
    var el = S.evoEligible(state);
    if (!el.length) return 0;
    var m = el.reduce(function (a, id) { return a + state.tracks[id].macros.movement; }, 0) / el.length;
    return Math.max(2, Math.round(16 - 14 * m));
  };
  S.evoEligible = function (state) {
    return TS.TRACKS.filter(function (id) {
      var T = state.tracks[id];
      if (T.lock || T.macros.movement < 0.03) return false;
      if (id === 'drums' && T.mode === 'loop') return false;
      return true;
    });
  };

  function stepKey(m) { return m.type === 'rot' ? 'rot' : (m.v ? m.v + ':' + m.i : m.i + ':' + m.field); }

  S.conduct = function (state, n) {
    if (n % 16 !== 0) return null;
    var song = state.song, rt = state.runtime;
    if (!song.evolve || song.freeze) return null;
    var el = S.evoEligible(state);
    if (!el.length) return null;
    rt.barsSince = (rt.barsSince || 0) + 1;
    if (rt.barsSince < S.evoInterval(state)) return null;
    rt.barsSince = 0;
    var k = rt.evoCount++;
    var r = function (salt) { return TS.rand(song.seed, 'evo', k, salt); };
    var cand = el.length > 1 ? el.filter(function (id) { return id !== rt.lastTrack; }) : el;
    var weights = cand.map(function (id) { return state.tracks[id].macros.movement * (id === 'drums' ? 0.4 : 1) + 0.01; });
    var tot = weights.reduce(function (a, b) { return a + b; }, 0), x = r('track') * tot, ti = 0;
    while (ti < cand.length - 1 && x >= weights[ti]) { x -= weights[ti]; ti++; }
    var id = cand[ti];
    rt.lastTrack = id;
    var T = state.tracks[id];
    var text = id === 'drums' ? mutateDrums(state, T, r) : mutateMelodic(state, id, T, r);
    return text ? { bar: n / 16, track: id, text: text } : null;
  };

  function pushMut(T, m) {
    var key = stepKey(m);
    T.mutations = T.mutations.filter(function (x) { return stepKey(x) !== key; });
    T.mutations.push(m);
  }
  function describeMel(state, id, m) {
    if (m.type === 'rot') return 'forskjøvet ' + (m.by > 0 ? 'ett steg fram' : 'ett steg tilbake');
    var s = 'steg ' + (m.i + 1) + ' ';
    if (m.field === 'deg') return s + 'ny tone (' + TS.NOTE_NAMES[(state.song.root + TS.degreeToSemis(state.song, m.value)) % 12] + ')';
    if (m.field === 'oct') return s + 'oktav ' + (m.value > 0 ? '+' : '') + m.value;
    if (m.field === 'on') return s + (m.value ? 'lagt til' : 'pause');
    if (m.field === 'gate') return s + (m.value > 0.5 ? 'lengre tone' : 'kortere tone');
    return s;
  }

  function mutateMelodic(state, id, T, r) {
    var maxM = 1 + Math.round(T.macros.movement * 5);
    if (T.mutations.length >= maxM || (T.mutations.length > 0 && r('back') < 0.3)) {
      var old = T.mutations.shift();
      return 'tilbake: ' + describeMel(state, id, old);
    }
    var eff = S.effectiveSteps(T), steps = eff.steps, len = T.seq.length;
    var onIdx = [], offIdx = [];
    for (var i = 1; i < len; i++) (steps[i].on ? onIdx : offIdx).push(i);
    var pick = function (arr, salt) { return arr[Math.floor(r(salt) * arr.length)]; };
    var t = r('type'), m = null;
    if (t < 0.35 && onIdx.length) {
      var i1 = pick(onIdx, 'i'), d = steps[i1].deg + (r('dir') < 0.5 ? -1 : 1) * (r('big') < 0.25 ? 2 : 1);
      m = { type: 'step', i: i1, field: 'deg', value: TS.clamp(d, 0, TS.DEG_MAX) };
    } else if (t < 0.55 && onIdx.length) {
      var i2 = pick(onIdx, 'i'), o = steps[i2].oct;
      m = { type: 'step', i: i2, field: 'oct', value: o !== 0 ? 0 : (r('dir') < 0.6 ? 1 : -1) };
    } else if (t < 0.75) {
      if ((r('add') < 0.5 || onIdx.length > len * 0.6) && onIdx.length > 3) {
        m = { type: 'step', i: pick(onIdx, 'i'), field: 'on', value: false };
      } else if (offIdx.length) {
        var i3 = pick(offIdx, 'i');
        /* ny tone låner tonen fra nærmeste slag før, så den passer inn */
        for (var k = 1; k < len; k++) { var ps = steps[((i3 - k) % len + len) % len]; if (ps.on) { pushMut(T, { type: 'step', i: i3, field: 'deg', value: ps.deg }); break; } }
        m = { type: 'step', i: i3, field: 'on', value: true };
      }
    } else if (t < 0.9 && onIdx.length) {
      var i4 = pick(onIdx, 'i');
      m = { type: 'step', i: i4, field: 'gate', value: steps[i4].gate > 0.5 ? 0.25 : 0.85 };
    } else {
      if (T.mutations.some(function (x) { return x.type === 'rot'; })) {
        T.mutations = T.mutations.filter(function (x) { return x.type !== 'rot'; });
        return 'forskyvning tilbake';
      }
      m = { type: 'rot', by: r('dir') < 0.5 ? 1 : -1 };
    }
    if (!m) return null;
    pushMut(T, m);
    return describeMel(state, id, m);
  }

  function mutateDrums(state, D, r) {
    var maxM = 1 + Math.round(D.macros.movement * 3);
    if (D.mutations.length >= maxM || (D.mutations.length > 0 && r('back') < 0.35)) {
      var old = D.mutations.shift();
      return 'tilbake: ' + nameOf(old.v) + ' steg ' + (old.i + 1);
    }
    /* bare hihat, åpen hat og perk – kick og klapp holder grunnpulsen */
    var ids = ['hat', 'open', 'perc'], vid = ids[Math.floor(r('v') * ids.length)];
    var vi = TS.DRUM_VOICES.findIndex(function (x) { return x.id === vid; });
    var steps = S.effectiveDrums(D)[vi];
    var i = 1 + Math.floor(r('i') * 15);
    if (i % 4 === 0) i = (i + 2) % 16;
    var m = { v: vid, i: i, on: !steps[i].on };
    pushMut(D, m);
    return nameOf(vid) + ' steg ' + (i + 1) + (m.on ? ' lagt til' : ' fjernet');
  }
  function nameOf(vid) { var v = TS.DRUM_VOICES.find(function (x) { return x.id === vid; }); return v ? v.name : vid; }

  /* Gjør utviklingens endringer til en del av grunnideen */
  S.keepMutations = function (T, isDrums) {
    if (isDrums) {
      var dv = S.effectiveDrums(T);
      T.voices.forEach(function (v, vi) { v.steps = dv[vi]; });
    } else {
      var eff = S.effectiveSteps(T);
      T.seq.steps = eff.steps;
      T.seq.rotate = ((T.seq.rotate + eff.rot) % T.seq.length + T.seq.length) % T.seq.length;
    }
    T.mutations = [];
  };
})(typeof window !== 'undefined' ? window : globalThis);
