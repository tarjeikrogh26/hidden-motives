/* Vokalypse – WAV-eksport (PCM, 24-bit, 48 kHz, stereo). */
(function (VK) {
  'use strict';

  // channels: [Float32Array, ...] like lange. Returnerer ArrayBuffer med komplett WAV-fil.
  VK.encodeWav = function (channels, sampleRate, bitDepth) {
    bitDepth = bitDepth || 24;
    const nCh = channels.length;
    const n = channels[0].length;
    const bps = bitDepth / 8;
    const blockAlign = nCh * bps;
    const dataBytes = n * blockAlign;
    const buf = new ArrayBuffer(44 + dataBytes);
    const v = new DataView(buf);
    let p = 0;
    const str = (s) => { for (let i = 0; i < s.length; i++) v.setUint8(p++, s.charCodeAt(i)); };
    const u32 = (x) => { v.setUint32(p, x, true); p += 4; };
    const u16 = (x) => { v.setUint16(p, x, true); p += 2; };
    str('RIFF'); u32(36 + dataBytes); str('WAVE');
    str('fmt '); u32(16); u16(1); u16(nCh); u32(sampleRate); u32(sampleRate * blockAlign); u16(blockAlign); u16(bitDepth);
    str('data'); u32(dataBytes);
    const bytes = new Uint8Array(buf);
    const max = Math.pow(2, bitDepth - 1) - 1;
    for (let i = 0; i < n; i++) {
      for (let c = 0; c < nCh; c++) {
        let s = channels[c][i];
        s = s > 1 ? 1 : s < -1 ? -1 : s;
        let x = Math.round(s * max);
        if (bitDepth === 24) {
          if (x < 0) x += 0x1000000;
          bytes[p++] = x & 0xff; bytes[p++] = (x >> 8) & 0xff; bytes[p++] = (x >> 16) & 0xff;
        } else {
          v.setInt16(p, x, true); p += 2;
        }
      }
    }
    return buf;
  };

  // Kjører appen inne i Claude-vinduet (forhåndsvisning)? Da gjelder andre regler for nedlasting og nett.
  VK.inPreview = function () { return !!(window.claude && typeof window.claude.use === 'function'); };

  // Minimal ZIP (ukomprimert) – forhåndsvisningen tillater ikke .wav direkte, men .zip
  const CRC = (function () {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
    return t;
  })();
  function crc32(u8) { let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  VK.zipStore = function (files) {
    const parts = [], central = [];
    let offset = 0;
    const d = new Date();
    const dosTime = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
    const dosDate = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
    for (const f of files) {
      const name = new TextEncoder().encode(f.name);
      const data = f.data;
      const crc = crc32(data);
      const lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true);
      lh.setUint16(10, dosTime, true); lh.setUint16(12, dosDate, true); lh.setUint32(14, crc, true);
      lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true); lh.setUint16(26, name.length, true); lh.setUint16(28, 0, true);
      parts.push(new Uint8Array(lh.buffer), name, data);
      const ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true);
      ch.setUint16(12, dosTime, true); ch.setUint16(14, dosDate, true); ch.setUint32(16, crc, true);
      ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true); ch.setUint16(28, name.length, true);
      ch.setUint32(42, offset, true);
      central.push(new Uint8Array(ch.buffer), name);
      offset += 30 + name.length + data.length;
    }
    let cSize = 0;
    for (const c of central) cSize += c.length;
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
    end.setUint32(12, cSize, true); end.setUint32(16, offset, true);
    return new Blob(parts.concat(central, [new Uint8Array(end.buffer)]), { type: 'application/zip' });
  };

  // Gir brukeren en fil. Lokalt: vanlig nedlasting. I forhåndsvisningen: Claude spør først,
  // og WAV-filer pakkes i en zip fordi .wav ikke er tillatt der.
  // Returnerer 'saved', 'declined' eller kaster en feil med forklaring.
  VK.downloadBlob = async function (data, filename, mime) {
    if (VK.inPreview()) {
      const dl = await window.claude.use('downloads');
      if (!dl) throw new Error('Nedlasting er ikke tilgjengelig i dette vinduet. Åpne den nedlastede versjonen av appen på Macen i stedet.');
      let name = filename, payload;
      if (/\.wav$/i.test(filename)) {
        payload = VK.zipStore([{ name: filename, data: new Uint8Array(data) }]);
        name = filename.replace(/\.wav$/i, '.zip');
      } else {
        payload = data instanceof Blob ? data : new Blob([data]);
      }
      try {
        await dl.save({ filename: name, data: payload });
        return 'saved';
      } catch (e) {
        if (e && e.code === 'declined') return 'declined';
        if (e && e.code === 'rate_limited') throw new Error('Et lagringsvindu er allerede åpent. Svar på det først.');
        throw new Error('Nedlastingen ble stoppet (' + (e && e.code ? e.code : e) + ').');
      }
    }
    const blob = data instanceof Blob ? data : new Blob([data], { type: mime || 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 4000);
    return 'saved';
  };
})(window.VK = window.VK || {});
