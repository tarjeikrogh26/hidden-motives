// Renders a chord progression through DRIFT SONATA to a WAV file and prints what can be measured:
// peak, loudness, DC, clicks, render speed, and whether a drifting note stays in tune on average.
//
//   render <out.wav> [preset name|all] [sample folder] [bars per chord]
#include <chrono>
#include <cmath>
#include <cstdio>
#include <cstring>
#include <string>

#include "../dsp/Engine.h"
#include "../dsp/Presets.h"
#include "../dsp/SampleLoader.h"

using namespace ds;

static void writeWav(const std::string& path, const std::vector<float>& l, const std::vector<float>& r, int sr) {
    FILE* f = std::fopen(path.c_str(), "wb");
    const uint32_t frames = (uint32_t)l.size(), data = frames * 6;
    auto w32 = [&](uint32_t v) { std::fwrite(&v, 4, 1, f); };
    auto w16 = [&](uint16_t v) { std::fwrite(&v, 2, 1, f); };
    std::fwrite("RIFF", 1, 4, f); w32(36 + data); std::fwrite("WAVEfmt ", 1, 8, f);
    w32(16); w16(1); w16(2); w32(sr); w32(sr * 6); w16(6); w16(24);
    std::fwrite("data", 1, 4, f); w32(data);
    for (uint32_t i = 0; i < frames; i++)
        for (float x : {l[i], r[i]}) {
            int32_t v = (int32_t)std::lround(std::fmax(-1.0, std::fmin(1.0, x)) * 8388607.0);
            unsigned char b[3] = {(unsigned char)v, (unsigned char)(v >> 8), (unsigned char)(v >> 16)};
            std::fwrite(b, 1, 3, f);
        }
    std::fclose(f);
}

struct Chord { std::vector<int> notes; };

// Am F C G Dm Am F E: the kind of slow, sad turn the machine is for.
static const std::vector<Chord> kSong = {
    {{57, 60, 64}}, {{53, 57, 60}}, {{55, 60, 64}}, {{55, 59, 62}}, {{57, 62, 65}}, {{57, 60, 64}}, {{53, 57, 60}}, {{56, 59, 64}}};

static std::vector<std::pair<int, float>> gOverrides;

static void renderPreset(const Preset& pr, std::shared_ptr<SampleBank> bank, int barsPerChord, int chords, const std::string& out) {
    const int sr = 48000, block = 256;
    const double bpm = 84, barSec = 4 * 60.0 / bpm;
    Engine e;
    e.prepare(sr, block);
    e.setSamples(bank);
    Values pv = presetValues(pr);
    for (auto& kv : gOverrides) pv[kv.first] = kv.second;
    e.setParams(pv);
    const long long total = (long long)((chords * barsPerChord * barSec + 6) * sr);
    std::vector<float> L(total), R(total);
    double ppq = 0;
    int current = -1;
    auto t0 = std::chrono::steady_clock::now();
    for (long long s = 0; s < total; s += block) {
        const int n = (int)std::min<long long>(block, total - s);
        const double t = (double)s / sr;
        const int idx = (int)(t / (barsPerChord * barSec));
        if (idx != current) {
            if (current >= 0 && current < chords) for (int m : kSong[current % kSong.size()].notes) e.noteOff(m);
            current = idx;
            if (current < chords) for (int m : kSong[current % kSong.size()].notes) e.noteOn(m, .8f);
        }
        e.setTransport(true, ppq, bpm, 4, 4);
        e.process(&L[s], &R[s], n);
        ppq += n * bpm / 60.0 / sr;
    }
    const double secs = std::chrono::duration<double>(std::chrono::steady_clock::now() - t0).count();
    double peak = 0, sum = 0, dc = 0, jump = 0;
    for (long long i = 0; i < total; i++) {
        peak = std::fmax(peak, std::fmax(std::fabs(L[i]), std::fabs(R[i])));
        sum += L[i] * L[i] + R[i] * R[i]; dc += L[i] + R[i];
        if (i > 1) jump = std::fmax(jump, std::fabs(L[i] - 2 * L[i - 1] + L[i - 2]));  // second difference: spikes = clicks
    }
    // Loudness over the part where chords sound (skip the tail)
    double body = 0; const long long bodyEnd = (long long)(chords * barsPerChord * barSec * sr);
    for (long long i = sr; i < bodyEnd; i++) body += L[i] * L[i] + R[i] * R[i];
    std::printf("%-17s peak %6.1f dBFS  rms %6.1f dBFS  dc %+.5f  max 2nd-diff %.3f  %.0fx realtime\n", pr.name,
                20 * std::log10(peak + 1e-12), 10 * std::log10(body / (2.0 * (bodyEnd - sr)) + 1e-12), dc / (2.0 * total), jump,
                total / (double)sr / secs);
    writeWav(out, L, R, sr);
}

