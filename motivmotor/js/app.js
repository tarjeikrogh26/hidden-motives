/* Motivmotor – grensesnitt. Fem faner: Referanser, Melodi, Arrangement, Lyd, Eksport. */
(function (MM) {
  'use strict';
  const T = MM.theory, P = MM.project, A = MM.arrange, F = MM.files;
  const SPB = T.STEPS_PER_BAR;

  /* ---------- små DOM-hjelpere ---------- */
  function h(tag, props) {
    const e = document.createElement(tag);
    if (props) for (const [k, v] of Object.entries(props)) {
      if (v === undefined || v === null || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = v;
      else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), v);
      else if (k === 'style') e.style.cssText = v;
      else if (k === 'value') e.value = v;
      else if (k === 'checked') e.checked = !!v;
      else e.setAttribute(k, v === true ? '' : v);
    }
    for (let i = 2; i < arguments.length; i++) add(e, arguments[i]);
    return e;
  }
  function add(e, c) {
    if (c === undefined || c === null || c === false) return;
    if (Array.isArray(c)) c.forEach((x) => add(e, x));
    else e.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  const btn = (label, onclick, cls, title) => h('button', { class: 'btn ' + (cls || ''), onclick, title }, label);
  function seg(options, value, onpick, full) {
    return h('div', { class: 'seg' + (full ? ' full' : '') }, options.map(([v, lab]) => h('button', {
      class: String(v) === String(value) ? 'on' : '', onclick: () => onpick(v), type: 'button',
    }, lab)));
  }
  function select(options, value, onchange) {
    const s = h('select', { onchange: () => onchange(s.value) }, options.map(([v, lab]) => h('option', { value: v }, lab)));
    s.value = value === null || value === undefined ? '' : value;
    return s;
  }
  function slider(label, value, min, max, step, onchange, fmt) {
    const out = h('output', {}, fmt ? fmt(value) : value);
    const r = h('input', { type: 'range', min, max, step, value });
    r.oninput = () => { out.textContent = fmt ? fmt(+r.value) : r.value; };
    r.onchange = () => onchange(+r.value);
    return h('div', { class: 'slider' }, h('span', {}, label), r, out);
  }
  let toastTimer;
  function toast(msg, ms) {
    let t = document.querySelector('.toast');
    if (!t) { t = h('div', { class: 'toast' }); document.body.appendChild(t); }
    t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, ms || 2600);
  }
  function guard(fn) {
    return async function () {
      try { return await fn.apply(this, arguments); }
      catch (e) { console.error(e); toast(e.message || String(e), 4500); }
    };
  }

  const KEY_OPTS = T.NAMES.map((n, i) => [i, n]);
  const MODE_OPTS = Object.entries(T.MODES).map(([k, m]) => [k, m.name]);
  const KIND_LABELS = { melody: 'Isolert melodi', chords: 'Kordeloop', mix: 'Utdrag av full miks' };
  const KIND_ALL = Object.assign({ song: 'Låtbit (lyd)' }, KIND_LABELS);
  const SOURCE_LABELS = { midi: 'MIDI', audio: 'lyd', drawn: 'tegnet' };
  const STYLE_OPTS = Object.entries(A.STYLES).map(([k, s]) => [k, s.label]);
  const MODE_HELP = {
    keep: 'Melodien beholdes som den er. De tre variantene har ulike korder under seg: fra stilen din, fra låta selv, eller harmonisert av appen.',
    inspire: 'Et nytt motiv bygges av rytmen og formen i melodien du ga, og utvikles med gjentakelse, svar og oppløsning. Den blir ikke bare flyttet til en annen toneart.',
    rhythm: 'Rytmen i melodien beholdes nøyaktig. Tonene velges på nytt etter kordene.',
    chords: 'Kordene beholdes. Nye melodier skrives over dem, med kordetoner på de tunge slagene.',
  };
  const RULE_LABELS = {
    chordTone: ['Akkordtoner på tunge slag', 'Høy = tydelig harmonisk, lav = flere spenningstoner'],
    leap: ['Sprang', 'Lav = trinnvis, høy = store sprang (oktaver og kvinter)'],
    repetition: ['Gjentakelse', 'Hvor ofte motivet kommer tilbake uendret'],
    tension: ['Spenning', 'Hvor ustabilt spørsmålsfrasen slutter før svaret løser'],
    syncopation: ['Synkoper', 'Forskyvninger før slaget'],
    density: ['Tetthet', 'Antall toner i motivet'],
    similarity: ['Likhet med referansen', 'Hvor tett kontur og intervaller følges'],
  };

  /* ---------- tilstand ---------- */
  const app = {
    project: null,
    player: new MM.Player(),
    ui: { tab: 'mel', refId: null, audio: {}, imp: null, styleId: null, alts: null, altGroup: null, playing: null, startStep: 0, importTracks: null, exporting: null },
    decoded: {},
    saveTimer: null,
  };
  MM.app = app;

  function touch(noRender) {
    app.project.modified = Date.now();
    clearTimeout(app.saveTimer);
    app.saveTimer = setTimeout(() => F.store.put(app.project).catch((e) => console.warn('lagring', e)), 900);
    if (!noRender) render();
  }

  /* ---------- lyd ---------- */
  async function decodedSamples() {
    const out = {};
    const ctx = await app.player.unlock();
    for (const [p, s] of Object.entries(app.project.samples || {})) {
      const k = p + ':' + s.name + ':' + s.data.length;
      if (!app.decoded[k]) {
        try { app.decoded[k] = await ctx.decodeAudioData(F.fromBase64(s.data)); }
        catch (e) { toast('Kunne ikke lese sample ' + s.name); continue; }
      }
      out[p] = app.decoded[k];
    }
    return out;
  }

  async function play(arr, opts, tag) {
    if (app.ui.playing === tag) { stop(); return; }
    const samples = await decodedSamples();
    const pr = app.project;
    app.ui.playing = tag;
    updateTransport();
    await app.player.play(arr, Object.assign({
      instruments: pr.instruments, samples, mute: pr.mixer.mute, solo: pr.mixer.solo,
      onStep: (s) => onStep(s, tag),
      onEnd: () => { app.ui.playing = null; updateTransport(); },
    }, opts || {}));
    render(true);
  }
  function stop() {
    if (app.ui.origSrc) { try { app.ui.origSrc.stop(); } catch (e) { /* ferdig */ } app.ui.origSrc = null; }
    app.player.stop();
    app.ui.playing = null;
    onStep(null);
    updateTransport();
    render(true);
  }
  function onStep(s, tag) {
    const pos = document.getElementById('pos');
    const a = app.project && app.project.arrangement;
    if (s === null || s === undefined) { if (pos) pos.textContent = ''; }
    else if (pos) {
      const bar = Math.floor(s / SPB) + 1;
      const sec = tag === 'arr' && a ? a.sections.find((x) => s >= x.start * SPB && s < (x.start + x.bars) * SPB) : null;
      pos.textContent = 'takt ' + bar + (sec ? ' · ' + sec.label : '');
    }
    if (app.arrView) app.arrView.setPlayhead(tag === 'arr' ? s : null);
    if (app.themeRoll) app.themeRoll.setPlayhead(tag === 'theme' && s !== null ? s % (app.project.theme.bars * SPB) : null);
  }
  function updateTransport() {
    const b = document.getElementById('playBtn');
    if (b) { b.textContent = app.ui.playing ? '■' : '▶'; b.classList.toggle('on', !!app.ui.playing); }
  }

  let auditionEngine = null;
  async function audition(p, part) {
    const ctx = await app.player.unlock();
    if (!auditionEngine || auditionEngine.ctx !== ctx) auditionEngine = new MM.synth.Engine(ctx, { instruments: app.project.instruments, bpm: 120 });
    auditionEngine.note(part || 'lead', { p, v: 0.8 }, ctx.currentTime + 0.01, 0.22);
  }

  function refArrangement(ref) {
    const pr = app.project;
    const bpm = ref.bpm || pr.settings.bpm;
    const notes = ref.kind === 'song' ? ref.notes : MM.features.normalizeStart(ref.notes);
    const parts = { drums: [], bass: [], pad: [], pluck: [], lead: [] };
    if (ref.kind === 'chords') parts.pad = notes; else parts.lead = notes;
    if (ref.chords && ref.chords.length) {
      let prev = null;
      for (const c of ref.chords) {
        const v = MM.harmony.voice(ref.key, c.chord, prev, 52, 67);
        prev = v;
        if (ref.hits && !ref.hits.pad) {
          for (let t = c.t; t < c.t + c.len; t++) if (ref.hits.pat[t % 16]) for (const p of v) parts.pluck.push({ t, d: 2, p, v: 0.7 });
        } else for (const p of v) parts.pad.push({ t: c.t, d: c.len, p, v: 0.6 });
      }
      for (const n of ref.bass || []) parts.bass.push(n);
    }
    for (let b = 0; b < ref.bars; b++) for (let q = 0; q < 4; q++) parts.drums.push({ t: b * SPB + q * 4, d: 1, p: q % 2 ? 42 : 36, v: 0.5 });
    return { totalBars: ref.bars, parts, fx: [], automation: null, bpm, key: ref.key, style: pr.settings.style, sections: [] };
  }

  function themePreview(theme) {
    const pr = app.project;
    return A.preview(pr.settings, theme, pr.seeds);
  }
  const FULL_FILTERS = { bass: 1, pad: 0.85, pluck: 0.9, lead: 1 };

  /* ---------- oppstart ---------- */
  async function init() {
    let p = null;
    try { const id = F.store.lastId(); if (id) p = await F.store.get(id); } catch (e) { console.warn(e); }
    app.project = p || P.newProject();
    app.ui.refId = app.project.gen.refId;
    buildShell();
    render();
    if (!p) toast('Velkommen! Prøv: Melodi → Lag 3 varianter.', 4000);
  }

  const TABS = [['mel', 'Melodier', '♪'], ['sty', 'Stil', '◎'], ['lag', 'Lag', '✦'], ['arr', 'Arrangement', '▤'], ['snd', 'Lyd', '◉'], ['exp', 'Eksport', '⇪']];

  function buildShell() {
    const header = h('header', { class: 'top' },
      h('div', { class: 'brand' }, 'Motiv', h('span', {}, 'motor')),
      h('input', { id: 'projName', type: 'text', value: app.project.name, 'aria-label': 'Prosjektnavn', onchange: (e) => { app.project.name = e.target.value || 'Uten navn'; touch(true); } }),
      h('div', { class: 'transport' }, h('span', { id: 'pos' }), h('button', { id: 'playBtn', class: 'play', 'aria-label': 'Spill/stopp', onclick: guard(mainPlay) }, '▶')));
    const nav = h('nav', { class: 'tabs' }, TABS.map(([id, label, icon]) => h('button', { 'data-tab': id, onclick: () => { app.ui.tab = id; render(); window.scrollTo(0, 0); } }, h('b', {}, icon), label)));
    const main = h('main', {}, TABS.map(([id]) => h('section', { class: 'panel', id: 'panel-' + id })));
    document.body.innerHTML = '';
    document.body.append(header, nav, main);
  }

  async function mainPlay() {
    if (app.ui.playing) { stop(); return; }
    const pr = app.project;
    if (pr.arrangement) return play(pr.arrangement, { fromStep: app.ui.startStep || 0 }, 'arr');
    if (pr.theme) return play(themePreview(pr.theme), { loop: true, filters: FULL_FILTERS }, 'theme');
    const ref = P.refById(pr, app.ui.refId);
    if (ref) return play(refArrangement(ref), { loop: true, filters: FULL_FILTERS }, 'ref:' + ref.id);
  }

  /* render(true) = bare oppdater knappetilstander der det er billig; ellers bygg aktiv fane på nytt */
  function render(light) {
    document.querySelectorAll('nav.tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === app.ui.tab));
    document.querySelectorAll('.panel').forEach((p) => p.classList.toggle('on', p.id === 'panel-' + app.ui.tab));
    const name = document.getElementById('projName');
    if (name && document.activeElement !== name) name.value = app.project.name;
    updateTransport();
    if (light) {
      document.querySelectorAll('[data-play]').forEach((b) => {
        const on = b.dataset.play === app.ui.playing;
        b.textContent = on ? '■ Stopp' : b.dataset.label;
        b.classList.toggle('on', on);
      });
      return;
    }
    const panel = document.getElementById('panel-' + app.ui.tab);
    const y = window.scrollY;
    panel.innerHTML = '';
    app.arrView = null; app.themeRoll = null;
    ({ mel: renderRef, sty: renderStyle, lag: renderMelody, arr: renderArrange, snd: renderSound, exp: renderExport })[app.ui.tab](panel);
    window.scrollTo(0, y);
  }

  function playBtn(label, tag, fn, cls) {
    const on = app.ui.playing === tag;
    return h('button', { class: 'btn ' + (cls || '') + (on ? ' on' : ''), 'data-play': tag, 'data-label': label, onclick: guard(fn) }, on ? '■ Stopp' : label);
  }

  /* ================= REFERANSER ================= */
  function renderRef(el) {
    const pr = app.project;
    el.append(
      h('h2', {}, 'Gi meg en melodi du liker'),
      h('p', { class: 'lead-in' }, 'Fra hvilken som helst låt, i hvilket som helst tempo og hvilken som helst sjanger. Vokalen regnes som lead-melodien. Trommene bryr appen seg ikke om.'),
      audioImporter('melodi'),
      h('div', { class: 'row', style: 'margin-top:10px' },
        btn('Importer MIDI', guard(importMidi), 'small'),
        btn('Tegn selv', () => {
          const ref = P.makeReference({ name: 'Tegnet melodi ' + (pr.references.filter((r) => r.source === 'drawn').length + 1), kind: 'melody', source: 'drawn', notes: [], key: Object.assign({}, pr.settings.key), bars: 2 });
          pr.references.unshift(ref); app.ui.refId = ref.id; touch();
        }, 'small')));

    if (app.ui.importTracks) el.append(trackChooser());

    el.append(h('h2', {}, 'Melodiene dine'));
    if (!pr.references.length) el.append(h('div', { class: 'empty' }, 'Ingen melodier ennå.'));
    el.append(h('div', { class: 'list' }, pr.references.map((r) => h('div', {
      class: 'item' + (r.id === app.ui.refId ? ' sel' : ''), onclick: () => { app.ui.refId = r.id; render(); },
    },
    h('div', { class: 'grow' },
      h('div', { class: 'name' }, r.name),
      h('div', { class: 'faint' }, KIND_ALL[r.kind] + ' · ' + (r.bpm ? Math.round(r.bpm) + ' BPM · ' : '') + SOURCE_LABELS[r.source] + ' · ' + T.keyName(r.key) + ' · ' + r.bars + ' takt' + (r.bars > 1 ? 'er' : '') + ' · ' + r.notes.length + ' noter')),
    r.id === pr.gen.refId ? h('span', { class: 'badge ok' }, 'i bruk') : null))));

    const ref = P.refById(pr, app.ui.refId);
    if (ref) el.append(refEditor(ref));

    el.append(h('h2', {}, 'Egenskapsbibliotek'));
    if (!pr.library.length) el.append(h('p', { class: 'faint' }, 'Lagre egenskaper fra en referanse (kontur, rytme, akkorder …) for å blande dem fritt i Melodi-fanen.'));
    el.append(h('div', { class: 'list' }, pr.library.map((it) => h('div', { class: 'item' },
      h('div', { class: 'grow' }, h('div', { class: 'name' }, it.name), h('div', { class: 'faint mono' }, featureSummary(it.type, it.data))),
      btn('✕', () => { pr.library = pr.library.filter((x) => x !== it); for (const k of Object.keys(pr.gen.sources)) if (pr.gen.sources[k] === it.id) delete pr.gen.sources[k]; touch(); }, 'small ghost', 'Slett')))));
  }

  function trackChooser() {
    const imp = app.ui.importTracks;
    return h('div', { class: 'card' },
      h('h3', {}, imp.name + ': velg spor'),
      h('p', { class: 'faint' }, 'Filen har flere spor. Velg melodien eller akkordene du vil bruke.'),
      h('div', { class: 'list' }, imp.tracks.map((t, i) => h('div', { class: 'item', onclick: () => finishMidi(imp, [i]) },
        h('div', { class: 'grow' }, h('div', {}, t.name), h('div', { class: 'faint' }, t.notes.length + ' noter · ' + (t.isDrum ? 'trommer' : MM.features.maxPolyphony(t.notes) >= 3 ? 'akkorder' : 'melodi'))),
        h('span', { class: 'badge' }, 'Bruk')))),
      h('div', { class: 'row', style: 'margin-top:10px' }, btn('Slå sammen alle', () => finishMidi(imp, imp.tracks.map((_, i) => i)), 'small'), btn('Avbryt', () => { app.ui.importTracks = null; render(); }, 'small ghost')));
  }

  async function importMidi() {
    const file = await F.pickFile('.mid,.midi,audio/midi,audio/x-midi');
    if (!file) return;
    const m = MM.midi.parseMidi(await file.arrayBuffer());
    const tracks = m.tracks.filter((t) => !t.isDrum);
    if (!tracks.length) throw new Error('Fant ingen melodi- eller akkordnoter i filen (bare trommer?).');
    const imp = { name: file.name.replace(/\.midi?$/i, ''), bpm: m.bpm, tracks };
    if (tracks.length === 1) finishMidi(imp, [0]);
    else { app.ui.importTracks = imp; render(); }
  }

  function finishMidi(imp, idx) {
    const pr = app.project;
    let notes = [];
    for (const i of idx) notes = notes.concat(imp.tracks[i].notes);
    notes = MM.features.normalizeStart(MM.features.quantize(notes, 1));
    let cropped = false;
    if (notes.some((n) => n.t >= 16 * SPB)) { notes = notes.filter((n) => n.t < 16 * SPB); cropped = true; }
    const ref = P.makeReference({ name: imp.name + (idx.length === 1 && imp.tracks.length > 1 ? ' – ' + imp.tracks[idx[0]].name : ''), source: 'midi', notes, bpm: imp.bpm });
    pr.references.unshift(ref);
    app.ui.refId = ref.id; app.ui.importTracks = null;
    touch();
    toast('Importert og kvantisert til 1/16' + (cropped ? ' (de første 16 taktene)' : '') + '. Sjekk type, toneart og fraselengde.', 4200);
  }

  /* ---------- lyd inn: låtbit + valgfrie stems fra Logic ---------- */
  function audioImporter(target) {
    const imp = app.ui.imp && app.ui.imp.target === target ? app.ui.imp : null;
    const st = imp || { target, files: {}, start: 0, len: 30, bpm: '' };
    app.ui.imp = st;
    const card = h('div', { class: 'card' });
    const pickRow = (slot, label, help) => {
      const f = st.files[slot];
      return h('div', { class: 'item', style: 'cursor:default' },
        h('div', { class: 'grow' }, h('div', {}, label), h('div', { class: 'faint' }, f ? f.name + ' · ' + Math.round(f.buf.duration) + ' s' : help)),
        f ? btn('✕', () => { delete st.files[slot]; render(); }, 'small ghost') : null,
        btn(f ? 'Bytt' : 'Velg fil', guard(async () => {
          const file = await F.pickFile('audio/*,.wav,.mp3,.m4a,.aif,.aiff');
          if (!file) return;
          const ctx = await app.player.unlock();
          toast('Leser ' + file.name + ' …');
          const buf = await ctx.decodeAudioData(await file.arrayBuffer());
          st.files[slot] = { name: file.name, buf };
          if (!st.name) st.name = file.name.replace(/\.[^.]+$/, '').replace(/[\s_-]*\(?(vocals?|vokal|other|stem|mix)\)?$/i, '');
          const b = (file.name.match(/(\d{2,3})\s*bpm/i) || [])[1];
          if (b && !st.bpm) st.bpm = +b;
          if (st.len > buf.duration) st.len = Math.floor(buf.duration);
          render();
        }), 'small' + (slot === 'mix' && !f ? ' primary' : '')));
    };
    card.append(
      pickRow('mix', 'Låta (hele miksen)', 'Brukes til å finne takt og tempo. Velg låta, og skriv inn hvor biten du liker starter.'),
      pickRow('vocal', target === 'stil' ? 'Vokal-/lead-stem (valgfri)' : 'Vokal-stem (valgfri, anbefalt)', 'Fra Logic Stem Splitter: «Vocals». Gir mye renere melodi.'),
      pickRow('chords', 'Korde-stem (valgfri, anbefalt)', 'Fra Logic Stem Splitter: «Other». Gir renere korder.'));
    if (Object.keys(st.files).length) {
      const num = (label, key, attrs) => h('label', { class: 'f' }, label, h('input', Object.assign({ type: 'number', value: st[key], onchange: (e) => { st[key] = e.target.value === '' ? '' : +e.target.value; } }, attrs)));
      const status = h('p', { class: 'faint', role: 'status' });
      const prog = h('div', { class: 'progress', hidden: true }, h('i', {}));
      card.append(
        h('div', { class: 'row', style: 'margin-top:10px' },
          num('Start (sek)', 'start', { min: 0, step: 0.5 }), num('Lengde (sek)', 'len', { min: 8, max: 120 }),
          num(st.files.mix || st.files.chords ? 'Tempo (tomt = finn selv)' : 'Tempo (må fylles ut)', 'bpm', { min: 50, max: 200, placeholder: 'auto' })),
        h('label', { class: 'f', style: 'margin-top:8px' }, 'Navn', h('input', { type: 'text', value: st.name || '', onchange: (e) => { st.name = e.target.value; } })),
        h('div', { class: 'row', style: 'margin-top:10px' },
          btn('Analyser', guard(async (ev) => {
            if (!st.files.mix && !st.files.chords && !st.bpm) throw new Error('Med bare vokal må du skrive inn tempoet (det står i Logic).');
            const button = ev && ev.currentTarget;
            if (button) button.disabled = true;
            prog.hidden = false;
            const bar = prog.querySelector('i');
            const cache = {};
            const opts = {
              mix: st.files.mix && st.files.mix.buf, vocal: st.files.vocal && st.files.vocal.buf, chords: st.files.chords && st.files.chords.buf,
              start: +st.start || 0, len: +st.len || 30, bpm: +st.bpm || 0, cache,
              onProgress: (f, msg) => { bar.style.width = Math.round(f * 100) + '%'; status.textContent = (msg || 'Lytter …') + ' ' + Math.round(f * 100) + ' %'; },
            };
            let res;
            try { res = await MM.listen.analyzeSong(opts); } finally { if (button) button.disabled = false; }
            app.ui.imp = null;
            const ref = refFromAnalysis(res, st.name || (target === 'melodi' ? 'Låtbit' : 'Eksempel'));
            app.ui.audio[ref.id] = { files: st.files, start: opts.start, len: opts.len, bpm: opts.bpm, cache, res };
            if (target === 'melodi') { app.project.references.unshift(ref); app.ui.refId = ref.id; }
            else addStyleExample(ref);
            touch();
            toast('Ferdig. Sjekk resultatet og rett der det trengs.', 3500);
          }), 'primary'),
          btn('Tøm', () => { app.ui.imp = null; render(); }, 'ghost')),
        prog, status,
        h('p', { class: 'faint' }, 'Stems fra Logic må eksporteres fra samme startpunkt som miksen. 20–40 sekunder holder. Analysen skjer på Macen din, uten nett, og tar gjerne et halvt til ett minutt.'));
    } else {
      card.append(h('p', { class: 'faint', style: 'margin-top:8px' }, 'Best resultat: miks + vokal-stem + korde-stem. Bare vokal går også, da må du skrive inn tempoet.'));
    }
    return card;
  }

  function snapBars(b) { return [16, 8, 4, 2, 1].find((x) => x <= b) || 1; }

  function refFromAnalysis(res, name) {
    const bars = snapBars(res.bars);
    const inside = (n) => n.t < bars * SPB;
    const ref = P.makeReference({ name, kind: 'song', source: 'audio', key: res.key, bars, bpm: res.bpm, notes: res.lead.filter(inside), analysis: res.info });
    ref.keyConfidence = 0.7;
    ref.chords = res.chords.filter((c) => c.t < bars * SPB).map((c) => Object.assign({}, c, { len: Math.min(c.len, bars * SPB - c.t) }));
    ref.bass = res.bass.filter(inside);
    ref.hits = res.hits; ref.loop = Math.min(res.loop || bars, bars); ref.t0 = res.t0; ref.leadFrom = res.leadFrom;
    return ref;
  }

  /* Rett tempo eller taktstart uten å lytte på nytt (tonene er husket). */
  async function refixAudio(ref, change) {
    const au = app.ui.audio[ref.id];
    if (!au) throw new Error('Lydfilene er ikke åpne lenger. Importer låtbiten på nytt for å rette takten.');
    au.fix = au.fix || {};
    if (change === 'half') au.fix.half = !au.fix.half;
    else if (change === 'bar') au.fix.bar = ((au.fix.bar || 0) + 1) % 4;
    else if (change === 'dbl') au.bpm = Math.min(200, au.res.bpm * 2);
    else if (change === 'hlf') au.bpm = Math.max(50, au.res.bpm / 2);
    const res = await MM.listen.analyzeSong({
      mix: au.files.mix && au.files.mix.buf, vocal: au.files.vocal && au.files.vocal.buf, chords: au.files.chords && au.files.chords.buf,
      start: au.start, len: au.len, bpm: au.bpm || 0, fix: au.fix, cache: au.cache,
    });
    au.res = res;
    const fresh = refFromAnalysis(res, ref.name);
    for (const k of ['notes', 'chords', 'bass', 'hits', 'loop', 'bars', 'bpm', 'key', 'analysis', 't0']) ref[k] = fresh[k];
    touch();
    toast(Math.round(res.bpm) + ' BPM · ' + T.keyName(res.key));
  }

  function playOriginal(ref) {
    const au = app.ui.audio[ref.id];
    if (!au) return;
    if (app.ui.playing === 'orig:' + ref.id) { stop(); return; }
    stop();
    const buf = (au.files.mix || au.files.vocal || au.files.chords).buf;
    const ctx = app.player.ctx;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain(); g.gain.value = 0.8;
    src.connect(g); g.connect(ctx.destination);
    const off = au.start + (ref.t0 || 0);
    src.start(ctx.currentTime + 0.05, Math.max(0, off), Math.min(au.len, ref.bars * 4 * 60 / ref.bpm + 0.5));
    app.ui.origSrc = src;
    app.ui.playing = 'orig:' + ref.id;
    src.onended = () => { if (app.ui.playing === 'orig:' + ref.id) { app.ui.playing = null; render(true); } };
    render(true);
  }

  /* Det appen hørte i en låtbit: korder, korderytme, og knapper for å rette takten. */
  function songPanel(ref) {
    const box = h('div', { style: 'margin:10px 0' });
    const prog = (ref.chords || []).map((c) => T.chordName(ref.key, c.chord) + (c.len >= 32 ? ' (' + c.len / 16 + ')' : c.len < 16 ? ' (½)' : '')).join(' – ');
    box.append(
      h('p', {}, h('b', {}, Math.round(ref.bpm) + ' BPM · ' + T.keyName(ref.key)), h('span', { class: 'faint' }, ' · melodi fra ' + (ref.leadFrom || 'miksen'))),
      h('p', { class: 'mono', style: 'font-size:13px' }, 'Korder: ' + (prog || 'fant ingen tydelige')),
      ref.hits ? h('p', { class: 'mono faint' }, ref.hits.pad ? 'Kordene holdes (strings)' : 'Korderytme: ' + MM.styles.patText(ref.hits.pat)) : null);
    const au = app.ui.audio[ref.id];
    if (au) {
      box.append(h('div', { class: 'row' },
        playBtn('▶ Originalen', 'orig:' + ref.id, () => playOriginal(ref)),
        h('span', { class: 'faint' }, 'Takten feil?'),
        btn('Flytt ½ slag', guard(() => refixAudio(ref, 'half')), 'small'),
        btn('Taktstart ett slag senere', guard(() => refixAudio(ref, 'bar')), 'small'),
        btn('Tempo ×2', guard(() => refixAudio(ref, 'dbl')), 'small'),
        btn('Tempo ÷2', guard(() => refixAudio(ref, 'hlf')), 'small')));
    } else if (ref.source === 'audio') {
      box.append(h('p', { class: 'faint' }, 'Lydfilene er ikke åpne i denne økten. Notene og kordene er lagret; rett dem i rullen.'));
    }
    return box;
  }

  /* Melodiens tempo inn i stilen: velg ×½, ×1 eller ×2 slik at farten i sekunder ligger nærmest originalen. */
  function suggestScale(srcBpm, tgtBpm) {
    if (!srcBpm || !tgtBpm) return 1;
    const r = tgtBpm / srcBpm;
    return [0.5, 1, 2].reduce((b, k) => (Math.abs(Math.log2(r / k)) < Math.abs(Math.log2(r / b)) ? k : b), 1);
  }

  /* ================= STIL ================= */
  function currentStyle() {
    const id = app.ui.styleId || (app.project.style && app.project.style.id);
    return MM.styles.store.all().find((s) => s.id === id) || null;
  }

  function addStyleExample(ref) {
    const style = currentStyle();
    if (!style) throw new Error('Lag eller velg en stil først.');
    style.examples.push(MM.styles.exampleFrom(ref));
    style.modified = Date.now();
    if (!MM.styles.store.upsert(style)) throw new Error('Lagringsplassen i nettleseren er full.');
    if (app.project.style && app.project.style.id === style.id) app.project.style = JSON.parse(JSON.stringify(style));
  }

  function renderStyle(el) {
    const pr = app.project;
    const all = MM.styles.store.all();
    el.append(
      h('h2', {}, 'Stilen du vil lage'),
      h('p', { class: 'lead-in' }, 'Gi appen biter av låter i sjangeren du vil lage (for eksempel Adam K & Soha, Deadmau5). Melodien trenger ikke være perfekt. Appen lærer tempoet, rytmen i kordene, hvor lenge kordene varer før de skifter, kordeprogresjonene og bassrytmen.'));
    const nameIn = h('input', { type: 'text', placeholder: 'For eksempel Melodisk prog house', style: 'flex:1;min-width:0' });
    el.append(h('div', { class: 'row' }, nameIn, btn('+ Ny stil', guard(() => {
      const n = nameIn.value.trim();
      if (!n) throw new Error('Gi stilen et navn.');
      const st = { id: 's' + MM.rng.newSeed().toString(36), name: n, examples: [], created: Date.now() };
      MM.styles.store.upsert(st);
      app.ui.styleId = st.id; render();
    }), 'primary')));
    if (!all.length) { el.append(h('div', { class: 'empty' }, 'Ingen stiler ennå. Lag en, og gi den 3–10 eksempler.')); return; }
    const style = currentStyle() || all[0];
    app.ui.styleId = style.id;
    el.append(h('div', { class: 'list', style: 'margin-top:12px' }, all.map((s) => h('div', { class: 'item' + (s.id === style.id ? ' sel' : ''), onclick: () => { app.ui.styleId = s.id; render(); } },
      h('div', { class: 'grow' }, h('div', { class: 'name' }, s.name), h('div', { class: 'faint' }, s.examples.length + ' eksempler')),
      pr.style && pr.style.id === s.id ? h('span', { class: 'badge ok' }, 'i bruk') : null))));

    const L = MM.styles.learn(style);
    const card = h('div', { class: 'card sel' },
      h('div', { class: 'row spread' }, h('h3', {}, style.name),
        h('div', { class: 'row' },
          btn(pr.style && pr.style.id === style.id ? 'I bruk' : 'Bruk i prosjektet', () => {
            pr.style = JSON.parse(JSON.stringify(style));
            if (L.bpm && pr.settings.style !== 'hiphop') pr.settings.bpm = L.bpm;
            const ref = P.refById(pr, pr.gen.refId);
            if (ref) pr.gen.melodyScale = suggestScale(ref.bpm, pr.settings.bpm);
            if (pr.arrangement) P.buildArrangement(pr);
            touch(); toast('«' + style.name + '» brukes nå i Lag og Arrangement.');
          }, pr.style && pr.style.id === style.id ? '' : 'primary'),
          pr.style && pr.style.id === style.id ? btn('Slutt å bruke', () => { pr.style = null; if (pr.arrangement) P.buildArrangement(pr); touch(); }, 'small ghost') : null)),
      h('p', { class: 'mono', style: 'white-space:pre-wrap;font-size:13px' }, MM.styles.describe(L, pr.settings.key)),
      L.hitPats.length ? h('div', {}, h('div', { class: 'faint' }, 'Korderytmer den har lært (x = anslag, | = slag):'),
        L.hitPats.slice(0, 4).map((hp) => h('div', { class: 'mono', style: 'font-size:13px' }, MM.styles.patText(hp.pat) + '  ×' + hp.w))) : null);
    el.append(card);

    el.append(h('h2', {}, 'Legg til eksempel'));
    el.append(audioImporter('stil'));
    const midiBtn = btn('Legg til MIDI-fil', guard(async () => {
      const file = await F.pickFile('.mid,.midi,audio/midi');
      if (!file) return;
      const m = MM.midi.parseMidi(await file.arrayBuffer());
      let notes = [];
      for (const t of m.tracks) if (!t.isDrum) notes = notes.concat(t.notes);
      notes = MM.features.normalizeStart(MM.features.quantize(notes, 1)).filter((n) => n.t < 16 * SPB);
      const ref = P.makeReference({ name: file.name.replace(/\.midi?$/i, ''), notes, bpm: m.bpm, source: 'midi' });
      ref.kind = 'chords';
      const ch = MM.features.analyzeChords(notes, ref.key, ref.bars, 16);
      ref.chords = ch.chords;
      addStyleExample(ref); touch(); toast('Lagt til');
    }), 'small');
    const fromMel = pr.references.length ? select([['', 'Fra en av melodiene dine …']].concat(pr.references.map((r) => [r.id, r.name])), '', guard((v) => {
      const r = P.refById(pr, v); if (!r) return;
      addStyleExample(r); touch(); toast('«' + r.name + '» lagt til i stilen');
    })) : null;
    el.append(h('div', { class: 'row', style: 'margin-top:10px' }, midiBtn, fromMel));

    el.append(h('h2', {}, 'Eksempler (' + style.examples.length + ')'));
    el.append(h('div', { class: 'list' }, style.examples.map((x) => h('div', { class: 'item', style: 'cursor:default' },
      h('div', { class: 'grow' }, h('div', { class: 'name' }, x.name),
        h('div', { class: 'faint mono' }, (x.bpm ? Math.round(x.bpm) + ' BPM · ' : '') + x.bars + ' takter · ' + (x.hits && !x.hits.pad ? MM.styles.patText(x.hits.pat) : 'holdte korder'))),
      btn('✕', () => {
        style.examples = style.examples.filter((y) => y !== x);
        MM.styles.store.upsert(style);
        if (pr.style && pr.style.id === style.id) pr.style = JSON.parse(JSON.stringify(style));
        touch();
      }, 'small ghost', 'Fjern')))));
    el.append(h('div', { class: 'row', style: 'margin-top:14px' }, btn('Slett stilen', () => {
      if (!confirm('Slette stilen «' + style.name + '» og alle eksemplene?')) return;
      MM.styles.store.remove(style.id); app.ui.styleId = null; render();
    }, 'ghost danger')));
  }

  function refEditor(ref) {
    const pr = app.project;
    const card = h('div', { class: 'card sel' });
    const summary = h('div', { class: 'faint mono', style: 'white-space:pre-wrap;margin-top:8px' });
    const refreshSummary = () => { summary.textContent = refSummary(ref); };
    card.append(
      h('div', { class: 'row spread' },
        h('input', { type: 'text', value: ref.name, style: 'flex:1;min-width:0', onchange: (e) => { ref.name = e.target.value; touch(); } }),
        playBtn('▶ Spill', 'ref:' + ref.id, () => play(refArrangement(ref), { loop: true, filters: FULL_FILTERS }, 'ref:' + ref.id))),
      ref.kind === 'song' ? songPanel(ref) : h('div', { style: 'margin:12px 0 6px' }, h('div', { class: 'faint' }, 'Hva slags materiale er dette?'),
        seg(Object.entries(KIND_LABELS), ref.kind, (k) => { ref.kind = k; touch(); }, true)));
    if (ref.kind === 'mix') card.append(h('div', { class: 'msg warn' }, 'Fra en full miks kan verken noter eller akkorder hentes ut sikkert. Bruk forslagene som skisse og rett opp noter, rytme og akkorder selv.'));
    if (ref.analysis) card.append(h('div', { class: 'msg' + (ref.analysis.confidence < 0.6 ? ' warn' : '') }, ref.analysis.summary));
    const kc = Math.round((ref.keyConfidence || 0) * 100);
    card.append(
      h('div', { class: 'grid2', style: 'margin-top:8px' },
        h('label', { class: 'f' }, 'Toneart' + (ref.keyConfidence < 1 ? ' (forslag, sikkerhet ' + kc + ' %)' : ''),
          h('div', { class: 'row' },
            select(KEY_OPTS, ref.key.root, (v) => { ref.key = { root: +v, mode: ref.key.mode }; ref.keyConfidence = 1; touch(); }),
            select(MODE_OPTS, ref.key.mode, (v) => { ref.key = { root: ref.key.root, mode: v }; ref.keyConfidence = 1; touch(); }))),
        h('label', { class: 'f' }, 'Fraselengde (takter)', seg([[1, '1'], [2, '2'], [4, '4'], [8, '8'], [16, '16']], ref.bars, (v) => { ref.bars = +v; touch(); }))));
    if (ref.keyConfidence < 1 && ref.keyCandidates && ref.keyCandidates.length > 1) {
      card.append(h('div', { class: 'row', style: 'margin-top:6px' }, h('span', { class: 'faint' }, 'Andre muligheter:'),
        ref.keyCandidates.slice(1, 4).map((k) => h('span', { class: 'chip', onclick: () => { ref.key = { root: k.root, mode: k.mode }; ref.keyConfidence = 1; touch(); } }, T.keyName(k)))));
    }
    if (ref.kind === 'chords') {
      card.append(h('label', { class: 'f', style: 'margin-top:10px' }, 'Akkordtempo',
        seg([[8, '½ takt'], [16, '1 takt'], [32, '2 takter']], ref.chordSlot || 16, (v) => { ref.chordSlot = +v; touch(); })));
    }
    const rollHost = h('div', { style: 'margin-top:12px' });
    card.append(rollHost);
    let chords;
    if (ref.chords && ref.chords.length) chords = ref.chords;
    else try { chords = ref.kind === 'chords' && ref.notes.length ? MM.features.analyzeChords(ref.notes, ref.key, ref.bars, ref.chordSlot).chords : undefined; } catch (e) { chords = undefined; }
    // pianorullen bygges etter at kortet er satt inn i DOM
    setTimeout(() => {
      new MM.PianoRoll(rollHost, {
        notes: ref.notes, bars: ref.bars, key: ref.key, chords, color: ref.kind === 'chords' ? '#a68bdc' : '#ffb000',
        onAudition: (p) => audition(p, ref.kind === 'chords' ? 'pluck' : 'lead'),
        onChange: (notes) => { ref.notes = notes; refreshSummary(); touch(true); },
        extraTools: [
          ['Kvantiser', 'Kvantiser til 1/16', () => { ref.notes = MM.features.quantize(ref.notes, 1); touch(); }],
          ['−8', 'Én oktav ned', () => { ref.notes = ref.notes.map((n) => Object.assign({}, n, { p: n.p - 12 })); touch(); }],
          ['+8', 'Én oktav opp', () => { ref.notes = ref.notes.map((n) => Object.assign({}, n, { p: n.p + 12 })); touch(); }],
        ],
      });
    }, 0);
    refreshSummary();
    card.append(summary);

    const types = ref.kind === 'chords' ? ['chords'] : ['melody', 'rhythm', 'contour', 'intervals', 'phrase', 'rests', 'accents', 'chords'];
    const checks = {};
    card.append(h('h2', {}, 'Lagre egenskaper som egne referanser'),
      h('div', { class: 'row' }, types.map((t) => {
        const cb = h('input', { type: 'checkbox', checked: t !== 'chords' || ref.kind === 'chords' });
        checks[t] = cb;
        return h('label', { class: 'chip' }, cb, MM.features.FEATURE_TYPES[t]);
      })),
      h('div', { class: 'row', style: 'margin-top:10px' },
        btn('Lagre valgte', guard(() => {
          if (!ref.notes.length) throw new Error('Referansen har ingen noter.');
          const sel = types.filter((t) => checks[t].checked);
          const items = MM.features.libraryItems(ref, sel);
          pr.library.push(...items);
          touch();
          toast(items.length + ' egenskaper lagret i biblioteket');
        })),
        btn('Bruk i Lag →', () => {
          if (ref.kind === 'chords') { pr.gen.chordRefId = ref.id; if (pr.gen.mode !== 'keep') pr.gen.mode = 'chords'; }
          else pr.gen.refId = ref.id;
          if (pr.gen.bars < ref.bars) pr.gen.bars = Math.min(16, Math.max(4, ref.bars));
          pr.settings.key = Object.assign({}, ref.key);
          if (ref.bpm && ref.source === 'midi' && !pr.style) pr.settings.bpm = Math.round(ref.bpm);
          pr.gen.melodyScale = suggestScale(ref.bpm, pr.settings.bpm);
          if (ref.kind === 'song' && pr.gen.mode !== 'keep' && pr.gen.mode !== 'inspire') pr.gen.mode = 'keep';
          app.ui.tab = 'lag'; touch();
        }, 'primary'),
        btn('Slett', () => {
          if (!confirm('Slette «' + ref.name + '»?')) return;
          pr.references = pr.references.filter((r) => r !== ref);
          if (pr.gen.refId === ref.id) pr.gen.refId = null;
          if (pr.gen.chordRefId === ref.id) pr.gen.chordRefId = null;
          app.ui.refId = null; touch();
        }, 'ghost danger')));
    return card;
  }

  function refSummary(ref) {
    if (!ref.notes.length) return 'Trykk i rullen for å tegne noter.';
    try {
      if (ref.kind === 'chords') {
        const ch = MM.features.analyzeChords(ref.notes, ref.key, ref.bars, ref.chordSlot);
        return 'Akkorder: ' + ch.chords.map((c) => T.chordName(ref.key, c.chord) + (c.conf < 0.6 ? '?' : '')).join(' – ') +
          '\nRomertall: ' + ch.chords.map((c) => T.roman(ref.key, c.chord)).join(' – ');
      }
      const a = MM.features.analyzeMelody(ref.notes, ref.key, ref.bars);
      return [
        'Kontur:     ' + featureSummary('contour', a.contour),
        'Intervaller: ' + featureSummary('intervals', a.intervals),
        'Rytme:      ' + featureSummary('rhythm', a.rhythm),
        'Frase:      ' + featureSummary('phrase', a.phrase) + ' · ' + featureSummary('rests', a.rests),
      ].join('\n');
    } catch (e) { return ''; }
  }

  function featureSummary(type, d) {
    if (!d) return '';
    switch (type) {
      case 'melody': return d.notes.length + ' noter, ' + d.bars + ' takter';
      case 'contour': return d.dirs.map((x) => (x > 0 ? '↗' : x < 0 ? '↘' : '→')).join('');
      case 'intervals': return d.steps.map((s) => (s > 0 ? '+' : '') + s).join(' ') + ' (trinn)';
      case 'rhythm': {
        let s = '';
        const len = Math.min(d.len, 32);
        for (let i = 0; i < len; i++) { if (i && i % 16 === 0) s += '|'; s += d.onsets.some((o) => Math.round(o) === i) ? 'x' : '·'; }
        return s;
      }
      case 'phrase': return d.bars + ' takter, ' + d.phrases.length + ' delfrase' + (d.phrases.length > 1 ? 'r' : '');
      case 'rests': return d.gaps.length + ' pause' + (d.gaps.length === 1 ? '' : 'r') + (d.gaps.length ? ' (snitt ' + (d.gaps.reduce((s, g) => s + g.d, 0) / d.gaps.length).toFixed(1) + ' steg)' : '');
      case 'accents': return d.values.map((v) => (v > 0.75 ? '!' : v > 0.5 ? '•' : '·')).join('');
      case 'chords': return d.chords.map((c) => T.chordName(d.key, c.chord)).join(' – ');
      default: return '';
    }
  }

  /* ================= MELODI ================= */
  function renderMelody(el) {
    const pr = app.project, g = pr.gen, st = pr.settings;
    const melRefs = pr.references.filter((r) => r.kind !== 'chords');
    const chordRefs = pr.references.filter((r) => r.kind === 'chords' || r.kind === 'mix' || (r.kind === 'song' && r.chords && r.chords.length));
    const styles = MM.styles.store.all();
    const src = P.refById(pr, g.refId);
    const L = P.learned(pr);
    const top = h('div', { class: 'card' },
      h('div', { class: 'grid2' },
        h('label', { class: 'f' }, 'Melodi fra',
          select([['', '– ingen –']].concat(melRefs.map((r) => [r.id, r.name + (r.bpm ? ' (' + Math.round(r.bpm) + ' BPM)' : '')])), g.refId || '', (v) => {
            g.refId = v || null;
            const r = P.refById(pr, v);
            if (r) { g.melodyScale = suggestScale(r.bpm, st.bpm); if (r.bars > g.bars && r.kind === 'song') g.bars = Math.min(16, r.bars); }
            touch();
          })),
        h('label', { class: 'f' }, 'Stil',
          select([['', 'Ingen (innebygd ' + A.STYLES[st.style].label.toLowerCase() + ')']].concat(styles.map((x) => [x.id, x.name + ' · ' + x.examples.length + ' eks.'])), pr.style ? pr.style.id : '', (v) => {
            const x = styles.find((y) => y.id === v);
            pr.style = x ? JSON.parse(JSON.stringify(x)) : null;
            const l2 = P.learned(pr);
            if (l2 && l2.bpm && st.style !== 'hiphop') st.bpm = l2.bpm;
            if (src) g.melodyScale = suggestScale(src.bpm, st.bpm);
            if (pr.arrangement) P.buildArrangement(pr);
            touch();
          }))),
      L && L.count ? h('p', { class: 'faint', style: 'white-space:pre-wrap' }, MM.styles.describe(L, st.key)) : null,
      h('div', { class: 'grid2', style: 'margin-top:8px' },
        h('label', { class: 'f' }, 'Retning og tempo', h('div', { class: 'row' },
          select(STYLE_OPTS, st.style, (v) => changeStyle(v)),
          h('input', { type: 'number', min: 60, max: 160, value: st.bpm, 'aria-label': 'Tempo', onchange: (e) => { st.bpm = T.clamp(+e.target.value || 124, 60, 160); if (src) g.melodyScale = suggestScale(src.bpm, st.bpm); if (pr.arrangement) P.buildArrangement(pr); touch(); } }),
          h('span', { class: 'faint' }, 'BPM'))),
        src && src.bpm ? h('label', { class: 'f' }, 'Melodiens fart (låta går i ' + Math.round(src.bpm) + ' BPM)',
          seg([[0.5, 'Dobbel'], [1, 'Som i takten'], [2, 'Halv']], g.melodyScale || 1, (v) => { g.melodyScale = +v; touch(); }, true)) : h('span', {})),
      src && src.bpm ? h('p', { class: 'faint' }, 'Melodien føles som ca. ' + Math.round(st.bpm / (g.melodyScale || 1)) + ' BPM i originalens fart (' + Math.round(st.bpm / (g.melodyScale || 1) / src.bpm * 100) + ' %).') : null,
      h('div', { class: 'row', style: 'margin-top:6px' },
        st.style !== 'hiphop' ? btn('Halvtempo-hiphop av dette', () => {
          const target = T.clamp(Math.round(st.bpm / 2 * 1.25), 70, 95);
          changeStyle('hiphop');
          st.bpm = target;
          if (pr.arrangement) P.buildArrangement(pr);
          touch(); toast('Melodisk hiphop i ' + target + ' BPM. Juster tempoet fritt.');
        }, 'small', 'Halverer tempoet og løfter det litt, med hiphop-trommer og 808') : null));
    el.append(h('h2', {}, 'Melodi og stil'), top);
    el.append(
      h('h2', {}, 'Hva skal lages?'),
      seg(Object.entries(MM.melody.MODE_LABELS), g.mode, (m) => { g.mode = m; touch(); }, true),
      h('p', { class: 'lead-in' }, MODE_HELP[g.mode]));

    const card = h('div', { class: 'card' });
    card.append(h('div', { class: 'grid2' },
      h('label', { class: 'f' }, 'Korder fra (overstyrer stilen)',
        select([['', L && L.count ? 'Stilen' : g.mode === 'keep' ? 'Harmoniser melodien' : 'Innebygd bank (frøstyrt)']].concat(chordRefs.map((r) => [r.id, r.name])), g.chordRefId || '', (v) => { g.chordRefId = v || null; touch(); }))));
    // bland enkeltegenskaper
    const det = h('details', {}, h('summary', {}, 'Bland egenskaper fra biblioteket'));
    const types = ['rhythm', 'contour', 'intervals', 'phrase', 'rests', 'accents', 'chords', 'melody'];
    det.append(h('div', { class: 'grid2' }, types.map((t) => {
      const items = pr.library.filter((x) => x.type === t);
      return h('label', { class: 'f' }, MM.features.FEATURE_TYPES[t],
        select([['', 'Fra referansen over'], ['none', 'Ikke bruk']].concat(items.map((x) => [x.id, x.name])), g.sources[t] || '', (v) => { if (v) g.sources[t] = v; else delete g.sources[t]; touch(true); }));
    })));
    if (!pr.library.length) det.append(h('p', { class: 'faint' }, 'Biblioteket er tomt. Lagre egenskaper fra en melodi under Melodier.'));
    if (Object.keys(g.sources).length) det.open = true;
    card.append(det);
    card.append(h('div', { class: 'grid2', style: 'margin-top:6px' },
      h('label', { class: 'f' }, 'Toneart', h('div', { class: 'row' },
        select(KEY_OPTS, st.key.root, (v) => changeKey({ root: +v, mode: st.key.mode })),
        select(MODE_OPTS, st.key.mode, (v) => changeKey({ root: st.key.root, mode: v })))),
      h('label', { class: 'f' }, 'Fraselengde', seg([[2, '2'], [4, '4'], [8, '8'], [16, '16 takter']], g.bars, (v) => { g.bars = +v; touch(); }))));
    if (src && src.kind === 'song' && T.keyName(src.key) !== T.keyName(st.key)) {
      card.append(h('p', { class: 'faint' }, 'Låta er i ' + T.keyName(src.key) + '. ', btn('Bruk ' + T.keyName(src.key), () => changeKey(Object.assign({}, src.key)), 'small ghost')));
    }
    el.append(card);

    const rules = h('details', {}, h('summary', {}, 'Regler for melodi og harmoni'));
    for (const [k, [lab, help]] of Object.entries(RULE_LABELS)) {
      const s = slider(lab, pr.rules[k], 0, 1, 0.05, (v) => { pr.rules[k] = v; touch(true); }, (v) => Math.round(v * 100));
      s.title = help;
      rules.append(s, h('div', { class: 'faint', style: 'margin:-2px 0 8px' }, help));
    }
    rules.append(btn('Tilbakestill reglene', () => { pr.rules = Object.assign({}, MM.melody.DEFAULT_RULES); touch(); }, 'small ghost'));
    el.append(rules);

    const seedIn = h('input', { type: 'text', value: MM.rng.seedCode(g.seed), style: 'width:110px', class: 'mono', 'aria-label': 'Frø' });
    el.append(h('div', { class: 'row', style: 'margin:14px 0' },
      btn('Lag 3 varianter', guard(() => { stop(); P.makeVariants(pr); touch(); }), 'primary'),
      btn('Samme frø', guard(() => {
        const s = MM.rng.parseSeedCode(seedIn.value);
        if (s === null) throw new Error('Ugyldig frø');
        stop(); P.makeVariants(pr, s); touch();
      }), 'small', 'Lag variantene på nytt med frøet i feltet'),
      h('span', { class: 'faint' }, 'Frø'), seedIn));

    if (pr.variants.length) {
      const grid = h('div', { class: 'grid3' });
      pr.variants.forEach((v, i) => {
        const chosen = pr.theme && JSON.stringify(pr.theme.notes) === JSON.stringify(v.notes) && JSON.stringify(pr.theme.chords) === JSON.stringify(v.chords);
        const rh = h('div', {});
        const c = h('div', { class: 'card' + (chosen ? ' sel' : '') },
          h('div', { class: 'row spread' }, h('h3', {}, 'Variant ' + v.label), chosen ? h('span', { class: 'badge ok' }, 'valgt') : null),
          h('p', { class: 'faint' }, v.desc),
          h('p', { class: 'mono', style: 'font-size:12px' }, MM.harmony.progressionLabel(st.key, v.chords)),
          rh,
          h('div', { class: 'row', style: 'margin-top:10px' },
            playBtn('▶ Lytt', 'var:' + i, () => play(themePreview(v), { loop: true, filters: FULL_FILTERS }, 'var:' + i)),
            btn(chosen ? 'Valgt' : 'Velg', guard(() => chooseTheme(i)), chosen ? '' : 'primary')));
        grid.append(c);
        setTimeout(() => new MM.PianoRoll(rh, { notes: v.notes, bars: v.bars, key: st.key, chords: v.chords, editable: false }), 0);
      });
      el.append(grid);
    } else {
      el.append(h('div', { class: 'empty' }, 'Trykk «Lag 3 varianter» for å komme i gang. Uten egne melodier brukes demohooken i A-moll.'));
    }

    if (pr.theme) {
      el.append(h('h2', {}, 'Valgt melodi'));
      const t = pr.theme;
      const host = h('div', {});
      const card2 = h('div', { class: 'card sel' },
        h('div', { class: 'row spread' },
          h('div', {}, h('div', { class: 'mono', style: 'font-size:13px' }, MM.harmony.progressionLabel(st.key, t.chords)), h('div', { class: 'faint' }, MM.harmony.progressionRoman(st.key, t.chords) + ' · ' + t.bars + ' takter')),
          h('div', { class: 'row' },
            playBtn('▶ Lytt', 'theme', () => play(themePreview(t), { loop: true, filters: FULL_FILTERS }, 'theme')),
            lockBtn('melody'))),
        h('p', { class: 'faint' }, 'Rett gjerne på notene. Arrangementet oppdateres når du endrer melodien.'),
        host,
        h('div', { class: 'row', style: 'margin-top:12px' },
          btn(pr.arrangement ? 'Til arrangementet →' : 'Bygg arrangement →', guard(() => {
            if (!pr.arrangement) P.buildArrangement(pr);
            app.ui.tab = 'arr'; touch(); window.scrollTo(0, 0);
          }), 'primary')));
      el.append(card2);
      setTimeout(() => {
        app.themeRoll = new MM.PianoRoll(host, {
          notes: t.notes, bars: t.bars, key: st.key, chords: t.chords,
          onAudition: (p) => audition(p, 'lead'),
          onChange: (notes) => { t.notes = notes; rebuildLeadOnly(); touch(true); },
        });
      }, 0);
    }
  }

  function lockBtn(group) {
    const pr = app.project;
    const on = !!pr.locked[group];
    return h('button', { class: 'btn small' + (on ? ' on' : ''), title: on ? 'Låst – beholdes ved regenerering' : 'Lås for å beholde ved regenerering', onclick: () => { pr.locked[group] = !on; touch(); } }, on ? '🔒 Låst' : '🔓 Lås');
  }

  function chooseTheme(i) {
    const pr = app.project;
    stop();
    P.chooseVariant(pr, i);
    if (pr.arrangement) {
      const keep = Object.assign({}, pr.locked);
      pr.locked = { melody: false, chords: false, bass: false, drums: !!keep.drums };
      P.buildArrangement(pr);
      pr.locked = keep;
    }
    app.ui.alts = null;
    touch();
    toast('Variant ' + pr.variants[i].label + ' er valgt.');
  }

  function rebuildLeadOnly() {
    const pr = app.project;
    if (!pr.arrangement) return;
    const keep = pr.locked;
    pr.locked = { melody: false, chords: true, bass: true, drums: true };
    P.buildArrangement(pr);
    pr.locked = keep;
  }

  function changeKey(k) {
    const pr = app.project;
    const old = pr.settings.key;
    pr.settings.key = k;
    if (pr.theme) {
      pr.theme.notes = MM.melody.placeRegister(MM.melody.mapToKey(pr.theme.notes, old, k), pr.settings.style === 'house' ? 72 : 76);
      pr.theme.key = k;
      for (const v of pr.variants) { v.notes = MM.melody.placeRegister(MM.melody.mapToKey(v.notes, old, k), pr.settings.style === 'house' ? 72 : 76); v.key = k; }
      if (pr.arrangement) { const keep = pr.locked; pr.locked = {}; P.buildArrangement(pr); pr.locked = keep; }
      toast('Melodien er flyttet til ' + T.keyName(k));
    }
    touch();
  }

  function changeStyle(s) {
    const pr = app.project;
    pr.settings.style = s;
    pr.settings.bpm = A.STYLES[s].bpm;
    const master = pr.instruments.master;
    pr.instruments = P.defaultInstruments(s);
    pr.instruments.master = master;
    if (pr.arrangement) P.buildArrangement(pr);
    toast(A.STYLES[s].label + ': ' + pr.settings.bpm + ' BPM og stilens lyder');
    touch();
  }

  /* ================= ARRANGEMENT ================= */
  let rebuildTimer;
  function scheduleRebuild() {
    clearTimeout(rebuildTimer);
    rebuildTimer = setTimeout(guard(() => {
      const pr = app.project;
      if (!pr.arrangement) return;
      const wasPlaying = app.ui.playing === 'arr';
      if (wasPlaying) stop();
      P.buildArrangement(pr);
      app.ui.alts = null;
      touch();
    }), 250);
  }

  function renderArrange(el) {
    const pr = app.project, st = pr.settings;
    if (!pr.theme) {
      el.append(h('div', { class: 'empty' }, 'Lag og velg en melodi i Lag-fanen først.', h('div', { style: 'margin-top:12px' }, btn('Gå til Lag', () => { app.ui.tab = 'lag'; render(); }, 'primary'))));
      return;
    }
    const total = A.totalBarsFor(st.lengthMin, st.bpm);
    el.append(h('div', { class: 'card' },
      h('label', { class: 'f' }, 'Retning', seg(STYLE_OPTS, st.style, (v) => changeStyle(v), true)),
      h('div', { class: 'grid2', style: 'margin-top:10px' },
        h('label', { class: 'f' }, 'Tempo (BPM)', h('input', { type: 'number', min: 100, max: 150, value: st.bpm, onchange: (e) => { st.bpm = T.clamp(+e.target.value || 128, 90, 160); scheduleRebuild(); touch(true); } })),
        h('label', { class: 'f' }, 'Breakdown', seg([[1, 'Med'], [0, 'Uten']], st.breakdown ? 1 : 0, (v) => { st.breakdown = !!+v; scheduleRebuild(); touch(true); render(); }))),
      slider('Energi', st.energy, 1, 5, 1, (v) => { st.energy = v; scheduleRebuild(); touch(true); }),
      slider('Lengde (min)', st.lengthMin, 2, 12, 0.5, (v) => { st.lengthMin = v; scheduleRebuild(); touch(true); render(); }, (v) => v + ''),
      h('p', { class: 'faint' }, total + ' takter ≈ ' + (total * 4 / st.bpm).toFixed(1) + ' min. Melodien introduseres gradvis og spiller ikke fullt gjennom hele sporet.')));

    if (!pr.arrangement) {
      el.append(btn('Bygg arrangement', guard(() => { P.buildArrangement(pr); touch(); }), 'primary'));
      return;
    }
    const a = pr.arrangement;
    el.append(h('div', { class: 'row', style: 'margin:12px 0' },
      playBtn('▶ Spill fra start', 'arr', () => { app.ui.startStep = 0; return play(a, { fromStep: 0 }, 'arr'); }, 'primary'),
      btn('Bygg på nytt', guard(() => { stop(); P.buildArrangement(pr); touch(); }), '', 'Bygg med samme frø og låser')));
    const viewHost = h('div', {});
    el.append(viewHost);
    app.arrView = new MM.ArrangeView(viewHost, { onSeek: (s) => { app.ui.startStep = s; play(a, { fromStep: s }, 'arr'); app.ui.playing = 'arr'; } });
    app.arrView.set(a, pr.locked);
    el.append(h('div', { class: 'row', style: 'margin:10px 0' }, a.sections.map((s) => h('span', {
      class: 'chip', title: 'Spill fra ' + s.label,
      onclick: () => { app.ui.startStep = s.start * SPB; if (app.ui.playing) stop(); play(a, { fromStep: s.start * SPB }, 'arr'); },
    }, s.label + ' · ' + s.bars))));

    el.append(h('h2', {}, 'Deler – lås det som er bra, regenerer resten'));
    const info = {
      melody: (a.info.leadPlan || []).map((x) => A.LEAD_KIND_LABELS[x.kind]).filter((x, i, arr) => arr.indexOf(x) === i).join(' → '),
      chords: MM.harmony.progressionLabel(st.key, pr.theme.chords) + ' · ' + (a.info.arp || ''),
      bass: (a.info.bassPattern || '') + ' bass mellom kickslagene',
      drums: 'kick, clap, hihat, perk, innfyll og virvler',
    };
    const colors = { melody: 'var(--c-lead)', chords: 'var(--c-pad)', bass: 'var(--c-bass)', drums: 'var(--c-drums)' };
    const partOf = { melody: 'lead', chords: 'pad', bass: 'bass', drums: 'drums' };
    el.append(h('div', { class: 'list' }, Object.keys(A.GROUPS).map((g) => {
      const part = partOf[g];
      const muted = pr.mixer.mute[part];
      return h('div', { class: 'item', style: 'cursor:default;flex-wrap:wrap' },
        h('span', { class: 'swatch', style: 'background:' + colors[g] }),
        h('div', { class: 'grow' }, h('div', {}, A.GROUP_LABELS[g]), h('div', { class: 'faint' }, info[g])),
        h('div', { class: 'row' },
          h('button', { class: 'btn small' + (muted ? ' on' : ''), title: 'Demp', onclick: () => {
            for (const p of A.GROUPS[g]) pr.mixer.mute[p] = !muted;
            touch(); if (app.ui.playing === 'arr') { const s = app.player.position(); stop(); play(a, { fromStep: Math.floor((s || 0) / SPB) * SPB }, 'arr'); }
          } }, 'M'),
          lockBtn(g),
          btn('3 alternativer', guard(() => makeAlts(g)), 'small', pr.locked[g] ? 'Låst' : '')));
    })));
    el.append(h('div', { class: 'row', style: 'margin:12px 0' }, btn('Regenerer alt ulåst · 3 alternativer', guard(() => makeAlts('all')), 'primary')));

    if (app.ui.alts) {
      const alts = app.ui.alts;
      const m2 = a.sections.find((s) => s.type === 'main2') || a.sections[0];
      const prevFrom = m2.start * SPB;
      const box = h('div', { class: 'card sel' },
        h('h3', {}, 'Alternativer: ' + (app.ui.altGroup === 'all' ? 'alt ulåst' : A.GROUP_LABELS[app.ui.altGroup])),
        h('p', { class: 'faint' }, 'Lytt fra ' + m2.label.toLowerCase() + ' (16 takter). Låste deler er like i alle tre.'),
        h('div', { class: 'grid3' }, alts.map((alt, i) => h('div', { class: 'card' },
          h('h3', {}, alt.label),
          h('p', { class: 'faint' }, alt.desc),
          h('div', { class: 'row' },
            playBtn('▶ Lytt', 'alt:' + i, () => play(alt.arrangement, { fromStep: prevFrom, toStep: prevFrom + 16 * SPB, loop: true }, 'alt:' + i)),
            btn('Velg', () => { stop(); P.applyAlternative(pr, alt); app.ui.alts = null; touch(); toast('Alternativ ' + alt.label + ' er valgt.'); }, 'primary'))))),
        h('div', { class: 'row', style: 'margin-top:10px' },
          playBtn('▶ Nåværende', 'cur', () => play(a, { fromStep: prevFrom, toStep: prevFrom + 16 * SPB, loop: true }, 'cur')),
          btn('Behold nåværende', () => { stop(); app.ui.alts = null; render(); }, 'ghost')));
      el.append(box);
    }

    el.append(h('h2', {}, 'Kontroll'), ...a.report.messages.map((m) => h('div', { class: 'msg ' + m.level }, m.text)));
    const stx = a.report.stats;
    el.append(h('p', { class: 'faint mono' }, Object.entries(stx).map(([k, v]) => A.PART_LABELS[k] + ' ' + T.noteName(v.lo) + '–' + T.noteName(v.hi)).join(' · ')));
    el.append(h('p', { class: 'faint mono' }, 'Frø: trommer ' + MM.rng.seedCode(pr.seeds.drums) + ' · bass ' + MM.rng.seedCode(pr.seeds.bass) + ' · akkorder ' + MM.rng.seedCode(pr.seeds.chords) + ' · melodi ' + MM.rng.seedCode(pr.gen.seed)));
  }

  function makeAlts(group) {
    const pr = app.project;
    if (group !== 'all' && pr.locked[group]) throw new Error(A.GROUP_LABELS[group] + ' er låst. Lås opp for å lage alternativer.');
    stop();
    app.ui.alts = P.alternatives(pr, group);
    app.ui.altGroup = group;
    render();
    setTimeout(() => { const c = document.querySelector('#panel-arr .card.sel'); if (c) c.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 50);
  }

  /* ================= LYD ================= */
  function renderSound(el) {
    const pr = app.project;
    el.append(h('p', { class: 'lead-in' }, 'Lydene er bare for avspilling og WAV. Komposisjonen er adskilt: MIDI-eksporten kan spilles med dine egne instrumenter i Ableton.'));
    const parts = [['lead', 'Lead'], ['pluck', 'Korder (spilte)'], ['pad', 'Strings (holdte)'], ['bass', 'Bass']];
    const grid = h('div', { class: 'grid3' });
    for (const [part, label] of parts) {
      const inst = pr.instruments[part];
      const presets = MM.synth.PRESETS[part];
      grid.append(h('div', { class: 'card' },
        h('div', { class: 'row spread' }, h('h3', {}, label), btn('♪', () => audition(part === 'bass' ? 45 : part === 'pad' ? 64 : 76, part), 'small ghost', 'Prøv lyden')),
        select(Object.entries(presets).map(([k, p]) => [k, p.label]), inst.preset, (v) => { inst.preset = v; auditionEngine = null; touch(true); audition(part === 'bass' ? 45 : 72, part); }),
        slider('Volum', inst.vol, 0, 1, 0.05, (v) => { inst.vol = v; touch(true); }, (v) => Math.round(v * 100)),
        slider('Lysstyrke', inst.bright, 0, 1, 0.05, (v) => { inst.bright = v; auditionEngine = null; touch(true); }, (v) => Math.round(v * 100)),
        slider('Utklang', inst.release, 0, 1, 0.05, (v) => { inst.release = v; auditionEngine = null; touch(true); }, (v) => Math.round(v * 100)),
        part === 'lead' ? slider('Detune', inst.detune === undefined ? 0.5 : inst.detune, 0, 1, 0.05, (v) => { inst.detune = v; auditionEngine = null; touch(true); }, (v) => Math.round(v * 100)) : null));
    }
    el.append(grid);
    const d = pr.instruments.drums;
    el.append(h('div', { class: 'card' },
      h('h3', {}, 'Trommer'),
      slider('Volum', d.vol, 0, 1, 0.05, (v) => { d.vol = v; touch(true); }, (v) => Math.round(v * 100)),
      slider('Lysstyrke', d.bright, 0, 1, 0.05, (v) => { d.bright = v; auditionEngine = null; touch(true); }, (v) => Math.round(v * 100)),
      h('p', { class: 'faint' }, 'Egne samples erstatter den innebygde lyden for hver tromme (WAV, AIFF, MP3). De lagres i prosjektet.'),
      h('div', { class: 'list' }, MM.synth.SAMPLE_SLOTS.map((slot) => {
        const s = pr.samples[slot.p];
        return h('div', { class: 'item', style: 'cursor:default' },
          h('div', { class: 'grow' }, h('div', {}, slot.label + ' ', h('span', { class: 'faint mono' }, '(MIDI ' + slot.p + ')')), h('div', { class: 'faint' }, s ? s.name : 'innebygd synth')),
          btn('♪', guard(async () => {
            const ctx = await app.player.unlock();
            const eng = new MM.synth.Engine(ctx, { instruments: pr.instruments, bpm: 120, samples: await decodedSamples() });
            eng.drum(slot.p, 0.9, ctx.currentTime + 0.02);
          }), 'small ghost', 'Prøv'),
          btn(s ? 'Bytt' : 'Velg fil', guard(async () => {
            const f = await F.pickFile('audio/*,.wav,.aif,.aiff,.mp3');
            if (!f) return;
            if (f.size > 3e6) throw new Error('Samplet er for stort (maks 3 MB).');
            const buf = await f.arrayBuffer();
            const ctx = await app.player.unlock();
            await ctx.decodeAudioData(buf.slice(0));
            pr.samples[slot.p] = { name: f.name, data: F.toBase64(buf) };
            touch();
          }), 'small'),
          s ? btn('✕', () => { delete pr.samples[slot.p]; touch(); }, 'small ghost', 'Bruk innebygd lyd') : null);
      }))));
    el.append(h('div', { class: 'card' },
      slider('Hovedvolum', pr.instruments.master.vol, 0, 1, 0.05, (v) => { pr.instruments.master.vol = v; touch(true); }, (v) => Math.round(v * 100)),
      h('div', { class: 'row', style: 'margin-top:8px' }, btn('Bruk stilens standardlyder', () => { const m = pr.instruments.master; pr.instruments = P.defaultInstruments(pr.settings.style); pr.instruments.master = m; auditionEngine = null; touch(); }, 'small'))));
    el.append(h('p', { class: 'faint' }, 'Endringer høres neste gang du trykker spill. Får du ingen lyd på iPhone: sjekk lydløs-bryteren og volumet.'));
  }

  /* ================= EKSPORT OG PROSJEKT ================= */
  function renderExport(el) {
    const pr = app.project;
    const a = pr.arrangement;
    const base = F.safeName(pr.name);
    el.append(h('h2', {}, 'MIDI per stemme (til Ableton)'));
    if (!a) el.append(h('p', { class: 'faint' }, 'Bygg et arrangement først.'));
    else {
      el.append(h('p', { class: 'faint' }, 'Trommene ligger på kanal 10 med GM-noter (kick C1=36, clap 39, hihat 42/46) og passer rett i en Drum Rack. Tempoet ligger i filene.'),
        h('div', { class: 'row' },
          P.midiTracks(pr).map((t) => btn(t.name, guard(() => F.save(P.midiFor(pr, t.id), base + '-' + F.safeName(t.name) + '.mid', 'audio/midi')), 'small')),
          btn('Alle stemmer (ZIP)', guard(() => {
            const files = P.midiTracks(pr).map((t) => ({ name: base + '-' + F.safeName(t.name) + '.mid', data: P.midiFor(pr, t.id) }));
            files.push({ name: base + '-alle-spor.mid', data: P.midiFor(pr) });
            return F.save(F.zip(files), base + '-midi.zip', 'application/zip');
          }), 'small primary'),
          btn('Samlet MIDI (flere spor)', guard(() => F.save(P.midiFor(pr), base + '.mid', 'audio/midi')), 'small'),
          pr.theme ? btn('Bare temaet', guard(() => F.save(P.themeMidi(pr), base + '-tema.mid', 'audio/midi')), 'small') : null));
    }

    el.append(h('h2', {}, 'Lyd'));
    if (a) {
      const prog = h('div', { class: 'progress', hidden: !app.ui.exporting }, h('i', {}));
      const status = h('p', { class: 'faint' }, app.ui.exporting || 'Renderes i nettleseren, raskere enn sanntid. Et helt spor tar ofte ett til to minutter.');
      let bits = 16;
      el.append(h('div', { class: 'card' },
        h('div', { class: 'row' },
          seg([[16, '16-bit'], [24, '24-bit']], 16, (v) => { bits = +v; el.querySelectorAll('.seg button').forEach((b) => { if (b.textContent.indexOf('bit') > 0) b.classList.toggle('on', b.textContent === v + '-bit'); }); }),
          btn('WAV: hele sporet', guard(() => exportWav(0, a.totalBars * SPB, bits, prog, status, base)), 'primary'),
          btn('WAV: hovedparti 2', guard(() => { const s = a.sections.find((x) => x.type === 'main2') || a.sections[0]; return exportWav(s.start * SPB, (s.start + s.bars) * SPB, bits, prog, status, base + '-' + F.safeName(s.label)); }))),
        prog, status,
        h('p', { class: 'faint' }, 'Separate lydspor (stems) kommer senere. Inntil videre: bruk MIDI per stemme med egne instrumenter.')));
    }

    el.append(h('h2', {}, 'Prosjekt'));
    const list = h('div', { class: 'list' });
    el.append(h('div', { class: 'card' },
      h('p', { class: 'faint' }, 'Prosjektet lagres automatisk på denne enheten. Det lagrer referanser, bibliotek, noter, instrumentinnstillinger, samples og frø, så en god versjon kan åpnes nøyaktig igjen. Bruk prosjektfilen for å flytte mellom Mac og iPhone.'),
      h('div', { class: 'row' },
        btn('Lagre nå', guard(async () => { await F.store.put(pr); toast('Lagret'); renderProjects(list); }), 'primary'),
        btn('Last ned prosjektfil', guard(() => F.save(P.serialize(pr), base + '.motiv.json', 'application/json'))),
        btn('Åpne prosjektfil', guard(async () => {
          const f = await F.pickFile('.json,application/json');
          if (!f) return;
          const p = P.deserialize(await f.text());
          stop(); app.project = p; app.ui.alts = null; app.ui.refId = p.gen.refId; await F.store.put(p); render(); toast('Åpnet «' + p.name + '»');
        })),
        btn('Nytt prosjekt', guard(async () => {
          await F.store.put(pr);
          stop(); app.project = P.newProject(); app.ui.alts = null; app.ui.refId = app.project.gen.refId; app.ui.tab = 'lag';
          await F.store.put(app.project); render();
        }))),
      h('h3', { style: 'margin-top:14px' }, 'Mine prosjekter'), list));
    renderProjects(list);
  }

  async function renderProjects(list) {
    const items = await F.store.list().catch(() => []);
    list.innerHTML = '';
    if (!items.length) list.append(h('p', { class: 'faint' }, 'Ingen lagrede prosjekter ennå.'));
    for (const it of items) {
      const cur = it.id === app.project.id;
      list.append(h('div', { class: 'item' + (cur ? ' sel' : '') },
        h('div', { class: 'grow' }, h('div', { class: 'name' }, it.name), h('div', { class: 'faint' }, new Date(it.modified).toLocaleString('nb-NO'))),
        cur ? h('span', { class: 'badge ok' }, 'åpent') : btn('Åpne', guard(async () => {
          await F.store.put(app.project);
          const p = await F.store.get(it.id);
          stop(); app.project = p; app.ui.alts = null; app.ui.refId = p.gen.refId; F.store.put(p); render();
        }), 'small'),
        cur ? null : btn('✕', guard(async () => { if (confirm('Slette «' + it.name + '»?')) { await F.store.remove(it.id); renderProjects(list); } }), 'small ghost')));
    }
  }

  async function exportWav(from, to, bits, prog, status, name) {
    const pr = app.project;
    if (app.ui.exporting) return;
    stop();
    app.ui.exporting = 'Renderer …';
    prog.hidden = false; status.textContent = app.ui.exporting;
    const bar = prog.querySelector('i');
    try {
      const samples = await decodedSamples();
      const t0 = performance.now();
      const buf = await MM.synth.renderOffline(pr.arrangement, {
        instruments: pr.instruments, samples, mute: pr.mixer.mute, fromStep: from, toStep: to,
        onProgress: (f) => { bar.style.width = Math.round(f * 100) + '%'; status.textContent = 'Renderer … ' + Math.round(f * 100) + ' %'; },
      });
      status.textContent = 'Lager WAV …';
      const wav = F.encodeWav(buf, bits);
      status.textContent = 'Ferdig på ' + Math.round((performance.now() - t0) / 1000) + ' s · ' + (wav.byteLength / 1e6).toFixed(1) + ' MB';
      bar.style.width = '100%';
      await F.save(wav, name + '.wav', 'audio/wav');
    } finally {
      app.ui.exporting = null;
    }
  }

  document.addEventListener('visibilitychange', () => { if (document.hidden && app.project) F.store.put(app.project).catch(() => {}); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', guard(init)); else guard(init)();
  MM.ui = Object.assign(MM.ui || {}, { h, render, toast, play, stop });
})(globalThis.MM = globalThis.MM || {});
