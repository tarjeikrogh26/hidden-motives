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

  VK.downloadBlob = function (data, filename, mime) {
    const blob = data instanceof Blob ? data : new Blob([data], { type: mime || 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 4000);
  };
})(window.VK = window.VK || {});
