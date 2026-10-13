/* TRE SPOR – innebygd trommesett (syntetisert til ekte samples ved oppstart) og klangrom.
   Hver lyd er et vanlig lydbuffer og kan byttes ut med egne samples. */
(function (root) {
  'use strict';
  var TS = root.TS;
  var K = TS.kit = {};

  /* liten deterministisk støykilde, så settet låter likt hver gang */
  function noise(seed) {
    var s = seed >>> 0 || 1;
    return function () { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) / 4294967296) * 2 - 1; };
  }
  /* enkel biquad (RBJ) for å forme samplene */
  function biquad(type, f, q, sr) {
    var w = 2 * Math.PI * f / sr, c = Math.cos(w), al = Math.sin(w) / (2 * q), b0, b1, b2, a0, a1, a2;
    if (type === 'hp') { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = b0; }
    else if (type === 'bp') { b0 = al; b1 = 0; b2 = -al; }
    else { b0 = (1 - c) / 2; b1 = 1 - c; b2 = b0; }
    a0 = 1 + al; a1 = -2 * c; a2 = 1 - al;
    b0 /= a0; b1 /= a0; b2 /= a0; a1 /= a0; a2 /= a0;
    var x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    return function (x) { var y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2; x2 = x1; x1 = x; y2 = y1; y1 = y; return y; };
  }
  function normalize(d, peak) {
    var m = 0; for (var i = 0; i < d.length; i++) m = Math.max(m, Math.abs(d[i]));
    if (m > 0) for (var j = 0; j < d.length; j++) d[j] *= peak / m;
    return d;
  }

  var GEN = {
    kick: function (sr) {
      var len = Math.floor(sr * 0.55), d = new Float32Array(len), ph = 0, rnd = noise(7);
      for (var i = 0; i < len; i++) {
        var t = i / sr, f = 46 + 120 * Math.exp(-t * 32) + 30 * Math.exp(-t * 300);
        ph += 2 * Math.PI * f / sr;
        var body = Math.sin(ph) * Math.exp(-t * 7.5);
        var click = rnd() * Math.exp(-t * 900) * 0.4;
        d[i] = Math.tanh((body + click) * 1.6);
      }
      return normalize(d, 0.95);
    },
    clap: function (sr) {
      var len = Math.floor(sr * 0.4), d = new Float32Array(len), rnd = noise(11), bp = biquad('bp', 1150, 1.1, sr), hp = biquad('hp', 600, 0.7, sr);
      for (var i = 0; i < len; i++) {
        var t = i / sr, e = 0;
        [0, 0.011, 0.022].forEach(function (o) { if (t >= o) e = Math.max(e, Math.exp(-(t - o) * 180)); });
        if (t >= 0.031) e = Math.max(e, 0.75 * Math.exp(-(t - 0.031) * 13));
        d[i] = hp(bp(rnd())) * e;
      }
      return normalize(d, 0.9);
    },
    hat: function (sr) {
      var len = Math.floor(sr * 0.09), d = new Float32Array(len), hp = biquad('hp', 7500, 0.8, sr), ph = [0, 0, 0, 0, 0, 0];
      var fr = [205.3, 304.4, 369.6, 522.7, 540, 800].map(function (f) { return f * 1.7; }), rnd = noise(3);
      for (var i = 0; i < len; i++) {
        var t = i / sr, m = 0;
        for (var k = 0; k < 6; k++) { ph[k] += fr[k] / sr; m += (ph[k] % 1 < 0.5 ? 1 : -1); }
        d[i] = hp(m / 6 * 0.6 + rnd() * 0.5) * Math.exp(-t * 55);
      }
      return normalize(d, 0.85);
    },
    open: function (sr) {
      var len = Math.floor(sr * 0.55), d = new Float32Array(len), hp = biquad('hp', 6800, 0.7, sr), ph = [0, 0, 0, 0, 0, 0];
      var fr = [205.3, 304.4, 369.6, 522.7, 540, 800].map(function (f) { return f * 1.7; }), rnd = noise(5);
      for (var i = 0; i < len; i++) {
        var t = i / sr, m = 0;
        for (var k = 0; k < 6; k++) { ph[k] += fr[k] / sr; m += (ph[k] % 1 < 0.5 ? 1 : -1); }
        d[i] = hp(m / 6 * 0.6 + rnd() * 0.5) * Math.exp(-t * 7) * Math.min(1, t * 400);
      }
      return normalize(d, 0.8);
    },
    perc: function (sr) {
      var len = Math.floor(sr * 0.22), d = new Float32Array(len), p1 = 0, p2 = 0, bp = biquad('bp', 1700, 4, sr), rnd = noise(13);
      for (var i = 0; i < len; i++) {
        var t = i / sr;
        p1 += 2 * Math.PI * 820 / sr; p2 += 2 * Math.PI * 1240 / sr;
        d[i] = (Math.sin(p1) * 0.6 + Math.sin(p2) * 0.35) * Math.exp(-t * 26) + bp(rnd()) * Math.exp(-t * 90) * 0.6;
      }
      return normalize(d, 0.85);
    }
  };

  /* Lager AudioBuffer-ene. ctxLike trenger bare createBuffer. */
  K.build = function (ctxLike, sr) {
    var out = {};
    Object.keys(GEN).forEach(function (id) {
      var data = GEN[id](sr);
      var b = ctxLike.createBuffer(1, data.length, sr);
      b.getChannelData(0).set(data);
      out[id] = b;
    });
    return out;
  };
  K.raw = GEN;

  /* Klangrom: stereo støyhale med mørkere slutt */
  K.impulse = function (ctx, seconds) {
    var sr = ctx.sampleRate, len = Math.floor(sr * seconds), b = ctx.createBuffer(2, len, sr);
    for (var ch = 0; ch < 2; ch++) {
      var d = b.getChannelData(ch), rnd = noise(101 + ch), lp = 0;
      for (var i = 0; i < len; i++) {
        var t = i / sr, a = 0.2 + 0.72 * (t / seconds);      // filteret lukker seg utover i halen
        lp = lp + (1 - a) * (rnd() - lp);
        var pre = t < 0.012 ? 0 : 1;
        d[i] = lp * Math.exp(-t * 3.2) * pre * 2.5;
      }
    }
    return b;
  };
})(typeof window !== 'undefined' ? window : globalThis);
