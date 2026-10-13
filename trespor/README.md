# TRE SPOR

Et lite, spillbart elektronisk instrument for iPhone og Mac: **trommer, bass og synth**. En enkel grunnidé som utvikler seg langsomt gjennom modulasjon, rytmiske forskyvninger og små endringer, mens groovet holder.

Alt kjører i nettleseren (Web Audio). Ingen installasjon, ingen konto, ingen betalte API-er, ingen nettverkskall.

---

## Mac (hovedversjonen)

**Dobbeltklikk `TRE SPOR.app`** i mappen `trespor`.

- Har du Chrome, Edge eller Brave, åpnes instrumentet i et eget vindu uten faner og adressefelt, som et vanlig program. Ellers åpnes det i Safari.
- Vil du ha det i Dock: dra `TRE SPOR.app` til Dock. La selve appen ligge i `trespor`-mappen, for den henter filene derfra.
- Trykk **H** for oversikten over tastene.

**Første gang** kan macOS stoppe appen fordi den ikke er signert av en kjent utvikler.
- På macOS 15 (Sequoia) og nyere: prøv å åpne den én gang. Gå så til **Systeminnstillinger → Personvern og sikkerhet**, bla ned og trykk **Åpne likevel**.
- På eldre macOS: høyreklikk på appen, velg **Åpne**, og bekreft.

Hentet du repoet som zip, og appen ikke starter i det hele tatt, kjør dette én gang i Terminal fra `trespor`-mappen:

```
xattr -dr com.apple.quarantine "TRE SPOR.app" start-mac.command
chmod +x "TRE SPOR.app/Contents/MacOS/trespor" start-mac.command
```

**Alternativ:** dobbeltklikk `index.html`. Det virker i Safari og Chrome.

### Spill med tastaturet

Alt kan gjøres uten mus. Tastene ligger direkte på et norsk tastatur, uten Alt-kombinasjoner.

| Tast | Gjør |
|---|---|
| **Mellomrom** | spill / stopp |
| **1  2  3** | velg trommer / bass / synth. Hovedkontrollene styrer da bare det sporet |
| **0** | hovedkontrollene styrer alle spor |
| **← →** | flytt stegmarkøren (⇧ = fire steg) |
| **↑ ↓** | tone opp / ned. I andre felt endres verdien. På trommer velges lyd |
| **Enter** | slag av / på |
| **,  .** | forrige / neste felt: Slag, Tone, Oktav, Lengde, Sjanse |
| **−  +** | tempo |
| **T / ⇧T** | tetthet opp / ned |
| **B / ⇧B** | bevegelse opp / ned |
| **I / ⇧I** | intensitet opp / ned |
| **L  M** | lås / demp valgt spor |
| **N** | ny idé for bass eller synth |
| **U  F** | utvikling av/på, frys tilfeldighet |
| **R** | opptak (starter på neste takt) |
| **S** | lagre snapshot. **⇧1–⇧9** henter snapshot 1–9 |
| **⌘Z / ⇧⌘Z** | angre / gjør om |
| **⌘S** | lagre prosjektfil. **⌘E** åpner fil og eksport |
| **H** eller **?** | vis tasteoversikten. **Esc** lukker den |

Valgt spor har hvit ramme, og stegmarkøren er den hvite ruta. Tastehintene vises ved kontrollene på Mac og skjules på telefon.

## iPhone

Samme instrument, med store ruter for fingre i stedet for tastehint.

**A. Fra Macen (samme Wi-Fi)**
1. Dobbeltklikk `start-mac.command` på Macen. Den starter en liten server og viser adressen for iPhone.
2. Åpne adressen fra terminalvinduet (`http://<mac-ip>:8765`) i Safari på iPhone.
3. Trykk ▶. Hører du ingenting: sjekk lydløs-bryteren på siden av telefonen, og skru opp volumet.
4. Valgfritt: Del-knappen → **Legg til på Hjem-skjerm**. Da åpnes appen i fullskjerm.

**B. Via GitHub Pages**
Repoet ser ut til å være publisert med GitHub Pages fra `main`. Når denne grenen er flettet inn, skal instrumentet på
`https://tarjeikrogh26.github.io/hidden-motives/trespor/` ligge der. Over https fungerer det også uten nett etter første besøk.

**iPad** fungerer på samme måte i Safari. Har iPaden tastatur, virker tastene også der.

Eksport på iPhone: knappene laster ned filene (Safari spør først). **Del / Lagre i Filer** sender WAV- og MIDI-filene rett til Filer, AirDrop eller en annen app.

Prosjektet lagres automatisk i nettleseren. Egne samples lagres også lokalt, slik at de er der neste gang.

---

## Slik spiller du

