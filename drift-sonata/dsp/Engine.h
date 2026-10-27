// DRIFT SONATA: the sound engine. Plain C++ without plugin code, so the plugin and the render tool share it.
#pragma once
#include <atomic>
#include <memory>
#include <vector>

#include "Bits.h"
#include "Harmony.h"
#include "Params.h"

namespace ds {

// Sampled single notes (choir, cello) the granular layers read from.
struct Zone { std::vector<float> data; float sr = 48000; float root = 60; int family = 0; };
enum Family { kChoir = 0, kCello = 1, kFamilies = 2 };

struct SampleBank {
    std::vector<Zone> zones;
    float lo[kFamilies] = {200, 200}, hi[kFamilies] = {-200, -200};
    void finish() {
        for (const Zone& z : zones) { lo[z.family] = std::min(lo[z.family], z.root); hi[z.family] = std::max(hi[z.family], z.root); }
    }
    bool has(int fam) const { return hi[fam] >= lo[fam]; }
};

class Engine {
public:
    static constexpr int kVoices = 32, kOsc = 6, kGrains = 4, kCtl = 32;

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

    void noteOn(int note, float velocity);
    void noteOff(int note);
    void allNotesOff();
    void process(float* left, float* right, int n);

    // For the screen: what the chord is right now.
    struct Display { int root = -1; Quality q = Quality::Unknown; int notes[16]; int count = 0; float subLevel = 0; };
    Display display() const { return disp; }

private:
    struct Osc { float ph = 0, last = 0, inc = 0, pw = .5f, pwPh = 0, pwRate = .2f; Wander drift; GlideHold hold; };
    struct Grain { int zone = -1; double pos = 0, rate = 1; int age = 0, len = 0; float pan = 0; };
    struct Layer { Grain g[kGrains]; int countdown = 0; Wander drift; };
    struct Voice {
        bool active = false, gate = false;
        int note = -1, role = 0, order = 0, delay = 0;
        float pitch = 60, target = 60, vel = 1, env = 0, attackCoef = 0, releaseCoef = 0, temper = 0, gain = 1, age = 0;
        float converge = 1; GlideHold convergeHold;
        Wander voiceDrift; GlideHold cutHold;
        Osc osc[kOsc];
        float oscGainL[kOsc] = {}, oscGainR[kOsc] = {};
        Svf filt[2][2];
        Layer layer[kFamilies];
        Rng rng;
    };

    void recompute();
    void startVoice(int note, int role, int order, float vel);
    Voice* allocVoice();
    void controlUpdate();
    float renderGrains(Voice& v, int fam, float& outR, const SampleBank& bank);
    void triggerSub();
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
    bool subWaiting = false;

    // Transport
    bool playing = false; double ppq = 0, bpm = 120, ppqPerSample = 0; int beatsPerBar = 4; double barQuarters = 4; long long lastBar = -1;

    // Fundament
    struct Sub { double ph = 0; float env = 0, freq = 55, decay = .9999f; int attack = 0, attackLen = 480; bool attacking = false; } sub;

    // Control-rate state
    int ctlCount = 0;
    float motionPh = 0, motionVals[3] = {}, lorenz[3] = {.1f, 0, 0}, chaosX = 0, chaosZ = 0;
    float cutoffHz = 2000, resQ = .7f, beatHz = 1, capCents = 10, driftSigma = 2, driftTau = 2;
    float oscLevel[kOsc] = {}, oscNorm = .2f, fmIndex = 0, pwmDepth = .4f, driveGain = 1;
    float choirLevel = 0, celloLevel = 0, voxMix = 0, airLevel = 0, shimmerAmt = 0, widthAmt = 1, ensembleAmt = 0;
    float vowelPos = 0;

    // Bus effects
    Biquad hpL, hpR, pocketL, pocketR, dcL, dcR;
    Svf formL[3], formR[3];
    DelayLine ensL, ensR; float ensPh = 0, ensFastPh = 0;
    DelayLine tapeL, tapeR; float wowPh = 0, flutPh = 0; Svf hissF;
    Svf airL[6], airR[6]; float airGain[6] = {}; GlideHold airBreath[6]; int airCount = 0;
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
