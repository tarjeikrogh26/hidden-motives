# DROPFATHER — by Tarjei Krogh · v0.11

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

## Make a drop (drop maker, v0.8)

1. Hele motoren ligger i svart-hvitt under startskjermen. Trykk **Make a drop**, så våkner den i rødt.
2. **BPM, toneart og skala** (moll, frygisk, dorisk, harmonisk moll, dur).
3. **Stilknappene** (House lift, Festival, Techno tunnel, Take-off, EBM motor, Progressive trance, Ambient chill)
   skriver et **nytt drop hver gang**:
   - Hver stil har sin egen meny av varianter, og hvert trykk trekker en ny kombinasjon: hats, clap/snare, open hats,
     fills, basspattern (Bass Invaders-riff, offbeat, synkopert, rullende 16-deler, gallop, oktav), lead og tempo
     innenfor stilen.
   - Linjen under knappene sier hva som ble valgt.
   - **🎲 Another … drop** gir et nytt drop i samme stil, toneart og skala. **🎲 Randomize all** ligger først i bunnlinjen og
     trekker stil, toneart, skala, akkorder, basslyd og DELAYSY-preset.
   - **Akkorder:** hvert drop har en akkordprogresjon på 4 takter (f.eks. Am – F – C – G). Bassriffet flytter seg
     med akkordene, og leaden lander på akkordtonene. **🎲 New chords** gir nye akkorder og skriver bass og lead på
     nytt. **🎲 New melody** gir et nytt riff på de samme akkordene.
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
   - **Trommer:** 14 trommesett med Stanley Cupids egne innspillinger fra Norwegian Beats. Det er de ferdige
     sample-settene (Punch, Deep, Dusty, Crisp, Room, Club, Tape, Trap, Boom bap, Heavy, Snaps) og de akustiske
     settene Pocket 93, Broken 78 og Groovy 102. Hvert sett har kick, clap, snare, hat og open hat, med tonehøyde
     og lag (f.eks. kick under snaren i Boom bap) som i Norwegian Beats. Hver stil velger et passende sett, og alle
     kan byttes i **Drum kit**. **Dropfather synth** er de gamle syntetiske trommene. Hvert slag nivåmatches mot
     synth-slaget i samme linje, så mikseknappene betyr det samme for alle sett. Norwegian Beats' effekter per
     slag (punch, plate, lofi …) er ikke med.
   - **Bass:** Bass Invaders (2000 fabrikklyder). Basslinjene kommer fra Bass Invaders' egen riff-generator.
   - **Lead:** Dropfathers egne lead-synther er standard: Festival supersaw, Big room stab, Trance pluck, Hoover,
     Screech lead, House organ stab, Techno dub chord, EBM pulse og Future bass chord. De spiller akkorder med
     melodien øverst, 3–7 detunede oscillatorer per tone, oktavlag, filterkonvolutt, drive, ping-pong-delay og
     romklang. Hver akkord rendres én gang og gjenbrukes.
   - **Filter før droppet:** I build-upen spiller leaden hele droppets melodi gjennom et lowpass som åpner seg fra
     280 Hz til 9 kHz, med mer romklang. I droppet er filteret helt åpent. Intro, breakdown og outro har et
     halvlukket filter.
   - AVANTGARDIAN ARP med alle 777 lyder gjennom ARP-ens egen kjede (Norwegian Beats v46-stemme, mono
     VoiceOutput, SoundMatch-nivå og lydens StudioFX). Bass Invaders-lydene kan også brukes som lead.
   - **Leadlinjen** kan hentes fra **ARP-ens mønsterbibliotek**: velg et av 2281 mønstre, trykk **🎲 Random ARP
     pattern**, eller **🎲 ARP blend (Make arp)**, som er ARP-ens egen `NoteEngine.hybrid` og blander fire mønstre til
     en ny frase. Tonene legges på nærmeste trinn i skalaen.
7. **Klikk BUILD-UP, PRE eller DROP** i stripen for å spille fra starten av den delen (og redigere den). **Play all**
   kan pauses og fortsetter der du stoppet. Mens det rendres, viser bunnlinjen hvor mange prosent som er ferdig.
   **Mikseren** i bunnlinjen har fire loddrette fadere: Drums, Bass, Lead og FX (risere, impact, DELAYSY-kast,
   reverse suck). Lyden rendres som fire stems, så faderne virker med en gang, også under Play all. Dobbeltklikk
   setter en fader tilbake til 0 dB. **Loop section** spiller delen du redigerer, og endringer i griden høres med en gang. **Play all** rendrer hele
   arrangementet. Endrer du noe mens det spiller (stil, lyd, grid), rendres det på nytt og fortsetter fra samme sted.
8. **Eksport**:
   - WAV i 24-bit: hele arrangementet, eller bare droppet, mikset slik faderne står.
   - **WAV stems**: Drums, Bass, Lead og FX som fire WAV-filer i én zip, alle fra takt 1.
   - MIDI med bass, lead og trommer.
   - Prosjektet som JSON.

