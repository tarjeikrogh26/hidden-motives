/* TRE SPOR – offline-rendering av løkker og innspilte fremføringer.
   Fremføringen er lagret som starttilstand + tidsstemplede kontrollendringer (globalt steg).
   Fordi all tilfeldighet er frøstyrt, gir avspillingen nøyaktig samme musikk som ble spilt inn. */
(function (root) {
  'use strict';
  var TS = root.TS;

  /* Brukes både live og ved avspilling av opptak */
  TS.applyChange = function (state, ch) {
    if (ch.op === 'set') { TS.setPath(state, ch.path, TS.clone(ch.value)); return; }
    if (ch.op === 'restore' || ch.op === 'replace') {
      var src = TS.clone(ch.state), runtime = state.runtime, muts = {};
      TS.TRACKS.forEach(function (id) { muts[id] = state.tracks[id].mutations; });
      Object.keys(src).forEach(function (k) { state[k] = src[k]; });
      state.runtime = runtime;
      /* angre beholder utviklingens pågående endringer; snapshot tar med sine egne */
      if (ch.op === 'restore') TS.TRACKS.forEach(function (id) { state.tracks[id].mutations = muts[id]; });
    }
  };

  var CHANNELS = { mix: 0, drums: 2, bass: 4, synth: 6 };

  function makeCtx(ch, len, sr) {
    var C = root.OfflineAudioContext || root.webkitOfflineAudioContext;
    return new C(ch, len, sr);
  }

  function renderPass(opts, mode) {
    var sr = opts.sampleRate || 44100, changes = opts.changes || [];
    /* først: tidspunkt for hvert steg (tempo kan endres underveis) */
    var st = TS.clone(opts.startState), ci = 0, times = [], t = 0.05;
    for (var k0 = 0; k0 < opts.steps; k0++) {
      var n0 = opts.startStep + k0;
      while (ci < changes.length && changes[ci].n <= n0) TS.applyChange(st, changes[ci++]);
      times.push(t); t += TS.stepDur(st.song);
    }
    var total = t + (opts.tail == null ? 3 : opts.tail);
    var len = Math.ceil(total * sr);
    var ctx = makeCtx(mode === 'stems' ? 8 : 2, len, sr);
    var eng = new TS.Engine(ctx, { offline: true, stems: mode === 'stems', stemOnly: mode !== 'stems' && mode !== 'mix' ? mode : null, samples: opts.samples, loop: opts.loop, logNotes: true });
    st = TS.clone(opts.startState); ci = 0;
    var k = 0;
    function scheduleUntil(limit) {
      while (k < opts.steps && times[k] < limit) {
        var n = opts.startStep + k;
        while (ci < changes.length && changes[ci].n <= n) TS.applyChange(st, changes[ci++]);
        eng.scheduleStep(st, n, times[k], k === 0);
        k++;
      }
    }
    var CH = 2;
    var chunked = false;
    if (typeof ctx.suspend === 'function' && total > CH + 0.5) {
      try {
        ctx.suspend(CH).then(function step() {
          /* planlegg neste bit og fortsett */
          var now = ctx.currentTime;
          scheduleUntil(now + CH + 0.6);
          if (opts.onProgress) opts.onProgress(Math.min(0.99, now / total));
          var next = now + CH;
          if (next < total - 0.05) ctx.suspend(next).then(step);
          ctx.resume();
        });
        chunked = true;
      } catch (e) { chunked = false; }
    }
    scheduleUntil(chunked ? CH + 0.6 : Infinity);
    return ctx.startRendering().then(function (buf) {
      if (opts.onProgress) opts.onProgress(1);
      return { buffer: buf, notes: eng.noteLog, tempos: eng.tempoLog, sampleRate: sr, duration: total };
    });
  }

  /* Rendrer miks + tre stems i én omgang (8 kanaler); faller tilbake til fire stereopass ved behov. */
  TS.render = function (opts) {
    return renderPass(opts, 'stems').then(function (r) {
      var b = r.buffer;
      if (b.numberOfChannels < 8) throw new Error('få kanaler');
      var out = { notes: r.notes, tempos: r.tempos, sampleRate: r.sampleRate, duration: r.duration, audio: {} };
      Object.keys(CHANNELS).forEach(function (k) { out.audio[k] = [b.getChannelData(CHANNELS[k]), b.getChannelData(CHANNELS[k] + 1)]; });
      return out;
    }).catch(function () {
      var out = { audio: {} }, prog = opts.onProgress;
      var ids = ['mix', 'drums', 'bass', 'synth'];
      return ids.reduce(function (p, id, i) {
        return p.then(function () {
          return renderPass(Object.assign({}, opts, { onProgress: prog ? function (x) { prog((i + x) / 4); } : null }), id).then(function (r) {
            out.audio[id] = [r.buffer.getChannelData(0), r.buffer.getChannelData(1)];
            if (id === 'mix') { out.notes = r.notes; out.tempos = r.tempos; out.sampleRate = r.sampleRate; out.duration = r.duration; }
          });
        });
      }, Promise.resolve()).then(function () { return out; });
    });
  };

  /* Bygger alle eksportfilene fra et renderresultat */
  TS.exportFiles = function (r, base, startStep) {
    var W = TS.files;
    return {
      mix:   { name: base + '-miks.wav',    mime: 'audio/wav', data: W.wav(r.audio.mix, r.sampleRate) },
      drums: { name: base + '-trommer.wav', mime: 'audio/wav', data: W.wav(r.audio.drums, r.sampleRate) },
      bass:  { name: base + '-bass.wav',    mime: 'audio/wav', data: W.wav(r.audio.bass, r.sampleRate) },
      synth: { name: base + '-synth.wav',   mime: 'audio/wav', data: W.wav(r.audio.synth, r.sampleRate) },
      midi:  { name: base + '.mid',         mime: 'audio/midi', data: W.midi(r.notes, r.tempos, startStep, base) }
    };
  };
})(typeof window !== 'undefined' ? window : globalThis);
