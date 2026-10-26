# Chordino browser integration

Chordino / NNLS-Chroma by Matthias Mauch / QMUL, GPL-2.0-or-later.
Source: https://github.com/c4dm/nnls-chroma, revision 4c5f214a75cb354f8d8c933e161377c5b4d83713.
Vamp SDK (MIT-style license), https://github.com/c4dm/vamp-plugin-sdk, revision 63e0c3b37b6fb9ce6f074ea8222b4903e4f5568a.
Full licenses and original notices are retained in each source directory.

Modifications: external Boost/file dictionary parser removed, built-in dictionary retained. Existing NNLS note activations and bass/treble chroma exposed as extra outputs. C API bridge and minimal WASI shim added. Core chord inference is the original Chordino. No neural network, API key, paid inference, or audio upload is used.

Build: Python package ziglang 0.17.0 provides the compiler; run bash analysis/build-wasm.sh from the checkout. The result is dist/chordino.wasm (355326 bytes). JS preprocessing and postprocessing are dist/chordino-runtime.js and dist/harmony-engine.js. Run node test-harmony.cjs for known-note synthetic mixtures. Build requires no Boost or system Vamp installation.

The browser runs a centered Hann FFT at 22050 Hz, 16384 samples, hop 2048. Chordino tunes globally, applies NNLS harmonic decomposition and HMM chord decoding. A separate bass decoder combines bass chroma and denoised note activations over MIDI 27–59. The chord-root map and literal bass line intentionally remain separate. Confidence is an evidence indicator, not a calibrated probability.

Test fixtures are synthetic. Results do not establish the transcription accuracy of TELEVISION IS BLUE or arbitrary commercial recordings. Transition points are frame-resolution estimates. Source audio and Norwegian Beats original files were not modified.
