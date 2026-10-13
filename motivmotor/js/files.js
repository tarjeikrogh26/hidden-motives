/* Filer: WAV-koding, ZIP (uten komprimering), base64, nedlasting/deling og lagring i nettleseren (IndexedDB). */
(function (MM) {
  'use strict';

  function encodeWav(buffer, bits) {
    const b = bits === 24 ? 24 : 16;
    const ch = buffer.numberOfChannels;
    const len = buffer.length;
    const bps = b / 8;
    const dataLen = len * ch * bps;
    const out = new ArrayBuffer(44 + dataLen);
    const v = new DataView(out);
    const w = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
    w(0, 'RIFF'); v.setUint32(4, 36 + dataLen, true); w(8, 'WAVE');
    w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, ch, true);
    v.setUint32(24, buffer.sampleRate, true); v.setUint32(28, buffer.sampleRate * ch * bps, true);
    v.setUint16(32, ch * bps, true); v.setUint16(34, b, true);
    w(36, 'data'); v.setUint32(40, dataLen, true);
    const chans = [];
    for (let c = 0; c < ch; c++) chans.push(buffer.getChannelData(c));
    let o = 44;
    for (let i = 0; i < len; i++) {
      for (let c = 0; c < ch; c++) {
        const s = Math.max(-1, Math.min(1, chans[c][i]));
        if (b === 16) { v.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true); o += 2; }
        else { const x = Math.round(s * 8388607); v.setUint8(o, x & 255); v.setUint8(o + 1, (x >> 8) & 255); v.setUint8(o + 2, (x >> 16) & 255); o += 3; }
      }
    }
    return out;
  }

  let CRC;
  function crc32(bytes) {
    if (!CRC) {
      CRC = new Uint32Array(256);
      for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; CRC[n] = c >>> 0; }
    }
    let c = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) c = CRC[(c ^ bytes[i]) & 255] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }

  /* files: [{ name, data: Uint8Array }] → Uint8Array (ZIP, «store») */
  function zip(files) {
    const enc = (s) => new TextEncoder().encode(s);
    const parts = [];
    const central = [];
    let offset = 0;
    for (const f of files) {
      const name = enc(f.name);
      const crc = crc32(f.data);
      const h = new DataView(new ArrayBuffer(30));
      h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(8, 0, true);
      h.setUint32(14, crc, true); h.setUint32(18, f.data.length, true); h.setUint32(22, f.data.length, true);
      h.setUint16(26, name.length, true);
      parts.push(new Uint8Array(h.buffer), name, f.data);
      const c = new DataView(new ArrayBuffer(46));
      c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true);
      c.setUint32(16, crc, true); c.setUint32(20, f.data.length, true); c.setUint32(24, f.data.length, true);
      c.setUint16(28, name.length, true); c.setUint32(42, offset, true);
      central.push(new Uint8Array(c.buffer), name);
      offset += 30 + name.length + f.data.length;
    }
    const cSize = central.reduce((s, x) => s + x.length, 0);
    const e = new DataView(new ArrayBuffer(22));
    e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true);
    e.setUint32(12, cSize, true); e.setUint32(16, offset, true);
    const all = parts.concat(central, [new Uint8Array(e.buffer)]);
    const out = new Uint8Array(all.reduce((s, x) => s + x.length, 0));
    let o = 0;
    for (const x of all) { out.set(x, o); o += x.length; }
    return out;
  }

  function toBase64(buf) {
    const bytes = new Uint8Array(buf);
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s);
  }
  function fromBase64(b64) {
    const s = atob(b64);
    const out = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out.buffer;
  }

  /* Last ned, eller del via iOS-delingsarket når det er tilgjengelig. */
  async function save(data, filename, mime) {
    const blob = data instanceof Blob ? data : new Blob([data], { type: mime || 'application/octet-stream' });
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    if (isIOS && navigator.canShare) {
      try {
        const file = new File([blob], filename, { type: blob.type });
        if (navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: filename }); return 'shared'; }
      } catch (e) { if (e && e.name === 'AbortError') return 'cancelled'; }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    return 'downloaded';
  }

  function pickFile(accept) {
    return new Promise((resolve) => {
      const inp = document.createElement('input');
      inp.type = 'file'; inp.accept = accept || '';
      inp.style.display = 'none';
      inp.onchange = () => { resolve(inp.files && inp.files[0] ? inp.files[0] : null); inp.remove(); };
      document.body.appendChild(inp);
      inp.click();
    });
  }

  function safeName(s) { return String(s || 'motivmotor').replace(/[^\wæøåÆØÅ\- ]+/g, '').trim().replace(/\s+/g, '-') || 'motivmotor'; }

  /* ---------- IndexedDB med localStorage som reserve ---------- */
  const DB = 'motivmotor', STORE = 'projects';
  function openDb() {
    return new Promise((resolve, reject) => {
      if (!globalThis.indexedDB) { reject(new Error('ingen IndexedDB')); return; }
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  async function tx(mode, fn) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const t = db.transaction(STORE, mode);
      const st = t.objectStore(STORE);
      const r = fn(st);
      t.oncomplete = () => resolve(r && r.result !== undefined ? r.result : undefined);
      t.onerror = () => reject(t.error);
    });
  }
  const store = {
    async put(project) {
      const rec = { id: project.id, name: project.name, modified: project.modified || Date.now(), data: MM.project.serialize(project) };
      try { await tx('readwrite', (s) => s.put(rec)); }
      catch (e) { localStorage.setItem('mm:' + rec.id, JSON.stringify(rec)); }
      try { localStorage.setItem('mm:last', project.id); } catch (e) { /* privat modus */ }
    },
    async list() {
      let out = [];
      try { out = await tx('readonly', (s) => s.getAll()); }
      catch (e) {
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k.indexOf('mm:p') === 0) out.push(JSON.parse(localStorage.getItem(k)));
        }
      }
      return (out || []).map((r) => ({ id: r.id, name: r.name, modified: r.modified })).sort((a, b) => b.modified - a.modified);
    },
    async get(id) {
      let r;
      try { r = await tx('readonly', (s) => s.get(id)); }
      catch (e) { r = JSON.parse(localStorage.getItem('mm:' + id) || 'null'); }
      return r ? MM.project.deserialize(r.data) : null;
    },
    async remove(id) {
      try { await tx('readwrite', (s) => s.delete(id)); } catch (e) { localStorage.removeItem('mm:' + id); }
    },
    lastId() { try { return localStorage.getItem('mm:last'); } catch (e) { return null; } },
  };

  MM.files = { encodeWav, crc32, zip, toBase64, fromBase64, save, pickFile, safeName, store };
})(globalThis.MM = globalThis.MM || {});
