# Brief: levende strings-maskin (strings, pads, støy og teksturer)

Lim inn denne teksten som første melding i en ny Claude-chat, og legg ved filene under «Dette får du».

---

## Hvem og hva

Jeg er Tarjei Krogh (artistnavn Stanley Cupid). Jeg lager musikkverktøy som kjører i nettleseren: Norwegian Beats,
AVANTGARDIAN ARP, Bass Invaders, DELAYSY, Chordlab/Stablab (akkorder og rytmiske stabs), There Will Be Acid,
Beatfighter, Voxy Music, Pump Fiction, Chop Secret og Dropfather (en liten DAW for drops og hele låter).

Nå vil jeg ha en egen maskin for **strings, pads, støy og teksturer**. Den skal virke alene og kunne kobles inn i
Dropfather. Den skal ikke etterligne et klassisk orkester. Den skal lage store, emosjonelle elektroniske landskap,
og den skal kunne **bære en hel låt alene** med bare trommer og vokal rundt seg.

## Lyden jeg er ute etter

Referanser, og hva jeg hører i dem:

| Referanse | Det jeg vil ha |
|---|---|
| Wendy Carlos, *A Clockwork Orange* | Moog-strykere og kor med ren, nesten barokk stemmeføring |
| Kraftwerk, *Radio-Activity* | Mørke, enkle korflater (Orchestron-aktig), mye luft rundt |
| Tangerine Dream | Mellotron-strykere og -kor, lange flater som utvikler seg |
| The Orb, Orbital | Varme, drivende flater, dub-rom, akkorder som løfter |
| Portishead | Mørkt og filmatisk, tape, vinyl, tonehøyde som vingler |
| TR/ST (Trust, kanadisk) | Sure, mørke darkwave-pads som vibrerer |
| Ulrich Schnauss | Lag på lag med pads, kor-effekt, stor reverb, filter i bevegelse |

Gamle string machines (Solina, Logan, ARP Omni) gjennom moderne effekter er grunnfjellet.

- **Levende og litt sur.** Strings som vibrerer, glir litt ut av stemning og lager lyd underveis. Ikke en
  pad-sample, ikke orkester.
- **Modulært, som et Eurorack.** Mange oscillatorer som påvirker hverandre og varierer hele tiden. Samme akkord
  skal aldri låte helt likt to ganger.
- **Behagelig først.** Støy og tekstur ligger rundt og inni lyden, ikke over den.

## De tre kjernefunksjonene

Disse tre er viktigst. Bygg dem skikkelig før resten.

### 1. Magisk surhet (drift og svevninger)

Oscillatorene driver litt mot hverandre og lager svevninger (beating). Det skal ikke låte falskt. Det skal gi den
vibrasjonen og spenningen som gir gåsehud, slik som hos TR/ST og i darkwave og witch house.

- **Mål svevningen i Hz, ikke bare i cent.** Samme detune i cent gir trege svevninger i bassen og raske i diskanten.
  Ved 10 cents spredning svever A2 med ca. 0,6 Hz og A5 med ca. 5 Hz. Lag en modus der «Sur» bestemmer
  svevefarten i Hz, så hele klaviaturet vibrerer likt, med et tak i cent så bassen ikke blir falsk.
  Omtrent: under 1 Hz er det en langsom sveving, 2–7 Hz vibrerer og er «surt», og over ca. 15 Hz blir det ruhet
  og falskt.
- **Midten skal stå stille.** Snittet av stemmene i en tone skal ligge på riktig tonehøyde (innenfor ±3 cent).
  Øret hører snittet som stemt, og svevningene rundt som liv.
- **Drift:** hver oscillator har sin egen langsomme drift, med random walk og glattet sample & hold, aldri en ren
  sinus-LFO. Av og til kan stemmene møtes og nesten stå rent et øyeblikk før de glir fra hverandre igjen.
- **Temperatur-knapp** for avstanden *mellom* akkordtonene: til venstre trekkes tersene og kvintene mot ren
  stemning (roligere), på midten er det vanlig likesvevende stemning, og til høyre skyves de litt fra hverandre
  (surere og mer spenning).
- «Sur»-makroen styrer både spredning, driftfart og temperatur.

### 2. Auto-fundament (sub-bass på ener)

Maskinen lager selv en dyp og fyldig grunntone som slår an bare på første slag i hver takt, og som så fader mykt ut
under akkorden. Dermed trengs ingen egen bass i rolige partier, og akkorden får tyngde.

- **Tone:** akkordens grunntone fra harmonianalysen (se punkt 3), med valget «laveste tone» for slash-akkorder.
  Legges i området E1–E2 (ca. 41–82 Hz).
