# Vokalypse 0.1

Vokalypse lager vokalmateriale til house, techno, EBM og annen elektronisk musikk. Hver variasjon er 16 takter i 4/4, med mye luft, og kan lastes ned som WAV i 24-bit / 48 kHz.

## Åpne på Mac (ingen installasjon)

1. Last ned mappen `vokalypse` med alle filene. Det er `index.html` og mappen `js`, og de må ligge sammen.
2. Dobbeltklikk `index.html`. Den åpnes i nettleseren.
   - Appen er testet i Chrome. Safari bør fungere, men er ikke testet.
   - Hvis Mac åpner filen i feil program: høyreklikk → «Åpne med» → Google Chrome eller Safari.
3. Klikk **Syntetisk** → **Lag startpakke**, og deretter **Ny variasjon** og **▶ Spill**.

Du trenger ikke terminal eller server. Alt lyd-arbeid skjer lokalt i nettleseren.

**Forhåndsvisning i Claude:** appen finnes også som et vindu i Claude-appen. Der virker import, syntetisk materiale, avspilling og nedlasting. Claude spør før en fil lagres, og hver WAV kommer pakket i en zip. Freesound og AI-sang virker bare i den nedlastede versjonen, fordi vinduet i Claude blokkerer kontakt med andre nettsteder. Forhåndsvisningen bygges med `node vokalypse/verktoy/bygg-forhandsvisning.js`.

## Arbeidsflyt

1. **Råmateriale** (til venstre)
   - **Importer**: dra inn egne vokalfiler (WAV, AIFF, MP3, M4A, FLAC). Dette gir best resultat.
   - **Syntetisk**: en enkel formant-vokalsynth som er bygget inn i appen. Den er gratis og fungerer uten nett.
   - **Freesound**: søk etter CC0- og CC BY-opptak. Krever en gratis API-nøkkel, og oppskriften står i appen.
   - **AI-sang**: ekte AI-vokal fra ElevenLabs. Krever egen konto og nøkkel, og koster penger.
2. **Variasjon** (til høyre): velg BPM, toneart, stil, tetthet, swing og effektmengde. Slå ingredienser av og på. Trykk **Ny variasjon** (N) eller **Ny behandling** (B). B beholder plasseringen og gir ny lyd.
3. **Lytt**: bytt mellom **Behandlet** og **Tørr**. Referansetrommen (kick + hihat) hjelper deg å høre groove, men den eksporteres ikke. Klikk i bølgeformen for å hoppe til en takt.
4. **Eksport**: **Last ned behandlet WAV**, **Last ned tørr WAV** og **Lisensliste**.

## Hva er hva?

| Merke | Hva det er |
|---|---|
| IMPORTERT | Din egen fil. Hvis det er et opptak av et menneske, er dette ekte menneskelig stemme. |
| FREESOUND | Opptak lastet opp av andre, med lisens CC0 eller CC BY. De fleste er menneskelige opptak, men sjekk beskrivelsen. |
| SYNTETISK | Vokalsynth i appen (pulsbølge/støy gjennom vokalfiltre). Den er verken menneske eller AI, og lager ikke ekte sang. |
| AI-GENERERT | Laget av ElevenLabs' AI-modeller. Det er ikke et menneskelig opptak. |

Alt som kommer ut av variasjonsmotoren er **bearbeidet** materiale av klippene over.

## Tørr og behandlet

Begge filene har nøyaktig samme lengde og ligger sample-nøyaktig oppå hverandre i Ableton.

- **Tørr** beholder utsnitt, timing, tonehøyde, kor-lag, chops, stutter, reversering og pitch-dykk.
- **Behandlet** legger i tillegg på filter, forvrengning, bitcrush, ringmod, kamfilter, gate, hvisk (tilfeldig fase), robot, granulær frysing, revers-romklang, romklang, ping-pong-delay og kompressor.

## Inn i Ableton

