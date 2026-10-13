/* Standard MIDI File: lesing (format 0/1) og skriving (format 1, ett spor per stemme). */
(function (MM) {
  'use strict';

  function parseMidi(buffer) {
    const bytes = new Uint8Array(buffer);
    let p = 0;
    const str = (n) => { let s = ''; for (let i = 0; i < n; i++) s += String.fromCharCode(bytes[p + i]); p += n; return s; };
    const u32 = () => { const v = (bytes[p] << 24 | bytes[p + 1] << 16 | bytes[p + 2] << 8 | bytes[p + 3]) >>> 0; p += 4; return v; };
    const u16 = () => { const v = bytes[p] << 8 | bytes[p + 1]; p += 2; return v; };
    const vlq = () => { let v = 0, b; do { b = bytes[p++]; v = (v << 7) | (b & 0x7f); } while (b & 0x80 && p < bytes.length); return v; };

    if (str(4) !== 'MThd') throw new Error('Dette er ikke en MIDI-fil.');
    const hlen = u32();
    const format = u16();
    const ntrks = u16();
    let division = u16();
    p = 8 + hlen;
    let ppq = division & 0x8000 ? 480 : division; // SMPTE-tid er sjelden; behandles som 480 PPQ

    let bpm = null, timeSig = null, keySig = null;
    const tracks = [];

    for (let ti = 0; ti < ntrks && p < bytes.length; ti++) {
      const id = str(4);
      const len = u32();
      const end = p + len;
      if (id !== 'MTrk') { p = end; continue; }
      let tick = 0, status = 0, name = '';
      const open = new Map();
      const notes = [];
      const channels = new Set();
      while (p < end) {
        tick += vlq();
        let b = bytes[p];
        if (b & 0x80) { status = b; p++; } else if (!status) { p++; continue; }
        if (status === 0xff) {
          const type = bytes[p++];
          const l = vlq();
          const at = p;
          if (type === 0x51 && bpm === null && l === 3) bpm = 60000000 / (bytes[at] << 16 | bytes[at + 1] << 8 | bytes[at + 2]);
          else if (type === 0x58 && !timeSig) timeSig = [bytes[at], 1 << bytes[at + 1]];
          else if (type === 0x59 && !keySig) keySig = { sf: (bytes[at] << 24) >> 24, minor: bytes[at + 1] === 1 };
          else if (type === 0x03 && !name) { for (let i = 0; i < l; i++) name += String.fromCharCode(bytes[at + i]); }
          p = at + l;
          status = 0;
          continue;
        }
        if (status === 0xf0 || status === 0xf7) { const l = vlq(); p += l; status = 0; continue; }
        const type = status & 0xf0;
        const ch = status & 0x0f;
        const d1 = bytes[p++];
        const d2 = (type === 0xc0 || type === 0xd0) ? 0 : bytes[p++];
        const k = ch * 128 + d1;
        if (type === 0x90 && d2 > 0) {
          if (!open.has(k)) open.set(k, []);
          open.get(k).push({ tick, vel: d2 });
          channels.add(ch);
        } else if (type === 0x80 || (type === 0x90 && d2 === 0)) {
          const st = open.get(k);
          if (st && st.length) {
            const on = st.shift();
            notes.push({ ch, p: d1, tick: on.tick, len: Math.max(1, tick - on.tick), vel: on.vel });
          }
        }
      }
      for (const [k, st] of open) for (const on of st) notes.push({ ch: Math.floor(k / 128), p: k % 128, tick: on.tick, len: ppq / 4, vel: on.vel });
      p = end;
      if (!notes.length) continue;
      const tpStep = ppq / 4;
      const chList = Array.from(channels);
      tracks.push({
        name: name || ('Spor ' + (tracks.length + 1)),
        channel: chList[0] || 0,
        isDrum: chList.length > 0 && chList.every((c) => c === 9),
        notes: notes
          .map((n) => ({ t: n.tick / tpStep, d: n.len / tpStep, p: n.p, v: Math.round(n.vel / 127 * 100) / 100 }))
          .sort((a, b) => a.t - b.t || a.p - b.p),
      });
    }
    return { format, ppq, bpm: bpm ? Math.round(bpm * 100) / 100 : null, timeSig: timeSig || [4, 4], keySig, tracks };
  }

  /* ---------- skriving ---------- */
  function vlqBytes(v) {
    const out = [v & 0x7f];
    v >>= 7;
    while (v > 0) { out.unshift((v & 0x7f) | 0x80); v >>= 7; }
    return out;
  }
  const textBytes = (s) => Array.from(unescape(encodeURIComponent(s))).map((c) => c.charCodeAt(0));

  function trackChunk(events) {
    // events: [{tick, bytes:[...]}] – sorteres, note-off før note-on på samme tick
    events.sort((a, b) => a.tick - b.tick || a.order - b.order);
    const data = [];
    let last = 0;
    for (const e of events) {
      data.push(...vlqBytes(Math.max(0, e.tick - last)), ...e.bytes);
      last = e.tick;
    }
    data.push(0, 0xff, 0x2f, 0);
    const len = data.length;
    return [0x4d, 0x54, 0x72, 0x6b, (len >>> 24) & 255, (len >>> 16) & 255, (len >>> 8) & 255, len & 255, ...data];
  }

  /* tracks: [{ name, channel, program, notes: [{t, d, p, v}] }] – t og d i steg. */
  function writeMidi(opts) {
    const ppq = opts.ppq || 480;
    const tps = ppq / 4;
    const bpm = opts.bpm || 128;
    const mpq = Math.round(60000000 / bpm);
    const chunks = [];
    const tempo = [
      { tick: 0, order: 0, bytes: [0xff, 0x03, ...vlqBytes(textBytes(opts.title || 'Motivmotor').length), ...textBytes(opts.title || 'Motivmotor')] },
      { tick: 0, order: 0, bytes: [0xff, 0x51, 3, (mpq >> 16) & 255, (mpq >> 8) & 255, mpq & 255] },
      { tick: 0, order: 0, bytes: [0xff, 0x58, 4, 4, 2, 24, 8] },
    ];
    chunks.push(trackChunk(tempo));
    for (const tr of opts.tracks) {
      const ch = tr.channel & 15;
      const ev = [{ tick: 0, order: 0, bytes: [0xff, 0x03, ...vlqBytes(textBytes(tr.name).length), ...textBytes(tr.name)] }];
      if (tr.program !== undefined && ch !== 9) ev.push({ tick: 0, order: 0, bytes: [0xc0 | ch, tr.program & 127] });
      for (const n of tr.notes) {
        const on = Math.max(0, Math.round(n.t * tps));
        const off = Math.max(on + 1, Math.round((n.t + n.d) * tps));
        const vel = Math.max(1, Math.min(127, Math.round((n.v === undefined ? 0.8 : n.v) * 127)));
        const pitch = Math.max(0, Math.min(127, Math.round(n.p)));
        ev.push({ tick: on, order: 2, bytes: [0x90 | ch, pitch, vel] });
        ev.push({ tick: off, order: 1, bytes: [0x80 | ch, pitch, 0] });
      }
      chunks.push(trackChunk(ev));
    }
    const ntr = chunks.length;
    const header = [0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 1, (ntr >> 8) & 255, ntr & 255, (ppq >> 8) & 255, ppq & 255];
    const total = header.length + chunks.reduce((s, c) => s + c.length, 0);
    const out = new Uint8Array(total);
    let o = 0;
    out.set(header, o); o += header.length;
    for (const c of chunks) { out.set(c, o); o += c.length; }
    return out;
  }

  MM.midi = { parseMidi, writeMidi };
})(globalThis.MM = globalThis.MM || {});