- **Lyd:** sinus med litt 2. og 3. overtone (myk metning), så den høres på telefon. Lavpass rundt 200 Hz. Mono.
- **Kurve:** anslag på 5–15 ms uten klikk, deretter en myk utfading. Lengden velges fra en halv takt til en hel
  takt (standard tre slag), og fadingen er ferdig før neste ener.
- **Bare ener:** et akkordskifte midt i takten gir ikke et nytt bassanslag (valgfritt «følg akkordskifte»).
- **Rydd plass:** når fundamentet er på, får stringsene et lavkutt på 100–150 Hz, så det ikke blir grøt.
- **Klokke:** frittstående bruker maskinen sin egen BPM, MIDI-klokke hvis den kommer, eller tap tempo. Uten tempo
  regnes starten på hver ny akkord som ener.
- **Nivå:** summen skal aldri klippe. Bruk en limiter til slutt med topp på −1 dBFS.

### 3. Dynamisk harmoni-ekspansjon

Jeg spiller to eller tre toner, og maskinen bretter dem sømløst ut til store, vakre fem-klanger, uten at jeg
trenger å kunne musikkteori.

- **Gjenkjenning:** finn grunntone og type fra tonene. Typene er dur, moll, forminsket, forstørret, sus2, sus4 og
  kvint. To toner tolkes slik: ters betyr at nederste tone er grunntonen, sekst er en omvendt ters, og kvart er en
  omvendt kvint. Velger jeg toneart (eller den gjettes fra de siste akkordene), brukes den for å velge farger som
  passer.
- **«Utvid»-knapp, 0–4:** 0 spiller som jeg spiller. 1 legger til oktav og kvint (Kraftwerk). 2 legger til septim
  (maj7 eller m7). 3 gir fem-klang med 9 (maj9, m9, 9sus4). 4 legger til 11 eller 13 som farge.
- **«Farge»:** Lys (maj9, 6/9), Mørk (m9, m11), Nøytral (add9, sus2), Kraftwerk (bare oktaver og kvinter) og Carlos
  (rene treklanger med barokk stemmeføring).
- **Regler som holder det vakkert:**
  - Aldri liten none mellom to stemmer.
  - Ingen tette intervaller (sekunder og terser) under ca. E3.
  - Dominantakkorder får 9sus4 eller 13, ikke b9.
  - Øverste tone (melodien) står alltid øverst og uendret.
  - Grunntonen ligger nederst, med mindre jeg har valgt «behold bassen».
- **Åpen voicing:** akkorden spres over ca. 2,5 oktaver: grunntone lavt, kvint og septim i midten, ters og none
  over.
- **Sømløst:** blant mulige voicinger velges den som flytter stemmene minst fra forrige akkord. Felles toner
  holdes uten nytt anslag, og stemmer som flytter seg glir (Glid: 50–300 ms).
- **Utfolding:** tonene som legges til, svulmer inn én etter én over 0,5–2 s (noneren sist), så akkorden blomstrer
  opp i stedet for å komme ferdig.
- **Testbart:** lag dette som en ren funksjon, `expand(notes, { level, color, key, prev })`, og en tabell med
  ca. 25 tilfeller som kjøres i Node og skrives ut med notenavn, så jeg kan lese dem.

## Resten av motoren (forslag; forbedre gjerne)

**Lag (kilder som kan blandes)**
- *String machine:* divide-down med én sag per oktav og tettpakket ensemble, slik en Solina gjør det.
- *Polysynth-strykere:* 4–16 oscillatorer per tone (sag, puls med PWM, trekant) og ladder-filter, i retning
  Moog, Juno og Prophet.
- *Kor/formant:* vokalformanter som gir Orchestron- og Mellotron-kor-glød.
- *Støy og tekstur:* tape (wow, flutter, metning og sus), vinylstøy, «luft» (filtrert støy som følger akkorden) og
  granulære skimmer-lag.

**Kryssmodulasjon**
- Oscillatorene kan modulere hverandres pulsbredde, filter og tonehøyde litt (FM og ringmod i små doser).
- En liten kaotisk modulator, for eksempel Lorenz eller et logistisk kart, som makrokilde.

**Ensemble og kor**
- Tre-fase BBD-kor, som i Solina og Eminent. Det er det viktigste for string machine-lyden.
- Bredde og stereospredning per stemme.

**Filter**
- Lavpass og båndpass som beveger seg langsomt av seg selv (glattet sample & hold).

**Rom**
- Lang shimmer-reverb (oktav opp i halen) som kan fryses.
- Dub-delay med filter i tilbakekoblingen.

**Bære en hel låt**
- *Intensitet* (0–100, kan automatiseres) legger på lag etter hvert, slik at én knapp kan ta låten fra vers til
  refreng. Trinnene er:
  1. Én string machine.
  2. Oktav opp og bredere kor.
  3. Kor/formant.
  4. Shimmer, fundament og luft.