// One note, maximum drift, dry: does the average pitch stay on the note?
static double tuningOnce(float drift, uint32_t seed) {
    const int sr = 48000, n = sr * 12;
    Engine e; e.prepare(sr, 512); e.setSeed(seed);
    Values v = defaults();
    v[Drift] = drift; v[Life] = 1; v[Tension] = .1f; v[Expand] = 1; v[SubDrop] = 0; v[Space] = 0; v[Tape] = 0; v[Air] = 0;
    v[LifeAmt] = 0;  // the Life sequencer pulls out of tune on purpose: measure the drift alone
    v[Choir] = 0; v[Cello] = 0; v[Vox] = 0; v[Ensemble] = 0; v[Cross] = 0; v[Chaos] = 0; v[Cutoff] = 1; v[Attack] = .01f; v[Delay] = 0;
    for (int o = 0; o < 6; o++) { v[oscParam(o, 1)] = 3; v[oscParam(o, 2)] = 0; }  // sines, same octave
    e.setParams(v);
    std::vector<float> L(n), R(n);
    e.setTransport(false, 0, 120, 4, 4);
    e.noteOn(57, .8f);
    for (int s = 0; s < n; s += 512) e.process(&L[s], &R[s], std::min(512, n - s));
    // Power-weighted average frequency around the note (10 s after the attack): where the ear puts the pitch.
    double num = 0, den = 0;
    for (double hz = 214; hz <= 226; hz += .02) {
        const double w = 2 * std::cos(2 * M_PI * hz / sr);
        double s1 = 0, s2 = 0;
        for (int i = sr * 2; i < n; i++) { const double s0 = (L[i] + R[i]) + w * s1 - s2; s2 = s1; s1 = s0; }
        const double pw = s1 * s1 + s2 * s2 - w * s1 * s2;
        num += hz * pw; den += pw;
    }
    const double hz = num / den;
    return 1200 * std::log2(hz / 220.0);
}

static void tuningCheck(float drift) {
    double sum = 0, worst = 0;
    for (uint32_t seed = 1; seed <= 8; seed++) { const double c = tuningOnce(drift, seed); sum += c; worst = std::fmax(worst, std::fabs(c)); }
    std::printf("tuning: drift %.2f, A3 over 8 runs averages %+.2f cents (worst single run %.2f)\n", drift, sum / 8, worst);
}

int main(int argc, char** argv) {
    if (argc < 2) { std::printf("render <out.wav> [preset|all] [sample folder] [bars per chord]\n"); return 1; }
    const std::string out = argv[1], which = argc > 2 ? argv[2] : presets()[0].name;
    auto bank = argc > 3 ? loadSampleFolder(argv[3]) : std::make_shared<SampleBank>();
    const int bars = argc > 4 ? std::atoi(argv[4]) : 2;
    // Extra arguments id=value change single parameters, e.g. space=0 drift=1
    for (int a = 5; a < argc; a++) {
        const char* eq = std::strchr(argv[a], '=');
        if (!eq) continue;
        const std::string id(argv[a], eq - argv[a]);
        for (int k = 0; k < COUNT; k++) if (id == params()[k].id) gOverrides.push_back({k, (float)std::atof(eq + 1)});
    }
    std::printf("samples: %zu notes\n", bank->zones.size());
    for (float d : {0.f, .25f, .5f, 1.f}) tuningCheck(d);
    for (const Preset& pr : presets()) {
        if (which != "all" && which != pr.name) continue;
        std::string path = out;
        if (which == "all") {
            std::string name = pr.name; for (char& c : name) if (c == ' ') c = '-';
            path = out + "/" + name + ".wav";
        }
        renderPreset(pr, bank, bars, which == "all" ? 4 : 8, path);
    }
    return 0;
}
