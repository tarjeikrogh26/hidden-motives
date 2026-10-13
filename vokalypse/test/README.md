# Tester (for utvikling – trengs ikke for å bruke appen)

Krever Node, Playwright med Chromium og ffmpeg (med flite) for å lage en testfil med tale.

```
mkdir -p vokalypse/test/out
ffmpeg -f lavfi -i "flite=text='count it backwards. number seven is silent':voice=slt" -ar 44100 vokalypse/test/out/mock_voice.wav
ffmpeg -i vokalypse/test/out/mock_voice.wav -b:a 128k vokalypse/test/out/mock_voice.mp3
NODE_PATH=$(npm root -g) node vokalypse/test/e2e.js      # hele arbeidsflyten i ekte Chromium via file://
NODE_PATH=$(npm root -g) node vokalypse/test/stress.js 80 # mange variasjoner: lengde, NaN, klipping, stumme innslag
NODE_PATH=$(npm root -g) node vokalypse/test/dump.js      # lagrer eksempel-WAV-er i test/out
```

Freesound og ElevenLabs simuleres i e2e-testen. Ingen ekte nøkler brukes.
