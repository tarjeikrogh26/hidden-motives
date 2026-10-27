# DROPFATHER — by Tarjei Krogh · v0.3

Lager et **nytt parti** (build-up, pre-drop og drop) av låtens egen lyd og setter det inn i låta. Bassen i droppet
spiller bare AVANTGARDIAN ARP-ens grunntoner. Lokal nettleserapp, ingen server, ingen konto.
Åpne `Dropfather.html` i Chrome, Edge eller Safari og dra inn en WAV/AIFF/MP3.

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
- **Trommer, risere, impact**: syntetisert i `src/dsp.js`. Ingen samples. Trommene fra Bass Invaders er bevisst
  *ikke* brukt, fordi lisensen deres er uavklart (se Bass Invaders `SOURCE-NOTES`).
- Logo: Tarjei Krogh.

## Utvikling

```
node build.mjs            # bygger Dropfather.html fra src/
node test-analysis.cjs    # tempo, takt 1 og drop-punkt på syntetiske låter
# hente motorene på nytt fra nye versjoner av appene:
python3 tools/extract-delaysy.py DELAYSY-vX.html src/vendor/delaysy-engine.js
python3 tools/extract-bass-host.py Bass-Invaders/source/dist/app.js src/vendor/bass-invaders/bass-host.js
```

`src/analysis.js` (tempo/takt/energikart/forslag), `src/dsp.js` (all lyd, offline rendering, WAV/MIDI),
`src/app.js` (UI), `src/vendor/` (ARP-analysen, Bass Invaders, DELAYSY).

## Kjente grenser i v0.3

- Takt 1 er en kvalifisert gjetning (seksjoner skifter på 1-ern). Sjekk den med «−1 beat / +1 beat».
- Taktartsforutsetning 4/4. Tempo må være stabilt (ingen live-tempo-drift).
- Bassen er aldri bedre enn ARP-analysen. I takter der ARP tar feil, tar bassen feil.
- Ikke lyttetestet av meg (Claude kan ikke høre). Tallene er målt (nivå, tonehøyde, tidsplassering), smaken er ikke.
