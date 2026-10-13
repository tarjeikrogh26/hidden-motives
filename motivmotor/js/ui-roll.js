/* Enkel pianorull på canvas. Trykk for å legge til, dra for å flytte, dra i høyre kant for lengde, dobbelttrykk for å slette.
   Usikre noter (fra lydanalyse) tegnes stiplet med spørsmålstegn. */
(function (MM) {
  'use strict';
  const T = MM.theory;
  const SPB = T.STEPS_PER_BAR;

  function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; }

  class PianoRoll {
    constructor(host, opts) {
      this.o = Object.assign({ editable: true, color: '#ffb000', rowH: 15 }, opts);
      this.notes = (this.o.notes || []).map((n) => Object.assign({}, n));
      this.bars = this.o.bars || 4;
      this.sel = null;
      this.len = 2;
      this.view = 0;
      this.undo = [];
      this.playhead = null;
      host.innerHTML = '';
      if (this.o.editable) this.toolbar(host);
      this.wrap = el('div', 'roll' + (this.o.editable ? '' : ' ro'));
      this.canvas = el('canvas');
      this.wrap.appendChild(this.canvas);
      host.appendChild(this.wrap);
      this.fitRange();
      if (this.o.editable) this.bind();
      else if (this.o.onTap) this.canvas.addEventListener('click', () => this.o.onTap());
      this.ro = new ResizeObserver(() => this.draw());
      this.ro.observe(this.wrap);
      this.draw();
    }

    toolbar(host) {
      const bar = el('div', 'rollbar');
      const seg = el('div', 'seg');
      [['1/16', 1], ['1/8', 2], ['1/4', 4], ['1/2', 8], ['1/1', 16]].forEach(([lab, v]) => {
        const b = el('button', v === this.len ? 'on' : '', lab);
        b.title = 'Lengde på nye noter';
        b.onclick = () => { this.len = v; seg.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); };
        seg.appendChild(b);
      });
      bar.appendChild(seg);
      const mk = (lab, title, fn) => { const b = el('button', 'btn small', lab); b.title = title; b.onclick = fn; bar.appendChild(b); return b; };
      this.navLabel = el('span', 'faint mono');
      mk('◀', 'Forrige takter', () => { this.view = Math.max(0, this.view - this.viewBars()); this.draw(); });
      bar.appendChild(this.navLabel);
      mk('▶', 'Neste takter', () => { this.view = Math.min(Math.max(0, this.bars - this.viewBars()), this.view + this.viewBars()); this.draw(); });
      mk('▲', 'Flytt utsnittet opp', () => { this.lo += 5; this.hi += 5; this.draw(); });
      mk('▼', 'Flytt utsnittet ned', () => { this.lo -= 5; this.hi -= 5; this.draw(); });
      bar.appendChild(el('span', 'sep'));
      mk('↶', 'Angre', () => { if (this.undo.length) { this.notes = this.undo.pop(); this.sel = null; this.changed(); } });
      this.delBtn = mk('Slett', 'Slett valgt note', () => { if (this.sel) { this.pushUndo(); this.notes = this.notes.filter((n) => n !== this.sel); this.sel = null; this.changed(); } });
      if (this.o.extraTools) for (const t of this.o.extraTools) mk(t[0], t[1], t[2]);
      host.appendChild(bar);
    }

    viewBars() {
      const w = this.wrap.clientWidth || 340;
      const fit = w < 560 ? 2 : w < 900 ? 4 : 8;
      return Math.min(this.bars, this.o.viewBars || fit);
    }

    fitRange() {
      const ps = this.notes.map((n) => n.p);
      let lo = ps.length ? Math.min.apply(null, ps) - 4 : 60;
      let hi = ps.length ? Math.max.apply(null, ps) + 4 : 84;
      const minRows = this.o.editable ? 22 : 14;
      while (hi - lo + 1 < minRows) { hi++; if (hi - lo + 1 < minRows) lo--; }
      this.lo = lo; this.hi = hi;
    }

    set(notes, bars, chords) {
      this.notes = notes.map((n) => Object.assign({}, n));
      if (bars) this.bars = bars;
      if (chords !== undefined) this.o.chords = chords;
      this.sel = null;
      this.view = Math.min(this.view, Math.max(0, this.bars - this.viewBars()));
      this.fitRange();
      this.draw();
    }

    setPlayhead(step) { this.playhead = step; this.draw(); }

    geom() {
      const W = this.wrap.clientWidth || 340;
      const keysW = 34;
      const top = this.o.chords ? 18 : 0;
      const rows = this.hi - this.lo + 1;
      const rowH = this.o.editable ? this.o.rowH : Math.max(5, Math.min(9, Math.floor(120 / rows)));
      const vb = this.o.editable ? this.viewBars() : this.bars;
      const v0 = this.o.editable ? this.view * SPB : 0;
      const stepW = (W - keysW) / (vb * SPB);
      return { W, H: top + rows * rowH, keysW, top, rowH, rows, stepW, v0, v1: v0 + vb * SPB };
    }

    draw() {
      const g = this.geom();
      const dpr = window.devicePixelRatio || 1;
      const c = this.canvas;
      if (c.width !== Math.round(g.W * dpr) || c.height !== Math.round(g.H * dpr)) {
        c.width = Math.round(g.W * dpr); c.height = Math.round(g.H * dpr);
        c.style.height = g.H + 'px';
      }
      const x = c.getContext('2d');
      x.setTransform(dpr, 0, 0, dpr, 0, 0);
      x.fillStyle = '#12151b'; x.fillRect(0, 0, g.W, g.H);
      const key = this.o.key;
      for (let p = this.lo; p <= this.hi; p++) {
        const y = g.top + (this.hi - p) * g.rowH;
        const inKey = key ? T.inScale(key, p) : [0, 2, 4, 5, 7, 9, 11].includes(T.mod(p, 12));
        x.fillStyle = inKey ? '#181c24' : '#12151b';
        x.fillRect(g.keysW, y, g.W - g.keysW, g.rowH);
        if (key && T.mod(p - key.root, 12) === 0) { x.fillStyle = 'rgba(255,176,0,.07)'; x.fillRect(g.keysW, y, g.W - g.keysW, g.rowH); }
        x.fillStyle = [1, 3, 6, 8, 10].includes(T.mod(p, 12)) ? '#0b0d11' : '#252a34';
        x.fillRect(0, y, g.keysW - 2, g.rowH - 1);
        if (T.mod(p, 12) === 0 || (key && T.mod(p - key.root, 12) === 0 && g.rowH >= 12)) {
          x.fillStyle = '#9aa2b1'; x.font = '9px ' + getComputedStyle(document.body).fontFamily;
          if (g.rowH >= 9) x.fillText(T.noteName(p), 3, y + g.rowH - 3);
        }
      }
      for (let s = g.v0; s <= g.v1; s++) {
        const xx = g.keysW + (s - g.v0) * g.stepW;
        if (s % SPB === 0) { x.fillStyle = '#3a4150'; x.fillRect(xx, g.top, 1, g.H); }
        else if (s % 4 === 0) { x.fillStyle = '#262b35'; x.fillRect(xx, g.top, 1, g.H); }
        else if (this.o.editable && g.stepW > 9) { x.fillStyle = '#1b1f27'; x.fillRect(xx, g.top, 1, g.H); }
      }
      if (this.o.chords && key) {
        x.font = '11px ' + getComputedStyle(document.body).fontFamily;
        const loop = this.bars * SPB;
        for (let base = 0; base < loop; base += loop) for (const ch of this.o.chords) {
          const a = Math.max(ch.t, g.v0), b = Math.min(ch.t + ch.len, g.v1);
          if (b <= a) continue;
          const xa = g.keysW + (a - g.v0) * g.stepW;
          x.fillStyle = '#1e222b'; x.fillRect(xa + 1, 1, (b - a) * g.stepW - 2, 15);
          x.fillStyle = ch.conf !== undefined && ch.conf < 0.6 ? '#ffb36b' : '#c9cfdb';
          x.fillText(T.chordName(key, ch.chord) + (ch.conf !== undefined && ch.conf < 0.6 ? '?' : ''), xa + 5, 12);
        }
      }
      for (const n of this.notes) {
        if (n.t + n.d <= g.v0 || n.t >= g.v1 || n.p < this.lo || n.p > this.hi) continue;
        const nx = g.keysW + (n.t - g.v0) * g.stepW;
        const ny = g.top + (this.hi - n.p) * g.rowH;
        const nw = Math.max(2, n.d * g.stepW - 1);
        const unsure = n.conf !== undefined && n.conf < 0.7;
        x.globalAlpha = 0.45 + 0.55 * (n.v === undefined ? 0.8 : n.v);
        x.fillStyle = n === this.sel ? '#ffffff' : (unsure ? 'rgba(255,179,107,.35)' : this.o.color);
        roundRect(x, nx, ny + 1, nw, g.rowH - 2, Math.min(3, g.rowH / 3));
        x.fill();
        x.globalAlpha = 1;
        if (unsure) {
          x.setLineDash([3, 2]); x.strokeStyle = '#ffb36b'; x.lineWidth = 1;
          roundRect(x, nx + 0.5, ny + 1.5, nw - 1, g.rowH - 3, 3); x.stroke(); x.setLineDash([]);
          if (nw > 10 && g.rowH >= 10) { x.fillStyle = '#ffb36b'; x.font = '10px sans-serif'; x.fillText('?', nx + 3, ny + g.rowH - 4); }
        }
      }
      if (this.playhead !== null && this.playhead >= g.v0 && this.playhead <= g.v1) {
        x.fillStyle = '#ffffff'; x.fillRect(g.keysW + (this.playhead - g.v0) * g.stepW, 0, 1.5, g.H);
      }
      if (this.navLabel) {
        const vb = this.viewBars();
        this.navLabel.textContent = 'takt ' + (this.view + 1) + (vb > 1 ? '–' + Math.min(this.bars, this.view + vb) : '') + ' av ' + this.bars;
      }
      if (this.delBtn) this.delBtn.disabled = !this.sel;
    }

    pushUndo() { this.undo.push(this.notes.map((n) => Object.assign({}, n))); if (this.undo.length > 40) this.undo.shift(); }
    changed() { this.draw(); if (this.o.onChange) this.o.onChange(this.notes.map((n) => { const m = Object.assign({}, n); return m; })); }

    hit(px, py) {
      const g = this.geom();
      const step = g.v0 + (px - g.keysW) / g.stepW;
      const p = this.hi - Math.floor((py - g.top) / g.rowH);
      let found = null;
      for (const n of this.notes) if (n.p === p && step >= n.t && step < n.t + n.d) found = n;
      const edge = found ? (found.t + found.d - step) * g.stepW < Math.max(8, g.stepW * 0.4) : false;
      return { step, p, note: found, edge, g };
    }

    bind() {
      const c = this.canvas;
      let drag = null;
      let lastTap = { n: null, time: 0 };
      const pos = (e) => { const r = c.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
      c.addEventListener('pointerdown', (e) => {
        const [px, py] = pos(e);
        const h = this.hit(px, py);
        if (px < h.g.keysW || py < h.g.top) return;
        c.setPointerCapture(e.pointerId);
        const now = Date.now();
        if (h.note) {
          if (lastTap.n === h.note && now - lastTap.time < 320) {
            this.pushUndo(); this.notes = this.notes.filter((n) => n !== h.note); this.sel = null; this.changed(); drag = null; return;
          }
          lastTap = { n: h.note, time: now };
          this.sel = h.note;
          this.pushUndo();
          drag = { mode: h.edge ? 'resize' : 'move', x0: px, y0: py, t0: h.note.t, p0: h.note.p, d0: h.note.d, moved: false };
          if (this.o.onAudition) this.o.onAudition(h.note.p);
        } else {
          this.pushUndo();
          const snap = this.len <= 1 ? 1 : 2;
          const t = Math.max(0, Math.min(this.bars * SPB - 1, Math.floor(h.step / snap) * snap));
          const n = { t, d: Math.min(this.len, this.bars * SPB - t), p: h.p, v: t % 4 === 0 ? 0.9 : 0.8 };
          this.notes.push(n);
          this.sel = n;
          drag = { mode: 'resize', x0: px, y0: py, t0: n.t, p0: n.p, d0: n.d, moved: true, created: true };
          if (this.o.onAudition) this.o.onAudition(n.p);
        }
        this.draw();
      });
      c.addEventListener('pointermove', (e) => {
        if (!drag || !this.sel) return;
        const [px, py] = pos(e);
        const g = this.geom();
        const ds = Math.round((px - drag.x0) / g.stepW);
        const dp = -Math.round((py - drag.y0) / g.rowH);
        const n = this.sel;
        if (drag.mode === 'move') {
          const nt = Math.max(0, Math.min(this.bars * SPB - n.d, drag.t0 + ds));
          const np = Math.max(0, Math.min(127, drag.p0 + dp));
          if (nt !== n.t || np !== n.p) { drag.moved = true; if (np !== n.p && this.o.onAudition) this.o.onAudition(np); n.t = nt; n.p = np; delete n.conf; }
        } else {
          const nd = Math.max(1, Math.min(this.bars * SPB - n.t, drag.d0 + ds));
          if (nd !== n.d) { drag.moved = true; n.d = nd; }
        }
        this.draw();
      });
      const end = () => {
        if (drag && drag.moved) this.changed();
        else if (drag) this.undo.pop();
        drag = null;
      };
      c.addEventListener('pointerup', end);
      c.addEventListener('pointercancel', end);
    }
  }

  function roundRect(x, a, b, w, h, r) {
    x.beginPath();
    x.moveTo(a + r, b); x.lineTo(a + w - r, b); x.quadraticCurveTo(a + w, b, a + w, b + r);
    x.lineTo(a + w, b + h - r); x.quadraticCurveTo(a + w, b + h, a + w - r, b + h);
    x.lineTo(a + r, b + h); x.quadraticCurveTo(a, b + h, a, b + h - r);
    x.lineTo(a, b + r); x.quadraticCurveTo(a, b, a + r, b); x.closePath();
  }

  MM.PianoRoll = PianoRoll;
  MM.ui = MM.ui || {};
  MM.ui.roundRect = roundRect;
})(globalThis.MM = globalThis.MM || {});