| Du vil … | Gjør dette |
|---|---|
| Starte og stoppe | ▶ (Mellomrom på Mac) |
| Endre tempo, toneart og energi | **Hovedkontroller** øverst |
| Endre bare bass eller bare synth | Velg **Bass** eller **Synth** under «Kontrollene styrer» |
| Låse et spor helt | **Lås** på sporet |
| Tegne noter | Velg felt (Slag, Tone, Oktav, Lengde, Sjanse) og trykk eller dra i stegrutene |
| Lagre en god tilstand | **+ Snapshot**. Trykk på et snapshot for å hente det, skjer på neste taktstart |
| Angre | ↶ / ↷ (⌘Z / ⇧⌘Z) |
| La musikken utvikle seg | **Utvikling: på**. Skru opp **Bevegelse** |
| Ta opp en fremføring | **Opptak**: starter på neste taktstart og husker alt du skrur på. Trykk igjen for å stoppe |
| Eksportere | **Fil og eksport** → WAV, stems, MIDI, eller alt i én zip |

### Hovedkontroller

- **Tempo**: grunnpulsen, 60–180 BPM.
- **Toneart**: grunntone, skala, og de 12 knappene for tillatte toner. Sequencerne lagrer skalatrinn, ikke faste toner. Bytter du toneart, følger alt med og forblir i skala.
- **Tetthet**: færre eller flere slag. Lav tetthet tynner ut alt som ikke bærer pulsen. Høy tetthet legger til ghost-hihat og korte utfyllingsnoter. Kick og klapp er alltid med.
- **Bevegelse**: hvor mye som flytter seg. Skalerer alle modulasjonsdybder, hvor ofte variasjon skjer og hvor raskt utviklingen går. Null betyr helt stille løkke.
- **Intensitet**: energi i lyden. Åpnere filter, mer drive, mer filter-envelope, og hardere anslag og aksenter.

Når du drar i en kontroll, lyser sporene den påvirker opp.

### Trommer

- **Trommesett**: fem lyder (kick, klapp, hihat, åpen hat, perk) i et 16-stegs mønster. Lydene er syntetisert ved oppstart. **Bytt sample …** erstatter en lyd med din egen (WAV, AIFF, MP3, M4A).
- **Egen loop**: importer en trommeloop. Appen gjetter antall takter og originaltempo, og **Sett tempo fra loop** setter tempoet til loopens. Loopen deles i slag, og hvert slag starter på grid, så den holder takten også når du endrer tempo. Tonehøyden følger tempoet, uten tidsstrekking.
- **Begge**: loop og sett samtidig.
- Felter: **Slag**, **Aksent** og **Sjanse** (100/75/50/25 %, trykk for å bytte, dra for finjustering).
- **Lyd og groove**: swing, tone (filter), drive, klang, ekko og volum.

### Bass og synth

Hver har sin egen sequencer:

- **Lengde** 1–16 steg (hurtigvalg 8/12/16). Forskjellige lengder gir polymeter: synth på 12 steg mot trommenes 16 møtes hver 3. takt.
- **Stegverdi** 1/16, 1/8 eller 1/4.
- **Forskyv**: roterer mønsteret.
- **Start på nytt**: tvinger sekvensen tilbake til steg 1 hver takt eller hver 2./4./8. takt, så forskyvningen alltid finner hjem.
- Felter per steg: **Slag** (pause eller tone), **Tone** (skalatrinn, dra opp/ned eller bruk − / +), **Oktav** (−2…+2), **Lengde** (kort … legato) og **Sjanse**.
- **Ny idé**: lager et nytt mønster i skala fra frøet. Kan angres.

**Synthmotor** (under «Lyd»): to oscillatorer (sag, firkant, trekant, sinus) med detune og fargeblanding, sub-oscillator, resonant lavpassfilter med egen envelope, ADSR-envelope, glide, mono/poly, drive (tanh-metning), volum, klang, ekko og panorering.

### Modulasjon

Et kompakt panel i stedet for kabler:

- **Kilder**
  - **LFO**: sinus, trekant, sagtann, myk firkant eller trinn, med periode fra 1/4 til 8 takter.
  - **Drift**: langsom, myk tilfeldig kurve over 4–64 takter.
  - **Sjanse**: ny tilfeldig verdi hver 1/2–4 takt.
- **Seks forbindelser**: kilde → spor → mål, med mengde fra −100 til +100 %. Mulige mål er filter, envelope (decay), klang, ekko, panorering og farge (oscillator 2). Under hver forbindelse står det i klartekst hva den påvirker. Måleren viser verdien akkurat nå.
- **∿-merket** i lydpanelet viser hvor en modulert verdi faktisk er flyttet til.
- **Kontrollert variasjon** per spor: *hvor ofte*, og vekter for **oktav**, **notelengde**, **pause** og **nabotone**. Første steg blir aldri til pause, og alt spilles i skala.

