# DROPFATHER — by Tarjei Krogh · v0.5

To veier inn fra startskjermen:

- **Drop a song here**: lager et **nytt parti** (build-up, pre-drop og drop) av låtens egen lyd og setter det inn i
  låta. Bassen i droppet spiller bare AVANTGARDIAN ARP-ens grunntoner.
- **Make a drop**: bygg build-up, pre-drop og drop fra bunnen av på en grid, og eventuelt resten av låta rundt
  (intro, breakdown, outro). Ingen låt trengs.

Lokal nettleserapp, ingen server, ingen konto. Åpne `Dropfather.html` i Chrome, Edge eller Safari.

**Formater** (`src/decode.js`):
- **Nettleserens egen dekoder:** MP3, M4A/AAC (som Suno), MP4, FLAC, OGG, Opus, WebM og WAV.
- **Dropfathers egne lesere:** AIFF/AIFC, ukomprimert CAF og WAV-varianter nettleseren ikke tar (f.eks. 64-bit float).
  Chrome og Firefox kan ikke åpne AIFF selv.
- **Apple Lossless (ALAC):** åpnes i Safari. I Chrome sier appen tydelig fra.

## Hva et drop egentlig er (kort research)

Et drop er **ikke** en hook. Det er et *energiskifte*: bunnen (kick + bass) blir tatt bort, spenningen bygges opp,
og så kommer bunnen tilbake på én gang, på taktslag 1. Melodien kan godt være monoton. Det er kontrasten som gjør jobben.

| Del | Hva skjer | Vanlig lengde |
|---|---|---|
| **Build-up** | Høypassfilter åpner seg og tar bort bassen. Det kommer en riser (støy eller tone som stiger), en tromme-/clap-roll som går fra 1/4 til 1/8, 1/16 og 1/32, og mer romklang. | 8 takter (4–16) |
| **Pre-drop** | Pustepausen: ett slag til én takt med nesten stillhet. Ofte et delay-kast av siste ord/slag, eller revers romklang som «suger» inn mot droppet. | 1 slag – 1 takt |
| **Drop** | Kick og bass tilbake. Impact (sub-boom + crash), pumping (sidechain), ofte veldig enkel bass. | 16–32 takter |

Regler som går igjen: ta bort bunnen før droppet så den føles større når den kommer tilbake. La build-upen aldri
bli like full som droppet. Kutt alt rett før slaget. Hold deg til 8/16/32-takters fraser.
I house er dette mer subtilt (filter og kick inn/ut). I festival-EDM er det store builds og en hel takt stillhet.

