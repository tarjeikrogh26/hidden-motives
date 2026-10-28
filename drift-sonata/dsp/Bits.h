// Small DSP parts the engine is built from.
#pragma once
#include <algorithm>
#include <cmath>
#include <cstdint>
#include <vector>

namespace ds {

constexpr float kPi = 3.14159265358979f;
constexpr float kTwoPi = 6.28318530717959f;

inline float mtof(float m) { return 440.f * std::pow(2.f, (m - 69.f) / 12.f); }
inline float clampf(float x, float lo, float hi) { return std::min(hi, std::max(lo, x)); }
inline float smoothstep(float a, float b, float x) { float t = clampf((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
inline float dbToGain(float db) { return std::pow(10.f, db / 20.f); }
// Sine for the audio paths (oscillators, folding, modulated delays): folded to a quarter turn and a 9th-order
// polynomial there, within 4e-6 of std::sin and several times faster.
inline float fastSin(float x) {
    float t = x * 0.15915494309f; t -= std::floor(t);
    float u = t < .5f ? t : t - 1;
    if (u > .25f) u = .5f - u; else if (u < -.25f) u = -.5f - u;
    const float z = u * 6.28318531f, z2 = z * z;
    return z * (1 + z2 * (-0.16666667f + z2 * (0.0083333333f + z2 * (-0.00019841270f + z2 * 2.7557319e-6f))));
}
// Soft saturation: a rational curve that follows tanh closely up to |x| = 3 and then holds at ±1
inline float fastTanh(float x) { if (x > 3) return 1; if (x < -3) return -1; const float x2 = x * x; return x * (27 + x2) / (27 + 9 * x2); }

struct Rng {
    uint32_t s;
    explicit Rng(uint32_t seed = 0x9e3779b9u) : s(seed ? seed : 1) {}
    uint32_t next() { s ^= s << 13; s ^= s >> 17; s ^= s << 5; return s; }
    float uni() { return (next() >> 8) * (1.f / 16777216.f); }  // 0..1
    float bi() { return uni() * 2 - 1; }                         // -1..1
    float gauss() { float a = uni() + 1e-7f, b = uni(); return std::sqrt(-2 * std::log(a)) * std::cos(kTwoPi * b); }
};

// Slowly wandering value: an Ornstein-Uhlenbeck random walk (pulls back to 0) with a given spread and time.
struct Wander {
    float x = 0;
    void init(Rng& r, float sigma) { x = r.gauss() * sigma; }
    float step(Rng& r, float dt, float tau, float sigma) {
        x += -x * dt / tau + sigma * std::sqrt(2 * dt / tau) * r.gauss();
        return x;
    }
};

// Glided sample & hold: picks a new random target now and then and slides to it.
struct GlideHold {
    float x = 0, target = 0, timer = 0;
    float step(Rng& r, float dt, float minHold, float maxHold, float slide, float sigma) {
        timer -= dt;
        if (timer <= 0) { target = r.gauss() * sigma; timer = minHold + r.uni() * (maxHold - minHold); }
        x += (target - x) * std::min(1.f, dt / slide);
        return x;
    }
};

// Topology-preserving state variable filter (Zavalishin).
struct Svf {
    float ic1 = 0, ic2 = 0, a1 = 0, a2 = 0, a3 = 0, k = 1;
    void set(float hz, float q, float sr) {
        float g = std::tan(kPi * clampf(hz, 10, sr * 0.45f) / sr);
        k = 1 / std::max(q, 0.05f);
        a1 = 1 / (1 + g * (g + k)); a2 = g * a1; a3 = g * a2;
    }
    // returns low; band and high through refs when needed
    inline float low(float v0) { float v3 = v0 - ic2, v1 = a1 * ic1 + a2 * v3, v2 = ic2 + a2 * ic1 + a3 * v3; ic1 = 2 * v1 - ic1; ic2 = 2 * v2 - ic2; return v2; }
    inline float band(float v0) { float v3 = v0 - ic2, v1 = a1 * ic1 + a2 * v3, v2 = ic2 + a2 * ic1 + a3 * v3; ic1 = 2 * v1 - ic1; ic2 = 2 * v2 - ic2; return v1; }
    inline float high(float v0) { float v3 = v0 - ic2, v1 = a1 * ic1 + a2 * v3, v2 = ic2 + a2 * ic1 + a3 * v3; ic1 = 2 * v1 - ic1; ic2 = 2 * v2 - ic2; return v0 - k * v1 - v2; }
    void reset() { ic1 = ic2 = 0; }
};

struct Biquad {
    float b0 = 1, b1 = 0, b2 = 0, a1 = 0, a2 = 0, z1 = 0, z2 = 0;
    inline float run(float x) { float y = b0 * x + z1; z1 = b1 * x - a1 * y + z2; z2 = b2 * x - a2 * y; return y; }
    void peak(float hz, float q, float db, float sr) {
        float A = std::pow(10.f, db / 40), w = kTwoPi * hz / sr, al = std::sin(w) / (2 * q), c = std::cos(w), a0 = 1 + al / A;
        b0 = (1 + al * A) / a0; b1 = -2 * c / a0; b2 = (1 - al * A) / a0; a1 = -2 * c / a0; a2 = (1 - al / A) / a0;
    }
    void highpass(float hz, float q, float sr) {
        float w = kTwoPi * hz / sr, al = std::sin(w) / (2 * q), c = std::cos(w), a0 = 1 + al;
        b0 = (1 + c) / 2 / a0; b1 = -(1 + c) / a0; b2 = b0; a1 = -2 * c / a0; a2 = (1 - al) / a0;
    }
    void bandpass(float hz, float q, float sr) {  // 0 dB at the centre
        float w = kTwoPi * hz / sr, al = std::sin(w) / (2 * q), c = std::cos(w), a0 = 1 + al;
        b0 = al / a0; b1 = 0; b2 = -al / a0; a1 = -2 * c / a0; a2 = (1 - al) / a0;
    }
    void lowpass(float hz, float q, float sr) {
        float w = kTwoPi * hz / sr, al = std::sin(w) / (2 * q), c = std::cos(w), a0 = 1 + al;
        b0 = (1 - c) / 2 / a0; b1 = (1 - c) / a0; b2 = b0; a1 = -2 * c / a0; a2 = (1 - al) / a0;
    }
};

struct DelayLine {
    std::vector<float> buf; int mask = 0, w = 0;
    void init(int maxSamples) { int n = 1; while (n < maxSamples + 4) n <<= 1; buf.assign(n, 0); mask = n - 1; w = 0; }
    inline void push(float x) { buf[w] = x; w = (w + 1) & mask; }
    inline float at(float d) const {  // d samples behind the newest (>= 1)
        float r = (float)w - d; while (r < 0) r += (float)(mask + 1);
        int i = (int)r; float f = r - i;
        float a = buf[i & mask], b = buf[(i + 1) & mask];
        return a + (b - a) * f;
    }
    void clear() { std::fill(buf.begin(), buf.end(), 0.f); }
};

// PolyBLEP correction for band-limited saw and pulse edges.
inline float polyBlep(float t, float dt) {
    if (t < dt) { t /= dt; return t + t - t * t - 1; }
    if (t > 1 - dt) { t = (t - 1) / dt; return t * t + t + t + 1; }
    return 0;
}

// In-place radix-2 FFT (size a power of two). The inverse is not scaled.
inline void fft(float* re, float* im, int n, bool inverse) {
    for (int i = 1, j = 0; i < n; i++) {
        int bit = n >> 1;
        for (; j & bit; bit >>= 1) j ^= bit;
        j ^= bit;
        if (i < j) { std::swap(re[i], re[j]); std::swap(im[i], im[j]); }
    }
    for (int len = 2; len <= n; len <<= 1) {
        const double ang = 2 * 3.14159265358979323846 / len * (inverse ? 1 : -1);
        const float wr = (float)std::cos(ang), wi = (float)std::sin(ang);
        for (int i = 0; i < n; i += len) {
            float cr = 1, ci = 0;
            for (int k = 0; k < len / 2; k++) {
                const int a = i + k, b = a + len / 2;
                const float tr = re[b] * cr - im[b] * ci, ti = re[b] * ci + im[b] * cr;
                re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
                const float nr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = nr;
            }
        }
    }
}

}  // namespace ds
