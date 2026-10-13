/* Enkel innebygd synthmotor (Web Audio). Samme kode brukes til avspilling og til WAV-eksport (OfflineAudioContext).
   Komposisjonen (noter) er helt adskilt fra lyden: MIDI-eksporten bruker bare notene. */
(function (MM) {
  'use strict';
  const T = MM.theory;

  const PRESETS = {
    lead: {
      supersaw: { label: 'Supersaw', osc: ['sawtooth', 5], spread: 22, a: 0.004, dcy: 0.25, s: 0.75, cut: 900, cutRange: 7000, env: 1.6, envDecay: 0.25, q: 2 },
      'hard-saw': { label: 'Hard saw', osc: ['sawtooth', 7], spread: 30, a: 0.002, dcy: 0.18, s: 0.8, cut: 1500, cutRange: 9000, env: 1.3, envDecay: 0.18, q: 3 },
      pluck: { label: 'Pluck', osc: ['sawtooth', 3], spread: 12, a: 0.002, dcy: 0.3, s: 0.12, cut: 500, cutRange: 6000, env: 3, envDecay: 0.18, q: 4 },
      soft: { label: 'Myk lead', osc: ['triangle', 2], spread: 8, a: 0.02, dcy: 0.3, s: 0.8, cut: 1200, cutRange: 4000, env: 1, envDecay: 0.3, q: 1 },
    },
    pluck: {
      pluck: { label: 'Pluck', osc: ['sawtooth', 2], spread: 10, a: 0.002, dcy: 0.18, s: 0.05, cut: 400, cutRange: 5000, env: 3, envDecay: 0.12, q: 5 },
      stab: { label: 'Stab', osc: ['square', 2], spread: 8, a: 0.002, dcy: 0.14, s: 0.15, cut: 700, cutRange: 4500, env: 2, envDecay: 0.1, q: 3 },
      bell: { label: 'Klokke', osc: ['triangle', 2], spread: 4, a: 0.001, dcy: 0.5, s: 0.05, cut: 2500, cutRange: 6000, env: 1, envDecay: 0.3, q: 1 },
    },
    pad: {
      airy: { label: 'Luftig pad', osc: ['sawtooth', 4], spread: 18, a: 0.6, dcy: 0.5, s: 0.85, cut: 500, cutRange: 3500, env: 0.3, envDecay: 1.5, q: 0.7 },
      warm: { label: 'Varm pad', osc: ['triangle', 3], spread: 12, a: 0.35, dcy: 0.5, s: 0.9, cut: 700, cutRange: 2500, env: 0.2, envDecay: 1, q: 0.5 },
      strings: { label: 'Strykere', osc: ['sawtooth', 3], spread: 10, a: 0.25, dcy: 0.4, s: 0.85, cut: 900, cutRange: 3000, env: 0.4, envDecay: 0.8, q: 0.8 },
    },
    bass: {
      roll: { label: 'Rullebass', osc: ['sawtooth', 1], sub: 0.7, spread: 0, a: 0.002, dcy: 0.12, s: 0.6, cut: 180, cutRange: 1800, env: 2.5, envDecay: 0.09, q: 3 },
      deep: { label: 'Dyp bass', osc: ['triangle', 1], sub: 0.9, spread: 0, a: 0.003, dcy: 0.2, s: 0.7, cut: 250, cutRange: 1200, env: 1.2, envDecay: 0.12, q: 1 },
      reese: { label: 'Reese', osc: ['sawtooth', 2], sub: 0.5, spread: 14, a: 0.005, dcy: 0.2, s: 0.8, cut: 220, cutRange: 1500, env: 1, envDecay: 0.15, q: 2 },
    },
  };

  const BUS_GAIN = { drums: 0.9, bass: 0.55, pad: 0.16, pluck: 0.18, lead: 0.2, fx: 0.25 };
  const DUCK = { bass: 0.15, pad: 0.4, pluck: 0.55, lead: 0.75 };
  const SAMPLE_SLOTS = [
    { p: 36, label: 'Kick' }, { p: 39, label: 'Clap' }, { p: 38, label: 'Skarptromme' }, { p: 42, label: 'Lukket hihat' },
    { p: 46, label: 'Åpen hihat' }, { p: 51, label: 'Ride' }, { p: 49, label: 'Crash' }, { p: 70, label: 'Perkusjon' },
  ];

  const mtof = (p) => 440 * Math.pow(2, (p - 69) / 12);
  const filterFreq = (v) => 120 * Math.pow(2, T.clamp(v, 0, 1) * 7.3); // 120 Hz – ~19 kHz

  function makeNoise(ctx) {
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let s = 22222;
    for (let i = 0; i < len; i++) { s = (s * 16807) % 2147483647; d[i] = (s / 2147483647) * 2 - 1; }
    return buf;
  }

  function makeImpulse(ctx, seconds, decay) {
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    let s = 1234567;
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        s = (s * 16807) % 2147483647;
        d[i] = ((s / 2147483647) * 2 - 1) * Math.pow(1 - i / len, decay);
      }
    }
    return buf;
  }

  class Engine {
    /* opts: { instruments, samples: {pitch: AudioBuffer}, bpm, mute: {}, solo } */
    constructor(ctx, opts) {
      this.ctx = ctx;
      this.opts = opts;
      this.inst = opts.instruments;
      this.samples = opts.samples || {};
      this.spb = 60 / opts.bpm; // sekunder per slag
      this.noise = makeNoise(ctx);

      this.out = ctx.createGain();
      this.out.gain.value = (this.inst.master && this.inst.master.vol !== undefined ? this.inst.master.vol : 0.85);
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14; comp.knee.value = 8; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.15;
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -2; limiter.knee.value = 0; limiter.ratio.value = 20; limiter.attack.value = 0.001; limiter.release.value = 0.08;
      this.master = ctx.createGain();
      this.master.connect(comp); comp.connect(limiter); limiter.connect(this.out); this.out.connect(ctx.destination);

      // romklang og delay
      this.reverb = ctx.createConvolver();
      this.reverb.buffer = makeImpulse(ctx, 2.8, 3.2);
      const revGain = ctx.createGain(); revGain.gain.value = 0.35;
      this.reverb.connect(revGain); revGain.connect(this.master);
      this.delay = ctx.createDelay(2);
      this.delay.delayTime.value = this.spb * 0.75; // punktert åttendedel
      const fb = ctx.createGain(); fb.gain.value = 0.38;
      const dlp = ctx.createBiquadFilter(); dlp.type = 'lowpass'; dlp.frequency.value = 3200;
      const dOut = ctx.createGain(); dOut.gain.value = 0.3;
      this.delay.connect(dlp); dlp.connect(fb); fb.connect(this.delay); dlp.connect(dOut); dOut.connect(this.master); dOut.connect(this.reverb);

      this.bus = {};
      for (const name of ['drums', 'bass', 'pad', 'pluck', 'lead', 'fx']) {
        const input = ctx.createGain();
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass'; filter.frequency.value = 20000; filter.Q.value = 0.8;
        const duck = ctx.createGain();
        const vol = ctx.createGain();
        const iv = this.inst[name] ? this.inst[name].vol : 0.8;
        let audible = !(opts.mute && opts.mute[name]);
        if (opts.solo && opts.solo !== name) audible = false;
        vol.gain.value = BUS_GAIN[name] * (iv === undefined ? 0.8 : iv) * (audible ? 1 : 0);
        input.connect(filter); filter.connect(duck); duck.connect(vol); vol.connect(this.master);
        const b = { input, filter, duck, vol };
        if (name === 'lead' || name === 'pluck') { const s = ctx.createGain(); s.gain.value = name === 'lead' ? 0.35 : 0.25; vol.connect(s); s.connect(this.delay); }
        if (name === 'lead' || name === 'pad' || name === 'pluck' || name === 'fx') { const s = ctx.createGain(); s.gain.value = name === 'pad' ? 0.5 : 0.3; vol.connect(s); s.connect(this.reverb); }
        this.bus[name] = b;
      }
    }

    /* Filterautomasjon per buss fra arrangementet. t0 = lydtid for steg `fromStep`. */
    automate(auto, t0, fromStep, stepSec) {
      if (!auto) return;
      for (const name of Object.keys(auto)) {
        const f = this.bus[name] && this.bus[name].filter.frequency;
        if (!f) continue;
        const pts = auto[name];
        let startV = pts.length ? pts[0].v : 1;
        for (let i = 0; i < pts.length; i++) {
          if (pts[i].t <= fromStep) startV = pts[i].v;
          if (i < pts.length - 1 && pts[i].t <= fromStep && pts[i + 1].t > fromStep) {
            const k = (fromStep - pts[i].t) / (pts[i + 1].t - pts[i].t);
            startV = pts[i].v + (pts[i + 1].v - pts[i].v) * k;
          }
        }
        f.setValueAtTime(filterFreq(startV), t0);
        for (const pt of pts) {
          if (pt.t <= fromStep) continue;
          f.linearRampToValueAtTime(filterFreq(pt.v), t0 + (pt.t - fromStep) * stepSec);
        }
      }
    }

    staticFilters(values) {
      for (const [name, v] of Object.entries(values)) if (this.bus[name]) this.bus[name].filter.frequency.setValueAtTime(filterFreq(v), this.ctx.currentTime);
    }

    duck(time) {
      for (const [name, depth] of Object.entries(DUCK)) {
        const g = this.bus[name].duck.gain;
        g.setValueAtTime(depth, time);
        g.setTargetAtTime(1, time + 0.012, this.spb * 0.16);
      }
    }

    note(part, n, time, dur) {
      if (part === 'drums') return this.drum(n.p, n.v, time, dur);
      const set = PRESETS[part];
      if (!set) return;
      const inst = this.inst[part] || {};
      const pr = set[inst.preset] || set[Object.keys(set)[0]];
      const ctx = this.ctx;
      const freq = mtof(n.p);
      const vel = n.v === undefined ? 0.8 : n.v;
      const rel = 0.04 + (inst.release === undefined ? 0.3 : inst.release) * (part === 'pad' ? 1.8 : 0.8);
      const end = time + Math.max(0.03, dur);

      const amp = ctx.createGain();
      const filt = ctx.createBiquadFilter();
      filt.type = 'lowpass';
      filt.Q.value = pr.q;
      const bright = inst.bright === undefined ? 0.6 : inst.bright;
      const base = pr.cut + pr.cutRange * bright * (0.6 + 0.4 * vel);
      const peak = Math.min(18000, base * (1 + pr.env));
      filt.frequency.setValueAtTime(peak, time);
      filt.frequency.setTargetAtTime(base, time + pr.a, pr.envDecay / 3);
      filt.connect(amp);
      amp.connect(this.bus[part].input);

      const level = vel * (part === 'bass' ? 0.9 : 0.6);
      const sustain = level * pr.s;
      // Konvolutten regnes ut analytisk ved noteslutt, så releasen starter uten klikk
      amp.gain.setValueAtTime(0, time);
      let atEnd;
      if (end <= time + pr.a) {
        atEnd = level * (end - time) / pr.a;
        amp.gain.linearRampToValueAtTime(atEnd, end);
      } else {
        amp.gain.linearRampToValueAtTime(level, time + pr.a);
        amp.gain.setTargetAtTime(sustain, time + pr.a, pr.dcy / 3);
        atEnd = sustain + (level - sustain) * Math.exp(-(end - time - pr.a) / (pr.dcy / 3));
        amp.gain.setValueAtTime(atEnd, end);
      }
      amp.gain.setTargetAtTime(0, end, rel / 4);
      const stopAt = end + rel + 0.05;

      const [wave, count] = pr.osc;
      const per = 1 / Math.sqrt(count);
      for (let i = 0; i < count; i++) {
        const o = ctx.createOscillator();
        o.type = wave;
        o.frequency.value = freq;
        if (count > 1) o.detune.value = (i / (count - 1) - 0.5) * 2 * pr.spread * (0.6 + 0.8 * (inst.detune === undefined ? 0.5 : inst.detune));
        const g = ctx.createGain();
        g.gain.value = per;
        o.connect(g); g.connect(filt);
        o.start(time); o.stop(stopAt);
      }
      if (pr.sub) {
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.value = freq;
        const g = ctx.createGain(); g.gain.value = pr.sub;
        o.connect(g); g.connect(amp);
        o.start(time); o.stop(stopAt);
      }
    }

    noiseHit(time, dur, type, freq, q, level, bus) {
      const ctx = this.ctx;
      const src = ctx.createBufferSource();
      src.buffer = this.noise;
      const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q || 0.7;
      const g = ctx.createGain();
      g.gain.setValueAtTime(level, time);
      g.gain.exponentialRampToValueAtTime(0.0008, time + dur);
      src.connect(f); f.connect(g); g.connect(bus || this.bus.drums.input);
      src.start(time, (time * 7.31) % 1.5); src.stop(time + dur + 0.02);
    }

    drum(p, v, time) {
      const ctx = this.ctx;
      const vel = v === undefined ? 0.8 : v;
      if (p === 36) this.duck(time);
      const smp = this.samples[p];
      if (smp) {
        const s = ctx.createBufferSource(); s.buffer = smp;
        const g = ctx.createGain(); g.gain.value = vel;
        s.connect(g); g.connect(this.bus.drums.input); s.start(time);
        return;
      }
      const bright = this.inst.drums && this.inst.drums.bright !== undefined ? this.inst.drums.bright : 0.6;
      switch (p) {
        case 36: {
          const o = ctx.createOscillator(); o.type = 'sine';
          o.frequency.setValueAtTime(160, time);
          o.frequency.exponentialRampToValueAtTime(48, time + 0.09);
          const g = ctx.createGain();
          g.gain.setValueAtTime(1.0 * vel, time);
          g.gain.setTargetAtTime(0, time + 0.06, 0.09);
          o.connect(g); g.connect(this.bus.drums.input); o.start(time); o.stop(time + 0.6);
          this.noiseHit(time, 0.012, 'highpass', 1500, 0.5, 0.3 * vel);
          break;
        }
        case 39:
          for (let k = 0; k < 3; k++) this.noiseHit(time + k * 0.008, 0.02, 'bandpass', 1300, 1.2, 0.5 * vel);
          this.noiseHit(time + 0.024, 0.18, 'bandpass', 1200, 1, 0.6 * vel);
          break;
        case 38: {
          this.noiseHit(time, 0.16, 'highpass', 1200, 0.7, 0.45 * vel);
          const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.setValueAtTime(220, time); o.frequency.exponentialRampToValueAtTime(160, time + 0.08);
          const g = ctx.createGain(); g.gain.setValueAtTime(0.4 * vel, time); g.gain.exponentialRampToValueAtTime(0.001, time + 0.1);
          o.connect(g); g.connect(this.bus.drums.input); o.start(time); o.stop(time + 0.12);
          break;
        }
        case 42: this.noiseHit(time, 0.045, 'highpass', 6000 + 3000 * bright, 0.8, 0.28 * vel); break;
        case 46: this.noiseHit(time, 0.22, 'highpass', 5500 + 2500 * bright, 0.8, 0.22 * vel); break;
        case 51: this.noiseHit(time, 0.5, 'bandpass', 7000, 2, 0.2 * vel); break;
        case 49: this.noiseHit(time, 1.8, 'highpass', 4500, 0.6, 0.25 * vel); break;
        case 70: this.noiseHit(time, 0.035, 'bandpass', 5500, 1.5, 0.3 * vel); break;
        default: this.noiseHit(time, 0.05, 'bandpass', 3000, 1, 0.3 * vel);
      }
    }

    fx(ev, time, dur) {
      const ctx = this.ctx;
      if (ev.kind === 'riser') {
        const src = ctx.createBufferSource(); src.buffer = this.noise; src.loop = true;
        const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 2.5;
        f.frequency.setValueAtTime(300, time); f.frequency.exponentialRampToValueAtTime(9000, time + dur);
        const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, time); g.gain.exponentialRampToValueAtTime(0.5, time + dur);
        g.gain.setValueAtTime(0.0001, time + dur + 0.01);
        src.connect(f); f.connect(g); g.connect(this.bus.fx.input);
        src.start(time); src.stop(time + dur + 0.05);
      } else if (ev.kind === 'impact') {
        const o = ctx.createOscillator(); o.type = 'sine';
        o.frequency.setValueAtTime(90, time); o.frequency.exponentialRampToValueAtTime(30, time + 1.2);
        const g = ctx.createGain(); g.gain.setValueAtTime(0.7, time); g.gain.exponentialRampToValueAtTime(0.001, time + 1.6);
        o.connect(g); g.connect(this.bus.fx.input); o.start(time); o.stop(time + 1.7);
        this.noiseHit(time, 1.5, 'lowpass', 1200, 0.5, 0.35, this.bus.fx.input);
      }
    }
  }

  /* Gjør om arrangementet til en sortert hendelsesliste i steg. */
  function events(arr, opts) {
    const o = opts || {};
    const ev = [];
    for (const part of MM.arrange.PARTS) {
      for (const n of arr.parts[part] || []) ev.push({ part, t: n.t, d: n.d, n });
    }
    if (!o.noFx) for (const f of arr.fx || []) ev.push({ part: 'fx', t: f.t, d: f.d, fx: f });
    ev.sort((a, b) => a.t - b.t);
    return ev;
  }

  function swingOffset(e, style, stepSec) {
    const sw = (MM.arrange.STYLES[style] || {}).swing || 0;
    if (!sw || e.part !== 'drums') return 0;
    const p = e.n.p;
    if ((p === 42 || p === 70 || p === 46) && T.mod(e.t, 2) === 1) return sw * stepSec;
    return 0;
  }

  /* Render hele (eller deler av) arrangementet til en AudioBuffer. */
  async function renderOffline(arr, opts) {
    const o = opts || {};
    const sr = o.sampleRate || 44100;
    const stepSec = MM.arrange.secondsPerStep(arr.bpm);
    const from = o.fromStep || 0;
    const to = o.toStep || arr.totalBars * 16;
    const tail = 3;
    const length = Math.ceil(((to - from) * stepSec + tail) * sr);
    const OAC = globalThis.OfflineAudioContext || globalThis.webkitOfflineAudioContext;
    const ctx = new OAC(2, length, sr);
    const eng = new Engine(ctx, { instruments: o.instruments, samples: o.samples, bpm: arr.bpm, mute: o.mute, solo: o.solo });
    eng.automate(arr.automation, 0, from, stepSec);
    const evs = events(arr).filter((e) => e.t >= from && e.t < to);
    let idx = 0;
    const scheduleUntil = (limitSec) => {
      while (idx < evs.length) {
        const e = evs[idx];
        const time = (e.t - from) * stepSec;
        if (time >= limitSec) break;
        const dur = Math.min(e.d, to - e.t) * stepSec;
        if (e.fx) eng.fx(e.fx, time + swingOffset(e, arr.style, stepSec), dur);
        else eng.note(e.part, e.n, time + swingOffset(e, arr.style, stepSec), dur);
        idx++;
      }
    };
    // Planlegg i biter: noder som ennå ikke spiller koster regnetid i hvert lydvindu,
    // så alt på forhånd blir kvadratisk tregt for lange spor.
    const chunk = 2;
    const totalSec = length / sr;
    if (typeof ctx.suspend === 'function' && totalSec > chunk * 2) {
      scheduleUntil(chunk);
      for (let t = chunk; t < totalSec; t += chunk) {
        const at = Math.max(0, t - 0.25);
        ctx.suspend(at).then(() => { scheduleUntil(t + chunk); ctx.resume(); });
      }
    } else scheduleUntil(Infinity);
    if (o.onProgress && typeof ctx.suspend === 'function') {
      // fremdrift rapporteres via de samme suspensjonene
      const report = () => o.onProgress(Math.min(1, ctx.currentTime / totalSec));
      const timer = setInterval(report, 250);
      const r = await ctx.startRendering();
      clearInterval(timer);
      return r;
    }
    return ctx.startRendering();
  }

  MM.synth = { PRESETS, SAMPLE_SLOTS, Engine, events, swingOffset, renderOffline, mtof, filterFreq };
})(globalThis.MM = globalThis.MM || {});
