# Brief: levende strings-motor (pads, strings, støy og teksturer)

Lim inn denne teksten som første melding i en ny Claude-chat. Legg ved filene som står under «Dette får du».

---

## Hvem og hva

Jeg er Tarjei Krogh (artistnavn Stanley Cupid). Jeg lager musikkverktøy i nettleseren: Norwegian Beats,
AVANTGARDIAN ARP, Bass Invaders, DELAYSY, Stablab (rytmiske akkord-stabs), There Will Be Acid, Beatfighter,
Voxy Music, Pump Fiction, Chop Secret og Dropfather (en liten DAW for drops og hele låter).

Nå vil jeg ha en egen motor for **strings, pads, støy og teksturer**. Den skal både fungere alene og kunne
plugges inn i Dropfather.

## Lyden jeg er ute etter

- Ulrich Schnauss, TR/ST (Trust, kanadisk), shoegaze-elektronika og gamle string machines (Solina,
  Logan, ARP Omni) gjennom moderne effekter.
- **Levende og litt sur.** Strings som vibrerer, glir litt ut av stemning og lager lyd underveis. Ikke en
  pad-sample, ikke orkester.
- **Modulært, som et Eurorack.** Mange oscillatorer som påvirker hverandre og varierer hele tiden, så samme
  akkord aldri låter helt likt to ganger.
- Behagelig først og fremst. Støy og tekstur skal ligge rundt og inni lyden, ikke over den.

## Motoren (forslag; forbedre gjerne)

**Stemmer**
- 4–16 oscillatorer per tone (sag, puls med PWM, trekant), hver med egen langsom drift: random walk og
  sample & hold, aldri en ren sinus-LFO.
- Divide-down string machine-modus: én sag per oktav og tettpakket ensemble, slik en Solina gjør det.
- «Sur»-knapp: hvor langt stemmene kan drive fra stemning (0–40 cent), og hvor fort.

**Kryssmodulasjon**
- Oscillatorene kan modulere hverandres pulsbredde, filter og tonehøyde litt (FM og ringmod i små doser).
- En liten kaotisk modulator (for eksempel Lorenz eller logistisk kart) som makro-kilde.

**Ensemble og kor**
- Tre-fase BBD-kor, som i Solina og Eminent. Det er det viktigste for string machine-lyden.
- Bredde og stereospredning per stemme.

**Filter**
- Lavpass og båndpass som beveger seg langsomt av seg selv (sample & hold, glatt).
- Formant-filter for «vokal» glød.

**Støy og tekstur**
- Tape (wow/flutter, metning, sus), vinylstøy, «luft» (filtrert støy som følger akkorden), granulære
  skimmer-lag.

**Rom**
- Lang shimmer-reverb (oktav opp i halen), frysbar.
- Dub-delay med filter i tilbakekoblingen.

**Bevegelse over tid**
- Akkorder som utvikler seg over 8–32 takter: filter, bredde, nye overtoner inn og ut.
- Valgfritt «selvspillende» lag som legger små variasjoner (oktaver, sus-toner, svell) på akkordene.

**Makroer**
- 6–8 store knapper som styrer mange parametere samtidig: Life, Sour, Air, Width, Tape, Shimmer, Motion,
  Darkness.

**Presets**
- 50–100 som utgangspunkt: string machine, shoegaze pad, sur Solina, granulær tåke, varm drone,
  TR/ST-aktig mørk pad osv.
- Randomize som alltid gir noe brukbart: tilfeldig innenfor gode grenser, ikke helt tilfeldig.

## Teknisk

- Én HTML-fil som virker offline. Web Audio og AudioWorklet (worklet-koden lagt inn i fila). Ingen samples
  er nødvendig.
- MIDI-input (Web MIDI) og et skjermkeyboard. Akkord-knapper for å teste.
- **Motoren skal kunne brukes i Dropfather.** Lag den som en egen motor-fil (`strings-engine.js`) med dette
  grensesnittet (det samme som Dropfathers egne lead-synther):

```js
// Registreres i Dropfather:
window.DropLead.register('strings', {
  name: 'Living strings',
  voicing: 'seventh',                      // hvordan Dropfather legger akkord under melodien
  create(ctx, dest, opts) {                // ctx: AudioContext eller OfflineAudioContext
    return {
      play({ midi, chord, time, duration, velocity }) { /* chord: alle tonene, melodien øverst */ },
      dispose() {}
    };
  }
});
```

- Motoren må tåle OfflineAudioContext. Dropfather rendrer offline takt for takt, så alt skal planlegges med
  `time` og aldri bruke `setTimeout` for lyd.
- Hold CPU nede: gjenbruk noder per tone, og ikke lag tusenvis av noder per takt.

## Arbeidsform

- Bygg i små steg, og la meg høre underveis.
- Du kan ikke høre selv, så mål det som kan måles (nivå, klipping, stemning) og vær ærlig om at smaken er
  min.
- Ikke kopier kode fra andres produkter. Prinsipper (Solina-ensemble, BBD-kor, shimmer) er fritt fram.

## Dette får du

1. **Norwegian Beats** (`Norwegian_Beats.html` + `assets-*.js`). Synthmotoren (`buildVoice`, synthfamiliene
   som Supersaw, CS-80, Jupiter-8, Lyra-8, Eurorack) og effektene viser hvordan jeg liker å bygge, og hva som
   allerede finnes.
2. **Stablab** (nyeste versjon). Se på menyene og hvordan en enkel flate styrer mye. Den samme følelsen vil
   jeg ha her.
3. **Dropfathers `src/lead.js`** fra repoet `hidden-motives` (mappen `dropfather/`). Det er grensesnittet
   motoren skal passe inn i, og et eksempel på en lead-motor med akkorder, filter, delay og reverb.
4. Denne briefen.
