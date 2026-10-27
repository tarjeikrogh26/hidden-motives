// A sound placed around the listener's head. The cues the ear uses: the far ear hears it later (up to about
// 0.65 ms) and quieter and darker (the head is in the way), sounds behind are a little darker, a notch from the outer
// ear moves up with height, and distance makes it quieter and duller. Best on headphones; on speakers it is a wide
// stereo picture. The position moves at control rate; the cues follow it sample by sample.
#pragma once
#include "Bits.h"

namespace ds {

struct Binaural {
    DelayLine line;
    float sr = 48000, dl = 1, dr = 1, gl = 1, gr = 1, cl = 1, cr = 1, zl = 0, zr = 0, amount = 1, pl = 1, pr = 1;
    Biquad pinna;

    void prepare(float sampleRate) { sr = sampleRate; line.init((int)(0.002f * sr) + 8); zl = zr = 0; pinna = Biquad(); }

    // azimuth: radians, 0 in front, positive to the right; elevation: radians, positive up; distance: metres.
    void place(float azimuth, float elevation, float distance, float amt) {
        amount = amt;
        const float s = std::sin(azimuth), lat = std::asin(clampf(s, -1, 1)), side = std::fabs(s);
        // Woodworth's head model: a = 8.75 cm, c = 343 m/s
        const float itd = 0.000255f * (side + std::fabs(lat)) * sr;
        dl = 1 + (s > 0 ? itd : 0); dr = 1 + (s < 0 ? itd : 0);
        const float back = std::max(0.f, -std::cos(azimuth)), d = std::max(.3f, distance);
        const float far = 1 - .38f * side, near = 1 + .18f * side, dg = 1 / (.5f + .5f * d);
        const float fcNear = std::min(20000.f - 9000 * back, 20000 / (1 + .4f * std::max(0.f, d - 1)));
        const float fcFar = std::min(fcNear, 1500 + 17000 * (1 - side) * (1 - side));
        const float fl = s > 0 ? fcFar : fcNear, fr = s > 0 ? fcNear : fcFar;
        cl = 1 - std::exp(-kTwoPi * std::min(fl, sr * .45f) / sr); cr = 1 - std::exp(-kTwoPi * std::min(fr, sr * .45f) / sr);
        gl = (s > 0 ? far : near) * dg; gr = (s > 0 ? near : far) * dg;
        // The outer-ear notch: lower when the sound is below, higher when above
        const float e = clampf(elevation / 1.2f, -1, 1);
        pinna.peak(std::min(sr * .4f, 7000 + 3500 * e), 2.2f, -7 + 3 * std::max(0.f, e), sr);
        // Plain panning, for the part of the mix that is not binaural
        const float a = (clampf(s, -1, 1) + 1) * kPi / 4;
        pl = std::cos(a) * 1.4142f * dg; pr = std::sin(a) * 1.4142f * dg;
    }

    inline void process(float x, float& L, float& R) {
        const float y = pinna.run(x);
        line.push(y);
        zl += (line.at(dl) - zl) * cl; zr += (line.at(dr) - zr) * cr;
        L += amount * zl * gl + (1 - amount) * x * pl;
        R += amount * zr * gr + (1 - amount) * x * pr;
    }
};

}  // namespace ds
