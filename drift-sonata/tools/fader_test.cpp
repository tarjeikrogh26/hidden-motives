// Does every fader come back? Holds a chord, then for each parameter: measure, turn it to the bottom and the top,
// put it back, and measure again. A fader that leaves the sound changed (or silent) after it is put back is a bug.
// Also checks that Air is heard when it is turned up again after being off.
#include <cmath>
#include <cstdio>
#include <vector>

#include "../dsp/Engine.h"
#include "../dsp/Presets.h"

using namespace ds;

static const int SR = 48000;

struct Meter { double sum = 0, hi = 0; Biquad hp; long n = 0; };

static void run(Engine& e, double secs, Meter* m, double& ppq) {
    std::vector<float> L(256), R(256);
    for (long s = 0; s < (long)(secs * SR); s += 256) {
        e.setTransport(true, ppq, 84, 4, 4);
        e.process(L.data(), R.data(), 256);
        ppq += 256 * 84.0 / 60 / SR;
        if (m) for (int i = 0; i < 256; i++) { const float x = (L[i] + R[i]) * .5f, h = m->hp.run(x); m->sum += x * x; m->hi += h * h; m->n++; }
    }
}

static double db(double x) { return 10 * std::log10(x + 1e-20); }

int main() {
    int bad = 0;
    // Air on its own: off, on, off, on again
    {
        Engine e; e.prepare(SR, 256); e.setSeed(3);
        Values v = presetValues(presets()[0]);
        v[Air] = 0; e.setParams(v);
        double ppq = 0;
        for (int n : {57, 60, 64}) e.noteOn(n, .8f);
        run(e, 3, nullptr, ppq);
        double hi[4];
        for (int k = 0; k < 4; k++) {
            v[Air] = (k % 2) ? 1.f : 0.f; e.setParams(v);
            Meter m; m.hp.highpass(5000, .7f, SR);
            run(e, .5, nullptr, ppq); run(e, 2, &m, ppq);
            hi[k] = db(m.hi / m.n);
        }
        std::printf("Air off/on/off/on, energy above 5 kHz: %.1f / %.1f / %.1f / %.1f dB\n", hi[0], hi[1], hi[2], hi[3]);
        if (hi[3] - hi[2] < 3 || std::fabs(hi[3] - hi[1]) > 3) { std::printf("  FEIL: Air kommer ikke tilbake\n"); bad++; }
    }
    // Every parameter. The sound lives and moves by itself, so each result is compared with a run where nothing was touched.
    double ctlLevel = 0, ctlHi = 0;
    for (int k = -1; k < COUNT; k++) {
        const bool control = k < 0;
        const ParamInfo& pi = params()[control ? 0 : k];
        if (k == Freeze || k == Level) continue;
        Engine e; e.prepare(SR, 256); e.setSeed(5);
        Values v = presetValues(presets()[0]);
        e.setParams(v);
        double ppq = 0;
        for (int n : {57, 60, 64}) e.noteOn(n, .8f);
        run(e, 4, nullptr, ppq);
        Meter before; before.hp.highpass(5000, .7f, SR);
        run(e, 2, &before, ppq);
        if (!control) {
            const float orig = v[k];
            v[k] = pi.min; e.setParams(v); run(e, 1, nullptr, ppq);
            v[k] = pi.max; e.setParams(v); run(e, 1, nullptr, ppq);
            v[k] = orig; e.setParams(v); run(e, 4, nullptr, ppq);
        } else run(e, 6, nullptr, ppq);
        Meter after; after.hp.highpass(5000, .7f, SR);
        run(e, 2, &after, ppq);
        double d = db(after.sum / after.n) - db(before.sum / before.n), dh = db(after.hi / after.n) - db(before.hi / before.n);
        if (control) { ctlLevel = d; ctlHi = dh; continue; }
        d -= ctlLevel; dh -= ctlHi;
        const bool off = std::fabs(d) > 3 || std::fabs(dh) > 6 || !std::isfinite(d);
        if (off) { std::printf("%-22s level %+5.1f dB, above 5 kHz %+5.1f dB  <- kommer ikke tilbake\n", pi.name, d, dh); bad++; }
    }
    std::printf(bad ? "%d fadere kommer ikke tilbake\n" : "Alle fadere kommer tilbake.\n", bad);
    return bad ? 1 : 0;
}
