// Robot with a soul: a channel vocoder after VOXY MUSIC's (Tarjei Krogh). Twenty bands like the VSM 201; the strings
// are the carrier, a voice is the modulator. Carrier whitening keeps the upper bands from drowning under the bass.
// Machine words is a voice for it to speak with when there is no choir: vowels and consonants on the beat.
#pragma once
#include "Bits.h"

namespace ds {

struct Vocoder {
    static constexpr int kBands = 20;
    Biquad m1[kBands], m2[kBands], c1[kBands], c2[kBands];
    float mp[kBands] = {}, cp[kBands] = {}, att[kBands] = {}, rel[kBands] = {};
    float carrierCoef = 0, powerCoef = 0, gainCoef = 0, carPow = 0, wetPow = 0, wetGain = 1;

    void prepare(float sr) {
        for (int i = 0; i < kBands; i++) {
            const float f = 100 * std::pow(80.f, i / (float)(kBands - 1));  // 100 Hz .. 8 kHz
            for (Biquad* b : {&m1[i], &m2[i], &c1[i], &c2[i]}) { *b = Biquad(); b->bandpass(f, 3.8f, sr); }
            att[i] = std::exp(-1 / (sr * (f > 2000 ? .0007f : .0015f) * 1.4f));
            rel[i] = std::exp(-1 / (sr * (f > 2000 ? .007f : .014f) * 1.6f));
            mp[i] = cp[i] = 0;
        }
        carrierCoef = 1 - std::exp(-1 / (sr * .035f)); powerCoef = 1 - std::exp(-1 / (sr * .05f)); gainCoef = 1 - std::exp(-1 / (sr * .08f));
        carPow = wetPow = 0; wetGain = 1;
    }

    // Returns the vocoded carrier at about the carrier's own level.
    inline float process(float mod, float car) {
        float voc = 0;
        for (int i = 0; i < kBands; i++) {
            const float m = m2[i].run(m1[i].run(mod)), c = c2[i].run(c1[i].run(car));
            const float power = m * m, follow = power > mp[i] ? att[i] : rel[i];
            mp[i] = follow * mp[i] + (1 - follow) * power;
            cp[i] += carrierCoef * (c * c - cp[i]);
            voc += c * std::min(70.f, 1 / std::sqrt(cp[i] + 4e-6f)) * std::sqrt(mp[i]);
        }
        voc *= .38f;
        carPow += powerCoef * (car * car - carPow); wetPow += powerCoef * (voc * voc - wetPow);
        const float target = clampf(std::sqrt((carPow + 1e-8f) / (wetPow + 1e-8f)), .25f, 2.5f);
        wetGain += gainCoef * (target - wetGain);
        return voc * wetGain;
    }
};

struct MachineWords {
    // Vowel formants U, O, A, E, I (Hz)
    float sr = 48000, ph = 0, f[3] = {700, 1100, 2400}, target[3] = {700, 1100, 2400}, env = 0, cons = 0, glide = 0;
    long long lastSyllable = -1; double ownClock = 0; int lastVowel = 2;
    Svf form[3]; Svf hiss;
    Rng rng{777};

    void prepare(float sampleRate) { sr = sampleRate; glide = 1 - std::exp(-1 / (sr * .03f)); hiss.set(2800, .7f, sr); }

    // syllable: length in quarter notes; ppq: the song position (or < 0 to run on its own at bpm)
    inline float sample(double ppq, double syllable, double bpm) {
        static const float vowels[5][3] = {{300, 870, 2240}, {570, 840, 2410}, {730, 1090, 2440}, {530, 1840, 2480}, {270, 2290, 3010}};
        if (ppq < 0) { ownClock += bpm / 60 / sr; ppq = ownClock; }
        const long long syl = (long long)std::floor(ppq / syllable);
        const double pos = ppq / syllable - syl;
        if (syl != lastSyllable) {
            lastSyllable = syl;
            int v; do { v = (int)(rng.uni() * 5); } while (v == lastVowel); lastVowel = v;
            for (int k = 0; k < 3; k++) target[k] = vowels[v][k] * (.94f + .12f * rng.uni());
            cons = rng.uni() < .6f ? 1.f : 0.f;
        }
        for (int k = 0; k < 3; k++) { f[k] += (target[k] - f[k]) * glide; }
        if (((int)(ph * 64)) % 8 == 0) for (int k = 0; k < 3; k++) form[k].set(f[k], 6 + 2 * k, sr);
        // A voice on about G2, with a little vibrato
        ph += (98.f * (1 + .006f * std::sin(kTwoPi * (float)pos * 2))) / sr; if (ph >= 1) ph -= 1;
        const float pulse = 2 * ph - 1 - polyBlep(ph, 98.f / sr);
        const float targetEnv = pos < .72 ? 1.f : .12f;
        env += (targetEnv - env) * (targetEnv > env ? .004f : .0015f);
        cons *= .9993f;
        const float noise = rng.bi();
        const float voiced = form[0].band(pulse) + .5f * form[1].band(pulse) + .3f * form[2].band(pulse);
        return voiced * env * 1.6f + hiss.high(noise) * (cons * .5f + .02f);
    }
};

}  // namespace ds
