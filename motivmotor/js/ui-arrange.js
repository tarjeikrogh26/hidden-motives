/* Oversikt over arrangementet: seksjoner øverst, én rad per stemme, tetthet per takt og melodikurve. Trykk for å spille derfra. */
(function (MM) {
  'use strict';
  const SPB = MM.theory.STEPS_PER_BAR;

  const ROWS = [
    { id: 'lead', label: 'Melodi', color: '#ffb000', group: 'melody' },
    { id: 'pluck', label: 'Akkordrytme', color: '#4db6ac', group: 'chords' },
    { id: 'pad', label: 'Pad', color: '#a68bdc', group: 'chords' },
    { id: 'bass', label: 'Bass', color: '#4fc3f7', group: 'bass' },
    { id: 'drums', label: 'Trommer', color: '#9aa3b8', group: 'drums' },
  ];
  const SEC_COLORS = { intro: '#2a2f3a', build: '#23384a', main1: '#4a3a14', breakdown: '#35284a', lift: '#23384a', main2: '#5a4310', main3: '#4a3a14', outro: '#2a2f3a' };

  class ArrangeView {
    constructor(host, opts) {
      this.o = opts || {};
      this.arr = null;
      this.locked = {};
      this.playhead = null;
      host.innerHTML = '';
      this.wrap = document.createElement('div');
      this.wrap.className = 'arrview';
      this.canvas = document.createElement('canvas');
      this.wrap.appendChild(this.canvas);
      host.appendChild(this.wrap);
      this.canvas.addEventListener('click', (e) => {
        if (!this.arr) return;
        const r = this.canvas.getBoundingClientRect();
        const bar = Math.floor((e.clientX - r.left) / r.width * this.arr.totalBars);
        if (this.o.onSeek) this.o.onSeek(Math.max(0, Math.floor(bar / 4) * 4) * SPB);
      });
      new ResizeObserver(() => this.draw()).observe(this.wrap);
    }

    set(arr, locked) {
      this.arr = arr;
      this.locked = locked || {};
      this.cache = null;
      this.draw();
    }

    setPlayhead(s) { this.playhead = s; this.draw(); }

    density() {
      if (this.cache) return this.cache;
      const a = this.arr;
      const d = {};
      for (const r of ROWS) {
        const arr = new Float32Array(a.totalBars);
        for (const n of a.parts[r.id] || []) { const b = Math.floor(n.t / SPB); if (b < a.totalBars) arr[b] += 1; }
        let max = 0; for (const v of arr) max = Math.max(max, v);
        d[r.id] = { arr, max: max || 1 };
      }
      const lead = a.parts.lead || [];
      const ps = lead.map((n) => n.p);
      d.leadRange = ps.length ? [Math.min.apply(null, ps), Math.max.apply(null, ps)] : [60, 80];
      this.cache = d;
      return d;
    }

    draw() {
      const W = this.wrap.clientWidth || 340;
      const head = 26, rowH = 30;
      const H = head + ROWS.length * rowH;
      const dpr = window.devicePixelRatio || 1;
      const c = this.canvas;
      if (c.width !== Math.round(W * dpr) || c.height !== Math.round(H * dpr)) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); c.style.height = H + 'px'; }
      const x = c.getContext('2d');
      x.setTransform(dpr, 0, 0, dpr, 0, 0);
      x.fillStyle = '#12151b'; x.fillRect(0, 0, W, H);
      const font = getComputedStyle(document.body).fontFamily;
      if (!this.arr) {
        x.fillStyle = '#6b7383'; x.font = '13px ' + font; x.fillText('Ingen arrangement ennå', 12, H / 2);
        return;
      }
      const a = this.arr;
      const bw = W / a.totalBars;
      for (const s of a.sections) {
        const sx = s.start * bw, sw = s.bars * bw;
        x.fillStyle = SEC_COLORS[s.type] || '#2a2f3a';
        x.fillRect(sx, 0, sw - 1, head - 2);
        x.fillStyle = 'rgba(255,255,255,.03)';
        x.fillRect(sx, head, sw - 1, H - head);
        x.fillStyle = '#e9ebf0'; x.font = '11px ' + font;
        const label = sw > 80 ? s.label : sw > 34 ? s.label.split(' ').map((w) => w[0]).join('') + (s.label.match(/\d/) || [''])[0] : '';
        x.save(); x.beginPath(); x.rect(sx, 0, sw - 2, head); x.clip();
        x.fillText(label, sx + 4, 16); x.restore();
        x.fillStyle = '#0e1014'; x.fillRect(sx + sw - 1, 0, 1, H);
      }
      const d = this.density();
      ROWS.forEach((r, i) => {
        const y = head + i * rowH;
        const dd = d[r.id];
        for (let b = 0; b < a.totalBars; b++) {
          const v = dd.arr[b] / dd.max;
          if (v <= 0) continue;
          x.globalAlpha = 0.18 + 0.6 * Math.sqrt(v);
          x.fillStyle = r.color;
          x.fillRect(b * bw, y + 5, Math.max(1, bw - (bw > 3 ? 1 : 0)), rowH - 10);
        }
        x.globalAlpha = 1;
        if (r.id === 'lead') {
          const [lo, hi] = d.leadRange;
          x.fillStyle = '#fff3d0';
          for (const n of a.parts.lead) {
            const ny = y + rowH - 6 - (n.p - lo) / Math.max(1, hi - lo) * (rowH - 12);
            x.fillRect(n.t / SPB * bw, ny, Math.max(1, n.d / SPB * bw), 1.5);
          }
        }
        x.fillStyle = 'rgba(14,16,20,.75)';
        const lab = r.label + (this.locked[r.group] ? ' 🔒' : '');
        x.font = '11px ' + font;
        const tw = x.measureText(lab).width;
        x.fillRect(2, y + 7, tw + 8, 16);
        x.fillStyle = '#c9cfdb'; x.fillText(lab, 6, y + 19);
      });
      if (this.playhead !== null) {
        x.fillStyle = '#ffffff';
        x.fillRect(this.playhead / SPB * bw, 0, 2, H);
      }
    }
  }

  MM.ArrangeView = ArrangeView;
})(globalThis.MM = globalThis.MM || {});