- Filnavnet inneholder BPM og toneart, f.eks. `Vokalypse_03_124bpm_Amoll_behandlet.wav`.
- Lengden er nøyaktig 16 takter (f.eks. 1 474 560 samples ved 125 BPM). Ved noen BPM-verdier går ikke 16 takter opp i hele samples. Da rundes lengden til nærmeste sample, og avviket er under 0,02 ms.
- Sett prosjektet til samme BPM. Dra filen inn på takt 1, og slå av **Warp** i klippet, eller sett Seg. BPM til samme tempo. Da ligger den rett i rutenettet.
- Med «Hale: Brett inn» legges romklang og delay fra slutten inn i starten. Da blir loopen sømløs. Velg «Kutt med fade» hvis du vil ha filen som et engangsinnslag.

## Pris og oppsett for ekte AI-vokal (ElevenLabs)

ElevenLabs er valgt fordi én nøkkel gir både sang (Eleven Music), tale og hvisk (Text to Speech) og lydteksturer (Sound Effects). Tjenesten tillater kall direkte fra nettleseren, så det trengs ingen server.

API-priser sjekket 13.10.2026 på [elevenlabs.io/pricing/api](https://elevenlabs.io/pricing/api):

- Musikk: $0,15 per minutt. Ti sekunder vokal koster rundt $0,025.
- Lydeffekter: $0,12 per minutt.
- Tale (v2/v3): $0,08 per 1000 tegn.
- Kommersiell bruk av musikken krever Starter ($6/mnd) eller høyere. Gratisnivået gir ikke kommersiell rett.

Slik setter du det opp:

1. Lag konto, og velg Starter hvis du skal gi ut musikken.
2. Gå til Settings → API Keys og lag en nøkkel. Begrens den gjerne til Music, Sound Effects, Text to Speech og Voices, og sett en kredittgrense.
3. Lim nøkkelen inn i fanen **AI-sang**. Kryss av for «husk» bare på din egen Mac.

Nøkkelen sendes bare til `api.elevenlabs.io`.

## Utskiftbar lydmotor

Kildene er samlet i `js/providers.js` (`VK.Providers.register(...)`). En ny tjeneste trenger bare én funksjon som returnerer lyd (ArrayBuffer eller AudioBuffer). Arrangør, effekter og eksport er uavhengige av hvor lyden kommer fra. Den lokale delen (import, synth, all bearbeiding og eksport) krever ikke abonnement.

## Filer

```
vokalypse/
  index.html        grensesnitt
  js/util.js        tilfeldighet med frø, skalaer, timing
  js/dsp.js         lokal DSP: FFT, hvisk, robot, bitcrush, granulær, tonehøydeanalyse, romklang
  js/synth.js       syntetisk formantstemme + tekstfragmenter
  js/providers.js   kilder: import, Freesound, ElevenLabs (utskiftbare)
  js/arranger.js    plassering i 16 takter, motiver, tetthet, stil
  js/render.js      lydmotor (OfflineAudioContext) – tørr og behandlet
  js/wav.js         WAV 24-bit/48 kHz
  js/app.js         grensesnitt, avspilling, eksport
  test/             automatiske tester (kun for utvikling, trengs ikke for å bruke appen)
```

## Kjente begrensninger i 0.1

- Klippene lagres ikke mellom økter. Hvis du laster siden på nytt, må råmaterialet legges inn igjen.
- Tonehøyde endres med varispeed, som også endrer lengde og klangfarge. Det er en del av sounden, men det finnes ingen formantbevarende pitch.
- Freesound gir forhåndsvisning i MP3 (ca. 128 kbps). Originalfilen må lastes ned manuelt fra lydsiden.
- ElevenLabs-koblingen er bygget etter den offentlige dokumentasjonen og testet mot en simulert tjeneste, men ikke mot en ekte konto.
- Det finnes ikke mikrofonopptak direkte i appen ennå.
