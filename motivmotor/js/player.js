/* Sanntidsavspilling med lookahead-planlegging. Brukes til hele sporet, utsnitt og forhåndslytting av alternativer. */
(function (MM) {
  'use strict';

  class Player {
    constructor() {
      this.ctx = null;
      this.engine = null;
      this.timer = null;
      this.raf = null;
      this.playing = false;
      this.session = 0;
    }

    async unlock() {
      if (!this.ctx) {
        const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
        this.ctx = new AC({ latencyHint: 'playback' });
      }
      // iPhone: spill som medieavspilling, så lyden ikke stoppes av lydløs-bryteren (Safari 17+)
      try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) { /* eldre Safari */ }
      if (this.ctx.state !== 'running') await this.ctx.resume();
      if (!this.unlocked) {
        const b = this.ctx.createBuffer(1, 1, 22050);
        const s = this.ctx.createBufferSource();
        s.buffer = b; s.connect(this.ctx.destination); s.start(0);
        this.unlocked = true;
      }
      return this.ctx;
    }

    /* opts: { instruments, samples, mute, solo, fromStep, toStep, loop, filters (statiske), onStep, onEnd } */
    async play(arr, opts) {
      this.stop();
      const o = opts || {};
      const ctx = await this.unlock();
      const session = ++this.session;
      const eng = new MM.synth.Engine(ctx, { instruments: o.instruments, samples: o.samples, bpm: arr.bpm, mute: o.mute, solo: o.solo });
      this.engine = eng;
      const stepSec = MM.arrange.secondsPerStep(arr.bpm);
      const from = o.fromStep || 0;
      const to = o.toStep || arr.totalBars * 16;
      const span = to - from;
      const all = MM.synth.events(arr, { noFx: !!o.loop });
      // noter som startet før startpunktet men fortsatt klinger (pad-akkorder) tas med fra startpunktet
      const evs = [];
      for (const e of all) {
        if (e.t >= to) break;
        if (e.t >= from) evs.push(e);
        else if (!e.fx && e.part !== 'drums' && e.t + e.d > from + 0.5) evs.push(Object.assign({}, e, { t: from, d: e.t + e.d - from }));
      }
      evs.sort((a, b) => a.t - b.t);
      const start = ctx.currentTime + 0.08;
      if (o.filters) eng.staticFilters(o.filters);
      else eng.automate(arr.automation, start, from, stepSec);
      let idx = 0, cycle = 0;
      this.playing = true;
      this.startTime = start; this.from = from; this.span = span; this.stepSec = stepSec; this.loop = !!o.loop;
      const end = start + span * stepSec;

      const tick = () => {
        if (session !== this.session) return;
        const horizon = ctx.currentTime + 0.25;
        for (let guard = 0; guard < 4000; guard++) {
          if (idx >= evs.length) {
            if (o.loop && evs.length) { idx = 0; cycle++; continue; }
            if (ctx.currentTime > end + 0.3) { this.stop(); if (o.onEnd) o.onEnd(); }
            return;
          }
          const e = evs[idx];
          const base = start + (cycle * span + e.t - from) * stepSec;
          if (base > horizon) return;
          const time = base + MM.synth.swingOffset(e, arr.style, stepSec);
          if (time >= ctx.currentTime - 0.01) {
            const dur = Math.min(e.d, to - e.t) * stepSec;
            if (e.fx) eng.fx(e.fx, time, dur); else eng.note(e.part, e.n, time, dur);
          }
          idx++;
        }
      };
      this.timer = setInterval(tick, 25);
      tick();
      const frame = () => {
        if (session !== this.session) return;
        if (o.onStep) o.onStep(this.position());
        this.raf = requestAnimationFrame(frame);
      };
      if (typeof requestAnimationFrame !== 'undefined') frame();
    }

    position() {
      if (!this.playing || !this.ctx) return null;
      let s = (this.ctx.currentTime - this.startTime) / this.stepSec;
      if (s < 0) s = 0;
      if (this.loop) s = s % this.span;
      return this.from + Math.min(s, this.span);
    }

    stop() {
      this.session++;
      if (this.timer) clearInterval(this.timer);
      if (this.raf && typeof cancelAnimationFrame !== 'undefined') cancelAnimationFrame(this.raf);
      this.timer = null; this.raf = null;
      if (this.engine) {
        const eng = this.engine;
        const t = this.ctx.currentTime;
        eng.out.gain.cancelScheduledValues(t);
        eng.out.gain.setValueAtTime(eng.out.gain.value, t);
        eng.out.gain.linearRampToValueAtTime(0, t + 0.06);
        setTimeout(() => { try { eng.out.disconnect(); } catch (e) { /* allerede frakoblet */ } }, 120);
      }
      this.engine = null;
      this.playing = false;
    }
  }

  MM.Player = Player;
})(globalThis.MM = globalThis.MM || {});
