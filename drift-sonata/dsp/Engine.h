// DRIFT SONATA: the sound engine. Plain C++ without plugin code, so the plugin and the render tool share it.
#pragma once
#include <atomic>
#include <memory>
#include <vector>

#include "Bits.h"
#include "Harmony.h"
#include "Params.h"
#include "Space3D.h"
#include "Vocoder.h"
#include "LifeSeq.h"

namespace ds {

// Sampled single notes (choir, cello, strings, brass) the granular layers read from.
struct Zone { std::vector<float> data; float sr = 48000; float root = 60; int family = 0; };
// Texture is not played per note: one bed of recorded atmosphere, moved to the chord's root.
enum Family { kChoir = 0, kCello = 1, kStrings = 2, kBrass = 3, kTexture = 4, kFamilies = 5 };

// Wavetables made from the recordings: 2048-sample cycles, several frames to glide through, and for each frame a
// copy per octave with only the harmonics that fit under half the sample rate (so high notes never alias).
enum Table { kTableCello = 0, kTableChoir, kTableStrings, kTableBrass, kTableChimera, kTables };
struct Wavetable {
    static constexpr int N = 2048, kLevels = 11;
    int frames = 0;
    std::vector<float> raw, mip;
    void build() {
        if (frames <= 0 || (int)raw.size() < frames * N) { frames = 0; return; }
        mip.assign((size_t)kLevels * frames * N, 0.f);
        std::vector<float> re(N), im(N), r2(N), i2(N);
        for (int f = 0; f < frames; f++) {
            for (int i = 0; i < N; i++) { re[i] = raw[(size_t)f * N + i]; im[i] = 0; }
            fft(re.data(), im.data(), N, false);
            for (int L = 0; L < kLevels; L++) {
                const int limit = std::max(1, (N / 2) >> L);
                for (int k = 0; k < N; k++) { const int h = k <= N / 2 ? k : N - k; const bool keep = h >= 1 && h <= limit && h < N / 2; r2[k] = keep ? re[k] : 0; i2[k] = keep ? im[k] : 0; }
                fft(r2.data(), i2.data(), N, true);
                float* dst = &mip[((size_t)L * frames + f) * N];
                for (int i = 0; i < N; i++) dst[i] = r2[i] / N;
            }
        }
    }
    const float* frame(int level, int f) const { return &mip[((size_t)level * frames + f) * N]; }
};

struct SampleBank {
    std::vector<Zone> zones;
    Wavetable tables[kTables];
    float lo[kFamilies] = {200, 200, 200, 200, 200}, hi[kFamilies] = {-200, -200, -200, -200, -200};
    void finish() {
        for (const Zone& z : zones) { lo[z.family] = std::min(lo[z.family], z.root); hi[z.family] = std::max(hi[z.family], z.root); }
        for (Wavetable& t : tables) if (!t.raw.empty() && t.mip.empty()) t.build();
    }
    bool has(int fam) const { return hi[fam] >= lo[fam]; }
};

class Engine {
public:
    static constexpr int kVoices = 32, kOsc = 6, kGrains = 4, kCtl = 32;
    // Sound sources in the 3D room: the six oscillators, the four recorded layers, the robot
    static constexpr int kRobotSrc = kOsc + kFamilies, kSources = kOsc + kFamilies + 1;

    void prepare(double sampleRate, int maxBlock);
    void reset();
    void setSeed(uint32_t s) { seed = s ? s : 1; reset(); }
    void setParams(const Values& v) { p = v; }
    // Called from any thread; the audio thread picks the new bank up at the start of a block.
    void setSamples(std::shared_ptr<const SampleBank> b) {
        while (bankLock.test_and_set(std::memory_order_acquire)) {}
        pendingBank = std::move(b); bankChanged = true;
        bankLock.clear(std::memory_order_release);
    }
    // Transport at the start of the next block. Not playing: every new chord counts as bar one.
    void setTransport(bool playing, double ppq, double bpm, int num, int den);

    // A vocal for the robot to speak with (mono, at the engine's sample rate). Call between blocks.
    float* vocalBuffer(int length) { extMod.assign(std::max(0, length), 0.f); extPos = 0; return extMod.data(); }

    void noteOn(int note, float velocity);
    void noteOff(int note);
    void allNotesOff();
    void process(float* left, float* right, int n);

    // For the screen: what the chord is right now.
    struct Display {
        int root = -1; Quality q = Quality::Unknown; int notes[16]; int count = 0; float subLevel = 0;
        float pos[kSources][3] = {};  // azimuth, elevation (radians), distance (m)
        float level[kSources] = {};   // how loud each source is now
    };
    Display display() const { return disp; }

private:
    struct Osc { float ph = 0, last = 0, inc = 0, pw = .5f, pwPh = 0, pwRate = .2f, morphPh = 0, morphRate = .1f, morph = 0; int level = 0; Wander drift; GlideHold hold; };
    struct Grain { int zone = -1; double pos = 0, rate = 1; int age = 0, len = 0; float pan = 0; };
    struct Layer { Grain g[kGrains]; int countdown = 0; Wander drift; };
    struct Voice {
        bool active = false, gate = false;
        int note = -1, role = 0, order = 0, delay = 0;
        float pitch = 60, target = 60, vel = 1, env = 0, attackCoef = 0, releaseCoef = 0, temper = 0, gain = 1, age = 0;
        float converge = 1; GlideHold convergeHold;
        Wander voiceDrift; GlideHold cutHold;
        Osc osc[kOsc];
        Svf of[kOsc][2];       // each oscillator through the voice filter on its own, so it can sit in its own place
        Svf lf[kFamilies];
        Layer layer[kFamilies];
        Rng rng;
    };

