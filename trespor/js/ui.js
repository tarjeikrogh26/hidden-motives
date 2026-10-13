/* TRE SPOR – grensesnitt. Bygger alt i #app og holder kontrollene i takt med tilstanden. */
(function (root) {
  'use strict';
  var TS = root.TS, A = TS.app, U = TS.ui = {};
  var upd = [];          // kalles når tilstanden endres
  var nowFns = [];       // kalles for hvert steg som høres
  var modFns = [];       // modulasjonsmålere og -markører
  var S = function () { return A.state; };
  U.macroTarget = 'all';
  U.focus = 'drums';     // sporet tastaturet redigerer
  U.ctl = {};

  /* ---------- DOM-hjelpere ---------- */
  function h(sel, props, kids) {
    var tag = (sel.match(/^[a-z0-9]+/i) || ['div'])[0];
    var el = document.createElement(tag);
    (sel.match(/[.#][^.#]+/g) || []).forEach(function (p) { if (p[0] === '.') el.classList.add(p.slice(1)); else el.id = p.slice(1); });
    props = props || {};
    Object.keys(props).forEach(function (k) {
      var v = props[k];
      if (k === 'text') el.textContent = v;
      else if (k === 'html') el.innerHTML = v;
      else if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (v === true) el.setAttribute(k, '');
      else if (v !== false && v != null) el.setAttribute(k, v);
    });
    (kids || []).forEach(function (c) { if (c != null) el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return el;
  }
  U.h = h;
  var clamp = TS.clamp;
  function pct(v) { return Math.round(v * 100) + ' %'; }
  function hz(v) { return v >= 1000 ? (v / 1000).toFixed(v >= 10000 ? 0 : 1) + ' kHz' : Math.round(v) + ' Hz'; }
  function ms(v) { return v >= 1 ? v.toFixed(2) + ' s' : Math.round(v * 1000) + ' ms'; }
  function locked(id) { return S().tracks[id].lock; }

  var toastTimer = null;
  U.toast = function (msg) {
    var t = document.getElementById('toast');
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2200);
  };

  /* ---------- kontroller ---------- */
  function slider(o) {
    var fill = h('div.sl-fill'), knob = h('div.sl-knob'), mark = o.mod ? h('div.sl-mod') : null;
    var val = h('span.sl-val');
    var track = h('div.sl-track', { role: 'slider', tabindex: '0', 'aria-label': o.label }, [fill, mark, knob]);
    var el = h('div.sl' + (o.cls ? '.' + o.cls : ''), {}, [
      h('div.sl-top', {}, [h('span.sl-name', { text: o.label }), o.keys ? h('kbd', { text: o.keys }) : null, o.mod ? h('span.sl-modtag', { text: '∿', title: 'Denne verdien moduleres' }) : null, val]),
      track,
      o.hint ? h('div.sl-hint', { text: o.hint }) : null
    ]);
    function toPos(v) { return o.log ? Math.log(v / o.min) / Math.log(o.max / o.min) : (v - o.min) / (o.max - o.min); }
    function fromPos(p) {
      p = clamp(p, 0, 1);
      var v = o.log ? o.min * Math.pow(o.max / o.min, p) : o.min + (o.max - o.min) * p;
      if (o.step) v = Math.round(v / o.step) * o.step;
      return +v.toFixed(5);
    }
    function dis() { return o.disabled && o.disabled(); }
    function render() {
      var v = o.get(), p = clamp(toPos(v), 0, 1);
      fill.style.width = (p * 100) + '%'; knob.style.left = (p * 100) + '%';
      val.textContent = o.fmt ? o.fmt(v) : String(v);
      track.setAttribute('aria-valuenow', v);
      el.classList.toggle('off', !!dis());
    }
    function setX(x) {
      var r = track.getBoundingClientRect();
      var v = fromPos((x - r.left) / r.width);
      o.set(v);
      if (o.onUser) o.onUser();
    }
    var st = null;
    track.addEventListener('pointerdown', function (e) {
      if (dis()) { U.toast(o.disabledMsg || 'Sporet er låst – lås opp for å endre.'); return; }
      st = { x: e.clientX, y: e.clientY, active: e.pointerType === 'mouse' };
      try { track.setPointerCapture(e.pointerId); } catch (err) { /* ok */ }
      if (st.active) setX(e.clientX);
    });
    track.addEventListener('pointermove', function (e) {
      if (!st) return;
      var dx = e.clientX - st.x, dy = e.clientY - st.y;
      if (!st.active && Math.abs(dx) > 5 && Math.abs(dx) > Math.abs(dy)) st.active = true;
      if (st.active) { e.preventDefault(); setX(e.clientX); }
    });
    track.addEventListener('pointerup', function (e) {
      if (st && !st.active && Math.abs(e.clientX - st.x) < 6 && Math.abs(e.clientY - st.y) < 6) setX(e.clientX);
      st = null;
    });
    track.addEventListener('pointercancel', function () { st = null; });
    track.addEventListener('keydown', function (e) {
      if (dis()) return;
      var d = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : 0;
      if (!d) return;
      e.preventDefault();
      o.set(fromPos(toPos(o.get()) + d * (e.shiftKey ? 0.1 : 0.02)));
    });
    if (mark) {
      modFns.push(function (mods) {
        if (!mods) { mark.style.display = 'none'; return; }
        var m = mods[o.mod.track] ? mods[o.mod.track][o.mod.dest] : 0;
        if (Math.abs(m) < 0.002) { mark.style.display = 'none'; return; }
        mark.style.display = 'block';
        mark.style.left = (clamp(toPos(o.mod.apply(o.get(), m)), 0, 1) * 100) + '%';
      });
    }
    upd.push(render); render();
    return el;
  }

  function select(o) {
    var sel = h('select', { 'aria-label': o.label }, o.options.map(function (op) { return h('option', { value: String(op[0]), text: op[1] }); }));
    sel.addEventListener('change', function () {
      if (o.disabled && o.disabled()) { U.toast('Sporet er låst – lås opp for å endre.'); render(); return; }
      var v = sel.value; o.set(o.num ? Number(v) : v);
    });
    function render() { sel.value = String(o.get()); sel.disabled = !!(o.disabled && o.disabled()); }
    upd.push(render); render();
    return o.label ? h('label.fld', {}, [h('span', { text: o.label }), sel]) : sel;
  }

  function seg(o) {
    var btns = o.options.map(function (op) {
      return h('button.seg-b', { type: 'button', onclick: function () {
        if (o.disabled && o.disabled()) { U.toast('Sporet er låst – lås opp for å endre.'); return; }
        o.set(op[0]);
      } }, [op[1]]);
    });
    var el = h('div.seg' + (o.cls ? '.' + o.cls : ''), { role: 'group', 'aria-label': o.label || '' }, btns);
    function render() { var v = o.get(); btns.forEach(function (b, i) { b.setAttribute('aria-pressed', String(o.options[i][0] === v)); }); }
    upd.push(render); render();
    return o.label ? h('div.fld', {}, [h('span', { text: o.label }), el]) : el;
  }

  function toggle(o) {
    var b = h('button.tog' + (o.cls ? '.' + o.cls : ''), { type: 'button', onclick: function () { o.set(!o.get()); } }, [o.label]);
    function render() { b.setAttribute('aria-pressed', String(!!o.get())); if (o.text) b.textContent = o.text(o.get()); }
    upd.push(render); render();
    return b;
  }

  function stepper(o) {
    var v = h('span.stp-v');
    function bump(d) {
      if (o.disabled && o.disabled()) { U.toast('Sporet er låst – lås opp for å endre.'); return; }
      o.set(clamp(o.get() + d, o.min, o.max));
    }
    var el = h('div.fld', {}, [h('span', { text: o.label }), h('div.stp', {}, [
      h('button', { type: 'button', 'aria-label': o.label + ' ned', onclick: function () { bump(-1); } }, ['−']), v,
      h('button', { type: 'button', 'aria-label': o.label + ' opp', onclick: function () { bump(1); } }, ['+'])
    ])]);
    upd.push(function () { v.textContent = o.fmt ? o.fmt(o.get()) : o.get(); });
    return el;
  }

  function meter() {
    var bar = h('div.mt-bar');
    var el = h('div.mt', {}, [h('div.mt-mid'), bar]);
    el.set = function (v) {
      v = clamp(v, -1, 1);
      if (v >= 0) { bar.style.left = '50%'; bar.style.width = (v * 50) + '%'; }
      else { bar.style.left = (50 + v * 50) + '%'; bar.style.width = (-v * 50) + '%'; }
    };
    return el;
  }

  /* ---------- rutenett for steg ---------- */
  function gridPointer(grid, H) {
    var st = null;
    grid.addEventListener('pointerdown', function (e) {
      var c = e.target.closest('.cell'); if (!c || !grid.contains(c)) return;
      if (H.locked && H.locked()) { U.toast('Sporet er låst – lås opp for å endre.'); return; }
      e.preventDefault();
      var i = +c.dataset.i;
      try { grid.setPointerCapture(e.pointerId); } catch (err) { /* ok */ }
      st = { i: i, x: e.clientX, y: e.clientY, moved: false, mode: H.mode(), last: i };
      if (st.mode === 'paint') st.val = H.paintStart(i, c);
      else st.v0 = H.valueOf(i);
      H.select(i, c);
    });
    grid.addEventListener('pointermove', function (e) {
      if (!st) return;
      var dx = e.clientX - st.x, dy = st.y - e.clientY;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) st.moved = true;
      if (st.mode === 'paint') {
        var el = document.elementFromPoint(e.clientX, e.clientY);
        var c = el && el.closest && el.closest('.cell');
        if (c && grid.contains(c) && +c.dataset.i !== st.last) { st.last = +c.dataset.i; H.paint(st.last, st.val, c); }
      } else if (st.moved) H.drag(st.i, st.v0, dy);
    });
    function end() { if (st && !st.moved && st.mode !== 'paint') H.tap(st.i); st = null; }
    grid.addEventListener('pointerup', end);
    grid.addEventListener('pointercancel', function () { st = null; });
  }

  /* ---------- toppfelt ---------- */
  function buildTop() {
    var play = h('button.big.play', { type: 'button', 'aria-label': 'Spill / stopp', onclick: A.togglePlay }, [h('span.ico')]);
    var recTxt = h('span.rt', { text: 'Opptak' });
    var rec = h('button.big.rec', { type: 'button', 'aria-label': 'Opptak', onclick: A.toggleRec }, [h('span.dot'), recTxt]);
    var scope = h('canvas.scope', { width: 240, height: 64, 'aria-hidden': 'true' });
    var undo = h('button.icon', { type: 'button', title: 'Angre (⌘Z)', 'aria-label': 'Angre', onclick: A.undo }, ['↶']);
    var redo = h('button.icon', { type: 'button', title: 'Gjør om (⇧⌘Z)', 'aria-label': 'Gjør om', onclick: A.redo }, ['↷']);
    var files = h('button.icon.wide', { type: 'button', onclick: openSheet, 'aria-label': 'Fil og eksport' }, [h('span.long', { text: 'Fil og eksport' }), h('span.short', { text: 'Fil' })]);
    var keysBtn = h('button.icon.kbd-only', { type: 'button', title: 'Tastatursnarveier (H)', onclick: function () { if (TS.keys) TS.keys.toggleHelp(); } }, ['Taster ', h('kbd', { text: 'H' })]);
    var bpm = h('span.bpm');
    var top = h('header.top', {}, [
      h('div.brand', {}, [h('b', { text: 'TRE SPOR' }), bpm]),
      play, rec, scope, h('div.tgrp', {}, [undo, redo]), keysBtn, files
    ]);
    function render() {
      play.classList.toggle('on', A.playing);
      bpm.textContent = Math.round(S().song.bpm) + ' BPM';
      undo.disabled = !A.hist.length; redo.disabled = !A.fut.length;
      rec.classList.toggle('on', !!A.rec); rec.classList.toggle('armed', A.armed);
      if (!A.rec) recTxt.textContent = A.armed ? 'Venter på takt' : 'Opptak';
    }
    upd.push(render);
    A.on('transport', render); A.on('rec', render);
    U.recTxt = recTxt; U.scope = scope;
    return top;
  }

  /* ---------- hovedkontroller ---------- */
  function macroTargets() {
    var ids = U.macroTarget === 'all' ? TS.TRACKS : [U.macroTarget];
    return ids.filter(function (id) { return !locked(id); });
  }
  function macroSlider(key, label, hint, keys) {
    return slider({
      label: label, hint: hint, min: 0, max: 1, cls: 'sl-big', keys: keys,
      get: function () {
        var ids = U.macroTarget === 'all' ? TS.TRACKS.filter(function (id) { return !locked(id); }) : [U.macroTarget];
        if (!ids.length) ids = TS.TRACKS;
        return ids.reduce(function (a, id) { return a + S().tracks[id].macros[key]; }, 0) / ids.length;
      },
      set: function (v) {
        var ids = macroTargets();
        if (!ids.length) { U.toast('Alle valgte spor er låst.'); return; }
        ids.forEach(function (id) { A.commit(['tracks', id, 'macros', key], v); });
        flashTracks(ids);
      },
      disabled: function () { return !macroTargets().length; },
      disabledMsg: 'Valgt spor er låst.',
      fmt: pct
    });
  }
  U.nudgeMacro = function (key, d) {
    var ids = macroTargets();
    if (!ids.length) return U.toast('Valgt spor er låst.');
    ids.forEach(function (id) { A.commit(['tracks', id, 'macros', key], Math.round(clamp(S().tracks[id].macros[key] + d, 0, 1) * 100) / 100); });
    flashTracks(ids);
    var names = { density: 'Tetthet', movement: 'Bevegelse', intensity: 'Intensitet' };
    U.toast(names[key] + ' ' + Math.round(S().tracks[ids[0]].macros[key] * 100) + ' % · ' + (U.macroTarget === 'all' ? 'alle spor' : TS.TRACK_NAMES[U.macroTarget]));
  };
  function flashTracks(ids) {
    ids.forEach(function (id) {
      var c = document.getElementById('track-' + id); if (!c) return;
      c.classList.add('touched'); clearTimeout(c._ft); c._ft = setTimeout(function () { c.classList.remove('touched'); }, 450);
    });
  }

  function buildMacros() {
    var target = seg({
      label: 'Kontrollene styrer',
      options: [['all', 'Alle'], ['drums', 'Trommer'], ['bass', 'Bass'], ['synth', 'Synth']],
      get: function () { return U.macroTarget; },
      set: function (v) { U.macroTarget = v; U.refresh(); }, cls: 'target'
    });
    var tempo = slider({
      label: 'Tempo', cls: 'sl-big', keys: '− +', min: 60, max: 180, step: 1, fmt: function (v) { return v + ' BPM'; },
      get: function () { return S().song.bpm; }, set: function (v) { A.commit(['song', 'bpm'], v); },
      hint: 'Grunnpulsen. Alle tre spor følger den.'
    });
    var root = select({
      label: 'Grunntone', num: true,
      options: TS.NOTE_NAMES.map(function (n, i) { return [i, n]; }),
      get: function () { return S().song.root; }, set: function (v) { A.commit(['song', 'root'], v, { newGroup: true }); }
    });
    var scale = select({
      label: 'Skala',
      options: Object.keys(TS.SCALES).map(function (k) { return [k, TS.SCALES[k].name]; }),
      get: function () { return S().song.scale; },
      set: function (v) {
        if (v === 'egen') { A.commit(['song', 'scale'], v, { newGroup: true }); return; }
        A.commitMany([[['song', 'scale'], v], [['song', 'allowed'], TS.scaleAllowed(v)]]);
      }
    });
    var notes = h('div.notes', { role: 'group', 'aria-label': 'Tillatte toner' });
    var nbtn = [];
    for (var i = 0; i < 12; i++) (function (i) {
      var b = h('button.nb', { type: 'button', onclick: function () {
        var al = S().song.allowed.slice(); al[i] = !al[i];
        if (!al.some(Boolean)) { U.toast('Minst én tone må være tillatt.'); return; }
        A.commitMany([[['song', 'allowed'], al], [['song', 'scale'], 'egen']]);
      } });
      nbtn.push(b); notes.appendChild(b);
    })(i);
    upd.push(function () {
      var s = S().song;
      nbtn.forEach(function (b, i) { b.textContent = TS.NOTE_NAMES[(s.root + i) % 12]; b.setAttribute('aria-pressed', String(!!s.allowed[i])); b.classList.toggle('root', i === 0); });
    });

    var snapRow = h('div.snaps');
    function renderSnaps() {
      snapRow.innerHTML = '';
      snapRow.appendChild(h('button.snap-add', { type: 'button', onclick: function () { A.saveSnapshot(); U.toast('Snapshot lagret.'); } }, ['+ Snapshot']));
      A.snapshots.forEach(function (sn, i) {
        snapRow.appendChild(h('div.snap', {}, [
          h('button.snap-b', { type: 'button', title: 'Hent snapshot (skjer på neste taktstart)', onclick: function () {
            A.recallSnapshot(i); U.toast(A.playing ? 'Snapshot ' + sn.name + ' kommer på neste takt.' : 'Snapshot ' + sn.name + ' hentet.');
          } }, [h('b', { text: sn.name }), ' ' + sn.time]),
          h('button.snap-x', { type: 'button', 'aria-label': 'Slett snapshot ' + sn.name, onclick: function () { A.deleteSnapshot(i); } }, ['×'])
        ]));
      });
    }
    A.on('snapshots', renderSnaps); renderSnaps();

    return h('section.panel.macros', { id: 'macros' }, [
      h('h2', { text: 'Hovedkontroller' }),
      target,
      tempo,
      h('div.keyrow', {}, [root, scale]),
      notes,
      h('div.sl-hint', { text: 'Sequencerne spiller skalatrinn, så alle noter følger med når du bytter toneart.' }),
      macroSlider('density', 'Tetthet', 'Færre eller flere slag. Lavt: bare grunnslagene. Høyt: ekstra ghost-noter og utfylling.', 'T ⇧T'),
      macroSlider('movement', 'Bevegelse', 'Hvor mye som flytter seg: modulasjonsdybde, hvor ofte variasjon skjer og hvor raskt musikken utvikler seg.', 'B ⇧B'),
      macroSlider('intensity', 'Intensitet', 'Energi i lyden: åpnere filter, mer drive, sterkere anslag og aksenter.', 'I ⇧I'),
      h('h3', { text: 'Snapshots' }),
      snapRow
    ]);
  }

  /* ---------- felles sporhode ---------- */
  function trackCard(id, body) {
    var pos = h('span.tpos'), badge = h('span.badge');
    var lock = toggle({ label: 'Lås', cls: 'lock', get: function () { return S().tracks[id].lock; }, set: function (v) { A.commit(['tracks', id, 'lock'], v, { newGroup: true }); U.toast(v ? TS.TRACK_NAMES[id] + ' er låst: ingen variasjon, utvikling eller makroendringer.' : TS.TRACK_NAMES[id] + ' er låst opp.'); } });
    var mute = toggle({ label: 'Demp', cls: 'mute', get: function () { return S().tracks[id].mute; }, set: function (v) { A.commit(['tracks', id, 'mute'], v, { newGroup: true }); } });
    var mutTxt = h('span');
    var mutBar = h('div.mutbar', {}, [mutTxt,
      h('button', { type: 'button', onclick: function () { A.keep(id); U.toast('Endringene er nå en del av grunnideen.'); } }, ['Behold']),
      h('button', { type: 'button', onclick: function () { A.backToBase(id); } }, ['Tilbake til grunnidé'])
    ]);
    upd.push(function () {
      var n = S().tracks[id].mutations.length;
      mutBar.hidden = !n;
      mutTxt.textContent = 'Utviklingen har gjort ' + n + (n === 1 ? ' endring' : ' endringer') + ' (stiplet).';
      card.classList.toggle('is-locked', S().tracks[id].lock);
      card.classList.toggle('is-muted', S().tracks[id].mute);
      card.classList.toggle('focus', U.focus === id);
    });
    var num = String(TS.TRACKS.indexOf(id) + 1);
    var card = h('section.track.t-' + id, { id: 'track-' + id }, [
      h('div.th', {}, [h('h2', {}, [h('span.tdot'), TS.TRACK_NAMES[id], h('kbd', { text: num, title: 'Velg sporet med tasten ' + num })]), pos, badge, h('div.tbtns', {}, [lock, mute])]),
      mutBar
    ].concat(body));
    card.addEventListener('pointerdown', function () { if (U.focus !== id) { U.focus = id; U.refresh(); } });
    nowFns.push(function (info) {
      if (!info) { pos.textContent = ''; return; }
      var p = info.ev.pos[id];
      var len = id === 'drums' ? 16 : S().tracks[id].seq.length;
      var txt = p >= 0 ? 'steg ' + (p + 1) + '/' + len : pos.textContent;
      var notes = info.ev[id];
      if (notes && notes.length && notes[0].varied) txt += ' · variasjon: ' + notes[0].varied;
      else if (info.ev[id + 'Rest'] != null) txt += ' · variasjon: pause';
      else if (notes && notes.length && notes[0].fill) txt += ' · utfylling';
      if (p >= 0) pos.textContent = txt;
      if (info.evo && info.evo.track === id) {
        badge.textContent = 'utvikles: ' + info.evo.text;
        card.classList.add('evolving');
        clearTimeout(card._ev); card._ev = setTimeout(function () { card.classList.remove('evolving'); badge.textContent = ''; }, 4000);
      }
    });
    return card;
  }

  /* ---------- trommer ---------- */
  function buildDrums() {
    var D = function () { return S().tracks.drums; };
    var voice = 0, lane = 'on', sel = 0;
    var isLocked = function () { return locked('drums'); };

    /* oversikt: alle stemmer */
    var ov = h('div.ov');
    var ovRows = TS.DRUM_VOICES.map(function (v, vi) {
      var lab = h('button.ov-l', { type: 'button', onclick: function () { voice = vi; U.refresh(); } }, [v.name]);
      var row = h('div.ov-r', {}, [lab]);
      var cells = h('div.ov-c.grid16');
      for (var i = 0; i < 16; i++) cells.appendChild(h('div.cell.mini', { 'data-i': i }));
      row.appendChild(cells);
      gridPointer(cells, {
        locked: isLocked, mode: function () { return 'paint'; },
        paintStart: function (i) { var on = !S().tracks.drums.voices[vi].steps[i].on; setDrum(vi, i, 'on', on); return on; },
        paint: function (i, val) { setDrum(vi, i, 'on', val); },
        select: function () { voice = vi; }, tap: function () {}, valueOf: function () { return 0; }, drag: function () {}
      });
      ov.appendChild(row);
      return { lab: lab, cells: cells };
    });

    function setDrum(vi, i, field, val) {
      A.commit(['tracks', 'drums', 'voices', vi, 'steps', i, field], val);
      var vid = TS.DRUM_VOICES[vi].id, muts = D().mutations;
      if (field === 'on' && muts.some(function (m) { return m.v === vid && m.i === i; }))
        A.commit(['tracks', 'drums', 'mutations'], muts.filter(function (m) { return !(m.v === vid && m.i === i); }), { noHistory: true });
    }

    var laneSeg = seg({ options: [['on', 'Slag'], ['acc', 'Aksent'], ['prob', 'Sjanse']], get: function () { return lane; }, set: function (v) { lane = v; U.refresh(); }, cls: 'lanes' });
    var big = h('div.grid16.big-grid');
    var cells = [];
    for (var i = 0; i < 16; i++) { var c = h('div.cell', { 'data-i': i }, [h('span.cn'), h('span.cbar')]); cells.push(c); big.appendChild(c); }
    var PROBS = [1, 0.75, 0.5, 0.25];
    var bigH = {
      locked: isLocked,
      mode: function () { return lane === 'prob' ? 'value' : 'paint'; },
      paintStart: function (i) {
        var s = D().voices[voice].steps[i];
        if (lane === 'acc') { var a = !s.acc; if (a && !s.on) setDrum(voice, i, 'on', true); setDrum(voice, i, 'acc', a); return a; }
        setDrum(voice, i, 'on', !s.on); return !s.on;
      },
      paint: function (i, val) {
        if (lane === 'acc') { if (val && !D().voices[voice].steps[i].on) setDrum(voice, i, 'on', true); setDrum(voice, i, 'acc', val); }
        else setDrum(voice, i, 'on', val);
      },
      select: function (i) { sel = i; },
      valueOf: function (i) { return D().voices[voice].steps[i].prob; },
      tap: function (i) {
        var p = D().voices[voice].steps[i].prob, k = PROBS.findIndex(function (x) { return Math.abs(x - p) < 0.01; });
        setDrum(voice, i, 'prob', PROBS[(k + 1) % PROBS.length]);
        if (!D().voices[voice].steps[i].on) setDrum(voice, i, 'on', true);
      },
      drag: function (i, v0, dy) { setDrum(voice, i, 'prob', clamp(Math.round((v0 + dy / 120) * 20) / 20, 0.05, 1)); }
    };
    gridPointer(big, bigH);

    function render() {
      var T = D(), dv = TS.seq.effectiveDrums(T), mut = TS.seq.mutatedSet(T, true);
      ovRows.forEach(function (r, vi) {
        r.lab.setAttribute('aria-pressed', String(vi === voice));
        var vid = TS.DRUM_VOICES[vi].id;
        Array.prototype.forEach.call(r.cells.children, function (c, i) {
          var s = dv[vi][i];
          c.classList.toggle('on', s.on); c.classList.toggle('acc', s.on && s.acc);
          c.classList.toggle('maybe', s.on && s.prob < 1);
          c.classList.toggle('mut', !!mut[vid + ':' + i]);
          c.classList.toggle('beat', i % 4 === 0);
        });
      });
      var vid = TS.DRUM_VOICES[voice].id;
      cells.forEach(function (c, i) {
        var s = dv[voice][i];
        c.classList.toggle('on', s.on); c.classList.toggle('acc', s.on && s.acc);
        c.classList.toggle('mut', !!mut[vid + ':' + i]); c.classList.toggle('beat', i % 4 === 0);
        c.classList.toggle('sel', i === sel);
        c.firstChild.textContent = s.on ? (lane === 'prob' ? Math.round(s.prob * 100) + '%' : (s.acc ? '▲' : '')) : '';
        var bh = !s.on ? 0 : lane === 'prob' ? s.prob : lane === 'acc' ? (s.acc ? 1 : 0.45) : 1;
        c.lastChild.style.height = (bh * 100) + '%';
        c.classList.toggle('maybe', s.on && s.prob < 1);
      });
      voiceName.textContent = TS.DRUM_VOICES[voice].name;
      sampleName.textContent = A.custom[vid] ? 'Eget sample: ' + A.custom[vid].name : 'Innebygd lyd';
      clearBtn.hidden = !A.custom[vid];
      loopName.textContent = A.custom.loop ? A.custom.loop.name + ' (' + A.custom.loop.buffer.duration.toFixed(2) + ' s)' : 'Ingen loop importert';
      loopBox.classList.toggle('dim', T.mode === 'kit');
      kitBox.classList.toggle('dim', T.mode === 'loop');
    }
    upd.push(render);
    A.on('samples', render);

    /* tastatur: samme handlinger som mus og finger */
    var DLANES = ['on', 'acc', 'prob'];
    U.ctl.drums = {
      move: function (d) { sel = (sel + d + 16) % 16; render(); },
      vert: function (d) { voice = clamp(voice - d, 0, TS.DRUM_VOICES.length - 1); U.refresh(); },
      enter: function () { if (isLocked()) return U.toast('Sporet er låst – lås opp for å endre.'); lane === 'prob' ? bigH.tap(sel) : bigH.paintStart(sel); },
      lane: function (d) { lane = DLANES[(DLANES.indexOf(lane) + d + DLANES.length) % DLANES.length]; U.refresh(); },
      where: function () { return TS.DRUM_VOICES[voice].name + ', steg ' + (sel + 1); }
    };

    nowFns.push(function (info) {
      var p = info ? info.ev.pos.drums : -1;
      cells.forEach(function (c, i) { c.classList.toggle('now', i === p); });
      ovRows.forEach(function (r) { Array.prototype.forEach.call(r.cells.children, function (c, i) { c.classList.toggle('now', i === p); }); });
      if (info) info.ev.drums.forEach(function (d) { var c = ovRows[d.v].cells.children[p]; if (c) { c.classList.remove('hit'); void c.offsetWidth; c.classList.add('hit'); } });
    });

    var voiceName = h('b'), sampleName = h('span.small');
    var fileIn = h('input', { type: 'file', accept: 'audio/*,.wav,.aif,.aiff,.mp3,.m4a,.caf', hidden: true });
    fileIn.addEventListener('change', function () {
      var f = fileIn.files[0]; if (!f) return;
      var vid = TS.DRUM_VOICES[voice].id;
      A.loadSample(vid, f).then(function () { U.toast('Sample lastet: ' + f.name); }).catch(function () { U.toast('Kunne ikke lese lydfila.'); });
      fileIn.value = '';
    });
    var clearBtn = h('button', { type: 'button', onclick: function () { A.clearSample(TS.DRUM_VOICES[voice].id); } }, ['Bruk innebygd']);
    var vpath = function (k) { return ['tracks', 'drums', 'voices', voice, k]; };
    var voiceBox = h('div.box', {}, [
      h('div.row', {}, [h('span', {}, ['Valgt lyd: ', voiceName]), sampleName]),
      h('div.row', {}, [h('button', { type: 'button', onclick: function () { fileIn.click(); } }, ['Bytt sample …']), clearBtn, fileIn]),
      h('div.cols3', {}, [
        slider({ label: 'Nivå', min: 0, max: 1, fmt: pct, get: function () { return D().voices[voice].level; }, set: function (v) { A.commit(vpath('level'), v); } }),
        slider({ label: 'Tonehøyde', min: -12, max: 12, step: 1, fmt: function (v) { return (v > 0 ? '+' : '') + v + ' st'; }, get: function () { return D().voices[voice].pitch; }, set: function (v) { A.commit(vpath('pitch'), v); } }),
        slider({ label: 'Lengde', min: 0.1, max: 1, fmt: pct, get: function () { return D().voices[voice].decay; }, set: function (v) { A.commit(vpath('decay'), v); } })
      ])
    ]);
    var kitBox = h('div', {}, [ov, h('div.lanehead', {}, [laneSeg]), big, voiceBox]);

    var loopIn = h('input', { type: 'file', accept: 'audio/*,.wav,.aif,.aiff,.mp3,.m4a,.caf', hidden: true });
    loopIn.addEventListener('change', function () {
      var f = loopIn.files[0]; if (!f) return;
      A.loadSample('loop', f).then(function (buf) {
        if (D().mode === 'kit') A.commit(['tracks', 'drums', 'mode'], 'loop', { newGroup: true });
        var bars = guessBars(buf.duration, S().song.bpm);
        A.commit(['tracks', 'drums', 'loopBars'], bars);
        U.toast('Loop lastet: ' + f.name + ' – ' + bars + ' takt' + (bars > 1 ? 'er' : '') + ', ca. ' + Math.round(bars * 240 / buf.duration) + ' BPM i original.');
      }).catch(function () { U.toast('Kunne ikke lese lydfila.'); });
      loopIn.value = '';
    });
    function guessBars(dur, bpm) {
      var best = 1, err = 1e9;
      [1, 2, 4, 8].forEach(function (b) { var tb = b * 240 / dur; var e = Math.abs(Math.log(tb / bpm)) + (tb < 70 || tb > 190 ? 2 : 0); if (e < err) { err = e; best = b; } });
      return best;
    }
    var loopName = h('span.small');
    var loopBox = h('div.box', {}, [
      h('div.row', {}, [h('button', { type: 'button', onclick: function () { loopIn.click(); } }, ['Importer trommeloop …']), loopIn,
        h('button', { type: 'button', onclick: function () { A.clearSample('loop'); } }, ['Fjern'])]),
      h('div.row', {}, [loopName]),
      h('div.cols3', {}, [
        select({ label: 'Lengde', num: true, options: [[1, '1 takt'], [2, '2 takter'], [4, '4 takter'], [8, '8 takter']], get: function () { return D().loopBars; }, set: function (v) { A.commit(['tracks', 'drums', 'loopBars'], v, { newGroup: true }); } }),
        slider({ label: 'Loopnivå', min: 0, max: 1.2, fmt: pct, get: function () { return D().loopLevel; }, set: function (v) { A.commit(['tracks', 'drums', 'loopLevel'], v); } }),
        h('button.fit', { type: 'button', onclick: function () {
          var L = A.custom.loop; if (!L) { U.toast('Importer en loop først.'); return; }
          var bpm = Math.round(D().loopBars * 240 / L.buffer.duration * 10) / 10;
          if (bpm < 40 || bpm > 240) { U.toast('Prøv en annen lengde i takter.'); return; }
          A.commit(['song', 'bpm'], Math.round(bpm), { newGroup: true }); U.toast('Tempo satt til loopens ' + Math.round(bpm) + ' BPM.');
        } }, ['Sett tempo fra loop'])
      ]),
      h('p.small', { text: 'Loopen deles i slag og startes på hvert slag i takt med grunnpulsen, så den holder tempo også når du endrer det (tonehøyden følger tempoet).' })
    ]);

    var sp = function (k) { return ['synths', 'drums', k]; };
    var sound = h('details.sound', {}, [h('summary', { text: 'Lyd og groove' }), h('div.cols3', {}, [
      slider({ label: 'Swing', min: 0.5, max: 0.75, fmt: function (v) { return Math.round(v * 100) + ' %'; }, get: function () { return S().song.swing; }, set: function (v) { A.commit(['song', 'swing'], v); } }),
      slider({ label: 'Tone (filter)', min: 300, max: 18000, log: true, fmt: hz, get: function () { return S().synths.drums.tone; }, set: function (v) { A.commit(sp('tone'), v); }, mod: { track: 'drums', dest: 'filter', apply: function (b, m) { return b * Math.pow(2, m * 2); } } }),
      slider({ label: 'Drive', min: 0, max: 1, fmt: pct, get: function () { return S().synths.drums.drive; }, set: function (v) { A.commit(sp('drive'), v); } }),
      slider({ label: 'Klang', min: 0, max: 1, fmt: pct, get: function () { return S().synths.drums.reverb; }, set: function (v) { A.commit(sp('reverb'), v); }, mod: { track: 'drums', dest: 'klang', apply: function (b, m) { return b + m * 0.6; } } }),
      slider({ label: 'Ekko', min: 0, max: 1, fmt: pct, get: function () { return S().synths.drums.delay; }, set: function (v) { A.commit(sp('delay'), v); }, mod: { track: 'drums', dest: 'ekko', apply: function (b, m) { return b + m * 0.6; } } }),
      slider({ label: 'Volum', min: 0, max: 1, fmt: pct, get: function () { return D().vol; }, set: function (v) { A.commit(['tracks', 'drums', 'vol'], v); } })
    ])]);

    var mode = seg({ label: 'Kilde', options: [['kit', 'Trommesett'], ['loop', 'Egen loop'], ['both', 'Begge']], get: function () { return D().mode; }, set: function (v) { A.commit(['tracks', 'drums', 'mode'], v, { newGroup: true }); }, disabled: isLocked });
    return trackCard('drums', [h('div.row.modes', {}, [mode]), kitBox, loopBox, sound]);
  }

  /* ---------- bass og synth ---------- */
  var LANES = [['on', 'Slag'], ['deg', 'Tone'], ['oct', 'Oktav'], ['gate', 'Lengde'], ['prob', 'Sjanse']];
  function buildMelodic(id) {
    var T = function () { return S().tracks[id]; };
    var P = function () { return S().synths[id]; };
    var lane = 'on', sel = 0;
    var isLocked = function () { return locked(id); };

    function setStep(i, field, val) {
      A.commit(['tracks', id, 'seq', 'steps', i, field], val);
      var muts = T().mutations;
      if (muts.some(function (m) { return m.type === 'step' && m.i === i && m.field === field; }))
        A.commit(['tracks', id, 'mutations'], muts.filter(function (m) { return !(m.type === 'step' && m.i === i && m.field === field); }), { noHistory: true });
    }
    function laneVal(i) { var s = TS.seq.effectiveSteps(T()).steps[i]; return s[lane]; }
    function bumpVal(i, d, ln) {
      ln = ln || lane;
      var v = TS.seq.effectiveSteps(T()).steps[i][ln];
      if (ln === 'deg') setStep(i, 'deg', clamp(v + d, 0, TS.DEG_MAX));
      else if (ln === 'oct') setStep(i, 'oct', clamp(v + d, -2, 2));
      else if (ln === 'gate') setStep(i, 'gate', clamp(Math.round((v + d * 0.05) * 20) / 20, 0.05, 1));
      else if (ln === 'prob') setStep(i, 'prob', clamp(Math.round((v + d * 0.05) * 20) / 20, 0.05, 1));
      else setStep(i, 'on', d > 0);
      if (ln !== 'on' && !TS.seq.effectiveSteps(T()).steps[i].on) setStep(i, 'on', true);
    }

    var grid = h('div.grid16.big-grid.mel');
    var cells = [];
    for (var i = 0; i < 16; i++) { var c = h('div.cell', { 'data-i': i }, [h('span.cn'), h('span.cbar')]); cells.push(c); grid.appendChild(c); }
    var CYC = { oct: [0, 1, -1], gate: [0.25, 0.5, 0.75, 1], prob: [1, 0.75, 0.5, 0.25] };
    var gridH = {
      locked: isLocked,
      mode: function () { return lane === 'on' ? 'paint' : 'value'; },
      paintStart: function (i) { var on = !TS.seq.effectiveSteps(T()).steps[i].on; setStep(i, 'on', on); return on; },
      paint: function (i, val) { if (i < T().seq.length) setStep(i, 'on', val); },
      select: function (i) { sel = i; U.refresh(); },
      valueOf: function (i) { return laneVal(i); },
      tap: function (i) {
        if (!TS.seq.effectiveSteps(T()).steps[i].on) { setStep(i, 'on', true); return; }
        if (lane === 'deg') return;      // tone: dra opp/ned eller bruk − / +
        var cyc = CYC[lane], v = laneVal(i), k = cyc.findIndex(function (x) { return Math.abs(x - v) < 0.01; });
        setStep(i, lane, cyc[(k + 1) % cyc.length]);
      },
      drag: function (i, v0, dy) {
        var nv;
        if (lane === 'deg') nv = clamp(v0 + Math.round(dy / 12), 0, TS.DEG_MAX);
        else if (lane === 'oct') nv = clamp(v0 + Math.round(dy / 30), -2, 2);
        else nv = clamp(Math.round((v0 + dy / 110) * 20) / 20, 0.05, 1);
        if (nv !== laneVal(i)) setStep(i, lane, nv);
      }
    };
    gridPointer(grid, gridH);

    function noteName(s) {
      var song = S().song;
      return TS.midiName(TS.trackBaseMidi(song, id) + 12 * (P().octave + s.oct) + TS.degreeToSemis(song, s.deg));
    }
    var selInfo = h('span.selinfo');
    function render() {
      var Tt = T(), eff = TS.seq.effectiveSteps(Tt), mut = TS.seq.mutatedSet(Tt), len = Tt.seq.length;
      cells.forEach(function (c, i) {
        var s = eff.steps[i];
        c.classList.toggle('out', i >= len);
        c.classList.toggle('on', s.on); c.classList.toggle('mut', !!mut[i]); c.classList.toggle('sel', i === sel);
        c.classList.toggle('maybe', s.on && s.prob < 1); c.classList.toggle('beat', i % 4 === 0);
        var label = '';
        if (s.on) {
          if (lane === 'oct') label = (s.oct > 0 ? '+' : '') + s.oct;
          else if (lane === 'gate') label = s.gate >= 0.99 ? 'legato' : Math.round(s.gate * 100) + '%';
          else if (lane === 'prob') label = Math.round(s.prob * 100) + '%';
          else label = noteName(s);
        }
        c.firstChild.textContent = label;
        var bh = !s.on ? 0 : lane === 'deg' ? 0.15 + 0.85 * s.deg / TS.DEG_MAX : lane === 'oct' ? (s.oct + 2) / 4 : lane === 'gate' ? s.gate : lane === 'prob' ? s.prob : 0.15 + 0.85 * s.deg / TS.DEG_MAX;
        c.lastChild.style.height = (bh * 100) + '%';
      });
      var s = eff.steps[sel];
      var ln = LANES.find(function (l) { return l[0] === lane; })[1];
      selInfo.textContent = 'Steg ' + (sel + 1) + ': ' + (s.on ? noteName(s) + (s.prob < 1 ? ', ' + Math.round(s.prob * 100) + '% sjanse' : '') : 'pause') + ' · ' + ln;
      rotInfo.textContent = mut.rot ? ' (utvikling: ' + (mut.rot > 0 ? '+' : '') + mut.rot + ')' : '';
    }
    upd.push(render);
    U.ctl[id] = {
      move: function (d) { var len = T().seq.length; sel = ((sel + d) % len + len) % len; U.refresh(); },
      /* ↑↓ endrer tonen i Slag- og Tone-feltet, ellers verdien i valgt felt */
      vert: function (d) { if (isLocked()) return U.toast('Sporet er låst – lås opp for å endre.'); bumpVal(sel, d, lane === 'on' ? 'deg' : lane); },
      enter: function () { if (isLocked()) return U.toast('Sporet er låst – lås opp for å endre.'); gridH.paintStart(sel); },
      lane: function (d) { var k = LANES.findIndex(function (l) { return l[0] === lane; }); lane = LANES[(k + d + LANES.length) % LANES.length][0]; U.refresh(); },
      idea: function () { if (isLocked()) return U.toast('Sporet er låst.'); A.newIdea(id); U.toast('Ny grunnidé for ' + TS.TRACK_NAMES[id].toLowerCase() + ' (angre med ⌘Z).'); },
      where: function () { return 'steg ' + (sel + 1); }
    };
    nowFns.push(function (info) {
      var p = info ? info.ev.pos[id] : -1;
      if (info && p < 0) return;
      cells.forEach(function (c, i) { c.classList.toggle('now', i === p); });
      if (info && info.ev[id].length) { var c = cells[p]; c.classList.remove('hit'); void c.offsetWidth; c.classList.add('hit'); }
    });

    var laneSeg = seg({ options: LANES, get: function () { return lane; }, set: function (v) { lane = v; render(); }, cls: 'lanes' });
    var rotInfo = h('span.small');
    var seqPath = function (k) { return ['tracks', id, 'seq', k]; };
    var seqRow = h('div.seqrow', {}, [
      stepper({ label: 'Lengde', min: 1, max: 16, get: function () { return T().seq.length; }, set: function (v) { A.commit(seqPath('length'), v); }, disabled: isLocked, fmt: function (v) { return v + ' steg'; } }),
      h('div.fld', {}, [h('span', { text: 'Hurtigvalg' }), h('div.seg', {}, [8, 12, 16].map(function (n) {
        return h('button.seg-b', { type: 'button', onclick: function () { if (isLocked()) { U.toast('Sporet er låst – lås opp for å endre.'); return; } A.commit(seqPath('length'), n, { newGroup: true }); } }, [String(n)]);
      }))]),
      seg({ label: 'Stegverdi', options: [[1, '1/16'], [2, '1/8'], [4, '1/4']], get: function () { return T().seq.rate; }, set: function (v) { A.commit(seqPath('rate'), v, { newGroup: true }); }, disabled: isLocked }),
      h('div', {}, [stepper({ label: 'Forskyv', min: -15, max: 15, get: function () { return T().seq.rotate; }, set: function (v) { A.commit(seqPath('rotate'), v); }, disabled: isLocked }), rotInfo]),
      select({ label: 'Start på nytt', num: true, options: [[0, 'Aldri (fri)'], [1, 'Hver takt'], [2, 'Hver 2. takt'], [4, 'Hver 4. takt'], [8, 'Hver 8. takt']], get: function () { return T().seq.reset; }, set: function (v) { A.commit(seqPath('reset'), v, { newGroup: true }); }, disabled: isLocked })
    ]);
    var tools = h('div.row.tools', {}, [
      selInfo,
      h('button.pm', { type: 'button', 'aria-label': 'Ned', onclick: function () { if (isLocked()) return U.toast('Sporet er låst.'); bumpVal(sel, -1); } }, ['−']),
      h('button.pm', { type: 'button', 'aria-label': 'Opp', onclick: function () { if (isLocked()) return U.toast('Sporet er låst.'); bumpVal(sel, 1); } }, ['+']),
      h('button', { type: 'button', onclick: function () { if (isLocked()) return U.toast('Sporet er låst.'); A.newIdea(id); U.toast('Ny grunnidé for ' + TS.TRACK_NAMES[id].toLowerCase() + ' (angre med ↶).'); } }, ['Ny idé'])
    ]);

    var sp = function (k) { return ['synths', id, k]; };
    var WAVES = [['sawtooth', 'Sag'], ['square', 'Firkant'], ['triangle', 'Trekant'], ['sine', 'Sinus']];
    function ps(k, label, min, max, fmt, extra) {
      return slider(Object.assign({ label: label, min: min, max: max, fmt: fmt, get: function () { return P()[k]; }, set: function (v) { A.commit(sp(k), v); } }, extra || {}));
    }
    var sound = h('details.sound', {}, [h('summary', { text: 'Lyd: oscillator, filter, envelope' }),
      h('h4', { text: 'Oscillator' }),
      h('div.cols3', {}, [
        seg({ label: 'Bølge 1', options: WAVES, get: function () { return P().wave; }, set: function (v) { A.commit(sp('wave'), v, { newGroup: true }); } }),
        seg({ label: 'Bølge 2', options: WAVES, get: function () { return P().wave2; }, set: function (v) { A.commit(sp('wave2'), v, { newGroup: true }); } }),
        ps('color', 'Farge (osc 2)', 0, 1, pct, { mod: { track: id, dest: 'farge', apply: function (b, m) { return b + m * 0.5; } } }),
        ps('detune', 'Detune', 0, 50, function (v) { return Math.round(v) + ' cent'; }),
        ps('sub', 'Sub-oscillator', 0, 1, pct),
        ps('octave', 'Oktav', -2, 2, function (v) { return (v > 0 ? '+' : '') + v; }, { step: 1 })
      ]),
      h('h4', { text: 'Filter' }),
      h('div.cols3', {}, [
        ps('cutoff', 'Cutoff', 40, 12000, hz, { log: true, mod: { track: id, dest: 'filter', apply: function (b, m) { return b * Math.pow(2, m * 2); } } }),
        ps('res', 'Resonans', 0, 20, function (v) { return v.toFixed(1) + ' dB'; }),
        ps('envAmt', 'Filter-envelope', 0, 5, function (v) { return v.toFixed(1) + ' okt'; }),
        ps('fdecay', 'Filter-decay', 0.02, 1.5, ms, { log: true })
      ]),
      h('h4', { text: 'Envelope' }),
      h('div.cols3', {}, [
        ps('attack', 'Attack', 0.002, 1, ms, { log: true }),
        ps('decay', 'Decay', 0.02, 2, ms, { log: true, mod: { track: id, dest: 'env', apply: function (b, m) { return b * Math.pow(2, 1.5 * m); } } }),
        ps('sustain', 'Sustain', 0, 1, pct),
        ps('release', 'Release', 0.01, 3, ms, { log: true }),
        ps('glide', 'Glide', 0, 0.3, ms),
        toggle({ label: 'Mono', cls: 'mono', get: function () { return P().mono; }, set: function (v) { A.commit(sp('mono'), v, { newGroup: true }); } })
      ]),
      h('h4', { text: 'Miks og effekt' }),
      h('div.cols3', {}, [
        ps('drive', 'Drive', 0, 1, pct),
        slider({ label: 'Volum', min: 0, max: 1, fmt: pct, get: function () { return T().vol; }, set: function (v) { A.commit(['tracks', id, 'vol'], v); } }),
        ps('reverb', 'Klang', 0, 1, pct, { mod: { track: id, dest: 'klang', apply: function (b, m) { return b + m * 0.6; } } }),
        ps('delay', 'Ekko', 0, 1, pct, { mod: { track: id, dest: 'ekko', apply: function (b, m) { return b + m * 0.6; } } }),
        ps('pan', 'Panorering', -1, 1, function (v) { return Math.abs(v) < 0.02 ? 'midt' : (v < 0 ? 'V ' : 'H ') + Math.round(Math.abs(v) * 100); }, { mod: { track: id, dest: 'pan', apply: function (b, m) { return b + m * 0.9; } } })
      ])
    ]);
    return trackCard(id, [seqRow, h('div.lanehead', {}, [laneSeg]), grid, tools, sound]);
  }

  /* ---------- modulasjon ---------- */
  function buildMod() {
    var M = function () { return S().modulation; };
    var srcMeters = {};
    function srcRow(key, name, controls, desc) {
      var m = meter(); srcMeters[key] = m;
      return h('div.src', {}, [h('div.src-h', {}, [h('b', { text: name }), m]), h('div.src-c', {}, controls), h('div.small', { text: desc })]);
    }
    var sources = h('div.sources', {}, [
      srcRow('lfo', 'LFO', [
        select({ label: 'Form', options: Object.keys(TS.seq.SHAPES).map(function (k) { return [k, TS.seq.SHAPES[k]]; }), get: function () { return M().lfo.shape; }, set: function (v) { A.commit(['modulation', 'lfo', 'shape'], v, { newGroup: true }); } }),
        select({ label: 'Periode', num: true, options: [[0.25, '1/4 takt'], [0.5, '1/2 takt'], [1, '1 takt'], [2, '2 takter'], [4, '4 takter'], [8, '8 takter']], get: function () { return M().lfo.bars; }, set: function (v) { A.commit(['modulation', 'lfo', 'bars'], v, { newGroup: true }); } })
      ], 'Jevn, taktfast svingning.'),
      srcRow('drift', 'Drift', [
        select({ label: 'Periode', num: true, options: [[4, '4 takter'], [8, '8 takter'], [16, '16 takter'], [32, '32 takter'], [64, '64 takter']], get: function () { return M().drift.bars; }, set: function (v) { A.commit(['modulation', 'drift', 'bars'], v, { newGroup: true }); } })
      ], 'Langsom, myk tilfeldig bevegelse (følger frøet).'),
      srcRow('chance', 'Sjanse', [
        select({ label: 'Ny verdi', num: true, options: [[0.5, 'hver 1/2 takt'], [1, 'hver takt'], [2, 'hver 2. takt'], [4, 'hver 4. takt']], get: function () { return M().chance.bars; }, set: function (v) { A.commit(['modulation', 'chance', 'bars'], v, { newGroup: true }); } })
      ], 'Trinnvis tilfeldig verdi (følger frøet).')
    ]);

    var routesBox = h('div.routes');
    var routeMeters = [];
    function buildRoutes() {
      routesBox.innerHTML = ''; routeMeters = [];
      M().routes.forEach(function (r, i) {
        var rp = function (k) { return ['modulation', 'routes', i, k]; };
        var desc = h('div.small.rdesc');
        var m = meter(); routeMeters.push(m);
        var row = h('div.route', {}, [
          h('div.route-top', {}, [
            toggle({ label: 'På', cls: 'ron', get: function () { return M().routes[i].on; }, set: function (v) { A.commit(rp('on'), v, { newGroup: true }); } }),
            select({ options: Object.keys(TS.seq.SOURCES).map(function (k) { return [k, TS.seq.SOURCES[k]]; }), get: function () { return M().routes[i].src; }, set: function (v) { A.commit(rp('src'), v, { newGroup: true }); }, label: '' }),
            h('span.arrow', { text: '→' }),
            select({ options: TS.TRACKS.map(function (k) { return [k, TS.TRACK_NAMES[k]]; }), get: function () { return M().routes[i].track; }, set: function (v) { A.commit(rp('track'), v, { newGroup: true }); }, label: '' }),
            select({ options: Object.keys(TS.seq.DESTS).map(function (k) { return [k, TS.seq.DESTS[k].name]; }), get: function () { return M().routes[i].dest; }, set: function (v) { A.commit(rp('dest'), v, { newGroup: true }); }, label: '' }),
            m
          ]),
          slider({ label: 'Mengde', min: -1, max: 1, step: 0.01, fmt: function (v) { return (v > 0 ? '+' : '') + Math.round(v * 100) + ' %'; }, get: function () { return M().routes[i].depth; }, set: function (v) { A.commit(rp('depth'), v); } }),
          desc
        ]);
        upd.push(function () {
          var r2 = M().routes[i]; if (!r2) return;
          row.classList.toggle('inactive', !r2.on);
          var dst = TS.seq.DESTS[r2.dest];
          var note = (r2.track === 'drums' && (r2.dest === 'env' || r2.dest === 'farge' || r2.dest === 'pan')) ? ' (har ingen virkning på trommer)' : '';
          desc.textContent = 'Påvirker: ' + TS.TRACK_NAMES[r2.track] + ' – ' + dst.what + note + '. Bevegelse på sporet skalerer mengden.';
        });
        routesBox.appendChild(row);
      });
    }
    buildRoutes();

    function varBox(id) {
      var vp = function (k) { return ['modulation', 'variation', id, k]; };
      var V = function () { return M().variation[id]; };
      var w = function (k, label) { return slider({ label: label, min: 0, max: 1, fmt: pct, get: function () { return V()[k]; }, set: function (v) { A.commit(vp(k), v); } }); };
      return h('div.varbox.t-' + id, {}, [
        h('h4', {}, [h('span.tdot'), TS.TRACK_NAMES[id] + ': kontrollert variasjon']),
        slider({ label: 'Hvor ofte', min: 0, max: 0.6, fmt: function (v) { return Math.round(v * 100) + ' % av slagene'; }, get: function () { return V().rate; }, set: function (v) { A.commit(vp('rate'), v); }, hint: 'Ved middels bevegelse. Første steg blir aldri pause, og alt spilles i skala.' }),
        h('div.cols4', {}, [w('oct', '→ Oktav'), w('len', '→ Notelengde'), w('rest', '→ Pause'), w('nabo', '→ Nabotone')])
      ]);
    }

    modFns.push(function (mods) {
      if (!mods) { Object.keys(srcMeters).forEach(function (k) { srcMeters[k].set(0); }); routeMeters.forEach(function (m) { m.set(0); }); return; }
      Object.keys(srcMeters).forEach(function (k) { srcMeters[k].set(mods.src[k]); });
      routeMeters.forEach(function (m, i) { m.set(mods.routes[i] || 0); });
    });

    return h('section.panel.mod', { id: 'mod' }, [
      h('h2', { text: 'Modulasjon' }),
      h('p.small', { text: 'Tre kilder og seks forbindelser. Målerne viser hva hver forbindelse gjør akkurat nå, og ∿-merket i lydpanelet viser hvor verdien er flyttet til.' }),
      sources, h('h3', { text: 'Forbindelser' }), routesBox,
      h('h3', { text: 'Variasjon' }), varBox('bass'), varBox('synth')
    ]);
  }

  /* ---------- utvikling og frø ---------- */
  function buildEvo() {
    var status = h('p.evo-status');
    var logEl = h('ol.evolog');
    var seedIn = h('input.seed', { type: 'number', inputmode: 'numeric', min: 0, max: 999999, 'aria-label': 'Frø' });
    seedIn.addEventListener('change', function () { A.commit(['song', 'seed'], clamp(Math.floor(+seedIn.value || 0), 0, 999999), { newGroup: true }); });
    upd.push(function () {
      if (document.activeElement !== seedIn) seedIn.value = S().song.seed;
      var s = S(), iv = TS.seq.evoInterval(s), el = TS.seq.evoEligible(s);
      if (!s.song.evolve) status.textContent = 'Utviklingen står stille. Musikken går i løkke med variasjon og modulasjon.';
      else if (s.song.freeze) status.textContent = 'Tilfeldigheten er fryst: variasjonen gjentas likt hver runde, og utviklingen venter.';
      else if (!el.length) status.textContent = 'Ingen spor kan utvikles (låst, eller bevegelse på null).';
      else status.textContent = 'Én liten endring hver ' + iv + '. takt, ett spor om gangen (' + el.map(function (x) { return TS.TRACK_NAMES[x]; }).join(', ') + '). Neste om ' + Math.max(1, iv - (s.runtime.barsSince || 0)) + ' takt(er).';
    });
    function renderLog() {
      logEl.innerHTML = '';
      A.evoLog.forEach(function (e) { logEl.appendChild(h('li.t-' + e.track, {}, [h('span.tdot'), 'Takt ' + (e.bar + 1) + ' · ' + TS.TRACK_NAMES[e.track] + ': ' + e.text])); });
      if (!A.evoLog.length) logEl.appendChild(h('li.small', { text: 'Ingen endringer ennå.' }));
    }
    nowFns.push(function (info) { if (info && info.evo) { renderLog(); U.refresh(); } });
    renderLog();
    return h('section.panel.evo', { id: 'evo' }, [
      h('h2', { text: 'Utvikling og tilfeldighet' }),
      h('div.row', {}, [
        toggle({ label: 'Utvikling', cls: 'evo-on', get: function () { return S().song.evolve; }, set: function (v) { A.commit(['song', 'evolve'], v, { newGroup: true }); }, text: function (v) { return v ? 'Utvikling: på' : 'Utvikling: av'; } }),
        toggle({ label: 'Frys tilfeldighet', cls: 'freeze', get: function () { return S().song.freeze; }, set: function (v) { A.commit(['song', 'freeze'], v, { newGroup: true }); }, text: function (v) { return v ? 'Tilfeldighet: fryst' : 'Frys tilfeldighet'; } })
      ]),
      h('div.row', {}, [
        h('label.fld.seedfld', {}, [h('span', { text: 'Frø' }), seedIn]),
        h('button', { type: 'button', onclick: function () { A.commit(['song', 'seed'], Math.floor(Math.random() * 999999), { newGroup: true }); } }, ['Nytt frø']),
        h('button', { type: 'button', onclick: function () { A.resetEvolution(); renderLog(); U.toast('Utviklingen er nullstilt.'); } }, ['Nullstill utvikling'])
      ]),
      status,
      h('p.small', { text: 'Alle tilfeldige valg kommer fra frøet. Stopp, trykk «Nullstill utvikling» og spill igjen: samme frø gir nøyaktig samme forløp. Utviklingen endrer ett spor om gangen og trekker seg gradvis tilbake mot grunnideen.' }),
      logEl
    ]);
  }

  /* ---------- fil og eksport ---------- */
  var sheet;
  function openSheet() { sheet.hidden = false; renderRecs(); renderResult(); }
  function closeSheet() { sheet.hidden = true; }
  U.openSheet = openSheet; U.closeSheet = closeSheet;
  U.sheetOpen = function () { return sheet && !sheet.hidden; };
  U.saveProject = function (withSamples) {
    var name = 'trespor-' + new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-') + '.json';
    TS.files.download(JSON.stringify(A.projectObject(withSamples !== false), null, 1), name, 'application/json');
    U.toast('Prosjektfil lagret: ' + name);
  };
  var recList, resultBox, progress, busy = false;
  function renderRecs() {
    recList.innerHTML = '';
    if (!A.recordings.length) recList.appendChild(h('p.small', { text: 'Ingen opptak ennå. Trykk «Opptak» øverst: opptaket starter på neste taktstart og husker alt du skrur på.' }));
    A.recordings.forEach(function (r, i) {
      var takter = Math.round(r.steps / 16);
      recList.appendChild(h('div.rec-item', {}, [
        h('div', {}, [h('b', { text: r.name }), h('span.small', { text: ' · ' + takter + ' takter · ' + r.changes.length + ' kontrollendringer' })]),
        h('div.row', {}, [
          h('button.primary', { type: 'button', onclick: function () { runRender(function (p) { return A.renderRecording(i, p); }); } }, ['Render og eksporter']),
          h('button', { type: 'button', onclick: function () { if (confirm('Slette ' + r.name + '?')) A.deleteRecording(i); } }, ['Slett'])
        ])
      ]));
    });
  }
  function runRender(fn) {
    if (busy) return;
    busy = true; progress.hidden = false; progress.value = 0;
    resultBox.innerHTML = ''; resultBox.appendChild(h('p.small', { text: 'Rendrer … (miks og stems i én omgang)' }));
    var t0 = Date.now();
    fn(function (p) { progress.value = p; }).then(function () {
      busy = false; progress.hidden = true; renderResult();
      U.toast('Ferdig på ' + ((Date.now() - t0) / 1000).toFixed(1) + ' s.');
    }).catch(function (e) {
      busy = false; progress.hidden = true;
      resultBox.innerHTML = ''; resultBox.appendChild(h('p.err', { text: 'Rendering feilet: ' + (e && e.message || e) }));
    });
  }
  function renderResult() {
    var r = A.exportResult;
    if (!r || busy) return;
    resultBox.innerHTML = '';
    var f = r.files;
    function dl(k, label) {
      var size = (f[k].data.length / 1048576).toFixed(1);
      return h('button', { type: 'button', onclick: function () { TS.files.download(f[k].data, f[k].name, f[k].mime); } }, [label, h('span.small', { text: ' ' + size + ' MB' })]);
    }
    var mm = Math.floor(r.duration / 60), ss = Math.round(r.duration % 60);
    resultBox.appendChild(h('p', {}, [h('b', { text: r.base }), h('span.small', { text: ' · ' + mm + ':' + (ss < 10 ? '0' : '') + ss + ' · WAV 24-bit 44,1 kHz' })]));
    resultBox.appendChild(h('div.dl', {}, [
      dl('mix', 'Samlet WAV'), dl('drums', 'Trommer WAV'), dl('bass', 'Bass WAV'), dl('synth', 'Synth WAV'), dl('midi', 'MIDI'),
      h('button.primary', { type: 'button', onclick: function () { TS.files.download(A.zipExport(), r.base + '.zip', 'application/zip'); } }, ['Alt i én .zip']),
      TS.files.canShareFiles() ? h('button', { type: 'button', onclick: function () {
        TS.files.share(['mix', 'drums', 'bass', 'synth', 'midi'].map(function (k) { return f[k]; })).catch(function () {});
      } }, ['Del / Lagre i Filer']) : null
    ]));
  }
  function buildSheet() {
    var withSamples = h('input', { type: 'checkbox', checked: true });
    var projIn = h('input', { type: 'file', accept: '.json,application/json', hidden: true });
    projIn.addEventListener('change', function () {
      var f = projIn.files[0]; if (!f) return;
      f.text().then(function (txt) { return A.loadProject(JSON.parse(txt)); })
        .then(function () { U.toast('Prosjekt åpnet: ' + f.name); renderRecs(); })
        .catch(function (e) { U.toast('Kunne ikke åpne: ' + (e.message || e)); });
      projIn.value = '';
    });
    var bars = h('select', { 'aria-label': 'Antall takter' }, [4, 8, 16, 32, 64].map(function (b) { return h('option', { value: b, text: b + ' takter' }); }));
    bars.value = '16';
    recList = h('div.recs'); resultBox = h('div.result');
    progress = h('progress', { max: 1, value: 0, hidden: true });
    sheet = h('div.sheet', { hidden: true, role: 'dialog', 'aria-label': 'Fil og eksport', onclick: function (e) { if (e.target === sheet) closeSheet(); } }, [
      h('div.sheet-in', {}, [
        h('div.sheet-h', {}, [h('h2', { text: 'Fil og eksport' }), h('button.icon', { type: 'button', onclick: closeSheet, 'aria-label': 'Lukk' }, ['×'])]),
        h('h3', { text: 'Prosjekt' }),
        h('p.small', { text: 'Prosjektfila (.json) lagrer noter, synthinnstillinger og modulasjon i hver sin seksjon, sammen med frø, snapshots og opptak, så både musikken og klangutviklingen kan gjenskapes.' }),
        h('div.row', {}, [
          h('button.primary', { type: 'button', onclick: function () { U.saveProject(withSamples.checked); } }, ['Lagre prosjektfil']),
          h('button', { type: 'button', onclick: function () { projIn.click(); } }, ['Åpne prosjektfil …']), projIn,
          h('label.chk', {}, [withSamples, ' Ta med egne samples'])
        ]),
        h('div.row', {}, [h('button', { type: 'button', onclick: function () { if (confirm('Starte et nytt prosjekt fra standardoppsettet? (Kan angres.)')) A.newProject(); } }, ['Nytt prosjekt'])]),
        h('h3', { text: 'Eksporter løkke' }),
        h('p.small', { text: 'Rendrer nåværende tilstand fra takt 1, med utvikling og modulasjon slik den ville spilt.' }),
        h('div.row', {}, [bars, h('button.primary', { type: 'button', onclick: function () { runRender(function (p) { return A.renderLoop(+bars.value, p); }); } }, ['Render'])]),
        h('h3', { text: 'Opptak' }), recList,
        h('h3', { text: 'Resultat' }), progress, resultBox,
        h('p.small', { text: 'Stems: trommer, bass og synth, hver med egen klang og ekko, før masterkompressoren. Summen tilsvarer miksen. MIDI: tre spor (trommer på kanal 10, GM-noter), tempo og swing med. En importert trommeloop er lyd og kommer ikke med i MIDI.' })
      ])
    ]);
    A.on('recordings', renderRecs);
    return sheet;
  }

  /* ---------- animasjon ---------- */
  var vq = [], cur = null, lastDrawn = null;
  A.on('step', function (info) { vq.push(info); if (vq.length > 400) vq.shift(); });
  A.on('transport', function () { if (!A.playing) { vq = []; cur = null; nowFns.forEach(function (f) { f(null); }); modFns.forEach(function (f) { f(null); }); } });
  function frame() {
    requestAnimationFrame(frame);
    if (!A.ctx) return;
    var t = A.ctx.currentTime;
    while (vq.length && vq[0].time <= t) cur = vq.shift();
    if (A.playing && cur && cur !== lastDrawn) {
      lastDrawn = cur;
      nowFns.forEach(function (f) { f(cur); });
      modFns.forEach(function (f) { f(cur.mods); });
    }
    if (A.rec) {
      var secs = Math.max(0, t - A.rec.startTime);
      U.recTxt.textContent = '● ' + Math.floor(secs / 60) + ':' + ('0' + Math.floor(secs % 60)).slice(-2);
    }
    drawScope();
  }
  var scopeBuf = null;
  function drawScope() {
    var cv = U.scope, an = A.engine && A.engine.analyser; if (!cv || !an) return;
    var g = cv.getContext('2d'), w = cv.width, hgt = cv.height;
    if (!scopeBuf) scopeBuf = new Float32Array(an.fftSize);
    an.getFloatTimeDomainData(scopeBuf);
    g.clearRect(0, 0, w, hgt);
    g.strokeStyle = getComputedStyle(cv).color; g.lineWidth = 2; g.beginPath();
    for (var i = 0; i < w; i++) { var v = scopeBuf[Math.floor(i / w * scopeBuf.length)]; var y = hgt / 2 - v * hgt * 0.45; i ? g.lineTo(i, y) : g.moveTo(i, y); }
    g.stroke();
  }

  U.refresh = function () { upd.forEach(function (f) { f(); }); };

  U.init = function () {
    var app = document.getElementById('app');
    app.innerHTML = '';
    app.appendChild(buildTop());
    app.appendChild(h('main.layout', {}, [
      h('div.col.left', {}, [buildMacros(), buildMod(), buildEvo()]),
      h('div.col.right', {}, [buildDrums(), buildMelodic('bass'), buildMelodic('synth')])
    ]));
    app.appendChild(buildSheet());
    app.appendChild(h('div#toast', { role: 'status', 'aria-live': 'polite' }));
    A.on('change', function () { U.refresh(); });
    A.on('pending', function () { U.toast('Bytter ved neste takt …'); });
    U.refresh();
    requestAnimationFrame(frame);

    if (TS.keys) TS.keys.init();
  };
})(typeof window !== 'undefined' ? window : globalThis);
