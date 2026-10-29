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
    --drums /sti/til/trommeslag --vox /sti/til/vox-biter --piano /sti/til/pianotoner \
    --guitar /sti/til/gitarfraser --asmr /sti/til/asmr --world /sti/til/world-fraser
```

Sida må holde seg under 16 MB (artifact-grensen); `build.py` skriver ut størrelsen. Lydene legges inn som AAC med
bitrater valgt for det: opptakene 80k, trommeslag 80k, vox 72k, gitar 64k, world og ASMR 48k. World-opptakene kuttes
med `KEEP=2.5 python3 tools/chop_guitar.py <ut-mappe> <filer>` (2,5 s beholdes av hvert).

Opptakene kommer fra samplepakker og ligger derfor ikke i repoet. Uten `--samples` spiller synthen alene.

`--arp` legger AVANTGARDIAN ARP inn i sida: skriptene, lydbanken (777 lyder) og de 2 281 mønstrene, pakket med
seks byte per note. Arpen følger akkordlinja på motorens taktklokke (sida starter avspillingen på et avtalt
lydtidspunkt, og motoren melder hvor slaget er), eller akkorden du holder når transporten står. Uten `--arp`
er arp-menyene skjult.

Trommeslagene klippes ut av trommeloops og perkusjonsopptak med `tools/chop_drums.py <mappe> <ut-mappe>`:
spektral fluks finner slagene, og hvor energien ligger sorterer dem i spark, skarp, hi-hat og perc. Skarper
og hi-hats får lavkutt, så sparken i en break ikke blør med. `--drums` legger dem inn i sida, der de blir til
trommesett sammen med syntetiserte lyder (343 sett: elektroniske, breaks, hybrider og perkusjon). Uten
`--drums` finnes bare de elektroniske settene. Hver tromme i et sett finnes i fem varianter (litt høyere eller lavere,
lengre eller kortere, andre slag av samme slag fra samme opptak, mørkere eller lysere), og motoren tar dem på
omgang, aldri samme to ganger, litt tidlig eller sent og litt mykere eller hardere, som en trommis. Hver groove
varierer over 32 takter: hi-hat-spøkelser, fills hver fjerde og åttende takt, åpen hi-hat, sparken som hviler, og et
brekk i takt 32. Enkeltslag-skarper (`snare`) går inn i settene; snaps, effekter, foley (`texture`) og
orkesterloops (`orch`) går til Perc-kanalen.

Perc er en egen kanal med fem perkusjonsspor, hvert på sin egen euklidske rytme og syklus, som glir mot hverandre;
over 32 takter kommer sporene inn og går ut. 96 sett i smaker (hender, snaps, gnister, smuler, orkester, natt,
blandet, laget) og 48 rytmer. Hvert slag har sin plass rundt hodet og flyr mens det ringer.

Melodi-kanalen har en lead som synger et lite motiv og svarer seg selv over akkordene (akkordtoner på de sterke
slagene), og en bass som følger grunntonene i sju mønstre. Piano-kanalen er et mykt filtpiano laget med
`tools/chop_piano.py <ut-mappe> <filer>`: rene enkelttoner skilles ut av pianoopptak (venstre hånd filtreres bort),
og hver tangent starter med en ekte innspilt tone og ringer videre på to strenger, laget av de målte deltonene. Det
spiller lange, enkle linjer i passasjer, av og til, langt ute i et stort mørkt rom. High (på Chord-stripen) er
strykeropptakene en til to oktaver over akkordene, noen lange toner av og til, svært lavt.

Gitaren spiller ekte fraser fra opptakene: `tools/chop_guitar.py <ut-mappe> <filer>` beholder det mest levende
stykket av hvert opptak og finner frasene i det (ett, to eller fire slag, plukk eller strum), med kroma. For hver akkord
velger sida frasen som passer best, flyttet noen halvtoner og i et tempo nær sangens; gitaristen kommer innom i
passasjer. 30 måter å spille på (flamenco, nylon, strum-svell, ørkenløp, leirbål, duende) i fem rom.

World er en spiller med mange instrumenter (cümbüş, oud, ruan, santoor, sarod, jaltarang, pku, zurna, irakisk fiolin,
tumbi), spilt som gitaren fra fraser i opptakene og flyttet til akkordene. Han tenker i 32 takter: når han vandrer, tar
han et nytt instrument og en ny måte å spille på for hver (fri taqsim, hypnotisk ostinato, spørsmål og svar, tremolo-
blomst, duett). Han deler stripe med gitaren.

Synth bass er en modulær analog stemme: flere oscillatorer noen cent fra hverandre, sub og støy, en kompleks
oscillator for FM (vestkyst-måten), ringmodulator, wavefolder, drive og crusher for de sure og skrapete, og et filter av
fem slag: stige (24 dB, Moog-måten), tvillingtopper (high-pass og skrikende low-pass, MS-20-måten), mykt 24 dB
(Jupiter-måten), notch med low-pass (SEM-måten) og low-pass-gate (Buchla-måten). 16 patcher i åtte mønstre (acid,
Berlin-sekstendeler, rullende, offbeat, brutt, stikk, sprett, halvtempo), med aksenter og slides, på beaten fra
akkordens grunntone, oktav, kvint, septim og ters. Den kommer inn noen toner om gangen. Alive tar den fram når en
stemning har spilt lenge, og gangbassen går ut så lenge den spiller. Den deler stripe med pianoet.

ASMR har sin egen motor: `tools/chop_asmr.py <ut-mappe> <filer>` legger stemmer, hvisking og nær foley etter hverandre
i én fil. Sida tar korn på 20-400 ms, baklengs, flyttet i oktaver og kvinter, stammende, og kaster dem helt inntil
ørene i korte byger (flutter, crawl, cloud, crackle, glitch, swarm), over bassen og under musikken. Ingenting spilles
som det ble tatt opp.

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

Overganger: reverserte svell (neste akkord slått mykt gjennom et langt rom og spilt baklengs, så den vokser opp og
lander på skiftet, på hvert akkordskifte eller bare inn i nye deler), en stigning før nye deler (skimmeret klatrer,
rommet fryses siste takt, alt slippes på første takt) og pumping med sparken (sidechain på akkord og arp).

1692 stemninger: de 192, 500 ensemble-stemninger, 500 Far and wide og 500 After hours (andre veier gjennom banken, og
synthbassen på beaten i de fleste), så ulike som mulig (hele lydbanken, alle
akkordlinjer, alle tonearter rundt kvintsirkelen, tempo jevnt fra 60 til 124, alle sett og grooves, sitt eget band og sin
egen miks), med en sang til hver. Ensemble-stemningene har hver et band på fire til seks instrumenter, alltid med piano
eller gitar. ⤓ ved siden av lagrer det som en fil på maskinen (⤒ åpner den igjen), og App ⤓ lagrer hele appen som én HTML-fil som
åpnes i nettleseren med lyd og alt. ★ ved siden av terningen lagrer det som spiller nå som din egen (under Your sessions). Et stemningsbytte
er en oppløsning: hele mikset synker inn i et mykt lavpass og et langt rom, den nye stemningen kommer på bunnen av
det, og alt åpner seg igjen. Telleren i baren viser spilt og igjen av sangen (♪), av stemningen til Endless eller
Alive går videre (∞), eller takten i akkordlinja. En kanal som spiller lyser i sin egen farge, sterkere jo høyere den
er.

Alive (på som standard): når ingen har rørt noe på 30 sekunder, lever maskinen selv som i Endless: nye
akkordlinjer og lyder, arpen snur, andre sett og grooves, leads og basser, pianoet, stemmene, og etter hvert nye
stemninger. Endringene lander på frasegrenser. Et arrangement med egen klokke lar kanalene komme og gå, så det aldri
spiller alt på én gang (færre når rolig, flere når urolig), og akkordene løftes opptil 4,5 dB når de står nesten
alene. Arpen spiller mørkere og lenger bak når en melodi synger, bytter mønster hver 16. takt og drar én gang hver 32.
takt helt ut til kanten av rommet og tilbake. Stemmene skifter stil, rom, sangere eller måte å synge på omtrent hvert
minutt. Når en stemning har spilt lenge (2,5 til 4 minutter) kommer en fet synthbass inn i 32 takter (Reese, Moog,
Juno, growl, wobble, oktavstabel) og går så igjen.

Eco (Auto, På, Av, i akkordlinjekortet): når maskinen ikke henger med, spiller sida lettere: enkelttoner og korn med
vanlig panorering i stedet for hodets filtre, halvparten av ASMR-kornene, én kanal færre om gangen i Alive, og visningene
tegnes sjeldnere. Visningene tegnes uansett bare når de vises, rundt 20 ganger i sekundet.

Lydbytter fader over: motoren har to motorer per kanal (akkord og arp), og trommesett, grooves, arp-mønstre og
vox-stiler fader også over tiden som er valgt under Fade.

## Teste motoren

```sh
g++ -std=c++17 -O2 tools/test_harmony.cpp -o test_harmony && ./test_harmony
g++ -std=c++17 -O2 tools/render.cpp dsp/Engine.cpp -o render && ./render ut.wav Sonata /sti/til/enkelttoner
```
