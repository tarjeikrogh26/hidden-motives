// The engine as a WebAssembly module for the browser test bench (runs inside an AudioWorklet). The page also loads a
// second copy on its own thread just for the harmony (ds_harmony_buf / ds_expand), to write MIDI files.
#include "../dsp/Engine.h"

#define EXPORT(name) extern "C" __attribute__((export_name(#name)))

using namespace ds;

namespace {
Engine* engine = nullptr;
Values values = defaults();
float outL[128], outR[128];
std::shared_ptr<SampleBank> building;
}  // namespace

EXPORT(ds_init) void dsInit(float sampleRate, unsigned seed) {
    if (!engine) engine = new Engine();
    engine->prepare(sampleRate, 128);
    engine->setSeed(seed);
    engine->setParams(values);
}
EXPORT(ds_param_count) int dsParamCount() { return COUNT; }
EXPORT(ds_set_param) void dsSetParam(int i, float v) { if (i >= 0 && i < COUNT) { values[i] = v; engine->setParams(values); } }
EXPORT(ds_note_on) void dsNoteOn(int note, float vel) { engine->noteOn(note, vel); }
EXPORT(ds_note_off) void dsNoteOff(int note) { engine->noteOff(note); }
EXPORT(ds_all_off) void dsAllOff() { engine->allNotesOff(); }
EXPORT(ds_transport) void dsTransport(int playing, double ppq, double bpm, int num, int den) { engine->setTransport(playing != 0, ppq, bpm, num, den); }
EXPORT(ds_left) float* dsLeft() { return outL; }
EXPORT(ds_right) float* dsRight() { return outR; }
EXPORT(ds_process) void dsProcess(int n) { engine->process(outL, outR, n > 128 ? 128 : n); }

// Samples arrive one recorded note at a time: begin, add (returns where to write the audio), commit.
EXPORT(ds_bank_begin) void dsBankBegin() { building = std::make_shared<SampleBank>(); }
EXPORT(ds_bank_add) float* dsBankAdd(int family, float root, float sr, int length) {
    Zone z; z.family = family; z.root = root; z.sr = sr; z.data.assign(length, 0.f);
    building->zones.push_back(std::move(z));
    return building->zones.back().data.data();
}
EXPORT(ds_bank_add_table) float* dsBankAddTable(int table, int frames) {
    if (table < 0 || table >= kTables) return nullptr;
    Wavetable& t = building->tables[table]; t.frames = frames; t.raw.assign((size_t)frames * Wavetable::N, 0.f);
    return t.raw.data();
}
EXPORT(ds_vocal) float* dsVocal(int length) { return engine->vocalBuffer(length); }
EXPORT(ds_bank_commit) void dsBankCommit() { building->finish(); engine->setSamples(building); building.reset(); }

// What the chord is right now (for the screen).
EXPORT(ds_disp_root) int dsDispRoot() { return engine->display().root; }
EXPORT(ds_disp_quality) int dsDispQuality() { return (int)engine->display().q; }
EXPORT(ds_disp_count) int dsDispCount() { return engine->display().count; }
EXPORT(ds_disp_note) int dsDispNote(int i) { return engine->display().notes[i & 15]; }
EXPORT(ds_disp_sub) float dsDispSub() { return engine->display().subLevel; }
// The 3D room: azimuth, elevation, distance and level of each source (six oscillators, five recorded layers, robot)
EXPORT(ds_sources) int dsSources() { return Engine::kSources; }
EXPORT(ds_disp_pos) float dsDispPos(int k, int c) { return engine->display().pos[k % Engine::kSources][c % 3]; }
EXPORT(ds_disp_level) float dsDispLevel(int k) { return engine->display().level[k % Engine::kSources]; }

// Harmony only (no engine needed): fold a chord out the way the engine does.
// Buffer: [0..15] the played notes, [16..31] the voicing before (for voice leading), [32..63] the result, [64] the root.
namespace { int harmonyBuf[80]; }
EXPORT(ds_harmony_buf) int* dsHarmonyBuf() { return harmonyBuf; }
EXPORT(ds_expand) int dsExpand(int count, int prevCount, int level, int color, int key, int minor, int keepBass) {
    std::vector<int> played(harmonyBuf, harmonyBuf + std::min(16, std::max(0, count))), prev(harmonyBuf + 16, harmonyBuf + 16 + std::min(16, std::max(0, prevCount)));
    ExpandOptions o; o.level = level; o.color = (Color)color; o.key = key; o.keyMinor = minor != 0; o.keepBass = keepBass != 0;
    const Voicing v = expand(played, o, prev);
    int n = 0;
    for (const VoicedNote& x : v.notes) if (n < 32) harmonyBuf[32 + n++] = x.midi;
    harmonyBuf[64] = v.chord.root;
    return n;
}
