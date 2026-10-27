# DRIFT SONATA

En elektronisk string-, pad- og teksturmaskin av Tarjei Krogh. Seks oscillatorer som driver og svever mot
hverandre, akkorder som foldes ut til fem toner og mer, en sub-bass på ener, og innspilt kor og cello blandet inn.

Motoren er ren C++ (`dsp/`) uten plugin-kode. Den samme koden kjører i dag i nettleseren som WebAssembly
(testsida), og blir senere en VST3/AU-plugin.

## Mapper

- `dsp/Engine.*`: lydmotoren (stemmer, drift, sub, sample-lag, ensemble, tape, luft, rom med shimmer, dub-delay, limiter).
- `dsp/Harmony.h`: gjenkjenning av akkorder og harmoni-ekspansjonen.
- `dsp/Params.h`: alle parametere på ett sted. `dsp/Presets.h`: fabrikklydene.
- `dsp/SampleLoader.h`: leser en mappe med enkelttoner (`choir_<midi>.wav`, `cello_<midi>.wav`).
- `tools/test_harmony.cpp`: tabell over hvordan akkorder foldes ut, med regelsjekk.
- `tools/render.cpp`: rendrer en akkordrekke til WAV og måler nivå, DC, hastighet og om drift holder midten stemt.
- `web/`: testsida (`page.html`), C-grensesnittet for WebAssembly (`wasm_api.cpp`) og byggeskriptet (`build.py`).

## Bygge testsida

```sh
python3 web/build.py --wasi-sdk /sti/til/wasi-sdk --out dist/DriftSonata.html \
    --samples /sti/til/enkelttoner --header header.jpg
```

Opptakene kommer fra samplepakker og ligger derfor ikke i repoet. Uten `--samples` spiller synthen alene.

## Teste motoren

```sh
g++ -std=c++17 -O2 tools/test_harmony.cpp -o test_harmony && ./test_harmony
g++ -std=c++17 -O2 tools/render.cpp dsp/Engine.cpp -o render && ./render ut.wav Sonata /sti/til/enkelttoner
```
