/* Vokalypse – lydkilder ("motorer"). Hver kilde leverer råmateriale som AudioBuffer i 48 kHz.
   Kildene er utskiftbare: en ny tjeneste legges til med VK.Providers.register({...}) og
   en funksjon som returnerer lyd. Resten av appen (arrangør, effekter, eksport) bryr seg ikke
   om hvor lyden kom fra – men opprinnelsen merkes alltid på klippet.

   Opprinnelse (origin):
     'import'    – din egen fil
     'freesound' – opptak fra Freesound med CC0 eller CC BY (lisens lagres på klippet)
     'synth'     – syntetisk formantstemme laget lokalt i appen (ikke AI, ikke menneske)
     'ai'        – generert av en ekstern AI-modell (ikke et menneskelig opptak) */
(function (VK) {
  'use strict';

  VK.ORIGINS = {
    import:    { badge: 'IMPORTERT',   cls: 'o-import', info: 'Din egen fil. Hvis det er et opptak av et menneske, er dette ekte menneskelig stemme.' },
    freesound: { badge: 'FREESOUND',   cls: 'o-freesound', info: 'Opptak lastet opp av andre på Freesound, med lisens CC0 eller CC BY. Lisens og opphav følger klippet.' },
    synth:     { badge: 'SYNTETISK',   cls: 'o-synth', info: 'Enkel formant-vokalsynth i appen. Ikke et menneske, ikke AI.' },
    ai:        { badge: 'AI-GENERERT', cls: 'o-ai', info: 'Laget av en ekstern AI-modell. Ikke et menneskelig opptak.' }
  };

  // ---------- Dekoding: alt råmateriale gjøres om til 48 kHz ----------
  VK.decodeAudio = function (arrayBuffer) {
    const oc = new OfflineAudioContext(2, 1, VK.SR);
    return new Promise(function (resolve, reject) {
      const p = oc.decodeAudioData(arrayBuffer, resolve, function (e) {
        reject(new Error('Kunne ikke lese lydfilen (' + (e && e.message ? e.message : 'ukjent format') + ').'));
      });
      if (p && p.then) p.then(resolve, function (e) { reject(new Error('Kunne ikke lese lydfilen (' + (e && e.message ? e.message : 'ukjent format') + ').')); });
    });
  };

  // ---------- Klippbiblioteket ----------
  VK.Pool = {
    clips: [],
    listeners: [],
    onChange: function (fn) { this.listeners.push(fn); },
    emit: function () { for (const fn of this.listeners) fn(this.clips); },
    add: function (spec) {
      const MAX_SEC = 600;
      let buffer = spec.buffer;
      if (!buffer && spec.channels) buffer = VK.DSP.makeBuffer(spec.channels);
      if (buffer.duration > MAX_SEC) throw new Error('Filen er lengre enn 10 minutter. Kutt den ned og prøv igjen.');
      const mono = VK.DSP.monoMix(buffer);
      const analysis = VK.DSP.analyze(mono, VK.SR);
      if (!analysis.segments.length || analysis.peak < 1e-4) throw new Error('«' + spec.name + '» ser ut til å være stille.');
      const clip = {
        id: VK.uid('clip'), name: spec.name, origin: spec.origin, buffer: buffer, mono: mono, analysis: analysis,
        enabled: true, meta: spec.meta || {}
      };
      this.clips.push(clip);
      this.emit();
      return clip;
    },
    remove: function (id) { this.clips = this.clips.filter((c) => c.id !== id); this.emit(); },
    byId: function () { const m = new Map(); for (const c of this.clips) m.set(c.id, c); return m; },
    enabled: function () { return this.clips.filter((c) => c.enabled); }
  };

  // ---------- Register over eksterne/lokale motorer ----------
  VK.Providers = {
    list: [],
    register: function (p) { this.list.push(p); return p; },
    get: function (id) { return this.list.find((p) => p.id === id); }
  };

  // ===== Lokal: syntetisk formantstemme =====
  VK.Providers.register({
    id: 'formant', name: 'Formantstemme (lokal)', origin: 'synth', needsKey: false, cost: 'Gratis, kjører i nettleseren',
    generate: async function (spec) {
      const r = VK.Synth.render(spec);
      return [{ name: spec.label || spec.text, channels: r.channels, meta: { engine: 'Vokalypse formantsynth', text: spec.text, voice: spec.voice } }];
    }
  });

  // ===== Freesound (CC0 / CC BY) =====
  function classifyLicense(lic) {
    const s = String(lic || '');
    if (/sampling\+|noncommercial|by-nc|nc\//i.test(s)) return null; // aldri NC eller Sampling+
    if (/zero|creative commons 0|cc0/i.test(s)) return { code: 'CC0', name: 'CC0 1.0 (ingen krav)', attribution: false };
    if (/attribution|\/by\//i.test(s)) {
      const v = (s.match(/by\/(\d\.\d)/) || [])[1];
      return { code: 'CC BY', name: 'CC BY' + (v ? ' ' + v : '') + ' (krever kreditering)', attribution: true };
    }
    return null;
  }

  VK.Freesound = VK.Providers.register({
    id: 'freesound', name: 'Freesound', origin: 'freesound', needsKey: true, cost: 'Gratis konto og API-nøkkel',
    classifyLicense: classifyLicense,
    search: async function (opts) {
      const licenses = opts.allowBy ? ['Creative Commons 0', 'Attribution'] : ['Creative Commons 0'];
      const all = [];
      for (const lic of licenses) {
        const params = new URLSearchParams({
          query: opts.query,
          filter: 'license:"' + lic + '" duration:[0.3 TO ' + (opts.maxDur || 40) + ']',
          fields: 'id,name,username,license,previews,duration,url,tags',
          page_size: String(opts.allowBy ? 12 : 20),
          sort: 'score',
          token: opts.key
        });
        const res = await fetch('https://freesound.org/apiv2/search/?' + params.toString());
        if (res.status === 401 || res.status === 403) throw new Error('Freesound avviste nøkkelen (' + res.status + '). Sjekk at du har limt inn «Client secret/API key».');
        if (!res.ok) throw new Error('Freesound svarte ' + res.status + '.');
        const j = await res.json();
        for (const r of j.results || []) {
          const lic2 = classifyLicense(r.license);
          if (!lic2 || !r.previews) continue;
          all.push({
            id: r.id, name: r.name, user: r.username, duration: r.duration, license: lic2, licenseRaw: r.license,
            preview: r.previews['preview-hq-mp3'] || r.previews['preview-lq-mp3'],
            page: r.url || ('https://freesound.org/s/' + r.id + '/'), tags: r.tags || []
          });
        }
      }
      return all;
    },
    fetchClip: async function (item) {
      const res = await fetch(item.preview);
      if (!res.ok) throw new Error('Klarte ikke å hente lyden fra Freesound (' + res.status + ').');
      const buf = await VK.decodeAudio(await res.arrayBuffer());
      return {
        name: item.name, buffer: buf, origin: 'freesound',
        meta: {
          license: item.license.name, licenseCode: item.license.code, licenseUrl: item.licenseRaw, author: item.user,
          url: item.page, attribution: item.license.attribution,
          credit: '«' + item.name + '» av ' + item.user + ' (' + item.page + '), ' + item.license.code,
          quality: 'Freesound-forhåndsvisning (MP3)'
        }
      };
    }
  });

  // ===== ElevenLabs (ekstern AI, krever egen nøkkel og betaling for kommersiell bruk) =====
  const EL_BASE = 'https://api.elevenlabs.io';
  async function elPost(path, key, body, query) {
    const url = EL_BASE + path + (query ? '?' + new URLSearchParams(query).toString() : '');
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'xi-api-key': key, 'Content-Type': 'application/json', 'Accept': 'audio/mpeg' },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      let msg = res.statusText;
      try {
        const j = await res.json();
        if (j && j.detail) msg = typeof j.detail === 'string' ? j.detail : (j.detail.message || JSON.stringify(j.detail));
      } catch (e) { /* ikke JSON */ }
      throw new Error('ElevenLabs svarte ' + res.status + ': ' + msg);
    }
    return res.arrayBuffer();
  }

  VK.ElevenLabs = VK.Providers.register({
    id: 'elevenlabs', name: 'ElevenLabs', origin: 'ai', needsKey: true,
    cost: 'Musikk $0,15/min, lydeffekter $0,12/min (API-pris okt. 2026). Kommersiell bruk av musikk krever Starter ($6/mnd) eller høyere.',
    voices: async function (key) {
      const res = await fetch(EL_BASE + '/v1/voices', { headers: { 'xi-api-key': key } });
      if (!res.ok) throw new Error('ElevenLabs svarte ' + res.status + ' ved henting av stemmer.');
      const j = await res.json();
      return (j.voices || []).map((v) => ({ id: v.voice_id, name: v.name, labels: v.labels || {} }));
    },
    // Sang: Eleven Music med komposisjonsplan, slik at vi kan gi egne tekstlinjer og be om a cappella
    song: async function (o) {
      const lines = o.lines.split('\n').map((s) => s.trim()).filter(Boolean).slice(0, 30).map((s) => s.slice(0, 200));
      const styles = ['a cappella', 'isolated vocal only', 'no instruments', 'no drums', 'dry close-mic vocal']
        .concat(o.styles.split(',').map((s) => s.trim()).filter(Boolean));
      const body = {
        model_id: 'music_v1',
        composition_plan: {
          positive_global_styles: styles,
          negative_global_styles: ['drums', 'bass', 'synthesizer', 'guitar', 'piano', 'instrumental backing', 'reverb wash'],
          sections: [{
            section_name: 'Vocal',
            positive_local_styles: styles.slice(0, 3),
            negative_local_styles: ['instruments'],
            duration_ms: Math.round(VK.clamp(o.seconds, 3, 120) * 1000),
            lines: lines
          }]
        }
      };
      return elPost('/v1/music', o.key, body);
    },
    speech: async function (o) {
      return elPost('/v1/text-to-speech/' + encodeURIComponent(o.voiceId), o.key,
        { text: o.text, model_id: o.modelId || 'eleven_multilingual_v2' }, { output_format: 'mp3_44100_128' });
    },
    sfx: async function (o) {
      return elPost('/v1/sound-generation', o.key, {
        text: o.text, duration_seconds: VK.clamp(o.seconds, 0.5, 30), prompt_influence: VK.clamp(o.influence, 0, 1)
      });
    },
    estimate: function (mode, seconds, chars) {
      if (mode === 'song') return seconds / 60 * 0.15;
      if (mode === 'sfx') return seconds / 60 * 0.12;
      return chars / 1000 * 0.08;
    }
  });
})(window.VK = window.VK || {});
