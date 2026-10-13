/* Vokalypse – lokal signalbehandling i ren JavaScript.
   Alt her kjører i nettleseren uten nett og uten abonnement. */
(function (VK) {
  'use strict';

  const DSP = VK.DSP = {};

  DSP.monoMix = function (buf) {
    const n = buf.length, ch = buf.numberOfChannels;
    const out = new Float32Array(n);
    for (let c = 0; c < ch; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < n; i++) out[i] += d[i];
    }
    if (ch > 1) for (let i = 0; i < n; i++) out[i] /= ch;
    return out;
  };

  DSP.makeBuffer = function (channels, sr) {
    const len = channels[0].length;
    const b = new AudioBuffer({ length: Math.max(1, len), numberOfChannels: channels.length, sampleRate: sr || VK.SR });
    for (let c = 0; c < channels.length; c++) {
      if (b.copyToChannel) b.copyToChannel(channels[c], c);
      else b.getChannelData(c).set(channels[c]);
    }
    return b;
  };

  DSP.slice = function (data, sr, startSec, durSec) {
    const s = Math.max(0, Math.floor(startSec * sr));
    const e = Math.min(data.length, s + Math.max(1, Math.floor(durSec * sr)));
    return data.slice(s, e);
  };

  DSP.reverse = function (data) {
    const out = new Float32Array(data.length);
    for (let i = 0, n = data.length; i < n; i++) out[i] = data[n - 1 - i];
    return out;
  };

  DSP.fade = function (data, inSamples, outSamples) {
    const n = data.length;
    const fi = Math.min(inSamples | 0, n >> 1), fo = Math.min(outSamples | 0, n >> 1);
    for (let i = 0; i < fi; i++) data[i] *= i / fi;
    for (let i = 0; i < fo; i++) data[n - 1 - i] *= i / fo;
    return data;
  };

  DSP.peak = function (data) {
    let p = 0;
    for (let i = 0; i < data.length; i++) { const a = Math.abs(data[i]); if (a > p) p = a; }
    return p;
  };

  DSP.normalizePeak = function (channels, target) {
    let p = 0;
    for (const c of channels) p = Math.max(p, DSP.peak(c));
    if (p < 1e-9) return 0;
    const g = target / p;
    for (const c of channels) for (let i = 0; i < c.length; i++) c[i] *= g;
    return g;
  };

  // ---------- FFT (radix-2, in-place) ----------
  DSP.fft = function (re, im, inverse) {
    const n = re.length;
    for (let i = 1, j = 0; i < n; i++) {
      let bit = n >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i < j) {
        let t = re[i]; re[i] = re[j]; re[j] = t;
        t = im[i]; im[i] = im[j]; im[j] = t;
      }
    }
    for (let len = 2; len <= n; len <<= 1) {
      const ang = (2 * Math.PI / len) * (inverse ? 1 : -1);
      const wr = Math.cos(ang), wi = Math.sin(ang);
      for (let i = 0; i < n; i += len) {
        let cr = 1, ci = 0;
        const half = len >> 1;
        for (let k = 0; k < half; k++) {
          const a = i + k, b = a + half;
          const xr = re[b] * cr - im[b] * ci;
          const xi = re[b] * ci + im[b] * cr;
          re[b] = re[a] - xr; im[b] = im[a] - xi;
          re[a] += xr; im[a] += xi;
          const ncr = cr * wr - ci * wi;
          ci = cr * wi + ci * wr; cr = ncr;
        }
      }
    }
    if (inverse) for (let i = 0; i < n; i++) { re[i] /= n; im[i] /= n; }
  };

  function hann(n) {
    const w = new Float32Array(n);
    for (let i = 0; i < n; i++) w[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / n);
    return w;
  }

  // Generell STFT-ombygger: modify(re, im) endrer spekteret per ramme.
  // anaHop = steg i inngangen, synHop = steg i utgangen.
  function stftResynth(data, size, positions, modify) {
    const w = hann(size);
    const outLen = data.length;
    const out = new Float32Array(outLen + size);
    const norm = new Float32Array(outLen + size);
    const re = new Float32Array(size), im = new Float32Array(size);
    for (const p of positions) {
      const inStart = p.inPos - (size >> 1);
      for (let i = 0; i < size; i++) {
        const idx = inStart + i;
        re[i] = (idx >= 0 && idx < data.length) ? data[idx] * w[i] : 0;
        im[i] = 0;
      }
      DSP.fft(re, im, false);
      modify(re, im, p);
      DSP.fft(re, im, true);
      const outStart = p.outPos - (size >> 1);
      for (let i = 0; i < size; i++) {
        const o = outStart + i;
        if (o < 0 || o >= out.length) continue;
        out[o] += re[i] * w[i];
        norm[o] += w[i] * w[i];
      }
    }
    const res = new Float32Array(outLen);
    for (let i = 0; i < outLen; i++) res[i] = norm[i] > 0.1 ? out[i] / norm[i] : out[i] / 0.1;
    return res;
  }

  // Hvisking: beholder spektral form, men gir hver frekvens tilfeldig fase.
  // Resultatet er stemmeløst – tonehøyden forsvinner, ordene/formantene blir igjen.
  DSP.whisperize = function (data, rng, size) {
    size = size || 1024;
    const hop = size >> 2;
    const positions = [];
    for (let p = 0; p < data.length + hop; p += hop) positions.push({ inPos: p, outPos: p });
    return stftResynth(data, size, positions, function (re, im) {
      const n = re.length;
      for (let k = 1; k < n / 2; k++) {
        const mag = Math.hypot(re[k], im[k]);
        const ph = rng.next() * 2 * Math.PI;
        re[k] = mag * Math.cos(ph); im[k] = mag * Math.sin(ph);
        re[n - k] = re[k]; im[n - k] = -im[k];
      }
      re[0] = Math.abs(re[0]); im[0] = 0;
    });
  };

  // Robot: null fase og fast rammeavstand gir en summende stemme låst til én tonehøyde.
  DSP.robotize = function (data, sr, f0) {
    const size = 1024;
    const hop = Math.max(32, Math.round(sr / f0));
    const positions = [];
    for (let p = 0; p < data.length + hop; p += hop) positions.push({ inPos: p, outPos: p });
    const res = stftResynth(data, size, positions, function (re, im) {
      const n = re.length;
      for (let k = 0; k < n; k++) {
        const mag = Math.hypot(re[k], im[k]);
        // null fase, men sentrer pulsen i rammen (faktor (-1)^k)
        re[k] = (k & 1) ? -mag : mag; im[k] = 0;
      }
    });
    return res;
  };

  // Bitcrush: sample-and-hold (lavere samplerate) + grovere bitdybde
  DSP.bitcrush = function (data, hold, bits) {
    const out = new Float32Array(data.length);
    const q = Math.pow(2, bits - 1);
    let v = 0;
    for (let i = 0; i < data.length; i++) {
      if (i % hold === 0) v = Math.round(data[i] * q) / q;
      out[i] = v;
    }
    return out;
  };

  // Granulær frysing/strekking: små korn fra et område spres utover en ny lengde.
  DSP.granular = function (data, sr, outSec, rng, opts) {
    opts = opts || {};
    let grain = Math.max(64, Math.floor((opts.grainSec || 0.07) * sr));
    if (data.length < grain * 2) grain = Math.max(32, Math.floor(data.length / 2));
    if (data.length < 64) return new Float32Array(Math.floor(outSec * sr));
    const hop = Math.max(16, grain >> 2);
    const outLen = Math.floor(outSec * sr);
    const from = Math.floor((opts.fromSec || 0) * sr);
    const to = Math.min(data.length - grain, Math.floor((opts.toSec != null ? opts.toSec : data.length / sr) * sr));
    const jitter = Math.floor((opts.jitterSec || 0.02) * sr);
    const out = new Float32Array(outLen + grain);
    const norm = new Float32Array(outLen + grain);
    const w = hann(grain);
    for (let o = 0; o < outLen; o += hop) {
      const frac = o / Math.max(1, outLen);
      let src = Math.floor(from + (Math.max(from, to) - from) * frac) + Math.floor((rng.next() * 2 - 1) * jitter);
      src = Math.max(0, Math.min(data.length - grain, src));
      for (let i = 0; i < grain; i++) {
        out[o + i] += (data[src + i] || 0) * w[i];
        norm[o + i] += w[i];
      }
    }
    const res = new Float32Array(outLen);
    for (let i = 0; i < outLen; i++) res[i] = norm[i] > 0.05 ? out[i] / norm[i] : 0;
    return res;
  };

  // ---------- Tonehøydeanalyse (YIN) ----------
  DSP.yinFrame = function (data, sr, start, W, fmin, fmax) {
    const maxTau = Math.min(Math.floor(sr / fmin), W - 1);
    const minTau = Math.max(2, Math.floor(sr / fmax));
    const d = new Float32Array(maxTau + 1);
    for (let tau = 1; tau <= maxTau; tau++) {
      let s = 0;
      for (let i = 0; i < W; i++) {
        const a = data[start + i] - data[start + i + tau];
        s += a * a;
      }
      d[tau] = s;
    }
    let run = 0;
    const cm = new Float32Array(maxTau + 1);
    cm[0] = 1;
    for (let tau = 1; tau <= maxTau; tau++) {
      run += d[tau];
      cm[tau] = run > 0 ? d[tau] * tau / run : 1;
    }
    let best = -1;
    for (let tau = minTau; tau <= maxTau; tau++) {
      if (cm[tau] < 0.15) {
        while (tau + 1 <= maxTau && cm[tau + 1] < cm[tau]) tau++;
        best = tau; break;
      }
    }
    if (best < 0) {
      let mv = Infinity;
      for (let tau = minTau; tau <= maxTau; tau++) if (cm[tau] < mv) { mv = cm[tau]; best = tau; }
      if (mv > 0.35) return { f0: 0, conf: 0 };
    }
    let t = best;
    if (best > 1 && best < maxTau) {
      const a = cm[best - 1], b = cm[best], c = cm[best + 1];
      const den = a - 2 * b + c;
      if (Math.abs(den) > 1e-12) t = best + 0.5 * (a - c) / den;
    }
    return { f0: sr / t, conf: 1 - cm[best] };
  };

  // Median-tonehøyde over et område. Returnerer f0=0 hvis området er stemmeløst.
  DSP.detectPitch = function (data, sr, startSec, durSec) {
    const fmin = 70, fmax = 1000;
    const W = 1536;
    const maxTau = Math.floor(sr / fmin);
    const s0 = Math.max(0, Math.floor(startSec * sr));
    const s1 = Math.min(data.length - W - maxTau - 1, Math.floor((startSec + durSec) * sr) - W);
    if (s1 <= s0) return { f0: 0, conf: 0 };
    const frames = Math.min(10, Math.max(1, Math.floor((s1 - s0) / 1024)));
    const vals = [];
    let rmsMax = 0;
    const rmsList = [];
    for (let f = 0; f < frames; f++) {
      const st = Math.floor(s0 + (s1 - s0) * (frames === 1 ? 0 : f / (frames - 1)));
      let e = 0;
      for (let i = 0; i < W; i++) e += data[st + i] * data[st + i];
      const rms = Math.sqrt(e / W);
      rmsList.push([st, rms]);
      if (rms > rmsMax) rmsMax = rms;
    }
    for (const [st, rms] of rmsList) {
      if (rms < rmsMax * 0.25 || rms < 1e-4) continue;
      const r = DSP.yinFrame(data, sr, st, W, fmin, fmax);
      if (r.f0 > 0 && r.conf > 0.75) vals.push(r.f0);
    }
    if (vals.length < Math.max(1, Math.floor(rmsList.length * 0.3))) return { f0: 0, conf: 0 };
    vals.sort((a, b) => a - b);
    return { f0: vals[vals.length >> 1], conf: vals.length / rmsList.length };
  };

  // ---------- Klippanalyse: hvor er det lyd, og hvor starter lydene? ----------
  DSP.analyze = function (data, sr) {
    const hop = Math.floor(sr / 100); // 10 ms
    const nF = Math.max(1, Math.floor(data.length / hop));
    const env = new Float32Array(nF);
    const zcr = new Float32Array(nF);
    let maxE = 0;
    for (let f = 0; f < nF; f++) {
      let e = 0, z = 0;
      const s = f * hop;
      for (let i = 0; i < hop; i++) {
        const v = data[s + i] || 0;
        e += v * v;
        if (i > 0 && ((v >= 0) !== ((data[s + i - 1] || 0) >= 0))) z++;
      }
      env[f] = Math.sqrt(e / hop);
      zcr[f] = z / hop;
      if (env[f] > maxE) maxE = env[f];
    }
    const thr = maxE * VK.dbToGain(-32);
    const regions = [];
    let inR = false, rs = 0, gap = 0;
    for (let f = 0; f < nF; f++) {
      const on = env[f] > thr;
      if (on) {
        if (!inR) { inR = true; rs = f; }
        gap = 0;
      } else if (inR) {
        gap++;
        if (gap > 6) { regions.push([rs, f - gap + 1]); inR = false; gap = 0; }
      }
    }
    if (inR) regions.push([rs, nF]);
    const segs = regions
      .filter((r) => r[1] - r[0] >= 5)
      .map((r) => {
        let zsum = 0;
        for (let f = r[0]; f < r[1]; f++) zsum += zcr[f];
        return { start: r[0] * hop / sr, end: r[1] * hop / sr, noisy: zsum / (r[1] - r[0]) > 0.18 };
      });
    const onsets = [];
    for (let f = 3; f < nF; f++) {
      const prev = (env[f - 1] + env[f - 2] + env[f - 3]) / 3;
      if (env[f] > thr * 1.5 && env[f] > prev * 2 && (!onsets.length || f * hop / sr - onsets[onsets.length - 1] > 0.06)) {
        onsets.push(Math.max(0, (f - 1) * hop / sr));
      }
    }
    for (const s of segs) if (!onsets.some((o) => Math.abs(o - s.start) < 0.03)) onsets.push(s.start);
    onsets.sort((a, b) => a - b);
    return { peak: DSP.peak(data), env: env, hop: hop, segments: segs, onsets: onsets, duration: data.length / sr };
  };

  // ---------- Romklang: generert impulsrespons ----------
  DSP.impulse = function (sr, seconds, opts, rng) {
    opts = opts || {};
    const len = Math.floor(seconds * sr);
    const pre = Math.floor((opts.preDelay || 0.01) * sr);
    const chans = [new Float32Array(len), new Float32Array(len)];
    const bright0 = opts.bright != null ? opts.bright : 0.6;
    for (let c = 0; c < 2; c++) {
      const d = chans[c];
      let lp = 0;
      for (let i = pre; i < len; i++) {
        const t = (i - pre) / sr;
        const env = Math.pow(1 - (i - pre) / (len - pre), opts.shape || 2.2) * Math.exp(-t * (opts.damp || 1.5));
        // lysere i starten, mørkere i halen
        const a = 0.05 + bright0 * 0.9 * Math.exp(-t * (opts.darken || 2));
        lp += a * ((rng.next() * 2 - 1) - lp);
        d[i] = lp * env;
      }
      // noen tidlige refleksjoner
      for (let k = 0; k < 8; k++) {
        const idx = pre + Math.floor(rng.next() * 0.06 * sr);
        if (idx < len) d[idx] += (rng.next() * 2 - 1) * 0.5;
      }
    }
    DSP.normalizePeak(chans, 0.5);
    return chans;
  };

  // Vern: erstatt eventuelle NaN/uendelige verdier med 0 (skal ikke skje, men må aldri ødelegge en fil)
  DSP.sanitize = function (chans) {
    let bad = 0;
    for (const d of chans) for (let i = 0; i < d.length; i++) if (!isFinite(d[i])) { d[i] = 0; bad++; }
    return bad;
  };

  // Brett halen etter 16 takter inn i starten -> sømløs loop
  DSP.foldTail = function (chans, len, fold) {
    return chans.map(function (d) {
      const out = d.slice(0, len);
      if (fold) {
        for (let i = len; i < d.length; i++) out[(i - len) % len] += d[i];
      } else {
        const f = Math.min(len >> 2, Math.floor(0.005 * VK.SR));
        for (let i = 0; i < f; i++) out[len - 1 - i] *= i / f;
      }
      return out;
    });
  };

  // Myk metning som siste vern mot klipping
  DSP.softLimit = function (chans, ceiling) {
    for (const d of chans) {
      for (let i = 0; i < d.length; i++) {
        const x = d[i];
        const ax = Math.abs(x);
        if (ax > ceiling * 0.8) {
          const over = (ax - ceiling * 0.8) / (ceiling * 0.2);
          d[i] = Math.sign(x) * (ceiling * 0.8 + ceiling * 0.2 * Math.tanh(over));
        }
      }
    }
  };
})(window.VK = window.VK || {});