Build-upen går gjennom ett high-pass som åpner seg, med riser, roll og romklang. «Kick plays until» bestemmer når kicken
forsvinner. I droppet pumper alt unntatt kick og clap, og det kommer et impact på 1-eren.

## Song (v0.9)

Bryteren **Drop | Song** nederst bytter mellom droppet og hele låta. **Take it further → make a song** i
drop-vinduet gjør det samme.

- **🎲 Make a song from the drop** skriver en hel låt rundt droppet. Droppet og build-upen beholdes som de er.
  - Formen følger stilen: club (intro, groove, breakdown, build-up, drop, breakdown 2, build-up, drop 2, outro),
    festival eller chill.
  - **Melodien bor i breakdownene**, ikke i droppet. De har en syngende linje på droppets akkorder, spilt som
    akkorder med pad, future bass-akkord eller glass-pluck, med holdte bassnoter og uten kick. Droppet er
    utløsningen etterpå.
  - **Groove** er droppets trommer og bass uten lead, den DJ-vennlige delen.
  - **Drop 2** er enten det samme droppet eller en egen kopi med nytt lead-riff.
  - Trykk igjen for en ny versjon.
- **Tidslinjen** viser hver del over fire spor (Drums, Bass, Lead, FX), med taktnummer.
  - Klikk en del for å spille fra den. Dra delene for å flytte dem. Dobbeltklikk eller ✎ åpner delens grid i
    drop-vinduet, og «← Back to the song» fører tilbake.
  - ↻ betyr en gjentakelse av en tidligere del.
- **Valgt del:**
  - ◀ og ▶ flytter delen. ⧉ Repeat legger inn samme del igjen. ✕ fjerner den.
  - ✦ Variation gir delen sin egen kopi, og drop og build-up får da et nytt lead-riff.
  - 🎲 New melody lager en ny lead-linje. **Lead** velger egen lyd for delen. **Length** setter antall takter.
- Hver build-up rett før et drop får pre-drop (pause, DELAYSY-kast, reverse suck).
- Hver del rendres én gang, også når den gjentas.
- Eksport: hele låta som WAV, stems (fra takt 1) eller MIDI.

### Tre veier inn (v0.11)

- **Drop a song here** åpner låta rett i Song mode. Den legges på et lydspor i sitt eget tempo, med takt 1 og
  toneart funnet (kromagram mot Krumhansl-profiler).
  - Klikk linjalen der droppet skal komme, og trykk **⤵ Insert a drop here**. Build-up og drop settes inn der,
    skrevet i låtas toneart og tempo.
  - Låta deles der, og resten flyttes fram.
  - Det gamle «sett inn et drop i en låt»-vinduet (med ARP-analysen) er tatt ut av startskjermen. Koden ligger
    fortsatt i `app.js`.
- **Make a drop** åpner drop-vinduet.
- **Song mode** åpner hele låta. I drop-vinduet fører **SONG MODE →** dit, og bryteren nederst bytter når som
  helst.

### Notes, klipp og miks (v0.11)

- **Notes**: notene til delen du har valgt, under tidslinjen, med fanene Lead, Bass og Drums.
  - Klikk en tom plass for å legge til en note, og dra for å sette lengden.
  - Dra en note for å flytte den, og høyre kant for å endre lengden. Shift+dra markerer flere. Dobbeltklikk
    sletter.
  - Taster: ←→ flytter (Shift: et slag), ↑↓ endrer tonehøyde (Shift: en oktav), Ctrl/Cmd+D dupliserer,
    Ctrl/Cmd+A markerer alt, Delete sletter.
  - Notene har egen lengde, som overstyrer gate-knappen. Én note per steg per spor, i låtas skala.
- **Klipp:** dra kantene for å trimme. Fade inn og ut. ✂ Split (Ctrl/Cmd+E) ved spillehodet, startpunktet eller
  midten.
- **Spor:** mute (M), solo (S) og farge per lydspor. Dobbeltklikk navnet for å endre det. Mikseren har M og S på
  hver kanal.
- **Raskere:** hver del rendres bare på nytt når den er endret, og lydspor rendres for seg. Etter en
  note-endring tok ny rendring 10 s i stedet for 38 s. Klipp-endringer gir bare ny rendring av lydsporene.

### DAW-funksjoner (v0.10)

- **Linjal og spoling:** klikk linjalen for å spille eller starte derfra (Shift: på slag). ⏮ går til start,
  ⏪ og ⏩ hopper 4 takter. Space spiller og pauser, Home går til start. **Follow** lar visningen følge
  spillehodet. **− og +** zoomer.