Alle endringer går som jevne ramper fra steg til steg, og alle mål har musikalske grenser. Bass holder seg mellom D1 og D4, synth mellom E2 og C7.

### Utvikling, tilfeldighet og frø

- **Utvikling** gjør én liten endring om gangen, på ett spor om gangen, aldri samme spor to ganger på rad. Med bevegelse på 50 % skjer det omtrent hver 9. takt. Mulige endringer:
  - nabotone
  - oktavskift
  - ny pause eller ny tone
  - kortere eller lengre tone
  - forskyvning ett steg
  - for trommer: bare hihat, åpen hat og perk
- Antall samtidige endringer er begrenset, og utviklingen trekker seg gradvis tilbake mot grunnideen. Endrede steg vises stiplet. **Behold** gjør dem til en del av grunnideen, og **Tilbake til grunnidé** fjerner dem.
- **Frys tilfeldighet** gjør at variasjonen gjentas likt hver runde, og utviklingen venter.
- **Frø**: all tilfeldighet regnes ut fra frøet, steget og runden. **Stopp → Nullstill utvikling → Spill** gir nøyaktig samme forløp igjen.

### Opptak og eksport

Et opptak lagrer **starttilstand + hver kontrollendring stemplet med steg**, ikke bare lyd. Ved eksport spilles fremføringen av på nytt gjennom samme lydmotor, offline og raskere enn sanntid. Derfor får du:

- **Samlet WAV**: 24-bit, 44,1 kHz, med masterkompressor.
- **Stems**: én WAV for hvert spor, hver med egen klang og ekko, før master.
- **MIDI**: type 1 med tre spor, trommer på kanal 10 med GM-noter, pluss tempoendringer og swing.
- **Alt i én .zip**, med prosjektfila i tillegg.

Du kan også eksportere **løkken** (4–64 takter) fra nåværende tilstand uten opptak.

### Prosjektfil

**Fil og eksport → Lagre prosjektfil** lager en `.json` med egne seksjoner:

```
song        tempo, swing, toneart, tillatte toner, frø, frys, utvikling
sequences   trommer / bass / synth: steg, lengde, makroer, lås, utviklingens endringer
synths      synthinnstillinger per spor (oscillator, filter, envelope, effekter)
modulation  kilder, forbindelser og variasjon
runtime     utviklingens teller (for nøyaktig gjenskaping)
snapshots   lagrede tilstander
recordings  innspilte fremføringer (starttilstand + kontrollendringer)
samples     egne samples og trommeloop (base64, valgfritt)
```

Fordi synth og modulasjon ligger i hver sin seksjon, kan klangutviklingen gjenskapes uavhengig av notene.

---

## Kjente begrensninger i første versjon

- En importert loop tidstilpasses ved å endre avspillingshastigheten. Tonehøyden følger derfor tempoet. Den kommer heller ikke med i MIDI.
- Lyden stopper når iPhone-skjermen låses. Det er Safari-regel for nettsider.
- Opptak husker kontrollendringer, men ikke bytte av sample underveis. Eksporten bruker samplene som er lastet når du rendrer.
- To renderinger av samme opptak gir identiske noter. Lyden er lik ned til nettleserens avrundingsstøy, rundt −115 dB.

## Filer

```
trespor/
  TRE SPOR.app          Mac-appen (dobbeltklikk)
  index.html            appen
  start-mac.command     server for iPhone (viser adressen)
  css/app.css           utseende
  js/core.js            tilstand, skalaer, frøstyrt tilfeldighet
  js/sequencer.js       sequencer, variasjon, modulasjonskilder, utvikling
  js/samples.js         innebygd trommesett og klangrom
  js/engine.js          lydmotor (synth, trommer, effekter, sanntidsklokke)
  js/render.js          offline-rendering av løkker og opptak
  js/files.js           WAV, MIDI, ZIP, prosjektfil, lagring
  js/app.js             angre, snapshots, opptak, samples, eksport
  js/ui.js              grensesnitt
  js/keys.js            tastaturstyring
  tests/                tester
```

## Tester

```
node tests/unit.test.js        # sequencer, utvikling, grenser, frø, filformater
node tests/browser.test.js     # i ekte nettleser (krever Playwright):
                               # spiller, tar opp, rendrer miks/stems/MIDI, loop, angre, prosjektfil,
                               # tastaturstyring og mobilvisning
BROWSER=webkit node tests/browser.test.js   # samme test i WebKit, motoren i Safari på Mac og iPhone
```
