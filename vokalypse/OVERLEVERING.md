# Overlevering: Vokalypse → Norwegian Beats

Dette er en overleveringsnotat til den chatten/økten som jobber med Norwegian Beats. Målet er å få Vokalypse inn i Norwegian Beats som en egen vokaldel, med kor, hvisk, chops og liknende.

## Hvor koden ligger

- **GitHub:** repo `tarjeikrogh26/hidden-motives`, gren `claude/vokalypse`, mappe `vokalypse/`. Den ligger ikke på `main`.
- **Zip:** `vokalypse.zip` inneholder `index.html`, `LES_MEG.md` og `js/`. Eieren kan legge den ved i chatten.
- **Forhåndsvisning i Claude:** https://claude.ai/artifact/2s25Xqo1WY3FUJkv7vC3TW. Den er privat for eieren, og er en innebygd versjon i én fil av samme kode.

Les `vokalypse/LES_MEG.md` for brukerdelen. Under står det tekniske.

## Hva Vokalypse er

En vokalgenerator som kjører i nettleseren. Den tar vokalklipp og lager 16 takters variasjoner i 4/4 med mye luft. Den kan levere tørr og behandlet WAV i 24-bit / 48 kHz, med eksakt lengde. Den trenger ikke byggesteg, rammeverk eller server.

## Arkitektur

Alt er vanlige `<script>`-filer, ikke ES-moduler, slik at appen fungerer fra `file://`. De deler ett globalt navnerom, `window.VK`. Rekkefølgen filene lastes i er viktig: util → dsp → synth → wav → providers → arranger → render → app.

| Fil | Innhold | Viktigste API |
|---|---|---|
| `js/util.js` | Tilfeldighet med frø, skalaer, timing | `VK.makeRng(seed)`, `VK.SCALES`, `VK.timing(bpm)`, `VK.snapToScale`, `VK.scaleStep`, `VK.SR = 48000` |
| `js/dsp.js` | Ren JS-DSP | `VK.DSP.whisperize`, `robotize`, `granular`, `bitcrush`, `detectPitch` (YIN), `analyze` (lydbiter/anslag), `impulse` (romklang-IR), `foldTail`, `sanitize` |
| `js/synth.js` | Syntetisk formantstemme (ikke AI) | `VK.Synth.render({text, voice:'bass'/'tenor'/'alto'/'soprano'/'mixed', voices, melody, whisper, bpm, root, scale, seed})` returnerer `{channels:[L,R]}` |
| `js/providers.js` | Klippbibliotek og utskiftbare kilder | `VK.Pool.add({name, origin, buffer/channels, meta})`, `VK.Providers.register(...)`, `VK.Freesound`, `VK.ElevenLabs`, `VK.decodeAudio` |
| `js/arranger.js` | Plasserer innslag i 16 takter | `VK.Arranger.arrange(settings, clips, seed, colorSeed)` returnerer `{events, form}`. `settings = {bpm, root, scale, style, density 0–4, swing, fx 0–1, ingredients{phrase,chop,stutter,choir,whisper,reverse,dive,robot}}` |
| `js/render.js` | Lydmotor (OfflineAudioContext) | `await VK.Render.render({settings, events, colorSeed}, clipsById, {wet, fold, normalize})` returnerer `{channels:[L,R], length}`. Lengden er alltid nøyaktig 16 takter. |
| `js/wav.js` | WAV-koding og nedlasting | `VK.encodeWav(channels, 48000, 24)`, `VK.downloadBlob` (zip i Claude-forhåndsvisning) |
| `js/app.js` | Grensesnitt, avspilling, historikk | `VK.App.generate()`, `VK.App.state` |

**Motor uten grensesnitt:** `arrange` og `Render.render` kan brukes direkte. Dette er sannsynligvis det Norwegian Beats trenger:

```js
const clips = VK.Pool.enabled();              // eller egne klippobjekter (se Pool.add)
const { events } = VK.Arranger.arrange(settings, clips, seed, colorSeed);
const wet = await VK.Render.render({ settings, events, colorSeed }, VK.Pool.byId(), { wet: true, fold: true });
// wet.channels = [Float32Array L, Float32Array R] i 48 kHz, eksakt 16 takter ved settings.bpm
```

**Kor spesielt:**
- Innslagstypen `choir` i `arranger.js` tar et kort utsnitt og fryser det granulært. Den legger akkordlag fra tonearten, med detune, stereospredning og en munke-oktav nedover.
- `VK.Synth.render({voice:'mixed', voices:6, ...})` gir en syntetisk korflate å starte med.

## Status (ærlig)

**Testet:**
- Automatiske tester i Chromium (`vokalypse/test/e2e.js` og `stress.js`).
- Eksakt lengde ved mange BPM, ingen NaN og ingen klipping i 160 renderinger.
- Import av filer.
- Freesound og ElevenLabs, men bare mot simulerte svar.

**Ikke testet:**
- Safari.
- ElevenLabs mot en ekte konto.
- Lytting av et menneske. Lyden er bare analysert med målinger.

**Mangler:**
- Klipp lagres ikke mellom økter.
- Tonehøyde endres med varispeed, som også endrer klangfarge.
- Det finnes ikke mikrofonopptak.

**Prinsipper eieren har bedt om, og som må beholdes:**
- Skill tydelig mellom menneskelig stemme, bearbeidet sample, syntetisk og AI-generert. Hvert klipp har `origin`.
- Ingen falske knapper og ingen oppdiktede API-er.
- Den lokale bearbeidingen må virke uten abonnement.

## Forslag til første steg i Norwegian Beats

1. Se hvordan Norwegian Beats er bygget: rammeverk, lydmotor, samplerate, tempo/transport, og hvordan spor og mønstre lagres.
2. Foreslå en plan for eieren før koding. For eksempel:
   - Et eget «Vokal»-spor eller -modul som bruker Vokalypse-motoren.
   - BPM og toneart hentes fra prosjektet.
   - Resultatet blir et lydklipp på tidslinjen, eller WAV-eksport.
3. Hvis Norwegian Beats bruker en annen samplerate eller ES-moduler, må `VK.SR` og innlastingen tilpasses. Motoren er ellers uavhengig av grensesnittet i `app.js`.
