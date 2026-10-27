// DRIFT SONATA's engine (Tarjei Krogh) as Dropfather renders it: everything arrives in processorOptions (the
// compiled WASM module, the sound, the recordings and the notes with their frames), so a render is the same
// every time, with no messages to wait for. Notes start and stop on their exact sample.
class DriftDF extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const o = options.processorOptions, stub = { fd_close: () => 0, fd_seek: () => 0, fd_write: () => 0 };
    const x = this.x = new WebAssembly.Instance(o.module, { wasi_snapshot_preview1: stub }).exports;
    x._initialize(); x.ds_init(sampleRate, o.seed >>> 0);
    o.params.forEach((v, i) => x.ds_set_param(i, v));
    if (o.zones && o.zones.length) {
      x.ds_bank_begin();
      for (const z of o.zones) { const ptr = x.ds_bank_add(z.fam, z.root, z.sr, z.data.length); new Float32Array(x.memory.buffer, ptr, z.data.length).set(z.data); }
      x.ds_bank_commit();
    }
    this.events = o.events.slice().sort((a, b) => a.f - b.f); this.next = 0; this.frame = 0; this.bpm = o.bpm || 120;
  }
  process(inputs, outputs) {
    const out = outputs[0], L = out[0], R = out[1] || out[0], n = L.length, x = this.x;
    let o = 0;
    while (o < n) {
      const e = this.events[this.next];
      if (e && e.f <= this.frame + o) { if (e.on) for (const m of e.on) x.ds_note_on(m, e.v); if (e.off) for (const m of e.off) x.ds_note_off(m); this.next++; continue; }
      const k = e ? Math.min(n - o, e.f - (this.frame + o)) : n - o;
      x.ds_transport(1, (this.frame + o) / sampleRate * this.bpm / 60, this.bpm, 4, 4);
      x.ds_process(k);
      L.set(new Float32Array(x.memory.buffer, x.ds_left(), k), o);
      if (R !== L) R.set(new Float32Array(x.memory.buffer, x.ds_right(), k), o);
      o += k;
    }
    this.frame += n;
    return true;
  }
}
registerProcessor('drift-df', DriftDF);
