/* Vokalypse – grensesnitt, avspilling og eksport. */
(function (VK) {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const store = {
    get: (k, d) => { try { const v = localStorage.getItem('vokalypse.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: (k, v) => { try { localStorage.setItem('vokalypse.' + k, JSON.stringify(v)); } catch (e) { /* privat modus o.l. */ } },
    del: (k) => { try { localStorage.removeItem('vokalypse.' + k); } catch (e) { /* ignorer */ } }
  };

  // ---------------- Tilstand ----------------
  const state = {
    settings: Object.assign({
      bpm: 124, root: 9, scale: 'minor', style: 'house', density: 1, swing: 0, fx: 0.5, fold: true,
      ingredients: { phrase: true, chop: true, stutter: true, choir: true, whisper: true, reverse: true, dive: true, robot: false }
    }, store.get('settings', {})),
    current: null,      // {n, seed, colorSeed, settings, events, form, clipIds}
    rendered: null,     // {wet:{channels}, dry:{channels}, guide:AudioBuffer}
    history: [],
    counter: 0,
    listen: 'wet',
    busy: false
  };

  function showErr(msg) { $('err').textContent = msg || ''; }

  // ---------------- Avspilling ----------------
  const Player = {
    ctx: null, nodes: null, startAt: 0, offset: 0, playing: false, length: 0, oneShot: null,
    ensure: function () {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AC();
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return this.ctx;
    },
    buffers: function () {
      const r = state.rendered;
      if (!r) return null;
      if (!r.wetBuf) r.wetBuf = VK.DSP.makeBuffer(r.wet.channels);
      if (!r.dryBuf) r.dryBuf = VK.DSP.makeBuffer(r.dry.channels);
      return { wet: r.wetBuf, dry: r.dryBuf, guide: r.guide };
    },
    position: function () {
      if (!this.playing) return this.offset;
      return (this.ctx.currentTime - this.startAt + this.offset) % this.length;
    },
    start: function (fromSec) {
      const b = this.buffers();
      if (!b) return;
      const ctx = this.ensure();
      this.stopNodes();
      this.length = b.wet.duration;
      const off = ((fromSec != null ? fromSec : this.offset) % this.length + this.length) % this.length;
      const when = ctx.currentTime + 0.05;
      const mk = (buf, gain) => {
        const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true;
        const g = ctx.createGain(); g.gain.value = gain;
        s.connect(g).connect(ctx.destination);
        s.start(when, off);
        return { s: s, g: g };
      };
      this.nodes = {
        wet: mk(b.wet, state.listen === 'wet' ? 1 : 0),
        dry: mk(b.dry, state.listen === 'dry' ? 1 : 0),
        guide: b.guide ? mk(b.guide, $('guide').checked ? 0.55 : 0) : null
      };
      this.startAt = when; this.offset = off; this.playing = true;
      $('play').textContent = '■ Stopp';
    },
    stopNodes: function () {
      if (this.nodes) for (const k in this.nodes) { const n = this.nodes[k]; if (n) { try { n.s.stop(); } catch (e) { /* allerede stoppet */ } n.s.disconnect(); } }
      this.nodes = null;
    },
    stop: function () {
      if (this.playing) this.offset = this.position();
      this.stopNodes();
      this.playing = false;
      this.offset = 0;
      $('play').textContent = '▶ Spill';
    },
    mix: function () {
      if (!this.nodes) return;
      const t = this.ctx.currentTime;
      this.nodes.wet.g.gain.setTargetAtTime(state.listen === 'wet' ? 1 : 0, t, 0.01);
      this.nodes.dry.g.gain.setTargetAtTime(state.listen === 'dry' ? 1 : 0, t, 0.01);
      if (this.nodes.guide) this.nodes.guide.g.gain.setTargetAtTime($('guide').checked ? 0.55 : 0, t, 0.01);
    },
    // Bytt lyd uten å miste posisjonen (ved ny rendering mens det spilles)
    reload: function () { if (this.playing) { const p = this.position(); this.start(p); } },
    preview: function (buffer) {
      const ctx = this.ensure();
      if (this.oneShot) { try { this.oneShot.stop(); } catch (e) { /* ok */ } }
      const s = ctx.createBufferSource(); s.buffer = buffer; s.connect(ctx.destination); s.start();
      this.oneShot = s;
    }
  };

  // ---------------- Innstillinger-UI ----------------
  function buildSettings() {
    const st = state.settings;
    const root = $('root');
    VK.NOTE_NAMES.forEach((n, i) => { const o = document.createElement('option'); o.value = i; o.textContent = n; root.appendChild(o); });
    const scale = $('scale');
    for (const k in VK.SCALES) { const o = document.createElement('option'); o.value = k; o.textContent = VK.SCALES[k].name; scale.appendChild(o); }
    $('bpm').value = st.bpm; root.value = st.root; scale.value = st.scale;
    $('density').value = st.density; $('swing').value = Math.round(st.swing * 100); $('fx').value = Math.round(st.fx * 100);
    $('fold').value = st.fold ? '1' : '0';
    setSeg('style', st.style);
    const ing = $('ingredients');
    const legend = $('typelegend');
    for (const k in VK.Arranger.TYPES) {
      const T = VK.Arranger.TYPES[k];
      const c = document.createElement('span');
      c.className = 'chip' + (st.ingredients[k] ? ' on' : '');
      c.style.setProperty('--chip', T.color);
      c.textContent = T.name; c.dataset.k = k;
      c.onclick = () => {
        st.ingredients[k] = !st.ingredients[k];
        c.classList.toggle('on', st.ingredients[k]);
        settingsChanged(true);
      };
      ing.appendChild(c);
      const l = document.createElement('span');
      l.innerHTML = '<i style="background:' + T.color + '"></i>' + T.name;
      legend.appendChild(l);
    }
    updateLabels();

    $('bpm').addEventListener('change', () => {
      let v = parseFloat($('bpm').value);
      if (!isFinite(v)) v = 124;
      v = VK.clamp(Math.round(v * 2) / 2, 60, 200);
      $('bpm').value = v; st.bpm = v; settingsChanged(false);
    });
    root.addEventListener('change', () => { st.root = +root.value; settingsChanged(false); });
    scale.addEventListener('change', () => { st.scale = scale.value; settingsChanged(false); });
    $('density').addEventListener('input', () => { st.density = +$('density').value; updateLabels(); });
    $('density').addEventListener('change', () => settingsChanged(true));
    $('swing').addEventListener('input', () => { st.swing = $('swing').value / 100; updateLabels(); });
    $('swing').addEventListener('change', () => settingsChanged(false));
    $('fx').addEventListener('input', () => { st.fx = $('fx').value / 100; updateLabels(); });
    $('fx').addEventListener('change', () => settingsChanged(false));
    $('fold').addEventListener('change', () => { st.fold = $('fold').value === '1'; settingsChanged(false); });
    segHandler('style', (v) => {
      st.style = v;
      // stilen foreslår swing (house) – men bare hvis brukeren ikke har rørt swing
      if (v === 'house' && st.swing === 0) { st.swing = VK.Arranger.STYLES.house.swing; $('swing').value = Math.round(st.swing * 100); }
      if (v !== 'house' && Math.abs(st.swing - VK.Arranger.STYLES.house.swing) < 1e-9) { st.swing = 0; $('swing').value = 0; }
      updateLabels();
      settingsChanged(true);
    });
  }

  function updateLabels() {
    const st = state.settings;
    $('dens-l').textContent = VK.Arranger.DENSITY[st.density].name;
    $('swing-l').textContent = Math.round(st.swing * 100) + ' %';
    $('fx-l').textContent = Math.round(st.fx * 100) + ' %';
    updateExportInfo();
  }

  function setSeg(id, v) { for (const b of $(id).querySelectorAll('button')) b.classList.toggle('on', b.dataset.v === v); }
  function segHandler(id, fn) {
    $(id).addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      setSeg(id, b.dataset.v); fn(b.dataset.v);
    });
  }

  let settingsTimer = null;
  // Endrede innstillinger: lag samme variasjon på nytt (samme frø) med nye verdier
  function settingsChanged(structural) {
    store.set('settings', state.settings);
    updateExportInfo();
    if (!state.current) return;
    clearTimeout(settingsTimer);
    settingsTimer = setTimeout(() => {
      generate({ seed: state.current.seed, colorSeed: state.current.colorSeed, replace: true });
    }, structural ? 150 : 250);
  }

  function updateExportInfo() {
    const t = VK.timing(state.settings.bpm);
    $('exportinfo').innerHTML =
      '<span>WAV · <b>24-bit</b> · <b>48 kHz</b> · stereo</span>' +
      '<span>16 takter @ ' + VK.fmtNum(state.settings.bpm, state.settings.bpm % 1 ? 1 : 0) + ' BPM = <b>' + VK.fmtNum(t.totalSamples) + '</b> samples (' + VK.fmtNum(t.totalSec, 3) + ' s)' +
      (t.isExact ? '' : ' · rundet til nærmeste sample, avvik ' + VK.fmtNum(Math.abs(t.exactSamples - t.totalSamples) / VK.SR * 1e6, 1) + ' µs') + '</span>';
  }

  // ---------------- Generering ----------------
  function setBusy(on, label) {
    state.busy = on;
    $('busy').classList.toggle('on', on);
    $('busy').textContent = label || 'RENDRER …';
    for (const id of ['gen', 'recolor']) $(id).disabled = on;
  }

  let genQueued = null;
  async function generate(opts) {
    opts = opts || {};
    if (state.busy) { genQueued = opts; return; }
    showErr('');
    const clips = VK.Pool.enabled();
    if (!clips.length) { showErr('Du har ingen aktive klipp. Legg til råmateriale til venstre først. Raskest er «Syntetisk» → «Lag startpakke».'); return; }
    const seed = opts.seed != null ? opts.seed : VK.newSeed();
    const colorSeed = opts.colorSeed != null ? opts.colorSeed : VK.newSeed();
    const settings = JSON.parse(JSON.stringify(state.settings));
    setBusy(true);
    await new Promise((r) => setTimeout(r, 20));
    try {
      const arr = VK.Arranger.arrange(settings, clips, seed, colorSeed);
      const n = opts.replace && state.current ? state.current.n : ++state.counter;
      const variation = { n: n, seed: seed, colorSeed: colorSeed, settings: settings, events: arr.events, form: arr.form, clipIds: clips.map((c) => c.id) };
      await renderVariation(variation);
      if (opts.replace && state.current) {
        const i = state.history.findIndex((h) => h.n === state.current.n);
        if (i >= 0) state.history[i] = variation; else state.history.push(variation);
      } else {
        state.history.push(variation);
        if (state.history.length > 12) state.history.shift();
      }
      state.current = variation;
      drawHistory();
    } catch (e) {
      console.error(e);
      showErr('Noe gikk galt under genereringen: ' + (e && e.message ? e.message : e));
    } finally {
      setBusy(false);
      if (genQueued) { const q = genQueued; genQueued = null; generate(q); }
    }
  }

  async function renderVariation(variation) {
    const byId = VK.Pool.byId();
    const t0 = performance.now();
    const fold = variation.settings.fold !== false;
    const wet = await VK.Render.render(variation, byId, { wet: true, fold: fold });
    const dry = await VK.Render.render(variation, byId, { wet: false, fold: fold });
    let guide = state.rendered && state.rendered.guideBpm === variation.settings.bpm ? state.rendered.guide : null;
    if (!guide) guide = await VK.Render.renderGuide(variation.settings.bpm);
    state.rendered = { wet: wet, dry: dry, guide: guide, guideBpm: variation.settings.bpm, ms: performance.now() - t0, variation: variation };
    state.current = variation;
    peaksCache = null;
    Player.reload();
    drawWave();
    updateInfo();
    for (const id of ['dl-wet', 'dl-dry', 'dl-credits']) $(id).disabled = false;
  }

  function updateInfo() {
    const v = state.current, r = state.rendered;
    if (!v || !r) { $('info').innerHTML = ''; return; }
    const t = VK.timing(v.settings.bpm);
    let occupied = 0;
    for (const e of v.events) occupied += e.lenSteps;
    const pct = Math.round(100 * occupied / VK.TOTAL_STEPS);
    $('info').innerHTML =
      '<span>#<b>' + v.n + '</b></span>' +
      '<span>form <b>' + v.form + '</b></span>' +
      '<span><b>' + v.events.length + '</b> innslag · vokal i ca. <b>' + pct + ' %</b> av tiden</span>' +
      '<span>' + VK.fmtNum(v.settings.bpm, v.settings.bpm % 1 ? 1 : 0) + ' BPM · ' + VK.keyLabel(v.settings.root, v.settings.scale) + '</span>' +
      '<span>frø ' + v.seed + '/' + v.colorSeed + '</span>' +
      '<span>' + VK.fmtNum(t.totalSec, 2) + ' s · rendret på ' + Math.round(r.ms) + ' ms</span>' +
      (r.wet.silent ? '<span style="color:var(--bad)">stille resultat. Prøv andre klipp.</span>' : '');
  }

  function drawHistory() {
    const h = $('history');
    h.innerHTML = '';
    for (const v of state.history.slice().reverse()) {
      const b = document.createElement('button');
      b.className = 'btn small' + (state.current && v.n === state.current.n ? ' on' : '');
      b.textContent = '#' + v.n + ' · ' + VK.fmtNum(v.settings.bpm, v.settings.bpm % 1 ? 1 : 0) + ' · ' + VK.keyLabel(v.settings.root, v.settings.scale) + ' · ' + VK.Arranger.DENSITY[v.settings.density].name.toLowerCase();
      b.onclick = async () => {
        if (state.busy) return;
        const missing = v.clipIds.filter((id) => !VK.Pool.byId().has(id));
        if (missing.length === v.clipIds.length) { showErr('Klippene til denne variasjonen er fjernet.'); return; }
        // gjenopprett innstillingene den ble laget med
        Object.assign(state.settings, JSON.parse(JSON.stringify(v.settings)));
        reflectSettings();
        setBusy(true);
        try { await renderVariation(v); } catch (e) { showErr(String(e.message || e)); }
        setBusy(false);
        drawHistory();
      };
      h.appendChild(b);
    }
  }

  function reflectSettings() {
    const st = state.settings;
    $('bpm').value = st.bpm; $('root').value = st.root; $('scale').value = st.scale;
    $('density').value = st.density; $('swing').value = Math.round(st.swing * 100); $('fx').value = Math.round(st.fx * 100);
    $('fold').value = st.fold ? '1' : '0';
    setSeg('style', st.style);
    for (const c of $('ingredients').children) c.classList.toggle('on', !!st.ingredients[c.dataset.k]);
    updateLabels();
    store.set('settings', st);
  }

  // ---------------- Bølgeform ----------------
  let peaksCache = null;
  function drawWave() {
    const cv = $('wave');
    const dpr = window.devicePixelRatio || 1;
    const W = cv.clientWidth, H = cv.clientHeight;
    if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); peaksCache = null; }
    const g = cv.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    const lane = 30, top = lane + 4, wh = H - top - 14;
    // takter
    for (let b = 0; b <= 16; b++) {
      const x = Math.round(b / 16 * W) + 0.5;
      g.strokeStyle = b % 4 === 0 ? '#34383e' : '#1f2226';
      g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke();
      if (b < 16) { g.fillStyle = b % 4 === 0 ? '#8a8880' : '#55544f'; g.font = '10px ui-monospace, Menlo, monospace'; g.fillText(String(b + 1), x + 4, H - 3); }
    }
    for (let q = 0; q < 64; q++) {
      if (q % 4 === 0) continue;
      const x = Math.round(q / 64 * W) + 0.5;
      g.strokeStyle = '#16181b'; g.beginPath(); g.moveTo(x, top); g.lineTo(x, top + wh); g.stroke();
    }
    const r = state.rendered;
    if (!r) {
      g.fillStyle = '#55544f'; g.font = '13px -apple-system, sans-serif';
      g.fillText('Legg til råmateriale, og trykk «Ny variasjon».', 14, top + wh / 2);
      return;
    }
    // innslag
    const v = state.current;
    const t = VK.timing(v.settings.bpm);
    for (const ev of v.events) {
      const x0 = ev.step / VK.TOTAL_STEPS * W;
      const w = Math.max(3, ev.lenSteps / VK.TOTAL_STEPS * W);
      g.fillStyle = VK.Arranger.TYPES[ev.type].color;
      g.globalAlpha = 0.85;
      g.fillRect(x0, 6, w - 1, lane - 10);
      g.globalAlpha = 1;
      if (w > 22) { g.fillStyle = '#0e0f11'; g.font = '600 10px ui-monospace, Menlo, monospace'; g.fillText(ev.motif || '', x0 + 3, 19); }
    }
    // bølgeform
    const ch = r[state.listen].channels;
    if (!peaksCache || peaksCache.key !== state.listen + W) {
      const n = ch[0].length, cols = Math.floor(W), per = n / cols;
      const mins = new Float32Array(cols), maxs = new Float32Array(cols);
      for (let c = 0; c < cols; c++) {
        let mn = 0, mx = 0;
        const s = Math.floor(c * per), e = Math.min(n, Math.floor((c + 1) * per));
        for (let i = s; i < e; i += 4) { const x = (ch[0][i] + ch[1][i]) * 0.5; if (x < mn) mn = x; if (x > mx) mx = x; }
        mins[c] = mn; maxs[c] = mx;
      }
      peaksCache = { key: state.listen + W, mins: mins, maxs: maxs };
    }
    const mid = top + wh / 2;
    g.fillStyle = state.listen === 'wet' ? '#e8b04a' : '#c9c5bb';
    for (let c = 0; c < peaksCache.mins.length; c++) {
      const y0 = mid - peaksCache.maxs[c] * wh / 2, y1 = mid - peaksCache.mins[c] * wh / 2;
      g.fillRect(c, y0, 1, Math.max(1, y1 - y0));
    }
    // spillehode
    if (Player.playing) {
      const x = Player.position() / t.totalSec * W;
      g.fillStyle = '#ffffff';
      g.fillRect(Math.round(x), 0, 1.5, H);
    }
  }

  function animate() {
    if (Player.playing) drawWave();
    requestAnimationFrame(animate);
  }

  // ---------------- Eksport ----------------
  function keyForFile(v) { return VK.NOTE_NAMES[v.settings.root].replace('#', 's') + VK.SCALES[v.settings.scale].short; }
  function baseName(v) { return 'Vokalypse_' + String(v.n).padStart(2, '0') + '_' + String(v.settings.bpm).replace('.', ',') + 'bpm_' + keyForFile(v); }
  function exportWav(kind) {
    const r = state.rendered; if (!r) return;
    const v = state.current;
    const data = VK.encodeWav(r[kind].channels, VK.SR, 24);
    deliver(data, baseName(v) + (kind === 'wet' ? '_behandlet' : '_torr') + '.wav', 'audio/wav');
  }
  async function deliver(data, filename, mime) {
    showErr('');
    try {
      const r = await VK.downloadBlob(data, filename, mime);
      if (r === 'declined') showErr('Nedlastingen ble avbrutt.');
    } catch (e) { showErr(String(e.message || e)); }
  }
  function exportCredits() {
    const v = state.current; if (!v) return;
    const byId = VK.Pool.byId();
    const used = Array.from(new Set(v.events.map((e) => e.clipId))).map((id) => byId.get(id)).filter(Boolean);
    const lines = ['Vokalypse – kilder brukt i ' + baseName(v), 'Laget ' + new Date().toLocaleString('nb-NO'), ''];
    let needCredit = false;
    for (const c of used) {
      const o = VK.ORIGINS[c.origin];
      lines.push('• ' + c.name + '  [' + o.badge + ']');
      if (c.origin === 'freesound') {
        lines.push('  Lisens: ' + c.meta.license + (c.meta.licenseUrl ? ' – ' + c.meta.licenseUrl : ''));
        lines.push('  Opphav: ' + c.meta.author + ' – ' + c.meta.url);
        if (c.meta.attribution) { lines.push('  KREDITERING KREVES: ' + c.meta.credit); needCredit = true; }
      } else if (c.origin === 'ai') {
        lines.push('  AI-generert med ' + c.meta.service + ' (' + c.meta.model + '), ' + c.meta.date + '. Ikke et menneskelig opptak.');
        lines.push('  Sjekk at abonnementet ditt gir kommersiell rett (ElevenLabs: Starter eller høyere for musikk).');
        if (c.meta.prompt) lines.push('  Tekst/beskrivelse: ' + c.meta.prompt);
      } else if (c.origin === 'synth') {
        lines.push('  Syntetisk formantstemme laget i Vokalypse. Ingen tredjepartsrettigheter.');
      } else {
        lines.push('  Din egen fil. Du må selv ha rettighetene til opptaket.');
      }
    }
    if (!used.length) lines.push('(ingen klipp brukt)');
    lines.push('', needCredit ? 'Minst én kilde er CC BY. Ta med krediteringen i utgivelsen (f.eks. i beskrivelsen eller på coveret).' : 'Ingen av kildene krever kreditering.');
    deliver(lines.join('\n'), baseName(v) + '_kilder.txt', 'text/plain;charset=utf-8');
  }

  // ---------------- Klippliste ----------------
  function fmtDur(s) { return s < 60 ? VK.fmtNum(s, 1) + ' s' : Math.floor(s / 60) + ':' + String(Math.round(s % 60)).padStart(2, '0'); }
  function drawPool() {
    const ul = $('pool');
    ul.innerHTML = '';
    const clips = VK.Pool.clips;
    $('pool-empty').style.display = clips.length ? 'none' : 'block';
    $('pool-count').textContent = clips.length ? '(' + VK.Pool.enabled().length + ' av ' + clips.length + ' i bruk)' : '';
    for (const c of clips) {
      const o = VK.ORIGINS[c.origin];
      const li = document.createElement('li');
      if (!c.enabled) li.className = 'off';
      const badge = document.createElement('span');
      badge.className = 'badge ' + o.cls; badge.textContent = o.badge; badge.title = o.info;
      const name = document.createElement('span'); name.className = 'name'; name.textContent = c.name; name.title = c.name;
      const acts = document.createElement('span'); acts.className = 'acts';
      const play = document.createElement('button'); play.className = 'btn small'; play.textContent = '▶'; play.title = 'Lytt';
      play.onclick = () => Player.preview(c.buffer);
      const tog = document.createElement('button'); tog.className = 'btn small'; tog.textContent = c.enabled ? 'i bruk' : 'av'; tog.title = 'Bruk i variasjoner';
      tog.onclick = () => { c.enabled = !c.enabled; drawPool(); };
      const del = document.createElement('button'); del.className = 'btn small ghost'; del.textContent = '✕'; del.title = 'Fjern';
      del.onclick = () => VK.Pool.remove(c.id);
      acts.append(play, tog, del);
      const meta = document.createElement('span'); meta.className = 'meta';
      let m = fmtDur(c.analysis.duration) + ' · ' + c.analysis.segments.length + ' lydbiter';
      if (c.origin === 'freesound') m += ' · ' + c.meta.licenseCode + ' · ' + c.meta.author;
      if (c.origin === 'ai') m += ' · ' + c.meta.service + ' ' + c.meta.model;
      if (c.origin === 'synth') m += ' · formantsynth';
      meta.textContent = m; meta.title = o.info;
      li.append(badge, name, acts, meta);
      ul.appendChild(li);
    }
  }

  // ---------------- Import ----------------
  async function importFiles(files) {
    const st = $('import-status');
    let ok = 0;
    for (const f of files) {
      st.textContent = 'Leser ' + f.name + ' …';
      try {
        const buf = await VK.decodeAudio(await f.arrayBuffer());
        VK.Pool.add({ name: f.name.replace(/\.[^.]+$/, ''), origin: 'import', buffer: buf, meta: { file: f.name } });
        ok++;
      } catch (e) {
        st.textContent = f.name + ': ' + (e.message || e);
        await new Promise((r) => setTimeout(r, 1500));
      }
    }
    st.textContent = ok ? ok + ' fil(er) lagt til.' : st.textContent;
  }

  // ---------------- Syntetisk ----------------
  function synthSpecBase() {
    const st = state.settings;
    return { bpm: st.bpm, root: st.root, scale: st.scale };
  }
  async function synthPack() {
    const b = synthSpecBase();
    const rng = VK.makeRng(VK.newSeed());
    const pick = (lang) => rng.pick(VK.Synth.FRAGMENTS[lang]);
    const specs = [
      { label: 'kor «oh-ah» (syntetisk)', text: 'oh ah', voice: 'mixed', voices: 6, melody: 'mono', stepsPerSyl: 8, holdLast: true },
      { label: 'hvisk «' + pick('no') + '»', text: null, lang: 'no', voice: 'tenor', whisper: true, melody: 'mono', stepsPerSyl: 2, wordGap: 1 },
      { label: 'chant «ta ka tsi ka»', text: 'ta ka tsi ka ta ka', voice: 'bass', voices: 2, melody: 'mono', stepsPerSyl: 1 },
      { label: 'drone «mmm-uu»', text: 'mm uu', voice: 'bass', voices: 3, melody: 'mono', stepsPerSyl: 8, holdLast: true },
      { label: 'sopran «' + pick('en') + '»', text: null, lang: 'en', voice: 'soprano', voices: 1, melody: 'scale', stepsPerSyl: 2, wordGap: 1 },
      { label: 'stikk «ki ri ki»', text: 'ki ri ki ah', voice: 'alto', voices: 3, melody: 'rise', stepsPerSyl: 1 }
    ];
    for (const s of specs) {
      if (!s.text) s.text = s.label.match(/«(.*)»/)[1];
      Object.assign(s, b, { seed: VK.newSeed() });
    }
    $('synth-pack').disabled = true;
    try {
      for (const s of specs) {
        await new Promise((r) => setTimeout(r, 0));
        const out = await VK.Providers.get('formant').generate(s);
        for (const o of out) VK.Pool.add({ name: s.label, origin: 'synth', channels: o.channels, meta: o.meta });
      }
    } catch (e) { showErr(String(e.message || e)); }
    $('synth-pack').disabled = false;
  }
  async function synthOne() {
    const text = $('syn-text').value.trim();
    if (!text) return;
    const s = Object.assign(synthSpecBase(), {
      text: text, voice: $('syn-voice').value, voices: +$('syn-voices').value || 1, melody: $('syn-mel').value,
      stepsPerSyl: +$('syn-len').value, whisper: $('syn-whisper').checked, wordGap: 1, holdLast: true, seed: VK.newSeed()
    });
    s.label = (s.whisper ? 'hvisk' : $('syn-voice').selectedOptions[0].textContent.toLowerCase()) + ' «' + text + '»';
    try {
      const out = await VK.Providers.get('formant').generate(s);
      for (const o of out) VK.Pool.add({ name: s.label, origin: 'synth', channels: o.channels, meta: o.meta });
    } catch (e) { showErr(String(e.message || e)); }
  }
  function clicheWarn(text, el) {
    const hits = VK.Synth.clicheHits(text);
    el.textContent = hits.length ? 'Klisjévarsel: «' + hits.join('», «') + '». Det er lov, men kanskje noe rarere?' : '';
  }

  // ---------------- Freesound ----------------
  const FS_SUGG = ['whisper voice', 'choir', 'vocal chant', 'breath', 'spoken word', 'counting voice', 'humming', 'shout', 'gregorian', 'throat singing', 'vowel', 'laugh'];
  async function fsSearch() {
    const key = $('fs-key').value.trim();
    const q = $('fs-q').value.trim();
    const status = $('fs-status'), ul = $('fs-results');
    if (!key) { status.textContent = 'Lim inn API-nøkkelen først (se «Slik får du gratis nøkkel»).'; return; }
    if ($('fs-remember').checked) store.set('fsKey', key); else store.del('fsKey');
    status.textContent = 'Søker …'; ul.innerHTML = '';
    try {
      const allowBy = document.querySelector('input[name=fs-lic]:checked').value === 'by';
      const res = await VK.Freesound.search({ key: key, query: q, allowBy: allowBy });
      status.textContent = res.length ? res.length + ' treff (bare CC0' + (allowBy ? '/CC BY' : '') + ')' : 'Ingen treff. Prøv andre ord, gjerne på engelsk.';
      for (const item of res) {
        const li = document.createElement('li');
        const t = document.createElement('div'); t.className = 't';
        const lic = document.createElement('span'); lic.className = 'badge o-freesound'; lic.textContent = item.license.code;
        const nm = document.createElement('a'); nm.className = 'nm'; nm.href = item.page; nm.target = '_blank'; nm.rel = 'noopener';
        nm.textContent = item.name; nm.title = item.name + ' – ' + item.user;
        const d = document.createElement('span'); d.className = 'note'; d.textContent = fmtDur(item.duration);
        const add = document.createElement('button'); add.className = 'btn small'; add.textContent = '+ legg til';
        add.onclick = async () => {
          add.disabled = true; add.textContent = 'henter …';
          try {
            const clip = await VK.Freesound.fetchClip(item);
            VK.Pool.add(clip);
            add.textContent = '✓ lagt til';
          } catch (e) { add.textContent = 'feil'; status.textContent = String(e.message || e); add.disabled = false; }
        };
        t.append(lic, nm, d, add);
        const by = document.createElement('div'); by.className = 'note'; by.textContent = 'av ' + item.user + (item.license.attribution ? ' · må krediteres' : '');
        const au = document.createElement('audio'); au.controls = true; au.preload = 'none'; au.src = item.preview;
        li.append(t, by, au);
        ul.appendChild(li);
      }
    } catch (e) {
      status.textContent = String(e.message || e) + (e instanceof TypeError ? ' (nettverksfeil – er du på nett?)' : '');
    }
  }

  // ---------------- ElevenLabs ----------------
  let elMode = 'song';
  function elCost() {
    let c;
    if (elMode === 'song') c = VK.ElevenLabs.estimate('song', VK.clamp(+$('el-sec').value || 10, 3, 30));
    else if (elMode === 'sfx') c = VK.ElevenLabs.estimate('sfx', VK.clamp(+$('el-sfx-sec').value || 6, 0.5, 30));
    else c = VK.ElevenLabs.estimate('tts', 0, $('el-text').value.length);
    $('el-cost').textContent = 'anslått API-kostnad ≈ $' + c.toFixed(3) + ' (trekkes fra kontoen din)';
    const txt = elMode === 'song' ? $('el-lines').value : elMode === 'tts' ? $('el-text').value : '';
    clicheWarn(txt, $('el-cliche'));
  }
  async function elGenerate() {
    const key = $('el-key').value.trim();
    const status = $('el-status');
    if (!key) { status.textContent = 'Lim inn ElevenLabs-nøkkelen først (se «Pris og oppsett»).'; return; }
    if ($('el-remember').checked) store.set('elKey', key); else store.del('elKey');
    $('el-go').disabled = true;
    status.textContent = 'Genererer hos ElevenLabs … (kan ta 10–60 s)';
    try {
      let ab, name, meta;
      const date = new Date().toISOString().slice(0, 10);
      if (elMode === 'song') {
        const sec = VK.clamp(+$('el-sec').value || 10, 3, 30);
        ab = await VK.ElevenLabs.song({ key: key, lines: $('el-lines').value, styles: $('el-styles').value, seconds: sec });
        name = 'AI-sang «' + $('el-lines').value.split('\n')[0].slice(0, 40) + '»';
        meta = { service: 'ElevenLabs', model: 'Eleven Music (music_v1)', prompt: $('el-lines').value.replace(/\n/g, ' / ') + ' | ' + $('el-styles').value, date: date };
      } else if (elMode === 'tts') {
        const voiceId = $('el-voice').value;
        if (!voiceId) throw new Error('Trykk «Hent stemmer» og velg en stemme.');
        ab = await VK.ElevenLabs.speech({ key: key, voiceId: voiceId, text: $('el-text').value, modelId: $('el-model').value });
        name = 'AI-tale «' + $('el-text').value.slice(0, 40) + '»';
        meta = { service: 'ElevenLabs', model: 'Text to Speech (' + $('el-model').value + ', stemme ' + $('el-voice').selectedOptions[0].textContent + ')', prompt: $('el-text').value, date: date };
      } else {
        ab = await VK.ElevenLabs.sfx({ key: key, text: $('el-prompt').value, seconds: +$('el-sfx-sec').value || 6, influence: +$('el-infl').value });
        name = 'AI-tekstur «' + $('el-prompt').value.slice(0, 40) + '»';
        meta = { service: 'ElevenLabs', model: 'Sound Effects', prompt: $('el-prompt').value, date: date };
      }
      const buf = await VK.decodeAudio(ab);
      VK.Pool.add({ name: name, origin: 'ai', buffer: buf, meta: meta });
      status.textContent = 'Ferdig. Klippet ligger i lista, merket AI-GENERERT.';
    } catch (e) {
      status.textContent = String(e.message || e) + (e instanceof TypeError ? ' (nettverksfeil – er du på nett?)' : '');
    }
    $('el-go').disabled = false;
  }
  async function elVoices() {
    const key = $('el-key').value.trim();
    const status = $('el-status');
    if (!key) { status.textContent = 'Lim inn nøkkelen først.'; return; }
    status.textContent = 'Henter stemmer …';
    try {
      const voices = await VK.ElevenLabs.voices(key);
      const sel = $('el-voice'); sel.innerHTML = '';
      for (const v of voices) {
        const o = document.createElement('option'); o.value = v.id;
        o.textContent = v.name + (v.labels.gender ? ' · ' + v.labels.gender : '') + (v.labels.accent ? ' · ' + v.labels.accent : '');
        sel.appendChild(o);
      }
      status.textContent = voices.length + ' stemmer hentet.';
    } catch (e) { status.textContent = String(e.message || e); }
  }

  // I forhåndsvisningen i Claude blokkeres kontakt med eksterne tjenester. Si det tydelig og slå av knappene.
  function applyPreviewMode() {
    if (!VK.inPreview() || document.body.classList.contains('preview')) return;
    document.body.classList.add('preview');
    for (const id of ['fs-search', 'el-go', 'el-load-voices']) $(id).disabled = true;
    for (const id of ['fs-preview-note', 'el-preview-note', 'export-preview-note']) $(id).hidden = false;
  }

  // ---------------- Oppkobling ----------------
  function init() {
    applyPreviewMode();
    setTimeout(applyPreviewMode, 1200);
    buildSettings();
    updateExportInfo();
    drawPool();
    VK.Pool.onChange(drawPool);

    // faner
    for (const b of document.querySelectorAll('.tabs button')) {
      b.onclick = () => {
        for (const x of document.querySelectorAll('.tabs button')) x.classList.toggle('on', x === b);
        for (const t of document.querySelectorAll('.tab')) t.classList.toggle('on', t.id === b.dataset.tab);
      };
    }

    // import
    const drop = $('drop'), file = $('file');
    drop.onclick = () => file.click();
    file.onchange = () => { importFiles(Array.from(file.files)); file.value = ''; };
    ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); }));
    ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
    drop.addEventListener('drop', (e) => importFiles(Array.from(e.dataTransfer.files)));
    // slipp filer hvor som helst i vinduet
    window.addEventListener('dragover', (e) => e.preventDefault());
    window.addEventListener('drop', (e) => { if (e.target !== drop && e.dataTransfer && e.dataTransfer.files.length) { e.preventDefault(); importFiles(Array.from(e.dataTransfer.files)); } });

    // syntetisk
    $('synth-pack').onclick = synthPack;
    $('syn-make').onclick = synthOne;
    $('syn-dice').onclick = () => { $('syn-text').value = VK.makeRng(VK.newSeed()).pick(VK.Synth.FRAGMENTS[$('syn-lang').value]); clicheWarn($('syn-text').value, $('syn-cliche')); };
    $('syn-text').addEventListener('input', () => clicheWarn($('syn-text').value, $('syn-cliche')));

    // freesound
    const fsKey = store.get('fsKey', '');
    if (fsKey) { $('fs-key').value = fsKey; $('fs-remember').checked = true; }
    $('fs-search').onclick = fsSearch;
    $('fs-q').addEventListener('keydown', (e) => { if (e.key === 'Enter') fsSearch(); });
    for (const s of FS_SUGG) {
      const c = document.createElement('span'); c.className = 'chip'; c.textContent = s;
      c.onclick = () => { $('fs-q').value = s; fsSearch(); };
      $('fs-sugg').appendChild(c);
    }

    // elevenlabs
    const elKey = store.get('elKey', '');
    if (elKey) { $('el-key').value = elKey; $('el-remember').checked = true; }
    segHandler('el-mode', (v) => {
      elMode = v;
      $('el-song').hidden = v !== 'song'; $('el-tts').hidden = v !== 'tts'; $('el-sfx').hidden = v !== 'sfx';
      elCost();
    });
    for (const id of ['el-sec', 'el-sfx-sec', 'el-text', 'el-lines']) $(id).addEventListener('input', elCost);
    $('el-go').onclick = elGenerate;
    $('el-load-voices').onclick = elVoices;
    $('el-dice').onclick = () => { $('el-lines').value = VK.makeRng(VK.newSeed()).pick(VK.Synth.FRAGMENTS.en) + '\n' + VK.makeRng(VK.newSeed()).pick(VK.Synth.FRAGMENTS.en); elCost(); };
    elCost();

    // transport
    $('gen').onclick = () => generate({});
    $('recolor').onclick = () => { if (state.current) generate({ seed: state.current.seed }); else generate({}); };
    $('play').onclick = () => {
      if (Player.playing) { Player.stop(); drawWave(); return; }
      if (!state.rendered) { showErr('Lag en variasjon først.'); return; }
      Player.start(0);
    };
    segHandler('listen', (v) => { state.listen = v; peaksCache = null; Player.mix(); drawWave(); });
    $('guide').onchange = () => Player.mix();
    $('wave').addEventListener('click', (e) => {
      if (!state.rendered) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const frac = (e.clientX - rect.left) / rect.width;
      // hopp til nærmeste takt
      const t = VK.timing(state.current.settings.bpm);
      const bar = Math.floor(frac * 16);
      Player.start(bar * t.barSec);
    });
    $('dl-wet').onclick = () => exportWav('wet');
    $('dl-dry').onclick = () => exportWav('dry');
    $('dl-credits').onclick = exportCredits;

    document.addEventListener('keydown', (e) => {
      const tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'input' && e.target.type !== 'range' && e.target.type !== 'checkbox' && e.target.type !== 'radio') return;
      if (tag === 'textarea' || tag === 'select') return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.code === 'Space') { e.preventDefault(); $('play').click(); }
      else if (e.key === 'n' || e.key === 'N') $('gen').click();
      else if (e.key === 'b' || e.key === 'B') $('recolor').click();
    });
    window.addEventListener('resize', () => { peaksCache = null; drawWave(); });
    drawWave();
    requestAnimationFrame(animate);
  }

  // Eksponer litt for testing i konsollen
  VK.App = { state: state, generate: generate, Player: Player, exportWav: exportWav, synthPack: synthPack };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})(window.VK = window.VK || {});
