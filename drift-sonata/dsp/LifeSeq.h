// Life sequencer: six lanes, one per oscillator, each with its own random patterns over 32 bars for everything the
// oscillator has: pitch (a little out of tune), shape (pulse width, morph and wavetable frame, folding), its place in the
// 3D room (direction and height), level, filter, cross-modulation and the odd octave jump. Seeded, so a sound always
// brings back the same patterns; locked to the bars when the song plays.
#pragma once
#include "Bits.h"

namespace ds {

struct LifeSeq {
    enum Target { Pitch, Shape, Azimuth, Height, Level, Filter, Cross, Octave, kTargets };
    static constexpr int kLanes = 6, kMaxSteps = 32 * 4;  // 32 bars at up to four steps a bar
    float pattern[kLanes][kTargets][kMaxSteps] = {};
    float now[kLanes][kTargets] = {};  // where each lane is, glided
    uint32_t seed = 0xffffffffu;

    void generate(uint32_t s) {
        if (s == seed) return;
        seed = s;
        for (int l = 0; l < kLanes; l++)
            for (int t = 0; t < kTargets; t++) {
                Rng r(1 + s * 2654435761u + l * 7919u + t * 104729u);
                float* p = pattern[l][t];
                float x = 0; int hold = 0;
                for (int k = 0; k < kMaxSteps; k++) {
                    switch (t) {
                        case Pitch:   // phrases: hold a pitch for a while, then lean somewhere else (and sometimes home)
                            if (--hold <= 0) { x = r.uni() < .15f ? 0.f : clampf(r.gauss() * .55f, -1, 1); hold = 1 + (int)(r.uni() * 6); }
                            break;
                        case Shape: case Height: case Filter:  // a new place every few steps
                            if (--hold <= 0) { x = r.bi(); hold = 2 + (int)(r.uni() * (t == Height ? 10 : 7)); }
                            break;
                        case Azimuth:  // wanders round, with now and then a jump to somewhere new
                            x = r.uni() < .06f ? r.bi() : x + r.gauss() * .22f;
                            if (x > 1) x = 2 - x; else if (x < -1) x = -2 - x;
                            break;
                        case Level:  // mostly there; now and then it fades out or swells
                            if (--hold <= 0) { const float u = r.uni(); x = u < .22f ? -(.3f + .7f * r.uni()) : u < .3f ? .4f : 0.f; hold = 1 + (int)(r.uni() * 4); }
                            break;
                        case Cross:  // bursts of cross-modulation
                            if (--hold <= 0) { x = r.uni() < .18f ? .3f + .7f * r.uni() : 0.f; hold = 1 + (int)(r.uni() * 3); }
                            break;
                        case Octave:  // rare jumps, up more often than down
                            x = r.uni() < .07f ? (r.uni() < .7f ? 1.f : -1.f) : 0.f;
                            break;
                    }
                    p[k] = x;
                }
            }
    }
};

}  // namespace ds
