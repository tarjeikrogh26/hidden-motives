# DROPFATHER — by Tarjei Krogh · v0.2

Build-up, pre-drop og drop for en hvilken som helst låt. Lokal nettleserapp, ingen server, ingen konto.
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

## Slik virker Dropfather

1. **Last inn låten.** Appen finner BPM, takt 1 og et energikart (rød = kick/bass, blå = breakdown).
   Den foreslår drop-punkter der bunnen kommer tilbake etter en roligere del (★ = hvor tydelig).
   Finnes ingen, velger du selv ved å klikke i kartet (f.eks. der refrenget starter).
2. **AVANTGARDIAN-analysen** kjører i bakgrunnen og finner bassnotene gjennom hele låten.
   Det er ARP-ens egen modifiserte analysekjede: den kompilerte WASM-en og `harmony-engine.js` med egen bassdekoder,
   kopiert uendret. Dropbassen og pitch-riseren følger låtens faktiske grunntoner.
3. **Velg modus:**
   - **Replace**: taktene før droppet blir til build-up. Låten beholder lengden.
   - **Insert**: en ny build-up settes inn før droppet, og låten blir lengre. Godt for gamle låter som aldri hadde et drop.
4. **Velg stil**: House lift · Festival · Techno tunnel · Take-off · EBM motor · Randomize. Juster så maskinene:
   - BUILD-UP: high-pass sweep, noise riser, pitch riser, roll (snare/clap/kick), stutter, reverb wash, volume swell
   - PRE-DROP: pausen (ingen / 1 slag / 2 slag / 1 takt), **DELAYSY** echo throw (alle 777 fabrikkpresets, kast av
     siste 1/2 slag til siste takt), reverse suck
   - DROP: kick, **Bass Invaders**-lyd (alle 2000 fabrikklyder, inkludert de innspilte bassene), basspattern
     (offbeat, rolling 16ths, gallop, oktav-motor, sub hold, monoton 1/4 eller **Bass Invaders riff**: lydens egen
     fabrikk-basslinje), oktav, pump, impact, air, låtnivå, «erstatt låtens egen bass»
5. **Lytt**: «Play drop» (build-up + drop), «Whole song» og «A/B original». Klikk i det hvite/røde vinduet for å lytte derfra.
6. **Eksport**: WAV (hele låten, bare build+drop, eller bare lagene) i 24-bit, MIDI (bass, kick, roll) og planen som JSON.

Lyd utenfor build/drop-området kopieres sample for sample fra originalen. En look-ahead-limiter jobber bare i det
nye området, så en hardt mastret låt ikke klipper. Statuslinjen viser hvor mye limiteren tar.

## Opphav og rettigheter (viktig før salg)

- **Analyse**: fra AVANTGARDIAN ARP v0.18 (`src/vendor/`). Chordino/NNLS-Chroma er **GPL-2.0-or-later**
  (lisenser og kildekode i `src/vendor/chordino-license/`). Selges Dropfather med denne motoren, må hele appen
  distribueres under GPL med kildekode tilgjengelig. Samme gjelder ARP i dag.
- **Bass**: den ekte Bass Invaders v0.10.8-motoren (`src/vendor/bass-invaders/`). Filene er kopiert uendret.
  Lydverts-delen av `app.js` (`loadPreset`, `applySound`, `makeGraph` og startverdiene) er hentet ordrett ut med
  `tools/extract-bass-host.py`. Hver lyd får derfor nøyaktig samme patch, graf (filter 2, dark echo, 3D space,
  kompressor) og nivåkalibrering (`bass-balance.js`) som i appen. Riff-mønsteret bruker Bass Invaders' egen
  frasegenerator med lydens fabrikk-seed. De innspilte bassene er CC0 (lisenser i `bass-assets/licenses/`) og er
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

## Kjente grenser i v0.2

- Takt 1 er en kvalifisert gjetning (seksjoner skifter på 1-ern). Sjekk den med «−1 beat / +1 beat».
- Taktartsforutsetning 4/4. Tempo må være stabilt (ingen live-tempo-drift).
- Ikke lyttetestet av et menneske ennå. Tallene er målt (nivå, tonehøyde, tidsplassering), smaken er ikke.
