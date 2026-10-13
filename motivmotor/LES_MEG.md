# Motivmotor

Melodisk dansemusikk fra melodiene du liker. Du finner bitene, appen gjør resten.

## Start på Macen

Dobbeltklikk **`Motivmotor.html`**. Den åpnes i Safari eller Chrome og virker uten nett.
Alt (app, notemodell og lyd) ligger i den ene fila. Prosjekter og stiler lagres i nettleseren på Macen.

## Slik bruker du den

**1 · Melodier.** Gi appen en bit av en låt du liker, i hvilken som helst sjanger og hvilket som helst tempo.
- *Låta (hele miksen):* brukes til å finne takt og tempo.
- *Vokal-stem* (Logic → Stem Splitter → «Vocals»): blir lead-melodien. Gir langt bedre resultat.
- *Korde-stem* («Other»): gir renere korder og kordens rytme.
- Skriv inn hvor biten starter (sekunder) og hvor lang den er (20–40 sek holder). Trykk **Analyser**.
- Sjekk resultatet. Er takten feil, bruk **Flytt ½ slag**, **Taktstart ett slag senere** eller **Tempo ×2 / ÷2**.
  Rett enkelttoner i rullen (trykk = ny tone, dra = flytt, dobbelttrykk = slett).

Stems må eksporteres fra samme startpunkt som miksen. Har du bare vokalen, skriv inn tempoet fra Logic.

**2 · Stil.** Lag en stil (for eksempel «Melodisk prog house») og gi den 3–10 eksempler fra sjangeren du vil lage:
lydbiter (gjerne med «Other»-stemmen), MIDI eller melodiene dine. Appen lærer tempoet, hvor lenge kordene varer,
rytmen kordene spilles i (*korder*) og om de holdes (*strings*), progresjonene og bassrytmen.

**3 · Lag.** Velg *Melodi fra* og *Stil*, og trykk **Lag 3 varianter**.
- *Behold melodien:* melodien din med tre ulike kordevalg (fra stilen, fra låta selv, eller harmonisert).
- *Ny melodi i samme ånd:* nye motiver bygget av rytmen og formen i melodien din.
- *Samme rytme, nye toner* og *Nye melodier over kordene.*
- *Melodiens fart:* «Som i takten» tar melodien opp i stilens tempo. «Halv» gir lange toner, «Dobbel» det motsatte.
- **Halvtempo-hiphop av dette:** halverer tempoet, løfter det litt (rundt 80 BPM) og bytter til hiphop-trommer med 808.

**4 · Arrangement.** Velg lengde, energi og retning. Sporet bygges med intro, oppbygging, hovedpartier, breakdown,
løft og avslutning, og melodien introduseres gradvis. **Lås** det som er bra (lead, korder og strings, bass,
trommer), og trykk **3 alternativer** for resten. Lytt og velg.

**5 · Lyd.** Enkle innebygde lyder og egne trommesamples. Lyden er bare for lytting og WAV.

**6 · Eksport.** MIDI per stemme (lead, korder, strings, bass, trommer på GM-noter for Drum Rack) til Ableton,
samlet WAV, og prosjektfil som åpner nøyaktig samme versjon igjen (noter, frø, stil og lydvalg).

## Godt å vite

- Analysen skjer på Macen, uten nett, og tar typisk et halvt til ett minutt per bit.
- Notemodellen er Spotifys Basic Pitch (Apache 2.0, se `vendor/`), hentet fra Norwegian Beats.
- Fra full miks alene blir tempo og toneart som regel riktig, men melodi og korder upresise. Bruk stems.
- Separate lydspor (WAV per stemme) kommer senere. Bruk MIDI per stemme med egne instrumenter inntil videre.

## For utvikling

- `index.html` + `js/` er kildekoden. `python3 tools/build.py` lager `Motivmotor.html` på nytt.
- Tester: `node tests/run.js` (musikkmotoren). Nettlesertester med Playwright: `tests/ui-check.js` (hele flyten med
  ekte lydfiler), `tests/listen-check.js` (analysen mot en låt med kjent fasit), `tests/render-check.js` (WAV-nivåer).
