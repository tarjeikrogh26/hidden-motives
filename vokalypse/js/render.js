/* Vokalypse – lydmotor: gjør en variasjon (liste med innslag) om til lyd med OfflineAudioContext.
   Samme plassering brukes til både TØRR og BEHANDLET versjon, så filene ligger sample-nøyaktig oppå hverandre.

   TØRR beholder: utsnitt, timing, tonehøyde, kor-lag, chops, stutter, reversering og pitch-dykk.
   TØRR fjerner:  filter, forvrengning, bitcrush, ringmod, kamfilter, gate, hvisk/robot, frysing,
                  revers-romklang, romklang og delay. */
(function (VK) {
  'use strict';

  const R = VK.Render = {};
  const SR = VK.SR;

  function driveCurve(amount) {
    const k = 1 + amount * 18;
    const n = 2048, c = new Float32Array(n);
    const norm = Math.tanh(k);
    for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = Math.tanh(k * x) / norm; }
    return c;
  }

  function rmsOf(data, s0, s1) {
    s0 = Math.max(0, s0 | 0); s1 = Math.min(data.length, s1 | 0);
    let e = 0, n = 0;
    for (let i = s0; i < s1; i += 2) { e += data[i] * data[i]; n++; }
    return n ? Math.sqrt(e / n) : 0;
  }

  // Lag (og mellomlagre) bearbeidede utsnitt som må regnes ut i JavaScript før avspilling
  async function prepare(hit, ev, clip, wet, t, cache, impulse) {
    const fx = ev.fx;
    const maxRate = Math.pow(2, Math.max(hit.semis, ev.dive ? ev.dive.to : hit.semis, 0) / 12) * 1.03;
    let srcSec = hit.srcSec && wet && fx.freeze ? hit.srcSec : hit.dur * maxRate + 0.02;
    srcSec = Math.min(srcSec, clip.analysis.duration - hit.offset);
    const freeze = wet && fx.freeze && !!hit.srcSec;
    const needJs = hit.reverse || freeze || (wet && (fx.whisper || fx.robot || fx.crush || fx.revSwell));
    if (!needJs) {
      return { buffer: clip.buffer, offset: hit.offset, srcSec: srcSec, rms: rmsOf(clip.mono, hit.offset * SR, (hit.offset + srcSec) * SR) };
    }
    const key = [clip.id, hit.offset.toFixed(4), srcSec.toFixed(4), hit.dur.toFixed(4), hit.reverse ? 1 : 0, wet ? JSON.stringify([fx.whisper, fx.robot, fx.crush, freeze, fx.revSwell, ev.id]) : 'dry'].join('|');
    if (cache.has(key)) return cache.get(key);
    let d = VK.DSP.slice(clip.mono, SR, hit.offset, srcSec);
    const rng = VK.makeRng(Math.floor(hit.offset * 1000) + 17);
    if (freeze) {
      const rate = Math.pow(2, hit.semis / 12);
      d = VK.DSP.granular(d, SR, hit.dur * rate + 0.05, rng, { grainSec: 0.09, jitterSec: 0.03, fromSec: 0, toSec: d.length / SR });
    }
    if (wet && fx.whisper) d = VK.DSP.whisperize(d, rng);
    if (wet && fx.robot) d = VK.DSP.robotize(d, SR, fx.robot.hz);
    if (wet && fx.crush) d = VK.DSP.bitcrush(d, fx.crush.hold, fx.crush.bits);
    VK.DSP.fade(d, 48, 240);
    let chans = [d];
    if (hit.reverse) {
      if (wet && fx.revSwell) {
        // klassisk revers-romklang: utsnitt + romklang, så snudd – romklangen suger inn mot ordet
        const tailSec = Math.min(2.5, t.beatSec * 4);
        const oc = new OfflineAudioContext(2, d.length + Math.floor(tailSec * SR), SR);
        const src = oc.createBufferSource();
        src.buffer = VK.DSP.makeBuffer([d]);
        const conv = oc.createConvolver();
        conv.normalize = true;
        conv.buffer = impulse;
        const wetG = oc.createGain(); wetG.gain.value = 0.9;
        const dryG = oc.createGain(); dryG.gain.value = 0.5;
        src.connect(conv).connect(wetG).connect(oc.destination);
        src.connect(dryG).connect(oc.destination);
        src.start(0);
        const rb = await oc.startRendering();
        chans = [VK.DSP.reverse(rb.getChannelData(0)), VK.DSP.reverse(rb.getChannelData(1))];
        VK.DSP.fade(chans[0], 2400, 96); VK.DSP.fade(chans[1], 2400, 96);
      } else {
        chans = [VK.DSP.reverse(d)];
      }
    }
    const res = { buffer: VK.DSP.makeBuffer(chans), offset: 0, srcSec: chans[0].length / SR, endAligned: hit.reverse, rms: rmsOf(d, 0, d.length) };
    cache.set(key, res);
    return res;
  }

  function hitTime(ev, hit, t, swing) {
    const s = ev.step + hit.step;
    const whole = Math.floor(s);
    return VK.stepTime(whole, t, swing) + (s - whole) * t.stepSec;
  }

  /* variation: {settings, events}
     clipsById: Map id -> clip
     opts: {wet: bool, fold: bool}
     Returnerer {channels:[L,R], length} med eksakt 16 takters lengde. */
  R.render = async function (variation, clipsById, opts) {
    const st = variation.settings;
    const t = VK.timing(st.bpm);
    const wet = !!opts.wet;
    const len = t.totalSamples;
    const tailSec = wet ? 6 : 2;
    const ctx = new OfflineAudioContext(2, len + Math.floor(tailSec * SR), SR);
    const rngC = VK.makeRng(variation.colorSeed + 99);
    const swing = st.swing || 0;

    const master = ctx.createGain();
    master.gain.value = 0.7;
    let reverbIn = null, delayIn = null, impulseBuf = null;
    const impulseChans = VK.DSP.impulse(SR, rngC.range(2.6, 4.8), { bright: rngC.range(0.35, 0.8), preDelay: rngC.range(0.01, 0.04) }, rngC);
    impulseBuf = VK.DSP.makeBuffer(impulseChans);

    if (wet) {
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -16; comp.ratio.value = 3; comp.knee.value = 8;
      comp.attack.value = 0.004; comp.release.value = 0.18;
      master.connect(comp).connect(ctx.destination);

      // romklang
      reverbIn = ctx.createGain();
      const conv = ctx.createConvolver();
      conv.normalize = true;
      conv.buffer = impulseBuf;
      const revHP = ctx.createBiquadFilter(); revHP.type = 'highpass'; revHP.frequency.value = 220;
      const revOut = ctx.createGain(); revOut.gain.value = 0.9;
      reverbIn.connect(revHP).connect(conv).connect(revOut).connect(master);

      // tempo-synket ping-pong-delay (punktert 1/8 eller 3/16 + 1/4)
      delayIn = ctx.createGain();
      const dl = ctx.createDelay(4), dr = ctx.createDelay(4);
      const dt = rngC.pick([0.75, 0.75, 0.5, 0.375]) * t.beatSec;
      dl.delayTime.value = dt; dr.delayTime.value = dt;
      const fb = ctx.createGain(); fb.gain.value = 0.42;
      const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 400;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 4200;
      const merger = ctx.createChannelMerger(2);
      const dOut = ctx.createGain(); dOut.gain.value = 0.8;
      delayIn.connect(hp).connect(lp).connect(dl);
      dl.connect(dr);
      dr.connect(fb).connect(dl);
      dl.connect(merger, 0, 0);
      dr.connect(merger, 0, 1);
      merger.connect(dOut).connect(master);
      const dToRev = ctx.createGain(); dToRev.gain.value = 0.25;
      dOut.connect(dToRev).connect(reverbIn);
    } else {
      master.connect(ctx.destination);
    }

    const cache = new Map();
    for (const ev of variation.events) {
      const clip = clipsById.get(ev.clipId);
      if (!clip) continue;
      const fx = ev.fx;
      const evStart = hitTime(ev, { step: 0 }, t, swing);
      const evEnd = evStart + ev.lenSteps * t.stepSec;

      // innslagets kjede
      const evIn = ctx.createGain();
      let node = evIn;
      if (wet) {
        if (fx.filter) {
          const f = ctx.createBiquadFilter();
          f.type = fx.filter.type; f.frequency.value = fx.filter.freq; f.Q.value = fx.filter.q;
          node.connect(f); node = f;
        }
        if (fx.comb) {
          const d = ctx.createDelay(0.05); d.delayTime.value = fx.comb.ms / 1000;
          const g = ctx.createGain(); g.gain.value = fx.comb.fb;
          const sum = ctx.createGain();
          node.connect(sum); node.connect(d); d.connect(g).connect(d); d.connect(sum);
          sum.gain.value = 0.6;
          node = sum;
        }
        if (fx.drive > 0) {
          const pre = ctx.createGain(); pre.gain.value = 1 + fx.drive * 2;
          const ws = ctx.createWaveShaper(); ws.curve = driveCurve(fx.drive); ws.oversample = '4x';
          const post = ctx.createGain(); post.gain.value = 0.4 / (1 + fx.drive * 2.2);
          node.connect(pre).connect(ws).connect(post); node = post;
        }
        if (fx.ring) {
          const ring = ctx.createGain(); ring.gain.value = 0;
          const osc = ctx.createOscillator(); osc.frequency.value = fx.ring.freq;
          osc.connect(ring.gain);
          osc.start(Math.max(0, evStart - 0.01)); osc.stop(evEnd + 2);
          const mixDry = ctx.createGain(); mixDry.gain.value = 1 - fx.ring.mix;
          const mixWet = ctx.createGain(); mixWet.gain.value = fx.ring.mix;
          const sum = ctx.createGain();
          node.connect(mixDry).connect(sum);
          node.connect(ring).connect(mixWet).connect(sum);
          node = sum;
        }
        if (fx.gate) {
          const g = ctx.createGain();
          g.gain.setValueAtTime(1, 0);
          const steps = Math.ceil(ev.lenSteps) + 1;
          for (let s = 0; s < steps; s++) {
            const on = fx.gate[s % fx.gate.length] === 'x';
            const tt = evStart + s * t.stepSec;
            g.gain.setTargetAtTime(on ? 1 : 0.04, tt, 0.004);
          }
          g.gain.setTargetAtTime(1, evEnd + 0.01, 0.01);
          node.connect(g); node = g;
        }
      }
      const evOut = ctx.createGain();
      evOut.gain.value = ev.gain;
      node.connect(evOut);
      evOut.connect(master);
      if (wet) {
        if (fx.reverb > 0) { const s = ctx.createGain(); s.gain.value = fx.reverb; evOut.connect(s).connect(reverbIn); }
        if (fx.delay > 0) { const s = ctx.createGain(); s.gain.value = fx.delay; evOut.connect(s).connect(delayIn); }
      }

      for (const hit of ev.hits) {
        const prep = await prepare(hit, ev, clip, wet, t, cache, impulseBuf);
        const when = hitTime(ev, hit, t, swing);
        for (const layer of ev.layers) {
          const semis = hit.semis + layer.semis;
          const rate = Math.pow(2, semis / 12) * Math.pow(2, (layer.detune || 0) / 1200);
          const src = ctx.createBufferSource();
          src.buffer = prep.buffer;
          src.playbackRate.value = rate;
          let start = when + (layer.delay || 0);
          let outDur = hit.dur;
          let offset = prep.offset;
          if (prep.endAligned) {
            // reversert lyd: skal slutte der innslaget slutter
            const total = prep.srcSec / rate;
            if (total > hit.dur) {
              offset = prep.srcSec - hit.dur * rate;
              if (wet && fx.revSwell) { start = Math.max(0, when + hit.dur - total); offset = 0; outDur = total; }
            } else {
              start = when + hit.dur - total;
              outDur = total;
            }
          }
          // tørr kor-versjon: spill bare selve utsnittet (den behandlede fryser og strekker det)
          if (!wet && fx.freeze && hit.srcSec) outDur = Math.min(outDur, hit.srcSec / rate);
          if (start < 0) { offset += -start * rate; outDur += start; start = 0; }
          if (outDur <= 0.002) continue;
          if (ev.dive) {
            src.playbackRate.setValueAtTime(rate, start);
            src.playbackRate.exponentialRampToValueAtTime(Math.pow(2, (ev.dive.to + layer.semis) / 12), start + outDur);
          }
          const env = ctx.createGain();
          // jevnt nivå mellom innslag: skaler hvert utsnitt mot et felles RMS-mål
          const level = prep.rms > 1e-5 ? VK.clamp(0.1 / prep.rms, 0.3, 6) : 1;
          const peak = hit.gain * layer.gain * level / Math.sqrt(ev.layers.length);
          let attack = Math.min(0.004, outDur / 4);
          if (prep.endAligned && wet && fx.revSwell) attack = 0.002;
          if (ev.type === 'choir') attack = Math.min(outDur * 0.3, 0.25);
          const release = ev.type === 'choir' ? Math.min(outDur * 0.35, 0.6) : Math.min(0.012, outDur / 3);
          env.gain.setValueAtTime(0, start);
          env.gain.linearRampToValueAtTime(peak, start + attack);
          env.gain.setValueAtTime(peak, Math.max(start + attack, start + outDur - release));
          env.gain.linearRampToValueAtTime(0, start + outDur);
          const pan = ctx.createStereoPanner();
          pan.pan.value = VK.clamp(ev.pan + layer.pan, -1, 1);
          src.connect(env).connect(pan).connect(evIn);
          const srcDur = Math.max(0.001, Math.min(prep.buffer.duration - offset, outDur * rate * (ev.dive ? 2 : 1.01)));
          src.start(start, Math.max(0, offset), srcDur);
          src.stop(start + outDur + 0.01);
        }
      }
    }

    const rendered = await ctx.startRendering();
    let chans = [rendered.getChannelData(0), rendered.getChannelData(1)];
    const bad = VK.DSP.sanitize(chans);
    if (bad) console.warn('Vokalypse: ' + bad + ' ugyldige sampler erstattet med 0');
    chans = VK.DSP.foldTail(chans, len, opts.fold !== false);
    const g = opts.normalize === false ? 1 : VK.DSP.normalizePeak(chans, VK.dbToGain(-1));
    VK.DSP.softLimit(chans, VK.dbToGain(-0.3));
    return { channels: chans, length: len, silent: g === 0 };
  };

  // Referansetromme for avspilling (eksporteres ikke): kick på 1-2-3-4, åpen hihat på offbeat
  R.renderGuide = async function (bpm) {
    const t = VK.timing(bpm);
    const ctx = new OfflineAudioContext(2, t.totalSamples, SR);
    const noise = VK.DSP.makeBuffer([(function () {
      const r = VK.makeRng(7), d = new Float32Array(SR >> 2);
      for (let i = 0; i < d.length; i++) d[i] = r.next() * 2 - 1;
      return d;
    })()]);
    const out = ctx.createGain(); out.gain.value = 0.5; out.connect(ctx.destination);
    for (let b = 0; b < VK.BARS * 4; b++) {
      const tt = b * t.beatSec;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.setValueAtTime(140, tt);
      o.frequency.exponentialRampToValueAtTime(44, tt + 0.12);
      g.gain.setValueAtTime(1, tt);
      g.gain.exponentialRampToValueAtTime(0.001, tt + 0.32);
      o.connect(g).connect(out);
      o.start(tt); o.stop(tt + 0.34);
      const h = ctx.createBufferSource(); h.buffer = noise;
      const hf = ctx.createBiquadFilter(); hf.type = 'highpass'; hf.frequency.value = 7000;
      const hg = ctx.createGain();
      const ht = tt + t.beatSec / 2;
      hg.gain.setValueAtTime(0.25, ht);
      hg.gain.exponentialRampToValueAtTime(0.001, ht + 0.09);
      h.connect(hf).connect(hg).connect(out);
      h.start(ht); h.stop(ht + 0.1);
    }
    return ctx.startRendering();
  };
})(window.VK = window.VK || {});