- **Lydspor:** dra lydfiler (WAV, AIFF, MP3, M4A, FLAC …) rett inn på tidslinjen. De lander på takten du slipper
  dem på.
  - Tempoet gjettes: looper som et helt antall takter, lengre lyd med Dropfathers tempo- og takt-analyse.
  - Lyden følger låtas tempo med **warp**: **Beats** (kutter ved slagene og flytter bitene, for trommer og
    looper), **Tones** (WSOLA-strekk, for pads og vokal), **Re-pitch** (raskere og lysere) eller **Off**.
  - Klipp: dra for å flytte (Shift: på slag), opp og ned til et annet spor. ←→ flytter, ↑↓ transponerer
    (Shift: en oktav), Ctrl/Cmd+D dupliserer, Delete sletter. Verktøylinjen har warp, klipp-BPM, pitch, gain,
    lengde og loop.
  - Lydsporene er en egen stem og har egen fader (Audio).
- **␣ Insert space:** skyver alt etter valgt del en del-lengde fram og lar rommet stå tomt (Ableton: Insert
  Time). Lydklipp etter innsettingspunktet flytter seg med.
- **Notemarkering i griden** (drop-vinduet): dra over rutene for å markere. ←→ flytter (Shift: et slag), ↑↓
  pitcher bass og lead (Shift: en oktav), Ctrl/Cmd+D dupliserer mot høyre, Delete tømmer, Esc slipper.
  Knappene over hintet gjør det samme.
- **Save project** samler sampler inn i én zip når låta har lydklipp (Collect All and Save). **Load project**
  tar både .json og .zip.
- **Ableton pack:** en mappe med stems fra takt 1, MIDI (Bass, Lead, Drums), prosjektet og en kort
  bruksanvisning. Et ekte Ableton-sett (.als) krever en mal fra Live: send et tomt sett lagret i din
  Live-versjon.
- **Egne instrumenter:** `DropLead.register(id, {name, voicing, create})` legger en ekstern motor til som
  lead-lyd. Strings-motoren og de andre maskinene kan kobles inn her (se `docs/strings-engine-brief.md`).

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
- **Trommer i drop maker**: Stanley Cupids (Tarjei Kroghs) egne innspillinger fra Norwegian Beats v43, de
  innebygde lydene som appen selv merker «Stanley Cupid's own recordings» (`src/vendor/nb-drums.js`). De hentes ut
  med `tools/extract-nb-drums.mjs`, med lyddata, nivå og settoppsett uendret. Bevisst *ikke* med: breakbeat-trommene
  i Norwegian Beats' brukerbank (ukjent opphav), Mouth-settet, og trommene fra Bass Invaders (uavklart lisens, se
  Bass Invaders `SOURCE-NOTES`).
- **Risere, impact og synth-trommene** (sangmodus og «Dropfather synth»): syntetisert i `src/dsp.js`. Ingen samples.
- Logo: Tarjei Krogh.

## Utvikling

```
node build.mjs            # bygger Dropfather.html fra src/
node test-analysis.cjs    # tempo, takt 1 og drop-punkt på syntetiske låter (sangmodus)
# hente motorene på nytt fra nye versjoner av appene:
python3 tools/extract-delaysy.py DELAYSY-vX.html src/vendor/delaysy-engine.js
python3 tools/extract-bass-host.py Bass-Invaders/source/dist/app.js src/vendor/bass-invaders/bass-host.js
python3 tools/extract-arp-patterns.py ARP/dist/assets/patterns.json src/vendor/arp/patterns-4bars.json
node tools/extract-nb-drums.mjs Norwegian_Beats.html assets-1.js assets-2.js assets-3.js
```

`src/analysis.js` (tempo/takt/energikart/forslag), `src/dsp.js` (all lyd, offline rendering, WAV/MIDI),
`src/app.js` (sangmodus-UI), `src/grid.js` + `src/maker.js` (drop maker: motor og UI), `src/decode.js` (formater),
`src/files.js` (lagring), `src/kits.js` (trommesett), `src/vendor/` (ARP-analysen, Bass Invaders, DELAYSY,
Norwegian Beats-trommene).

## Kjente grenser i v0.7

- Takt 1 er en kvalifisert gjetning (seksjoner skifter på 1-ern). Sjekk den med «−1 beat / +1 beat».
- Taktartsforutsetning 4/4. Tempo må være stabilt (ingen live-tempo-drift).
- Bassen er aldri bedre enn ARP-analysen. I takter der ARP tar feil, tar bassen feil.
- Ikke lyttetestet av meg (Claude kan ikke høre). Tallene er målt (nivå, tonehøyde, tidsplassering), smaken er ikke.
- Drop maker: leadens hook-generator er Dropfathers egen (enkel). Bass og lead er monofone, én note per steg.
- Drop maker: en full render tar tid, fordi ARP bygger en full stemme per note. Det rendres takt for takt, og i
  testmiljøet tok hele låta (137 s lyd) 31 s. På en vanlig maskin går det raskere.
