/* TRE SPOR – filer: WAV, MIDI, ZIP, prosjektfil, base64 og lagring av samples (IndexedDB). */
(function (root) {
  'use strict';
  var TS = root.TS;
  var F = TS.files = {};

  /* ---------- WAV (24-bit PCM) ---------- */
  F.wav = function (channels, sampleRate) {
    var nch = channels.length, len = channels[0].length, bps = 3;
    var dataLen = len * nch * bps, buf = new ArrayBuffer(44 + dataLen), v = new DataView(buf);
    function str(o, s) { for (var i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); }
    str(0, 'RIFF'); v.setUint32(4, 36 + dataLen, true); str(8, 'WAVE');
    str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, nch, true);
    v.setUint32(24, sampleRate, true); v.setUint32(28, sampleRate * nch * bps, true);
    v.setUint16(32, nch * bps, true); v.setUint16(34, 24, true);
    str(36, 'data'); v.setUint32(40, dataLen, true);
    var o = 44, u8 = new Uint8Array(buf);
    for (var i = 0; i < len; i++) {
      for (var c = 0; c < nch; c++) {
        var s = channels[c][i]; s = s > 1 ? 1 : s < -1 ? -1 : s;
        var x = Math.round(s * 8388607); if (x < 0) x += 16777216;
        u8[o] = x & 255; u8[o + 1] = (x >> 8) & 255; u8[o + 2] = (x >> 16) & 255; o += 3;
      }
    }
    return u8;
  };

  /* ---------- MIDI (type 1, 96 ppq, én sekstendedel = 24 ticks) ---------- */
  F.midi = function (notes, tempos, startStep, name) {
    var PPQ = 96, STEP = 24;
    function vlq(n) { var b = [n & 127]; n >>= 7; while (n > 0) { b.unshift((n & 127) | 128); n >>= 7; } return b; }
    function text(type, s) { var bytes = []; for (var i = 0; i < s.length; i++) bytes.push(s.charCodeAt(i) & 127); return [0xff, type].concat(vlq(bytes.length), bytes); }
    function chunk(events) {
      events.sort(function (a, b) { return a.t - b.t || a.o - b.o; });
      var out = [], last = 0;
      events.forEach(function (e) { out = out.concat(vlq(e.t - last), e.d); last = e.t; });
      out = out.concat([0, 0xff, 0x2f, 0]);
      return [0x4d, 0x54, 0x72, 0x6b, (out.length >>> 24) & 255, (out.length >>> 16) & 255, (out.length >>> 8) & 255, out.length & 255].concat(out);
    }
    var tracks = [];
    var tev = [{ t: 0, o: 0, d: text(3, name || 'TRE SPOR') }, { t: 0, o: 0, d: [0xff, 0x58, 4, 4, 2, 24, 8] }];
    (tempos.length ? tempos : [{ n: startStep, bpm: 120 }]).forEach(function (tp) {
      var us = Math.round(60000000 / tp.bpm);
      tev.push({ t: Math.max(0, (tp.n - startStep) * STEP), o: 1, d: [0xff, 0x51, 3, (us >> 16) & 255, (us >> 8) & 255, us & 255] });
    });
    tracks.push(chunk(tev));
    [['drums', 9, 'Trommer', -1], ['bass', 0, 'Bass', 38], ['synth', 1, 'Synth', 81]].forEach(function (def) {
      var ch = def[1], ev = [{ t: 0, o: 0, d: text(3, def[2]) }];
      if (def[3] >= 0) ev.push({ t: 0, o: 0, d: [0xc0 | ch, def[3]] });
      notes.forEach(function (nt) {
        if (nt.tr !== def[0]) return;
        var on = Math.max(0, Math.round((nt.n - startStep + nt.sw) * STEP));
        var off = on + Math.max(1, Math.round(nt.len * STEP));
        var vel = TS.clamp(Math.round(nt.vel * 112), 1, 127), key = TS.clamp(nt.midi, 0, 127);
        ev.push({ t: on, o: 2, d: [0x90 | ch, key, vel] });
        ev.push({ t: off, o: 1, d: [0x80 | ch, key, 0] });
      });
      tracks.push(chunk(ev));
    });
    var head = [0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 1, 0, tracks.length, (PPQ >> 8) & 255, PPQ & 255];
    var all = head; tracks.forEach(function (t) { all = all.concat(t); });
    return new Uint8Array(all);
  };

  /* ---------- ZIP (uten komprimering) ---------- */
  var CRC = null;
  function crc32(u8) {
    if (!CRC) { CRC = new Uint32Array(256); for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; CRC[n] = c >>> 0; } }
    var crc = 0xffffffff; for (var i = 0; i < u8.length; i++) crc = CRC[(crc ^ u8[i]) & 255] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  }
  F.zip = function (files) {
    var parts = [], central = [], offset = 0;
    function le(n, b) { var a = []; for (var i = 0; i < b; i++) a.push((n >>> (8 * i)) & 255); return a; }
    files.forEach(function (f) {
      var name = new TextEncoder().encode(f.name), data = f.data, crc = crc32(data);
      var local = [].concat(le(0x04034b50, 4), le(20, 2), le(0x0800, 2), le(0, 2), le(0, 2), le(0x21, 2), le(crc, 4), le(data.length, 4), le(data.length, 4), le(name.length, 2), le(0, 2));
      parts.push(new Uint8Array(local), name, data);
      central.push(new Uint8Array([].concat(le(0x02014b50, 4), le(20, 2), le(20, 2), le(0x0800, 2), le(0, 2), le(0, 2), le(0x21, 2), le(crc, 4), le(data.length, 4), le(data.length, 4), le(name.length, 2), le(0, 2), le(0, 2), le(0, 2), le(0, 2), le(0, 4), le(offset, 4))), name);
      offset += local.length + name.length + data.length;
    });
    var cenLen = central.reduce(function (a, p) { return a + p.length; }, 0);
    var end = new Uint8Array([].concat(le(0x06054b50, 4), le(0, 2), le(0, 2), le(files.length, 2), le(files.length, 2), le(cenLen, 4), le(offset, 4), le(0, 2)));
    var total = parts.concat(central, [end]), size = total.reduce(function (a, p) { return a + p.length; }, 0);
    var out = new Uint8Array(size), o = 0;
    total.forEach(function (p) { out.set(p, o); o += p.length; });
    return out;
  };

  /* ---------- base64 ---------- */
  F.toBase64 = function (ab) {
    var u8 = new Uint8Array(ab), s = '', CH = 0x8000;
    for (var i = 0; i < u8.length; i += CH) s += String.fromCharCode.apply(null, u8.subarray(i, i + CH));
    return (typeof btoa !== 'undefined' ? btoa(s) : Buffer.from(s, 'binary').toString('base64'));
  };
  F.fromBase64 = function (b64) {
    var s = typeof atob !== 'undefined' ? atob(b64) : Buffer.from(b64, 'base64').toString('binary');
    var u8 = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) u8[i] = s.charCodeAt(i);
    return u8.buffer;
  };

  /* ---------- prosjektfil ----------
     Synthinnstillinger (synths) og modulasjon (modulation) lagres som egne seksjoner,
     slik at klangutviklingen kan gjenskapes uavhengig av notene. */
  F.toProject = function (state, extra) {
    extra = extra || {};
    return {
      format: 'trespor-prosjekt', version: TS.VERSION, saved: new Date().toISOString(),
      song: state.song,
      sequences: { drums: state.tracks.drums, bass: state.tracks.bass, synth: state.tracks.synth },
      synths: state.synths,
      modulation: state.modulation,
      runtime: state.runtime,
      snapshots: extra.snapshots || [],
      recordings: extra.recordings || [],
      samples: extra.samples || {}
    };
  };
  F.fromProject = function (p) {
    if (!p || p.format !== 'trespor-prosjekt') throw new Error('Dette er ikke en TRE SPOR-prosjektfil.');
    var state = TS.migrate({
      v: p.version, song: p.song, tracks: p.sequences, synths: p.synths,
      modulation: p.modulation, runtime: p.runtime || { evoCount: 0, barsSince: 0, lastTrack: null }
    });
    return { state: state, snapshots: p.snapshots || [], recordings: p.recordings || [], samples: p.samples || {} };
  };

  /* ---------- IndexedDB for egne samples ---------- */
  var DBN = 'trespor', ST = 'samples';
  function db() {
    return new Promise(function (res, rej) {
      if (typeof indexedDB === 'undefined') return rej(new Error('ingen IndexedDB'));
      var r = indexedDB.open(DBN, 1);
      r.onupgradeneeded = function () { r.result.createObjectStore(ST); };
      r.onsuccess = function () { res(r.result); };
      r.onerror = function () { rej(r.error); };
    });
  }
  F.idbPut = function (key, val) {
    return db().then(function (d) { return new Promise(function (res, rej) { var tx = d.transaction(ST, 'readwrite'); val == null ? tx.objectStore(ST).delete(key) : tx.objectStore(ST).put(val, key); tx.oncomplete = res; tx.onerror = function () { rej(tx.error); }; }); });
  };
  F.idbAll = function () {
    return db().then(function (d) {
      return new Promise(function (res, rej) {
        var out = {}, tx = d.transaction(ST, 'readonly'), s = tx.objectStore(ST), req = s.openCursor();
        req.onsuccess = function () { var cur = req.result; if (cur) { out[cur.key] = cur.value; cur.continue(); } else res(out); };
        req.onerror = function () { rej(req.error); };
      });
    });
  };

  /* ---------- nedlasting og deling ---------- */
  F.download = function (data, name, mime) {
    var blob = data instanceof Blob ? data : new Blob([data], { type: mime || 'application/octet-stream' });
    var url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url; a.download = name; a.rel = 'noopener';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
  };
  F.canShareFiles = function () {
    try { return !!(navigator.canShare && navigator.canShare({ files: [new File([new Uint8Array(1)], 'x.wav', { type: 'audio/wav' })] })); } catch (e) { return false; }
  };
  F.share = function (items) {
    var files = items.map(function (it) { return new File([it.data], it.name, { type: it.mime }); });
    return navigator.share({ files: files, title: 'TRE SPOR' });
  };
})(typeof window !== 'undefined' ? window : globalThis);
