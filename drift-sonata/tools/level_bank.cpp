// Measures how loud every sound in the bank is and writes dsp/BankLevels.h, so all 533 come out about equally loud.
// Loudness: a K-weighting (the curve loudness meters use: low cut, a lift above ~1.5 kHz) over a few chords.
//
//   level_bank <sample folder> <out BankLevels.h>     measure and write the trims
//   level_bank <sample folder> check                  measure again with the trims applied
#include <algorithm>
#include <atomic>
#include <cmath>
#include <cstdio>
#include <thread>
#include <vector>

#include "../dsp/Bank.h"
#include "../dsp/Engine.h"
#include "../dsp/SampleLoader.h"

using namespace ds;

static bool gCheck = false;  // measure with the trims applied, to see how even the bank is now

static double loudness(const Values& v, std::shared_ptr<SampleBank> bank) {
    const int sr = 48000, block = 256;
    const double bpm = 84, bar = 4 * 60.0 / bpm;
    Engine e; e.prepare(sr, block); e.setSeed(11); e.setSamples(bank);
    Values vv = v; if (!gCheck) vv[Trim] = 0; e.setParams(vv);
    const int chords[3][3] = {{57, 60, 64}, {53, 57, 60}, {55, 60, 64}};
    Biquad hp, shelf; hp.highpass(40, .5f, sr); shelf.peak(3000, .5f, 4, sr);
    std::vector<float> L(block), R(block);
    double ppq = 0, sum = 0; long n = 0; int cur = -1;
    const long total = (long)(3 * 1.5 * bar * sr);
    for (long s = 0; s < total; s += block) {
        const int c = (int)(s / (1.5 * bar * sr));
        if (c != cur) { if (cur >= 0) for (int m : chords[cur]) e.noteOff(m); cur = c; for (int m : chords[cur]) e.noteOn(m, .8f); }
        e.setTransport(true, ppq, bpm, 4, 4);
        e.process(L.data(), R.data(), block);
        ppq += block * bpm / 60 / sr;
        if (s > sr) for (int i = 0; i < block; i++) { const float x = shelf.run(hp.run((L[i] + R[i]) * .5f)); sum += x * x; n++; }
    }
    return 10 * std::log10(sum / std::max(1L, n) + 1e-12);
}

int main(int argc, char** argv) {
    if (argc < 3) { std::printf("level_bank <sample folder> <out BankLevels.h | check>\n"); return 1; }
    gCheck = std::string(argv[2]) == "check";
    auto bank = loadSampleFolder(argv[1]);
    const auto& sounds = soundBank();
    std::vector<double> lv(sounds.size());
    std::atomic<size_t> next{0};
    std::vector<std::thread> pool;
    for (unsigned t = 0; t < std::max(1u, std::thread::hardware_concurrency()); t++)
        pool.emplace_back([&] { for (size_t i; (i = next++) < sounds.size();) lv[i] = loudness(sounds[i].values, bank); });
    for (auto& t : pool) t.join();
    std::vector<double> sorted = lv; std::sort(sorted.begin(), sorted.end());
    const double target = sorted[sorted.size() / 2];
    std::printf("loudness %s: quietest %.1f, median %.1f, loudest %.1f dB; middle 90%% within %.1f dB\n", gCheck ? "with trims" : "before",
                sorted.front(), target, sorted.back(), sorted[sorted.size() * 95 / 100] - sorted[sorted.size() * 5 / 100]);
    if (gCheck) return 0;
    FILE* f = std::fopen(argv[2], "w");
    std::fprintf(f, "// Level trim per bank sound (dB), measured by tools/level_bank.cpp: brings each sound to the bank's median loudness.\n"
                    "#pragma once\n\nnamespace ds {\ninline const float kBankTrim[] = {");
    for (size_t i = 0; i < lv.size(); i++) std::fprintf(f, "%s%s%.1ff", i ? "," : "", i % 16 ? " " : "\n    ", std::clamp(target - lv[i], -9.0, 9.0));
    std::fprintf(f, "\n};\n}  // namespace ds\n");
    std::fclose(f);
    int far = 0; for (double x : lv) if (std::fabs(target - x) > 9) far++;
    std::printf("%d sounds needed more than 9 dB (trim stops at 9)\n", far);
    return 0;
}
