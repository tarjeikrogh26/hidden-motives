/* TRE SPOR – lydmotor (Web Audio).
   Samme motor brukes både i sanntid og i offline-eksport (OfflineAudioContext).
   Synth: 2 oscillatorer + sub → lavpassfilter med envelope → VCA (ADSR) → drive → volum → panorering → klang/ekko. */
(function (root) {
  'use strict';
  var TS = root.TS;
  var REF = 100;                 // filterets referansefrekvens; cutoff ligger som cent-forskyvning på en modulasjonsbuss
  var LOOKAHEAD = 0.12;
  var TRACK_GAIN = { drums: 1, bass: 2.6, synth: 1.3 };   // nivåbalanse mellom sporene ved standardvolum

  function shaperCurve() {
    var n = 2049, c = new Float32Array(n), k = Math.tanh(4);
    for (var i = 0; i < n; i++) { var x = i / (n - 1) * 2 - 1; c[i] = Math.tanh(4 * x) / k; }
    return c;
  }
  var CURVE = null;
  function shape(x) { return Math.tanh(4 * TS.clamp(x, -1, 1)) / Math.tanh(4); }

  function Engine(ctx, opts) {
    opts = opts || {};
    this.ctx = ctx;
    this.offline = !!opts.offline;
    this.samples = opts.samples || {};
    this.loop = opts.loop || null;
    this.noteLog = opts.logNotes ? [] : null;
    this.tempoLog = opts.logNotes ? [] : null;
    this.onStep = null;
    this.beforeStep = null;
    this.lastVoice = {};
    this.lastFreq = {};
    this.openHat = null;
    this.delayTime = {};
    this.build(opts);
  }

  Engine.prototype.build = function (opts) {
    var c = this.ctx, self = this;
    if (!CURVE) CURVE = shaperCurve();
    this.master = c.createGain(); this.master.gain.value = 0.85;
    var comp = c.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 8; comp.ratio.value = 3; comp.attack.value = 0.006; comp.release.value = 0.18;
    var lim = c.createDynamicsCompressor();
    lim.threshold.value = -2; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.001; lim.release.value = 0.08;
    this.out = c.createGain();
    this.master.connect(comp); comp.connect(lim); lim.connect(this.out);

    var merger = null;
    if (opts.stems) {
      merger = c.createChannelMerger(8);
      c.destination.channelCount = 8;
      c.destination.channelCountMode = 'explicit';
      c.destination.channelInterpretation = 'discrete';
      merger.connect(c.destination);
      this._toMerger(this.out, merger, 0);
    } else if (opts.stemOnly) {
      /* reserve: ett spor rendres alene, uten master */
    } else {
      this.out.connect(c.destination);
    }
    if (!this.offline) {
      this.analyser = c.createAnalyser(); this.analyser.fftSize = 1024;
      this.out.connect(this.analyser);
    }

    var ir = TS.kit.impulse(c, 2.6);
    this.tr = {};
    TS.TRACKS.forEach(function (id, ti) {
      var t = {};
      t.input = c.createGain();
      t.pre = c.createGain();
      t.shaper = c.createWaveShaper(); t.shaper.curve = CURVE; t.shaper.oversample = '2x';
      t.post = c.createGain();
      t.vol = c.createGain();
      t.pan = c.createStereoPanner ? c.createStereoPanner() : null;
      t.sum = c.createGain();
      t.rev = c.createGain(); t.rev.gain.value = 0;
      t.conv = c.createConvolver(); t.conv.buffer = ir;
      t.dly = c.createGain(); t.dly.gain.value = 0;
      t.delay = c.createDelay(2.5); t.delay.delayTime.value = 0.36;
      t.dlpf = c.createBiquadFilter(); t.dlpf.type = 'lowpass'; t.dlpf.frequency.value = 2800;
      t.fb = c.createGain(); t.fb.gain.value = 0.38;
      t.cut = c.createConstantSource ? c.createConstantSource() : null;
      if (t.cut) { t.cut.offset.value = 0; t.cut.start(0); }

      var head = t.input;
      if (id === 'drums') {
        t.filter = c.createBiquadFilter(); t.filter.type = 'lowpass'; t.filter.Q.value = 0.5; t.filter.frequency.value = REF;
        if (t.cut) t.cut.connect(t.filter.detune);
        t.input.connect(t.filter); head = t.filter;
      }
      head.connect(t.pre); t.pre.connect(t.shaper); t.shaper.connect(t.post); t.post.connect(t.vol);
      var panOut = t.vol;
      if (t.pan) { t.vol.connect(t.pan); panOut = t.pan; }
      panOut.connect(t.sum);
      panOut.connect(t.rev); t.rev.connect(t.conv); t.conv.connect(t.sum);
      panOut.connect(t.dly); t.dly.connect(t.delay); t.delay.connect(t.dlpf); t.dlpf.connect(t.fb); t.fb.connect(t.delay); t.dlpf.connect(t.sum);
      if (opts.stemOnly) { if (opts.stemOnly === id) t.sum.connect(c.destination); }
      else t.sum.connect(self.master);
      if (merger) self._toMerger(t.sum, merger, 2 + ti * 2);
      self.tr[id] = t;
    });
  };

  Engine.prototype._toMerger = function (node, merger, ch) {
    var sp = this.ctx.createChannelSplitter(2);
    node.connect(sp); sp.connect(merger, 0, ch); sp.connect(merger, 1, ch + 1);
  };

  /* ---------- kontinuerlige parametere (jevne ramper steg for steg) ---------- */
  Engine.prototype.trackValues = function (state, id, mods) {
    var T = state.tracks[id], P = state.synths[id], I = T.macros.intensity, m = mods[id];
    var lo = 1200 * Math.log2(25 / REF), hi = 1200 * Math.log2(19000 / REF), cents;
    if (id === 'drums') cents = 1200 * Math.log2(P.tone / REF) + Math.min(0, I - 0.5) * 2 * 2400 + m.filter * 2400;
    else cents = 1200 * Math.log2(P.cutoff / REF) + (I - 0.5) * 2 * 1500 + m.filter * 2400;
    var drive = TS.clamp(P.drive + (I - 0.5) * 0.8, 0, 1);
    var pre = 0.08 * Math.pow(2, drive * 4.5);
    var post = 0.3 / shape(pre * 0.3);
    var volScale = id === 'drums' ? 0.8 + 0.4 * I : 0.85 + 0.3 * I;
    return {
      cut: TS.clamp(cents, lo, hi),
      pre: pre, post: post,
      vol: T.mute ? 0 : T.vol * volScale * TRACK_GAIN[id],
      rev: TS.clamp(P.reverb + m.klang * 0.6, 0, 1) * 0.9,
      dly: TS.clamp(P.delay + m.ekko * 0.6, 0, 1) * 0.75,
      pan: TS.clamp(P.pan + m.pan * 0.9, -1, 1),
      drive: drive
    };
  };

  Engine.prototype.applyParams = function (state, mods, t, first) {
    var self = this, c = this.ctx;
    var dur = TS.stepDur(state.song);
    TS.TRACKS.forEach(function (id) {
      var tr = self.tr[id], v = self.trackValues(state, id, mods);
      var set = function (param, val) {
        if (!param) return;
        if (first) { param.cancelScheduledValues(Math.max(0, c.currentTime)); param.setValueAtTime(val, t); }
        else param.linearRampToValueAtTime(val, t);
      };
      set(tr.cut && tr.cut.offset, v.cut);
      set(tr.pre.gain, v.pre); set(tr.post.gain, v.post);
      set(tr.vol.gain, v.vol);
      set(tr.rev.gain, v.rev); set(tr.dly.gain, v.dly);
      if (tr.pan) set(tr.pan.pan, v.pan);
      var dt = TS.clamp(dur * 3, 0.05, 2.4);           // ekko på punktert åttendedel, følger tempo
      if (first || Math.abs((self.delayTime[id] || 0) - dt) > 1e-4) { tr.delay.delayTime.setValueAtTime(dt, t); self.delayTime[id] = dt; }
    });
  };

  /* ---------- synthstemme ---------- */
  Engine.prototype.playNote = function (state, id, note, t, stepDur, mods) {
    var c = this.ctx, P = state.synths[id], T = state.tracks[id], tr = this.tr[id];
    var I = T.macros.intensity, m = mods[id];
    var f = TS.mtof(note.midi);
    var dur = Math.max(0.03, note.gate * stepDur * note.steps * (note.gate >= 0.95 ? 1.05 : 1));
    var envMul = Math.pow(2, 1.5 * TS.clamp(m.env, -1, 1));
    var att = Math.max(0.002, Math.min(P.attack, dur * 0.8));
    var dec = Math.max(0.01, P.decay * envMul), rel = Math.max(0.01, P.release * (0.6 + 0.4 * envMul));
    var vel = note.vel * (0.6 + 0.8 * I);
    var color = TS.clamp(P.color + m.farge * 0.5, 0, 1);

    var o1 = c.createOscillator(); o1.type = P.wave;
    var o2 = c.createOscillator(); o2.type = P.wave2; o2.detune.value = P.detune;
    var g1 = c.createGain(), g2 = c.createGain();
    var w1 = 1 - color * 0.7, w2 = color, ws = P.sub || 0, norm = 1 / Math.max(0.6, w1 + w2 + ws * 0.8);
    g1.gain.value = w1 * norm; g2.gain.value = w2 * norm;
    var oscs = [o1, o2], nodes = [o1, o2, g1, g2];
    var os = null;
    if (ws > 0) { os = c.createOscillator(); os.type = 'triangle'; var gs = c.createGain(); gs.gain.value = ws * 0.8 * norm; os.connect(gs); oscs.push(os); nodes.push(os, gs); }

    var prev = this.lastFreq[id];
    oscs.forEach(function (o, k) {
      var mul = o === os ? 0.5 : 1;
      if (P.glide > 0.001 && prev) {
        o.frequency.setValueAtTime(prev * mul, t);
        o.frequency.exponentialRampToValueAtTime(f * mul, t + P.glide);
      } else o.frequency.setValueAtTime(f * mul, t);
    });
    this.lastFreq[id] = f;

    var filt = c.createBiquadFilter(); filt.type = 'lowpass'; filt.Q.value = P.res;
    var envOct = P.envAmt * (0.6 + 0.8 * I);
    filt.frequency.setValueAtTime(REF, t);
    filt.frequency.exponentialRampToValueAtTime(REF * Math.pow(2, envOct), t + att);
    filt.frequency.setTargetAtTime(REF, t + att, Math.max(0.005, P.fdecay * envMul / 3));
    if (tr.cut) tr.cut.connect(filt.detune);

    var vca = c.createGain(), peak = 0.36 * vel, sus = P.sustain * peak, tc = dec / 3;
    vca.gain.setValueAtTime(0, t);
    vca.gain.linearRampToValueAtTime(peak, t + att);
    vca.gain.setTargetAtTime(sus, t + att, tc);
    var tEnd = t + dur;
    var vEnd = sus + (peak - sus) * Math.exp(-(tEnd - t - att) / tc);
    vca.gain.setValueAtTime(Math.max(vEnd, 0.0002), tEnd);
    vca.gain.exponentialRampToValueAtTime(0.0001, tEnd + rel);
    vca.gain.setValueAtTime(0, tEnd + rel + 0.005);   // helt stille før stemmen ryddes bort
    var choke = c.createGain();

    g1.connect(filt); g2.connect(filt);
    o1.connect(g1); o2.connect(g2);
    if (os) nodes[nodes.length - 1].connect(filt);
    filt.connect(vca); vca.connect(choke); choke.connect(tr.input);
    nodes.push(filt, vca, choke);

    if (P.mono && this.lastVoice[id] && this.lastVoice[id].end > t) {
      this.lastVoice[id].choke.gain.setTargetAtTime(0, t, 0.004);
    }
    this.lastVoice[id] = { choke: choke, end: tEnd + rel };

    var stopAt = tEnd + rel + 0.03;
    oscs.forEach(function (o) { o.start(t); o.stop(stopAt); });
    var cut = tr.cut;
    o1.onended = function () {
      try { if (cut) cut.disconnect(filt.detune); } catch (e) { /* allerede frakoblet */ }
      nodes.forEach(function (nd) { try { nd.disconnect(); } catch (e) { /* ok */ } });
    };
  };

  /* ---------- trommer ---------- */
  Engine.prototype.playDrum = function (state, ev, t) {
    var c = this.ctx, D = state.tracks.drums, V = D.voices[ev.v], buf = this.samples[ev.id];
    if (!buf) return;
    var I = D.macros.intensity;
    var src = c.createBufferSource(); src.buffer = buf;
    var rate = Math.pow(2, (V.pitch || 0) / 12); src.playbackRate.value = rate;
    var lvl = V.level * Math.pow(ev.vel, 0.5 + 1.5 * I);
    var g = c.createGain(); g.gain.value = lvl;
    var len = buf.duration / rate, stopAt = t + len;
    if (V.decay < 0.99) {
      var hold = Math.max(0.02, len * V.decay);
      g.gain.setValueAtTime(lvl, t + hold * 0.5);
      g.gain.exponentialRampToValueAtTime(0.0001, t + hold);
      stopAt = t + hold + 0.01;
    }
    src.connect(g);
    var last = g, choke = null;
    if (ev.id === 'open') { choke = c.createGain(); g.connect(choke); last = choke; this.openHat = { choke: choke, end: stopAt }; }
    if (ev.id === 'hat' && this.openHat && this.openHat.end > t) { this.openHat.choke.gain.setTargetAtTime(0, t, 0.012); this.openHat = null; }
    last.connect(this.tr.drums.input);
    src.start(t); src.stop(stopAt);
    src.onended = function () { try { src.disconnect(); g.disconnect(); if (choke) choke.disconnect(); } catch (e) { /* ok */ } };
  };

  /* importert trommeloop: spilles i slag-biter som alltid starter på grid, så den holder takten */
  Engine.prototype.playLoopSlice = function (state, beat, t, stepDur) {
    var buf = this.loop; if (!buf) return;
    var c = this.ctx, D = state.tracks.drums, I = D.macros.intensity;
    var beats = D.loopBars * 4, slice = buf.duration / beats, beatDur = stepDur * 4;
    var src = c.createBufferSource(); src.buffer = buf; src.playbackRate.value = slice / beatDur;
    var g = c.createGain(), lvl = D.loopLevel * (0.8 + 0.4 * I);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(lvl, t + 0.002);
    g.gain.setValueAtTime(lvl, t + beatDur - 0.003); g.gain.linearRampToValueAtTime(0, t + beatDur + 0.001);
    src.connect(g); g.connect(this.tr.drums.input);
    src.start(t, Math.min(beat * slice, buf.duration - 0.001)); src.stop(t + beatDur + 0.01);
    src.onended = function () { try { src.disconnect(); g.disconnect(); } catch (e) { /* ok */ } };
  };

  /* ---------- ett steg ---------- */
  Engine.prototype.scheduleStep = function (state, n, t, first) {
    var self = this, dur = TS.stepDur(state.song);
    var evo = TS.seq.conduct(state, n);
    var ev = TS.seq.stepEvents(state, n);
    var mods = TS.seq.modsAt(state, n);
    this.applyParams(state, mods, t, first);
    var swOff = TS.swingOffset(state.song, n, dur), ts = t + swOff;
    ev.drums.forEach(function (d) { self.playDrum(state, d, ts); });
    if (ev.loopBeat >= 0) this.playLoopSlice(state, ev.loopBeat, t, dur);
    TS.MELODIC.forEach(function (id) { ev[id].forEach(function (note) { self.playNote(state, id, note, ts, dur, mods); }); });
    if (this.noteLog) {
      var sw = swOff / dur, log = this.noteLog;
      if (!this.tempoLog.length || this.tempoLog[this.tempoLog.length - 1].bpm !== state.song.bpm) this.tempoLog.push({ n: n, bpm: state.song.bpm });
      if (!state.tracks.drums.mute) ev.drums.forEach(function (d) { log.push({ tr: 'drums', n: n, sw: sw, len: 0.5, midi: TS.DRUM_VOICES[d.v].gm, vel: d.vel }); });
      TS.MELODIC.forEach(function (id) {
        if (state.tracks[id].mute) return;
        ev[id].forEach(function (nt) { log.push({ tr: id, n: n, sw: sw, len: nt.gate * nt.steps, midi: nt.midi, vel: nt.vel }); });
      });
    }
    if (this.onStep) this.onStep({ n: n, time: t, ev: ev, mods: mods, evo: evo });
  };

  /* ---------- sanntidstransport ---------- */
  Engine.prototype.start = function (getState, fromStep) {
    this.getState = getState;
    this.nextStep = fromStep || 0;
    this.nextTime = this.ctx.currentTime + 0.08;
    this.first = true;
    this.running = true;
    this.lastVoice = {}; this.lastFreq = {}; this.openHat = null;
    var self = this;
    if (!this.worker && typeof Worker !== 'undefined' && typeof Blob !== 'undefined') {
      try {
        var url = URL.createObjectURL(new Blob(['var t=null;onmessage=function(e){if(e.data==="start"){clearInterval(t);t=setInterval(function(){postMessage(0)},25)}else{clearInterval(t)}}'], { type: 'text/javascript' }));
        this.worker = new Worker(url);
      } catch (e) { this.worker = null; }
    }
    if (this.worker) { this.worker.onmessage = function () { self.tick(); }; this.worker.postMessage('start'); }
    this.timer = setInterval(function () { self.tick(); }, 25);
    this.tick();
  };
  Engine.prototype.stop = function () {
    this.running = false;
    clearInterval(this.timer);
    if (this.worker) this.worker.postMessage('stop');
  };
  Engine.prototype.tick = function () {
    if (!this.running) return;
    var c = this.ctx;
    var hidden = typeof document !== 'undefined' && document.hidden;
    var ahead = hidden ? 1.2 : LOOKAHEAD;
    if (this.nextTime < c.currentTime - 0.2) { this.nextTime = c.currentTime + 0.05; this.first = true; }
    var guard = 0;
    while (this.nextTime < c.currentTime + ahead && guard++ < 64) {
      if (this.beforeStep) this.beforeStep(this.nextStep);
      var st = this.getState();
      this.scheduleStep(st, this.nextStep, this.nextTime, this.first);
      this.first = false;
      this.nextTime += TS.stepDur(st.song);
      this.nextStep++;
    }
  };

  TS.Engine = Engine;
  TS.REF = REF;
})(typeof window !== 'undefined' ? window : globalThis);