- *Vokallomme:* et dipp på 1,5–4 kHz (0–6 dB), så vokalen får plass.
- Akkorder som utvikler seg over 8–32 takter: filter, bredde og overtoner glir inn og ut.
- Et valgfritt selvspillende lag som legger små variasjoner på akkordene: oktaver, sus-toner og svell.

**Makroer**
- 8 store knapper som styrer mange parametere samtidig: Sour, Life, Expand, Fundament, Air, Tape, Shimmer og
  Intensity.

**Presets**
- 50–100 som utgangspunkt, blant annet string machine, shoegaze-pad, sur Solina, granulær tåke, varm drone,
  TR/ST-mørk, Carlos-kor, Radio-Activity-kor og Orbital-løft.
- Randomize som alltid gir noe brukbart: tilfeldig innenfor gode grenser, ikke helt tilfeldig.

## Teknisk

- Web Audio og AudioWorklet, uten samples. Alle oscillatorene til en motor kjører i én worklet-node, ikke som
  hundrevis av OscillatorNoder. Det holder CPU nede og gir drift og kryssmodulasjon per sample.
- Motoren ligger i `strings-engine.js`. Den frittstående siden er én HTML-fil som virker offline, med samme kode
  lagt inn (worklet-koden lastes fra en Blob-URL).
- MIDI inn (Web MIDI), skjermkeyboard og akkordknapper for å teste.
- Menyene skal ha samme følelse som Chordlab/Stablab: en enkel flate som styrer mye.

### Inn i Dropfather

Grensesnittet er det samme som Dropfathers egne lead-synther bruker (`dropfather/src/lead.js`):

```js
window.DropLead.register('strings', {
  name: 'Living strings',
  voicing: 'triad',              // Dropfather sender en treklang med melodien øverst; motoren utvider selv
  create(ctx, dest, opts = {}) { // ctx: AudioContext eller OfflineAudioContext. Må returnere synkront.
    return {
      prepare(list) { /* Promise. Last worklet-modulen her. Dropfather venter på denne før første tone.
                         list = [{ midi, chord, duration, velocity, glide }] for delen som skal spilles. */ },
      play({ midi, chord, time, duration, velocity }) { /* chord: alle tonene, melodien øverst */ },
      dispose() {}
    };
  }
});
```

Dette er verdt å vite om Dropfather:
- `opts` er `{}` i dag. Les `opts.bpm` og `opts.beatsPerBar` hvis de finnes; jeg legger dem til i Dropfather når
  fundamentet skal brukes der. Til da gjelder regelen «ny akkord = ener».
- Dropfather lager en ny instans for hver del (intro, build, drop …) og rendrer offline. Alt planlegges med `time`,
  og aldri med `setTimeout` for lyd.
- Lead-sporet i Dropfather har allerede egen drive, delay og reverb. I Dropfather skal motorens eget rom være av
  som standard, og fundamentet av når låten har eget bass-spor.
- Nivået skal ligge omtrent som Dropfathers egen «pad»-lyd (mål RMS og sammenlign).

## Arbeidsform

Bygg i små steg, og la meg høre etter hvert steg:

1. Én tone: oscillatorbanken i worklet, med drift og Sur. Skjermkeyboard. Mål svevefarten og at midten er stemt.
2. Ensemble-kor, filter og akkordknapper.
3. Harmoni-ekspansjon (ren funksjon med tester), voicing, glid og utfolding.
4. Auto-fundament med BPM og klokke.
5. Støy, tape og rom.
6. Lag, intensitet, makroer, presets og randomize.
7. `strings-engine.js` i Dropfather. Render 8 takter i OfflineAudioContext to ganger og sjekk nivå, klikk og tid.

Du kan ikke høre selv, så mål det som kan måles: topp og RMS, klipping, DC, klikk (store hopp fra sample til
sample), stemning og svevefart, og hvor fort offline-rendering går. Vær ærlig om at smaken er min.

Ikke kopier kode fra andres produkter. Prinsippene (Solina-ensemble, BBD-kor, shimmer, divide-down) er fritt fram.

## Dette får du

1. **Denne briefen.**
2. **Norwegian Beats** (`Norwegian_Beats.html` + `assets-*.js`). Synthmotoren (`buildVoice`, synthfamiliene som
   Supersaw, CS-80, Jupiter-8, Lyra-8 og Eurorack) og effektene viser hvordan jeg liker å bygge, og hva som finnes
   fra før.
3. **Chordlab/Stablab** (nyeste versjon). Se på menyene og hvordan en enkel flate styrer mye.
4. **`dropfather/src/lead.js`** fra repoet `hidden-motives`, grenen `claude/determined-albattani-piiulv`.
   Det er grensesnittet over, og et eksempel på en lead-motor med akkorder, filter, delay og reverb.
