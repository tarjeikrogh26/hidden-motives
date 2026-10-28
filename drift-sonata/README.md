# DRIFT SONATA

En elektronisk string-, pad- og teksturmaskin av Tarjei Krogh. Seks oscillatorer som driver og svever mot
hverandre, akkorder som foldes ut til fem toner og mer, en sub-bass på ener, og innspilt kor og cello blandet inn.

Motoren er ren C++ (`dsp/`) uten plugin-kode. Den samme koden kjører i dag i nettleseren som WebAssembly
(testsida), og blir senere en VST3/AU-plugin.

## Mapper

- `dsp/Engine.*`: lydmotoren (stemmer, drift, sub, sample-lag, ensemble, tape, luft, rom med shimmer, dub-delay, limiter).
- `dsp/Harmony.h`: gjenkjenning av akkorder og harmoni-ekspansjonen.
- `dsp/Params.h`: alle parametere på ett sted. `dsp/Presets.h`: fabrikklydene.
- `dsp/Space3D.h`: binaural plassering. Hver oscillator, hvert opptakslag og roboten er sin egen lydkilde i bane rundt hodet.
- `dsp/Vocoder.h`: Robot with a soul, en 20-bånds vocoder etter VOXY MUSIC, med kor eller maskinord som stemme.
- `dsp/SampleLoader.h`: leser en mappe med opptak: `choir_`, `cello_`, `strings_`, `brass_` + midi-tone (enkelttoner),
  `texture_` + grunntone (hele teksturer), og wavetables `wt_cello`, `wt_choir`, `wt_strings`, `wt_brass`, `wt_chimera`
  (rammer på 2048 samples, laget av opptakene, som oscillatorene kan bruke som bølgeform).
- `tools/test_harmony.cpp`: tabell over hvordan akkorder foldes ut, med regelsjekk.
- `tools/render.cpp`: rendrer en akkordrekke til WAV og måler nivå, DC, hastighet og om drift holder midten stemt.
- `tools/fader_test.cpp`: skrur hver fader helt ned og opp og tilbake, og sjekker at lyden kommer igjen.
- `web/`: testsida (`page.html`), C-grensesnittet for WebAssembly (`wasm_api.cpp`) og byggeskriptet (`build.py`).

## Bygge testsida

```sh
python3 web/build.py --wasi-sdk /sti/til/wasi-sdk --out dist/DriftSonata.html \
    --samples /sti/til/enkelttoner --header assets/header.webp --arp /sti/til/AVANTGARDIAN-ARP/dist \
    --drums /sti/til/trommeslag --vox /sti/til/vox-biter
```

Opptakene kommer fra samplepakker og ligger derfor ikke i repoet. Uten `--samples` spiller synthen alene.

`--arp` legger AVANTGARDIAN ARP inn i sida: skriptene, lydbanken (777 lyder) og de 2 281 mønstrene, pakket med
seks byte per note. Arpen følger akkordlinja på motorens taktklokke (sida starter avspillingen på et avtalt
lydtidspunkt, og motoren melder hvor slaget er), eller akkorden du holder når transporten står. Uten `--arp`
er arp-menyene skjult.

Trommeslagene klippes ut av trommeloops og perkusjonsopptak med `tools/chop_drums.py <mappe> <ut-mappe>`:
spektral fluks finner slagene, og hvor energien ligger sorterer dem i spark, skarp, hi-hat og perc. Skarper
og hi-hats får lavkutt, så sparken i en break ikke blør med. `--drums` legger dem inn i sida, der de blir til
trommesett sammen med syntetiserte lyder (343 sett: elektroniske, breaks, hybrider og perkusjon). Uten
`--drums` finnes bare de elektroniske settene.

Vox-sporet lages av vokalister med `tools/chop_vox.py <ut-mappe> <navn>=<fil> ...`: et tonesøk (YIN) finner nynn og
holdte vokaler, starten på stavelser blir korte ordbiter (aldri hele ord), og pust tas med. Sungne akkorder med
toneart i filnavnet (`..._choir_Gmaj.wav`) kuttes i myke vinduer. `--vox` legger bitene inn i sida, der de stemmes
til akkordene, legges i skyer på tvers av vokalistene, og flyr hver sin bane gjennom 3D-rommet.

Moods er presets for hele maskinen: 16 familier med 12 stemninger hver (lyd, akkordlinje, toneart, tempo, trommer,
arp, vox, bevegelse og rom), laget av bankene etter familiens smak. Et valg fader alt over på neste taktstrek, og
tempoet glir dit. Endless reiser selv mellom stemningene (mest i samme familie, ellers en nabo med nært tempo), og
gjør små endringer på taktstrekene innimellom: ny akkordlinje, en annen arp, et trommebrekk, vox inn eller ut, mer
eller mindre Twist, av og til en ny toneart. Opptak tar mikset, eller mikset og hver kanal for seg, som WAV.

Song line spiller en hel sang: en stemning og en rekke deler (intro, vers, refreng, bro, breakdown, outro), hver med
egen akkordlinje og lengde og sin egen følelse (refrenget åpner seg, breakdown slipper trommene, intro og outro står
langt unna). Hver del starter sin akkordlinje på sin egen første takt, kanalene fader inn og ut, og Intensity, Twist
og sub glir. 192 sanger, én per stemning, i fem former; delene kan endres, flyttes, legges til og lagres, og
MIDI-eksporten tar hele sangen med markører for delene.

Lydbytter fader over: motoren har to motorer per kanal (akkord og arp), og trommesett, grooves, arp-mønstre og
vox-stiler fader også over tiden som er valgt under Fade.

## Teste motoren

```sh
g++ -std=c++17 -O2 tools/test_harmony.cpp -o test_harmony && ./test_harmony
g++ -std=c++17 -O2 tools/render.cpp dsp/Engine.cpp -o render && ./render ut.wav Sonata /sti/til/enkelttoner
```
