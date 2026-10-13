/* Frøstyrt tilfeldighet. Samme frø gir samme resultat, så en god versjon kan gjenskapes nøyaktig.
   Reglene i motoren rangerer alternativene; frøet velger bare mellom de beste. */
(function (MM) {
  'use strict';

  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function mulberry32(a) {
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function make(seed, salt) {
    const base = (seed >>> 0) ^ (salt ? hash(String(salt)) : 0);
    const next = mulberry32(base);
    const r = {
      next,
      int(lo, hi) { return lo + Math.floor(next() * (hi - lo + 1)); },
      chance(p) { return next() < p; },
      pick(arr) { return arr[Math.floor(next() * arr.length)]; },
      weighted(items, weights) {
        const tot = weights.reduce((s, w) => s + Math.max(0, w), 0);
        if (tot <= 0) return items[0];
        let x = next() * tot;
        for (let i = 0; i < items.length; i++) {
          x -= Math.max(0, weights[i]);
          if (x <= 0) return items[i];
        }
        return items[items.length - 1];
      },
      /* Velg blant kandidater med poeng. Lav temperatur = nesten alltid den beste. */
      softmax(items, scoreOf, temp) {
        if (!items.length) return undefined;
        const t = Math.max(0.01, temp);
        const scores = items.map(scoreOf);
        const max = Math.max.apply(null, scores);
        return r.weighted(items, scores.map((s) => Math.exp((s - max) / t)));
      },
      jitter(amount) { return (next() - 0.5) * 2 * amount; },
      child(salt2) { return make(Math.floor(next() * 4294967296), salt2); },
    };
    return r;
  }

  function newSeed() {
    if (globalThis.crypto && globalThis.crypto.getRandomValues) {
      return globalThis.crypto.getRandomValues(new Uint32Array(1))[0];
    }
    return Math.floor(Math.random() * 4294967296);
  }

  function seedCode(seed) { return (seed >>> 0).toString(36).toUpperCase().padStart(7, '0'); }
  function parseSeedCode(code) {
    const n = parseInt(String(code).trim().toLowerCase(), 36);
    return Number.isFinite(n) ? n >>> 0 : null;
  }

  function derive(seed, salt) { return ((seed >>> 0) ^ hash(String(salt))) >>> 0; }

  MM.rng = { make, newSeed, seedCode, parseSeedCode, derive, hash };
})(globalThis.MM = globalThis.MM || {});