Kilder: [Point Blank – drops that hit harder](https://www.pointblankmusicschool.com/blog/how-to-make-your-drops-hit-harder-tips-for-edm-producers/),
[EDMProd – build-ups](https://edmprod.com/ultimate-guide-build-ups),
[WA Production – risers](https://blog.waproduction.com/before-the-drop-how-to-make-edm-buildups-risers),
[Mixed In Key – arrangering](https://mixedinkey.com/captain-plugins/wiki/how-to-arrange-a-dance-music-track/),
[Sound On Sound – house vs trance](https://www.soundonsound.com/techniques/secrets-house-trance).

## Slik virker Dropfather (v0.3)

1. **Last inn låten.** Appen finner BPM, takt 1 og et energikart (rød = kick/bass, blå = breakdown). Samtidig kjører
   ARP-analysen. Ingenting rendres før den er ferdig, fordi bassen følger den.
2. **Velg hvor det nye partiet skal inn** («New part at bar») og **hvilke takter droppet lages av** («Drop made of bars»,
   4/8/16 takter). Forslagene (★) setter begge to til der bunnen kommer tilbake, typisk der refrenget starter. Du kan
   også klikke i kartet. Knappene over forslagene bestemmer om et klikk flytter det nye partiet eller drop-materialet.
3. **Det nye partiet:**
   - **Build-up**: taktene rett før innsettingspunktet spilles en gang til med high-pass sweep, riser og roll.
   - **Pre-drop**: pausen, et DELAYSY-kast av siste slag og reverse suck.
   - **Drop**: drop-taktene loopet. Bassen deres er kuttet (high-pass 130 Hz), med ny kick, impact og pump.
   - **Bassen** er en Bass Invaders-lyd som **bare spiller ARP-ens grunntoner** for akkurat de taktene droppet er laget
     av, i samme øyeblikk. Det er samme toner som ARP-ens «Hør bare grunntonene». Mønsteret bestemmer bare rytmen.
     «ARP roots, held» spiller grunntonene akkurat som ARP gjør. Der ARP ikke finner noen grunntone, spilles ingen
     bassnote.
   - Etter partiet fortsetter låta fra innsettingspunktet. Resten av låta er bit-identisk med originalen.
4. **Lytt**: «Play new part», «Whole song», og «Original material» (drop-taktene slik de er i låta).
5. **Eksport**: WAV (hele låten med det nye partiet, bare det nye partiet, eller bare lagene) i 24-bit, MIDI (bass, kick,
   roll) og planen som JSON. Inne i en claude.ai-artifact kommer WAV/MIDI som zip.

En look-ahead-limiter jobber bare i det nye partiet, så en hardt mastret låt ikke klipper. Statuslinjen viser hvor mye
den tar.

### Hva gikk galt i v0.2
- Droppet ble lagt **oppå** låta, med låtens egne akkorder under.
- Take-off-stilen (standard) spilte én fast bassnote.
- Bassen fulgte Chordinos separate «bassSegments», ikke ARP-ens grunntoner.
- Før analysen var ferdig, sto grunntonen på A.

Målt på *Television Is Blue*: den faste noten traff sterkeste tone i originalens bassområde bare **27–28 %** av tiden.
ARP-grunntonene treffer **69–74 %** (*The Light*: 77–84 %). Resten kan være omvendinger (ARP gir akkordens
grunntone, ikke bassnoten) eller kick i målingen. Det må høres, ikke bare måles.

## Make a drop (drop maker, v0.5)

1. Velg **Make a drop** på startskjermen.
2. **BPM, toneart og skala** (moll, frygisk, dorisk, harmonisk moll, dur).
3. **Stilknappene** (House lift, Festival, Techno tunnel, Take-off, EBM motor) skriver et **nytt drop hver gang**:
   - Hver stil har sin egen meny av varianter, og hvert trykk trekker en ny kombinasjon: hats, clap/snare, open hats,
     fills, basspattern (Bass Invaders-riff, offbeat, synkopert, rullende 16-deler, gallop, oktav), lead og tempo
     innenfor stilen.
   - Linjen under knappene sier hva som ble valgt.
   - **🎲 New drop** gir et nytt drop i samme stil, toneart og skala. **Randomize** trekker stil, toneart, skala,
     basslyd og DELAYSY-preset.
4. **Stripen** er arrangementet. Klikk en del for å redigere den.
   - **Grid:** build-up, drop (og intro, breakdown og outro) har hver sin grid, med fem trommelinjer og bass og lead
     i valgt skala. Mønsteret er 1, 2 eller 4 takter.
   - **Pre-drop** er pausen, DELAYSY-kastet og reverse suck.
5. **+ Suggest the rest of the song** lager tre deler av droppet:
   - **Intro**, 16 takter: droppets groove uten clap og lead, med lowpass som åpner seg.
   - **Breakdown**, 8 takter: ingen trommer, leaden og holdte bassnoter under romklang.
   - **Outro**, 16 takter: trommer og bass, med lowpass som lukker seg.

   Hver del har egen grid og egne filterknapper. Rekkefølgen blir intro → breakdown → build-up → pre-drop → drop → outro.
6. **Lyder**:
   - **Bass:** Bass Invaders (2000 fabrikklyder). Basslinjene kommer fra Bass Invaders' egen riff-generator.
   - **Lead:** AVANTGARDIAN ARP med alle 777 lyder gjennom ARP-ens egen kjede (Norwegian Beats v46-stemme, mono
     VoiceOutput, SoundMatch-nivå og lydens StudioFX). Bass Invaders-lydene kan også brukes som lead.
   - **Leadlinjen** kan hentes fra **ARP-ens mønsterbibliotek**: velg et av 2281 mønstre, trykk **🎲 Random ARP
     pattern**, eller **🎲 ARP blend (Make arp)**, som er ARP-ens egen `NoteEngine.hybrid` og blander fire mønstre til
     en ny frase. Tonene legges på nærmeste trinn i skalaen.
7. **Loop section** spiller delen du redigerer, og endringer i griden høres med en gang. **Play all** rendrer hele
   arrangementet. Endrer du noe mens det spiller (stil, lyd, grid), rendres det på nytt og fortsetter fra samme sted.
8. **Eksport**:
   - WAV i 24-bit: hele arrangementet, eller bare droppet.
   - MIDI med bass, lead og trommer.
   - Prosjektet som JSON.

Build-upen går gjennom ett high-pass som åpner seg, med riser, roll og romklang. «Kick plays until» bestemmer når kicken
forsvinner. I droppet pumper alt unntatt kick og clap, og det kommer et impact på 1-eren.

## Opphav og rettigheter (viktig før salg)

- **Analyse**: fra AVANTGARDIAN ARP v0.18 (`src/vendor/`). Chordino/NNLS-Chroma er **GPL-2.0-or-later**
  (lisenser og kildekode i `src/vendor/chordino-license/`). Selges Dropfather med denne motoren, må hele appen
  distribueres under GPL med kildekode tilgjengelig. Samme gjelder ARP i dag.
- **Bass**: den ekte Bass Invaders v0.10.8-motoren (`src/vendor/bass-invaders/`). Filene er kopiert uendret.
  Lydverts-delen av `app.js` (`loadPreset`, `applySound`, `makeGraph` og startverdiene) er hentet ordrett ut med
  `tools/extract-bass-host.py`. Hver lyd får derfor nøyaktig samme patch, graf (filter 2, dark echo, 3D space,
  kompressor) og nivåkalibrering (`bass-balance.js`) som i appen. Riff-mønsteret med Bass Invaders' egen
  frasegenerator ble brukt i v0.2, men er tatt ut i v0.3 fordi den la til intervaller utenfor ARP-grunntonene. De innspilte bassene er CC0 (lisenser i `bass-assets/licenses/`) og er
  innebygd slik `Bass-Invaders.html` gjør det.
- **Echo throw**: den ekte DELAYSY v0.6.3-motoren med alle 777 presets (`src/vendor/delaysy-engine.js`), hentet ordrett
  ut av HTML-filen med `tools/extract-delaysy.py`. Bare en liten vertsdel er ny. Den kobler motoren til én
  AudioContext/OfflineAudioContext i stedet for siden. Nivået følger DELAYSYs egen auto-level-regel (weighted energy).
- **Lead i drop maker**: AVANTGARDIAN ARP v0.18 (`src/vendor/arp/`). Filene er kopiert uendret: `nb-voice.js`,
  `nb-ladder.js`, `nb46-presets.js`, `nb46-bank.js`, `voice-output.js`, `sound-match.js`, `studio-fx.js`,
  `performance.js` og `engine.js`. Byggesteget endrer bare stien til ladder-workleten, så den kan ligge inne i
  HTML-filen. Mønsterbiblioteket er de første 4 taktene av ARP-ens `patterns.json`
  (`tools/extract-arp-patterns.py`), med notene uendret.
- **Trommer, risere, impact**: syntetisert i `src/dsp.js`. Ingen samples. Trommene fra Bass Invaders er bevisst
  *ikke* brukt, fordi lisensen deres er uavklart (se Bass Invaders `SOURCE-NOTES`).
- Logo: Tarjei Krogh.

## Utvikling

```
node build.mjs            # bygger Dropfather.html fra src/
node test-analysis.cjs    # tempo, takt 1 og drop-punkt på syntetiske låter (sangmodus)
# hente motorene på nytt fra nye versjoner av appene:
python3 tools/extract-delaysy.py DELAYSY-vX.html src/vendor/delaysy-engine.js
python3 tools/extract-bass-host.py Bass-Invaders/source/dist/app.js src/vendor/bass-invaders/bass-host.js
python3 tools/extract-arp-patterns.py ARP/dist/assets/patterns.json src/vendor/arp/patterns-4bars.json
```

`src/analysis.js` (tempo/takt/energikart/forslag), `src/dsp.js` (all lyd, offline rendering, WAV/MIDI),
`src/app.js` (sangmodus-UI), `src/grid.js` + `src/maker.js` (drop maker: motor og UI), `src/decode.js` (formater),
`src/files.js` (lagring), `src/vendor/` (ARP-analysen, Bass Invaders, DELAYSY).

## Kjente grenser i v0.5

- Takt 1 er en kvalifisert gjetning (seksjoner skifter på 1-ern). Sjekk den med «−1 beat / +1 beat».
- Taktartsforutsetning 4/4. Tempo må være stabilt (ingen live-tempo-drift).
- Bassen er aldri bedre enn ARP-analysen. I takter der ARP tar feil, tar bassen feil.
- Ikke lyttetestet av meg (Claude kan ikke høre). Tallene er målt (nivå, tonehøyde, tidsplassering), smaken er ikke.
- Drop maker: leadens hook-generator er Dropfathers egen (enkel). Bass og lead er monofone, én note per steg.
- Drop maker: en full render tar tid, fordi ARP bygger en full stemme per note. Det rendres takt for takt, og i
  testmiljøet tok hele låta (137 s lyd) 31 s. På en vanlig maskin går det raskere.
