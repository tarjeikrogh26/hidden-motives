/* TRE SPOR – app-logikk: tilstand, angre, snapshots, opptak av fremføring, samples, lagring og eksport. */
(function (root) {
  'use strict';
  var TS = root.TS;
  var LS_KEY = 'trespor.v1';

  var A = TS.app = {
    state: TS.defaultState(),
    snapshots: [],
    recordings: [],
    hist: [], fut: [],
    custom: {},          // egne samples: slot → { name, mime, bytes, buffer }
    kit: null,           // innebygde trommelyder
    ctx: null, engine: null,
    playing: false,
    rec: null, armed: false,
    pending: [],         // endringer som venter på neste taktstart (snapshot)
    evoLog: [],
    listeners: {},
    lastEdit: 0,
    exportResult: null
  };

  A.on = function (ev, fn) { (A.listeners[ev] = A.listeners[ev] || []).push(fn); };
  A.emit = function (ev, data) { (A.listeners[ev] || []).forEach(function (fn) { fn(data); }); };

  /* ---------- lyd ---------- */
  var decodeCtx = null;
  function getDecodeCtx() {
    if (!decodeCtx) { var C = root.OfflineAudioContext || root.webkitOfflineAudioContext; decodeCtx = new C(2, 44100, 44100); }
    return decodeCtx;
  }
  A.decode = function (bytes) {
    var c = getDecodeCtx();
    return new Promise(function (res, rej) {
      var p = c.decodeAudioData(bytes.slice(0), res, rej);
      if (p && p.then) p.then(res, rej);
    });
  };
  A.buildKit = function () {
    if (!A.kit) A.kit = TS.kit.build(getDecodeCtx(), 44100);
    return A.kit;
  };
  A.drumBuffers = function () {
    var kit = A.buildKit(), out = {};
    TS.DRUM_VOICES.forEach(function (v) { out[v.id] = A.custom[v.id] ? A.custom[v.id].buffer : kit[v.id]; });
    return out;
  };
  A.loopBuffer = function () { return A.custom.loop ? A.custom.loop.buffer : null; };

  A.ensureAudio = function () {
    if (A.ctx) { if (A.ctx.state !== 'running') A.ctx.resume(); return A.ctx; }
    var C = root.AudioContext || root.webkitAudioContext;
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) { /* eldre Safari */ }
    A.ctx = new C({ latencyHint: 'interactive' });
    /* iPhone: en stille <audio> i gang gjør at lyden spilles selv med lydløs-bryteren på (eldre iOS) */
    try {
      var au = document.createElement('audio');
      au.setAttribute('playsinline', ''); au.loop = true;
      au.src = URL.createObjectURL(new Blob([TS.files.wav([new Float32Array(4410)], 44100)], { type: 'audio/wav' }));
      var pr = au.play(); if (pr && pr.catch) pr.catch(function () {});
      A._silent = au;
    } catch (e) { /* ok */ }
    var b = A.ctx.createBuffer(1, 1, 22050), s = A.ctx.createBufferSource(); s.buffer = b; s.connect(A.ctx.destination); s.start(0);
    A.ctx.resume();
    A.engine = new TS.Engine(A.ctx, { samples: A.drumBuffers(), loop: A.loopBuffer() });
    A.engine.beforeStep = beforeStep;
    A.engine.onStep = function (info) { A.emit('step', info); if (info.evo) { A.evoLog.unshift(info.evo); A.evoLog.length = Math.min(A.evoLog.length, 8); } };
    return A.ctx;
  };
  A.refreshEngineSamples = function () {
    if (!A.engine) return;
    A.engine.samples = A.drumBuffers();
    A.engine.loop = A.loopBuffer();
  };

  /* ---------- transport ---------- */
  A.play = function () {
    A.ensureAudio();
    if (A.playing) return;
    A.playing = true;
    A.engine.start(function () { return A.state; }, 0);
    A.emit('transport');
  };
  A.stop = function () {
    if (!A.playing) return;
    if (A.rec) A.stopRec();
    A.armed = false;
    A.engine.stop();
    A.playing = false;
    flushPending(true);
    A.emit('transport');
  };
  A.togglePlay = function () { A.playing ? A.stop() : A.play(); };
  A.nextStep = function () { return A.playing && A.engine ? A.engine.nextStep : 0; };

  function beforeStep(n) {
    if (n % 16 === 0) {
      flushPending(false, n);
      if (A.armed) {
        A.armed = false;
        A.rec = { startStep: n, startState: TS.clone(A.state), changes: [], startedAt: Date.now(), startTime: A.engine.nextTime };
        A.emit('rec');
      }
    }
  }
  function flushPending(now, n) {
    var list = A.pending; A.pending = [];
    list.forEach(function (ch) {
      TS.applyChange(A.state, ch);
      log(Object.assign({}, ch), n);
    });
    if (list.length) { A.emit('change', { full: true }); save(); }
  }
  function log(ch, n) {
    if (!A.rec) return;
    ch.n = n != null ? n : A.nextStep();
    A.rec.changes.push(ch);
  }

  /* ---------- endringer og angre ---------- */
  function userState() { var s = TS.clone(A.state); delete s.runtime; return s; }
  function pushHistory(force) {
    var now = Date.now();
    if (force || now - A.lastEdit > 650) {
      A.hist.push(userState());
      if (A.hist.length > 150) A.hist.shift();
      A.fut = [];
    }
    A.lastEdit = now;
  }
  A.commit = function (path, value, opts) {
    opts = opts || {};
    if (JSON.stringify(TS.getPath(A.state, path)) === JSON.stringify(value)) return;
    if (!opts.noHistory) pushHistory(opts.newGroup);
    TS.setPath(A.state, path, TS.clone(value));
    log({ op: 'set', path: path.slice(), value: TS.clone(value) });
    A.emit('change', { path: path });
    save();
  };
  A.commitMany = function (pairs) {
    pushHistory(true);
    pairs.forEach(function (p) { A.commit(p[0], p[1], { noHistory: true }); });
  };
  /* for større operasjoner som endrer et helt objekt (f.eks. «Ny idé») */
  A.mutate = function (fn) {
    pushHistory(true);
    var before = TS.clone(A.state);
    fn(A.state);
    /* logg som full gjenoppretting for presis avspilling */
    var s = TS.clone(A.state); delete s.runtime;
    if (A.rec) log({ op: 'replace', state: s });
    A.emit('change', { full: true });
    save();
    return before;
  };
  A.undo = function () {
    if (!A.hist.length) return;
    A.fut.push(userState());
    var s = A.hist.pop();
    TS.applyChange(A.state, { op: 'restore', state: s });
    log({ op: 'restore', state: s });
    A.lastEdit = 0;
    A.emit('change', { full: true }); save();
  };
  A.redo = function () {
    if (!A.fut.length) return;
    A.hist.push(userState());
    var s = A.fut.pop();
    TS.applyChange(A.state, { op: 'restore', state: s });
    log({ op: 'restore', state: s });
    A.lastEdit = 0;
    A.emit('change', { full: true }); save();
  };

  /* ---------- snapshots ---------- */
  A.saveSnapshot = function () {
    var s = TS.clone(A.state); delete s.runtime;
    var d = new Date();
    A.snapshots.push({ id: Date.now(), name: String(A.snapshots.length + 1), time: d.toTimeString().slice(0, 5), state: s });
    A.emit('snapshots'); save();
  };
  A.recallSnapshot = function (i) {
    var snap = A.snapshots[i]; if (!snap) return;
    pushHistory(true);
    var ch = { op: 'replace', state: TS.clone(snap.state) };
    if (A.playing) { A.pending.push(ch); A.emit('pending'); }   // skjer på neste taktstart
    else { TS.applyChange(A.state, ch); A.emit('change', { full: true }); save(); }
  };
  A.deleteSnapshot = function (i) { A.snapshots.splice(i, 1); A.emit('snapshots'); save(); };

  /* ---------- utvikling ---------- */
  A.keep = function (id) {
    A.mutate(function (s) { TS.seq.keepMutations(s.tracks[id], id === 'drums'); });
  };
  A.backToBase = function (id) { A.commit(['tracks', id, 'mutations'], [], { newGroup: true }); };
  A.resetEvolution = function () {
    pushHistory(true);
    TS.TRACKS.forEach(function (id) { A.commit(['tracks', id, 'mutations'], [], { noHistory: true }); });
    A.commit(['runtime'], { evoCount: 0, barsSince: 0, lastTrack: null }, { noHistory: true });
    A.evoLog = [];
    A.emit('change', { full: true });
  };

  /* Ny grunnidé for bass eller synth – i skala, med fast første slag, styrt av frøet */
  A.newIdea = function (id) {
    var k = (A._ideaCount = (A._ideaCount || 0) + 1);
    A.mutate(function (s) {
      var T = s.tracks[id], seed = s.song.seed, len = T.seq.length;
      var r = function (i, salt) { return TS.rand(seed, 'idea', id, k, i, salt); };
      var pool = id === 'bass' ? [0, 0, 0, 2, 4, 3, 7] : [0, 2, 4, 7, 4, 9, 6, 11];
      var dens = id === 'bass' ? 0.45 : 0.55;
      T.seq.steps = T.seq.steps.map(function (st, i) {
        var on = i === 0 ? true : (i < len && r(i, 'on') < dens * (i % 2 === 0 ? 1.2 : 0.7));
        return { on: on, deg: pool[Math.floor(r(i, 'deg') * pool.length)], oct: r(i, 'oct') < 0.1 ? 1 : 0,
                 gate: [0.25, 0.5, 0.5, 0.75][Math.floor(r(i, 'g') * 4)], prob: (i % 4 === 0 || r(i, 'p') < 0.6) ? 1 : 0.6 };
      });
      T.mutations = [];
    });
  };

  /* ---------- opptak av fremføring ---------- */
  A.toggleRec = function () {
    if (A.rec || A.armed) { A.stopRec(); return; }
    if (!A.playing) { A.armed = true; A.play(); }
    else A.armed = true;               // starter på neste taktstart
    A.emit('rec');
  };
  A.stopRec = function () {
    if (A.armed && !A.rec) { A.armed = false; A.emit('rec'); return; }
    var r = A.rec; if (!r) return;
    A.rec = null;
    var endStep = A.nextStep();
    if (endStep - r.startStep < 4) { A.emit('rec'); return; }
    var secs = (Date.now() - r.startedAt) / 1000;
    A.recordings.push({
      id: Date.now(), name: 'Opptak ' + (A.recordings.length + 1),
      created: new Date().toISOString(), seconds: Math.round(secs),
      startStep: r.startStep, steps: endStep - r.startStep,
      startState: r.startState, changes: r.changes
    });
    A.emit('rec'); A.emit('recordings'); save();
  };
  A.deleteRecording = function (i) { A.recordings.splice(i, 1); A.emit('recordings'); save(); };

  /* ---------- eksport ---------- */
  A.renderLoop = function (bars, onProgress) {
    var s = TS.clone(A.state);
    return A.renderJob({ startState: s, startStep: 0, steps: bars * 16, changes: [] }, 'trespor-' + bars + 'takter', onProgress);
  };
  A.renderRecording = function (i, onProgress) {
    var r = A.recordings[i];
    var base = 'trespor-' + r.name.toLowerCase().replace(/[^a-z0-9æøå]+/g, '-');
    return A.renderJob({ startState: r.startState, startStep: r.startStep, steps: r.steps, changes: r.changes }, base, onProgress);
  };
  A.renderJob = function (job, base, onProgress) {
    job.samples = A.drumBuffers(); job.loop = A.loopBuffer(); job.onProgress = onProgress;
    return TS.render(job).then(function (r) {
      A.exportResult = { base: base, files: TS.exportFiles(r, base, job.startStep), duration: r.duration };
      A.emit('export');
      return A.exportResult;
    });
  };
  A.zipExport = function () {
    var f = A.exportResult.files;
    return TS.files.zip(['mix', 'drums', 'bass', 'synth', 'midi'].map(function (k) { return { name: f[k].name, data: f[k].data }; })
      .concat([{ name: A.exportResult.base + '-prosjekt.json', data: new TextEncoder().encode(JSON.stringify(A.projectObject(false), null, 1)) }]));
  };

  /* ---------- samples ---------- */
  A.loadSample = function (slot, file) {
    return file.arrayBuffer().then(function (bytes) {
      return A.decode(bytes).then(function (buffer) {
        A.custom[slot] = { name: file.name, mime: file.type || 'audio/wav', bytes: bytes, buffer: buffer };
        TS.files.idbPut(slot, { name: file.name, mime: file.type, bytes: bytes }).catch(function () {});
        A.refreshEngineSamples();
        A.emit('samples');
        return buffer;
      });
    });
  };
  A.clearSample = function (slot) {
    delete A.custom[slot];
    TS.files.idbPut(slot, null).catch(function () {});
    A.refreshEngineSamples(); A.emit('samples');
  };
  function restoreSamples(map) {
    var jobs = Object.keys(map).map(function (slot) {
      var it = map[slot]; if (!it || !it.bytes) return null;
      return A.decode(it.bytes).then(function (buffer) {
        A.custom[slot] = { name: it.name, mime: it.mime, bytes: it.bytes, buffer: buffer };
      }).catch(function () {});
    });
    return Promise.all(jobs).then(function () { A.refreshEngineSamples(); A.emit('samples'); });
  }

  /* ---------- prosjekt ---------- */
  A.projectObject = function (withSamples) {
    var samples = {};
    if (withSamples) Object.keys(A.custom).forEach(function (k) {
      var c = A.custom[k]; samples[k] = { name: c.name, mime: c.mime, base64: TS.files.toBase64(c.bytes) };
    });
    return TS.files.toProject(A.state, { snapshots: A.snapshots, recordings: A.recordings, samples: samples });
  };
  A.loadProject = function (obj) {
    var p = TS.files.fromProject(obj);
    if (A.playing) A.stop();
    A.state = p.state; A.snapshots = p.snapshots; A.recordings = p.recordings;
    A.hist = []; A.fut = []; A.evoLog = [];
    var map = {};
    Object.keys(p.samples).forEach(function (k) {
      var s = p.samples[k];
      map[k] = { name: s.name, mime: s.mime, bytes: TS.files.fromBase64(s.base64) };
      TS.files.idbPut(k, map[k]).catch(function () {});
    });
    A.emit('change', { full: true }); A.emit('snapshots'); A.emit('recordings');
    save();
    return restoreSamples(map);
  };
  A.newProject = function () {
    pushHistory(true);
    var d = TS.defaultState();
    TS.applyChange(A.state, { op: 'replace', state: d });
    A.state.runtime = d.runtime;
    log({ op: 'replace', state: d });
    A.emit('change', { full: true }); save();
  };

  /* ---------- autolagring ---------- */
  var saveTimer = null;
  function save() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      try {
        localStorage.setItem(LS_KEY, JSON.stringify({ state: A.state, snapshots: A.snapshots, recordings: A.recordings }));
      } catch (e) {
        try { localStorage.setItem(LS_KEY, JSON.stringify({ state: A.state, snapshots: A.snapshots, recordings: [] })); } catch (e2) { /* ingen lagring */ }
      }
    }, 800);
  }
  A.save = save;
  A.load = function () {
    try {
      var raw = localStorage.getItem(LS_KEY);
      if (raw) {
        var o = JSON.parse(raw);
        if (o.state) A.state = TS.migrate(o.state);
        A.snapshots = o.snapshots || [];
        A.recordings = o.recordings || [];
      }
    } catch (e) { /* start på nytt */ }
    return TS.files.idbAll().then(restoreSamples).catch(function () {});
  };
})(typeof window !== 'undefined' ? window : globalThis);