    void recompute();
    void startVoice(int note, int role, int order, float vel);
    Voice* allocVoice();
    void controlUpdate();
    float renderGrains(Voice& v, int fam, const SampleBank& bank);
    void triggerSub(double untilNextQuarters = 1e9);
    bool subOnStep(int step16, int stepsPerBar);
    double subGapQuarters(int step16, int stepsPerBar);
    float temperFor(int note) const;
    float temperature() const;
    int expandLevel() const;

    double sr = 48000;
    Values p = defaults();
    std::shared_ptr<const SampleBank> bank, pendingBank;
    std::atomic_flag bankLock = ATOMIC_FLAG_INIT; bool bankChanged = false;
    Voice voices[kVoices];
    Rng rng{12345}; uint32_t seed = 1;

    // Held keys and the voicing made from them
    std::vector<int> held; float heldVel = .8f; int pendingRecompute = -1;
    Voicing voicing; std::vector<int> prevVoicing;
    int lastExpand = -1, lastColor = -1, lastKey = -1, lastKeyMinor = -1, lastKeepBass = -1;
    bool subWaiting = false; long long last16 = -1;

    // Transport
    bool playing = false; double ppq = 0, bpm = 120, ppqPerSample = 0; int beatsPerBar = 4; double barQuarters = 4; long long lastBar = -1;

    // Fundament
    struct Sub { double ph = 0; float env = 0, freq = 55, decay = .9999f; int attack = 0, attackLen = 480; bool attacking = false; } sub;

    // Control-rate state
    int ctlCount = 0;
    float motionPh = 0, motionVals[3] = {}, lorenz[3] = {.1f, 0, 0}, chaosX = 0, chaosZ = 0;
    float cutoffHz = 2000, resQ = .7f, beatHz = 1, capCents = 10, driftSigma = 2, driftTau = 2;
    float oscLevel[kOsc] = {}, oscNorm = .2f, fmIndex = 0, pwmDepth = .4f, driveGain = 1;
    float layerLevel[kFamilies] = {}, voxMix = 0, airLevel = 0, shimmerAmt = 0, widthAmt = 1, ensembleAmt = 0;
    float vowelPos = 0;

    // Bus effects
    Biquad hpL, hpR, pocketL, pocketR, dcL, dcR;
    Svf formL[3], formR[3];
    DelayLine ensL, ensR; float ensPh = 0, ensFastPh = 0;
    DelayLine tapeL, tapeR; float wowPh = 0, flutPh = 0; Svf hissF;
    Svf airL[6], airR[6]; float airGain[6] = {}; GlideHold airBreath[6]; int airCount = 0;
    float airFollow = 0, breathAmt = 0; Svf breathHpL, breathHpR, breathLpL, breathLpR; GlideHold breathHold;
    // 3D room and robot
    Binaural space[kSources]; float srcPh[kSources] = {}, srcRate[kSources] = {}, srcDir[kSources] = {}, bus[kSources] = {}, srcMeter[kSources] = {};
    Vocoder vocoder; MachineWords words; float robotAmt = 0;
    std::vector<float> extMod; long long extPos = 0;
    Voice texVoice; float texEnv = 0;
    // Life sequencer state, per oscillator: what the lanes do to it right now
    LifeSeq lifeLanes; double lifeClock = 0; float lifeStep = 0;
    float lifeCents[kOsc] = {}, lifeSemis[kOsc] = {}, lifeShape[kOsc] = {}, lifeFold[kOsc] = {}, lifeAz[kOsc] = {}, lifeEl[kOsc] = {}, lifeCut[kOsc] = {}, lifeFm[kOsc] = {};
public:
    // For the screen: the lanes' patterns and where the sequencer is
    const LifeSeq& lifeSeq() const { return lifeLanes; }
    float lifePosition() const { return lifeStep; }
    int lifeSteps() const;
private:
    DelayLine dubL, dubR; Biquad dubLp, dubHp; float dubTime = .375f;
    // Reverb: 8-line feedback delay network with a shimmer (octave up) in the loop
    DelayLine fdn[8]; float fdnLen[8] = {}, fdnLp[8] = {}, fdnGk[8] = {}, revDamp = .3f; float fdnModPh = 0;
    DelayLine shimBuf; float shimPh = 0; float shimFb = 0; Biquad revHpL, revHpR, shimHp;
    DelayLine preL, preR;
    // Limiter
    std::vector<float> limBufL, limBufR, limGain; int limPos = 0, limLen = 64; float limEnv = 1;
    std::vector<float> scratchL, scratchR;

    Display disp;
};

}  // namespace ds
