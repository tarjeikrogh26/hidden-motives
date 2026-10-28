#include "Engine.h"

#include <cstring>

namespace ds {

namespace {
// Where each of the six oscillators sits in the spread (half the widest beat on either side). Neighbours sit apart.
const float kSlot[6] = {-.5f, .3f, -.1f, .1f, -.3f, .5f};
// How far just intonation lies from equal temperament, per interval over the chord root (cents).
const float kJust[12] = {0, 11.7f, 3.9f, 15.6f, -13.7f, -2.0f, -17.5f, 2.0f, 13.7f, -15.6f, 17.6f, -11.7f};
// Vowel formants: U, O, A, E (Hz) for the Vox layer.
const float kVowels[4][3] = {{300, 870, 2240}, {570, 840, 2410}, {730, 1090, 2440}, {530, 1840, 2480}};
const float kFormGain[3] = {1.f, .55f, .3f}, kFormQ[3] = {6, 8, 11};
// Voices sum to a level that leaves room: a full chord sits around -18 dBFS RMS before the room.
const float kVoiceBus = .3f;
// Machine words: syllable length in quarter notes for 1/2, 1/4, 1/8, 1/16
const double kWordLen[4] = {2, 1, .5, .25};
// Recorded layers at full sit a few dB under the synth at full (measured): choir, cello, strings, brass, texture
const float kLayerGain[5] = {1.3f, 1.4f, 1.2f, 2.2f, 3.5f};
const float kFdnMs[8] = {37.1f, 41.3f, 47.9f, 53.7f, 59.3f, 67.1f, 73.9f, 83.3f};

inline void hadamard8(float* x) {
    for (int h = 1; h < 8; h <<= 1)
        for (int i = 0; i < 8; i += h << 1)
            for (int j = i; j < i + h; j++) { float a = x[j], b = x[j + h]; x[j] = a + b; x[j + h] = a - b; }
    for (int i = 0; i < 8; i++) x[i] *= 0.35355339f;
}
}  // namespace

void Engine::prepare(double sampleRate, int maxBlock) {
    sr = sampleRate;
    ensL.init((int)(0.02 * sr)); ensR.init((int)(0.02 * sr));
    tapeL.init((int)(0.01 * sr)); tapeR.init((int)(0.01 * sr));
    dubL.init((int)(2.2 * sr)); dubR.init((int)(2.2 * sr));
    preL.init((int)(0.05 * sr)); preR.init((int)(0.05 * sr));
    for (int k = 0; k < 8; k++) fdn[k].init((int)(0.2 * sr));
    shimBuf.init((int)(0.2 * sr));
    limLen = std::max(16, (int)(0.0015 * sr));
    limBufL.assign(limLen, 0); limBufR.assign(limLen, 0); limGain.assign(limLen, 1);
    scratchL.assign(maxBlock, 0); scratchR.assign(maxBlock, 0);
    dcL.highpass(20, .7f, (float)sr); dcR = dcL;
    hissF.set(6500, .7f, (float)sr);
    dubLp.lowpass(2400, .7f, (float)sr); dubHp.highpass(220, .7f, (float)sr);
    revHpL.highpass(110, .7f, (float)sr); revHpR = revHpL; shimHp.highpass(280, .7f, (float)sr);
    breathHpL.set(3500, .6f, (float)sr); breathHpR = breathHpL; breathLpL.set(11000, .6f, (float)sr); breathLpR = breathLpL;
    for (Binaural& b : space) b.prepare((float)sr);
    vocoder.prepare((float)sr); words.prepare((float)sr);
    texVoice = Voice(); texVoice.rng = Rng(9001); texEnv = 0;
    reset();
}

void Engine::reset() {
    for (Voice& v : voices) v = Voice();
    held.clear(); voicing = {}; prevVoicing.clear(); pendingRecompute = -1;
    sub = Sub(); limEnv = 1; ctlCount = 0; lastBar = -1;
    ensL.clear(); ensR.clear(); tapeL.clear(); tapeR.clear(); dubL.clear(); dubR.clear(); preL.clear(); preR.clear(); shimBuf.clear();
    for (auto& d : fdn) d.clear();
    std::fill(fdnLp, fdnLp + 8, 0.f);
    std::fill(limBufL.begin(), limBufL.end(), 0.f); std::fill(limBufR.begin(), limBufR.end(), 0.f); std::fill(limGain.begin(), limGain.end(), 1.f);
    for (int i = 0; i < kVoices; i++) voices[i].rng = Rng(0x1234567u * seed + i * 7919u);
    {
        Rng r(4242u + seed);
        for (int k = 0; k < kSources; k++) { srcPh[k] = r.uni() * kTwoPi; srcRate[k] = .6f + .8f * r.uni(); srcDir[k] = r.uni() < .5f ? -1.f : 1.f; srcMeter[k] = 0; }
    }
    rng = Rng(12345u * seed);
}

void Engine::setTransport(bool isPlaying, double pos, double tempo, int num, int den) {
    if (isPlaying && !playing) lastBar = -1;
    playing = isPlaying; bpm = tempo > 20 ? tempo : 120; beatsPerBar = std::max(1, num);
    barQuarters = num * 4.0 / std::max(1, den);
    if (playing) ppq = pos;
    ppqPerSample = bpm / 60.0 / sr;
}

void Engine::noteOn(int note, float velocity) {
    if (std::find(held.begin(), held.end(), note) == held.end()) held.push_back(note);
    heldVel = held.size() == 1 ? velocity : std::max(heldVel, velocity);
    pendingRecompute = std::max(1, (int)(0.008 * sr));
}

void Engine::noteOff(int note) {
    held.erase(std::remove(held.begin(), held.end(), note), held.end());
    pendingRecompute = std::max(1, (int)(0.008 * sr));
}

void Engine::allNotesOff() {
    held.clear();
    for (Voice& v : voices) if (v.active) { v.gate = false; if (v.delay > 0) v.active = false; }
    voicing = {};
}

// Tension below the middle pulls the chord's intervals towards pure tuning; above it pushes them apart.
float Engine::temperature() const { return clampf((p[Tension] - .5f) * 1.4f, -.7f, .7f); }

// Expand on Auto follows Tension: plain chord at the bottom, eleven and thirteen at the top.
int Engine::expandLevel() const {
    const int e = (int)std::lround(p[Expand]);
    if (e > 0) return e - 1;
    const float t = p[Tension];
    return t < .08f ? 0 : t < .25f ? 1 : t < .45f ? 2 : t < .75f ? 3 : 4;
}

float Engine::temperFor(int note) const {
    if (voicing.chord.root < 0) return 0;
    float t = temperature(), ji = kJust[pcOf(note - voicing.chord.root)];
    return -t * ji * (t < 0 ? 1.f : .8f);
}

Engine::Voice* Engine::allocVoice() {
    for (Voice& v : voices) if (!v.active) return &v;
    Voice* best = nullptr;
    for (Voice& v : voices) if (!v.gate && (!best || v.env < best->env)) best = &v;
    if (!best) for (Voice& v : voices) if (!best || v.env < best->env) best = &v;
    return best;
}

void Engine::startVoice(int note, int role, int order, float vel) {
    Voice* vp = allocVoice();
    Rng keep = vp->rng; keep.next();
    *vp = Voice(); vp->rng = keep;
    Voice& v = *vp; Rng& r = v.rng;
    v.active = v.gate = true; v.note = note; v.pitch = v.target = (float)note; v.role = role; v.order = order;
    v.vel = .55f + .45f * vel;
    v.gain = role == 0 ? 1.f : role == 1 ? .8f : .7f;
    const float unfold = p[Unfold];
    v.delay = order > 0 ? (int)(unfold * sr * order / 3.f * (.8f + .4f * r.uni())) : 0;
    const float att = std::max(.002f, p[Attack] + (role == 2 ? unfold * .4f : 0.f));
    v.attackCoef = 1 - std::exp(-1.f / (att / 1.466f * (float)sr));
    v.releaseCoef = 1 - std::exp(-1.f / (std::max(.02f, p[Release]) / 6.9f * (float)sr));
    v.temper = temperFor(note);
    v.voiceDrift.init(r, .5f);
    v.converge = .7f + .3f * r.uni();
    for (Osc& o : v.osc) { o.ph = r.uni(); o.pwPh = r.uni() * kTwoPi; o.pwRate = .07f + .35f * r.uni(); o.morphPh = r.uni() * kTwoPi; o.morphRate = .03f + .22f * r.uni(); o.drift.init(r, driftSigma); }
    for (Layer& l : v.layer) { l.countdown = (int)(r.uni() * 0.02 * sr); l.drift.init(r, 2); }
}

void Engine::recompute() {
    pendingRecompute = -1;
    const bool wasEmpty = voicing.notes.empty();
    if (held.empty()) {
        for (Voice& v : voices) if (v.active && v.gate) { v.gate = false; if (v.delay > 0) v.active = false; v.releaseCoef = 1 - std::exp(-1.f / (std::max(.02f, p[Release]) / 6.9f * (float)sr)); }
        voicing = {}; disp.count = 0; disp.root = -1;
        return;
    }
    ExpandOptions o;
    o.level = expandLevel(); o.color = (Color)(int)std::lround(p[ChordColor]);
    o.key = p[Key] >= .5f ? (int)std::lround(p[Key]) - 1 : -1; o.keyMinor = p[KeyMinor] > .5f; o.keepBass = p[KeepBass] > .5f;
    Voicing nv = expand(held, o, prevVoicing);
    bool changed = nv.notes.size() != voicing.notes.size();
    for (size_t i = 0; !changed && i < nv.notes.size(); i++) changed = nv.notes[i].midi != voicing.notes[i].midi;
    voicing = nv;

    // Notes both chords share keep sounding; the rest glide to a near new note, or release while new ones start.
    std::vector<VoicedNote> todo = nv.notes;
    std::vector<Voice*> leaving;
    for (Voice& v : voices) {
        if (!v.active || !v.gate) continue;
        auto it = std::find_if(todo.begin(), todo.end(), [&](const VoicedNote& n) { return n.midi == v.note; });
        if (it != todo.end()) { v.role = it->role; todo.erase(it); } else leaving.push_back(&v);
    }
    if (p[Glide] > .005f) {
        for (auto it = todo.begin(); it != todo.end();) {
            Voice* best = nullptr; int bd = 5;
            for (Voice* v : leaving) { int d = std::abs(v->note - it->midi); if (d < bd) { bd = d; best = v; } }
            if (best) {
                best->note = it->midi; best->target = (float)it->midi; best->role = it->role;
                leaving.erase(std::find(leaving.begin(), leaving.end(), best));
                it = todo.erase(it);
            } else ++it;
        }
    }
    for (Voice* v : leaving) { v->gate = false; if (v->delay > 0) v->active = false; v->releaseCoef = 1 - std::exp(-1.f / (std::max(.02f, p[Release]) / 6.9f * (float)sr)); }
    for (const VoicedNote& n : todo) startVoice(n.midi, n.role, n.order, heldVel);
    for (Voice& v : voices) if (v.active && v.gate) v.temper = temperFor(v.note);

    prevVoicing.clear();
    for (const VoicedNote& n : nv.notes) prevVoicing.push_back(n.midi);

    // The air follows the chord: narrow noise bands two octaves over the top notes.
    airCount = 0;
    for (int i = (int)nv.notes.size() - 1; i >= 0 && airCount < 6; i--) {
        float hz = mtof((float)nv.notes[i].midi + 24);
        while (hz > 9000) hz *= .5f;
        airL[airCount].set(hz, 22, (float)sr); airR[airCount].set(hz * 1.003f, 22, (float)sr);
        airCount++;
    }
    disp.root = nv.chord.root; disp.q = nv.chord.q; disp.count = 0;
    for (const VoicedNote& n : nv.notes) if (disp.count < 16) disp.notes[disp.count++] = n.midi;

    if (wasEmpty && (!playing || subWaiting)) triggerSub();
    else if (changed && p[FundFollow] > .5f) triggerSub();
    subWaiting = false;
}

void Engine::triggerSub() {
    if (p[SubDrop] < .001f || voicing.notes.empty()) return;
    int root = voicing.chord.root;
    if (p[FundRoot] > .5f) root = pcOf(*std::min_element(held.begin(), held.end()));
    const int midi = 28 + pcOf(root - 28);
    if (sub.env < .02f) sub.ph = 0;  // start on a zero crossing
    sub.freq = mtof((float)midi);
    sub.attacking = true; sub.attackLen = std::max(1, (int)(0.012 * sr));
    const double barSec = barQuarters * 60.0 / bpm;
    const double fade = std::min((double)p[FundFade] * 60.0 / bpm, barSec * 0.97);
    sub.decay = (float)std::exp(std::log(0.001) / (std::max(0.05, fade) * sr));
}

void Engine::controlUpdate() {
    const float dt = kCtl / (float)sr, sour = p[Drift], life = p[Life], I = p[Intensity];
    // Harmony settings changed while a chord is held: fold it out again.
    const int ex = expandLevel(), co = (int)std::lround(p[ChordColor]), ke = (int)std::lround(p[Key]), km = p[KeyMinor] > .5f, kb = p[KeepBass] > .5f;
    // (fresh, without leading from the voicing before, so turning a setting back gives back the same chord)
    if ((ex != lastExpand || co != lastColor || ke != lastKey || km != lastKeyMinor || kb != lastKeepBass) && !held.empty() && pendingRecompute < 0) { prevVoicing.clear(); recompute(); }
    lastExpand = ex; lastColor = co; lastKey = ke; lastKeyMinor = km; lastKeepBass = kb;

    beatHz = .06f + 7.f * std::pow(sour, 1.6f);
    capCents = 2 + 28 * sour;
    driftSigma = (.5f + 9 * sour) * (.3f + .7f * life);
    driftTau = 3.5f - 2.5f * life;
    const float wUpper = smoothstep(.15f, .45f, I), wLayer = smoothstep(.4f, .7f, I), wTop = smoothstep(.65f, .95f, I);

    float sumSq = 0;
    for (int i = 0; i < kOsc; i++) {
        const bool on = p[oscParam(i, 0)] > .5f;
        const bool upper = p[oscParam(i, 2)] > .5f || p[oscParam(i, 3)] >= 12;
        oscLevel[i] = on ? p[oscParam(i, 5)] * (upper ? wUpper : 1.f) : 0.f;
        sumSq += oscLevel[i] * oscLevel[i];
    }
    oscNorm = .42f / std::sqrt(sumSq + .05f);

    // Slow movement over 4..32 bars, locked to the song when the host plays.
    const int barsChoice[4] = {4, 8, 16, 32};
    const float bars = (float)barsChoice[std::min(3, std::max(0, (int)std::lround(p[MotionBars])))];
    if (playing) motionPh = (float)std::fmod(ppq / (barQuarters * bars), 1.0);
    else { motionPh += dt / (bars * (float)(barQuarters * 60.0 / bpm)); if (motionPh >= 1) motionPh -= 1; }
    const float ph = motionPh * kTwoPi, mot = p[Motion];
    motionVals[0] = .6f * std::sin(ph) + .4f * std::sin(3 * ph + 1);
    motionVals[1] = .6f * std::sin(ph + 2.1f) + .4f * std::sin(2 * ph);
    motionVals[2] = .5f * std::sin(ph + 4.2f) + .5f * std::sin(5 * ph + .5f);

    // A Lorenz attractor as a chaotic modulation source.
    const float chaos = p[Chaos], ldt = dt * (.25f + .9f * chaos);
    float& lx = lorenz[0]; float& ly = lorenz[1]; float& lz = lorenz[2];
    const float dx = 10 * (ly - lx), dy = lx * (28 - lz) - ly, dz = lx * ly - 2.6667f * lz;
    lx += dx * ldt; ly += dy * ldt; lz += dz * ldt;
    chaosX = clampf(lx / 20, -1, 1); chaosZ = clampf((lz - 25) / 12, -1, 1);

    cutoffHz = 60 * std::pow(2.f, p[Cutoff] * 8.4f + mot * .8f * motionVals[0] + chaos * .45f * chaosZ);
    resQ = .6f + p[Resonance] * 5.f;
    fmIndex = p[Cross] * p[Cross] * .22f * (1 + .6f * chaos * chaosX);
    pwmDepth = p[Pwm];
    driveGain = 1 + 4 * p[Drive];
    layerLevel[kChoir] = p[Choir] * wLayer * (1 + .4f * mot * motionVals[2]);
    layerLevel[kCello] = p[Cello] * wLayer;
    layerLevel[kStrings] = p[StringLayer] * wLayer * (1 + .3f * mot * motionVals[0]);
    layerLevel[kBrass] = p[BrassLayer] * wLayer;
    layerLevel[kTexture] = p[TextureLayer] * wLayer * (1 + .3f * mot * motionVals[1]);
    robotAmt = p[Robot];
    voxMix = p[Vox] * wLayer;
    vowelPos = clampf(p[Vowel] + .3f * mot * motionVals[1], 0, 1);
    airLevel = p[Air] * wTop;
    shimmerAmt = p[Shimmer] * wTop * (.25f + .75f * p[Space]);
    widthAmt = p[Width] * (.55f + .45f * smoothstep(.2f, .5f, I)) * (1 + .15f * mot * motionVals[1]);
    ensembleAmt = p[Ensemble];

    // Bus filters
    const float fund = p[SubDrop];
    const float hpHz = fund > .001f ? 30 + 110 * fund : 20;
    hpL.highpass(hpHz, .7f, (float)sr); hpR.b0 = hpL.b0; hpR.b1 = hpL.b1; hpR.b2 = hpL.b2; hpR.a1 = hpL.a1; hpR.a2 = hpL.a2;
    pocketL.peak(2600, .9f, -7 * p[Pocket], (float)sr); pocketR.b0 = pocketL.b0; pocketR.b1 = pocketL.b1; pocketR.b2 = pocketL.b2; pocketR.a1 = pocketL.a1; pocketR.a2 = pocketL.a2;
    {
        const float x = vowelPos * 3; const int a = std::min(2, (int)x); const float f = x - a;
        for (int k = 0; k < 3; k++) {
            const float hz = kVowels[a][k] + (kVowels[a + 1][k] - kVowels[a][k]) * f;
            formL[k].set(hz, kFormQ[k], (float)sr); formR[k].set(hz * 1.01f, kFormQ[k], (float)sr);
        }
    }
    const int dtChoice = std::min(4, std::max(0, (int)std::lround(p[DelayTime])));
    const float beats[5] = {1, .75f, .5f, .375f, 2};
    dubTime = std::min(2.f, beats[dtChoice] * 60.f / (float)bpm);
    // Reverb: size sets both line lengths and decay; freeze holds the tail.
    const float size = clampf(p[Size] + .35f * (p[Space] - .5f), 0, 1), t60 = 1.2f + 12 * std::pow(size, 1.5f);
    const bool freeze = p[Freeze] > .5f;
    for (int k = 0; k < 8; k++) {
        fdnLen[k] = kFdnMs[k] * (.6f + 1.4f * size) * .001f * (float)sr;
        fdnGk[k] = freeze ? 1.f : std::pow(10.f, -3 * fdnLen[k] / (t60 * (float)sr));
    }
    revDamp = freeze ? 1.f : 1 - std::exp(-kTwoPi * (2500 + 6000 * (1 - size)) / (float)sr);

    // Air breathes, but never far from where the fader puts it (about +-2 dB)
    for (int a = 0; a < 6; a++) airGain[a] = clampf(.85f + airBreath[a].step(rng, dt, 1, 5, 1.5f, .18f), .6f, 1.1f);
    breathAmt = clampf(.85f + breathHold.step(rng, dt, 1.5f, 6, 2, .15f), .65f, 1.05f);

    // The 3D room: every source drifts round the head on its own path. Orbit 0 leaves each where its pan puts it.
    {
        const float orbit = p[Orbit], hz = .01f + .3f * p[OrbitSpeed] * p[OrbitSpeed], over = p[Overhead], dist = .7f + 2.3f * p[Distance], amt = p[Space3D];
        const float widthPan = clampf(widthAmt, 0, 1.2f);
        for (int k = 0; k < kSources; k++) {
            srcPh[k] += kTwoPi * hz * srcRate[k] * srcDir[k] * dt;
            if (srcPh[k] > 1000) srcPh[k] -= 100 * kTwoPi; else if (srcPh[k] < -1000) srcPh[k] += 100 * kTwoPi;
            const float base = k < kOsc ? p[oscParam(k, 6)] * kPi / 2 * widthPan
                             : k == kRobotSrc ? 0.f : (k - kOsc - (kFamilies - 1) / 2.f) * .5f * widthPan;  // the recorded layers spread left to right
            const float ph = srcPh[k], phase = (float)k;
            const float az = base * (1 - .5f * orbit) + orbit * (kPi * .85f * std::sin(ph) + .55f * kPi * std::sin(.37f * ph + phase));
            const float el = over * (.15f + .85f * orbit) * .9f * std::sin(.53f * ph + 1.3f * phase);
            const float d = dist * (1 + .35f * orbit * std::sin(.29f * ph + 2 * phase));
            space[k].place(az, el, d, amt);
            disp.pos[k][0] = az; disp.pos[k][1] = el; disp.pos[k][2] = d;
            disp.level[k] = srcMeter[k];
        }
    }

    // Voices
    const float glideT = std::max(1e-4f, p[Glide] * .4f);
    for (Voice& v : voices) {
        if (!v.active) continue;
        Rng& r = v.rng;
        v.age += dt;
        v.pitch += (v.target - v.pitch) * std::min(1.f, dt / glideT);
        const float vd = v.voiceDrift.step(r, dt, 4, .3f * life + 1.2f * sour * life);
        v.converge = clampf(.7f + v.convergeHold.step(r, dt, 3, 9, 3, .35f), .15f, 1);
        float cents[kOsc], mean = 0, wsum = 0;
        for (int i = 0; i < kOsc; i++) {
            Osc& o = v.osc[i];
            const float d = o.drift.step(r, dt, driftTau, driftSigma) + o.hold.step(r, dt, 1, 6, 1.5f, driftSigma * .6f);
            const float nominal = mtof(v.pitch + 12 * p[oscParam(i, 2)] + p[oscParam(i, 3)]);
            const float spread = clampf(1200 * std::log2(1 + kSlot[i] * beatHz * v.converge / nominal), -capCents, capCents);
            cents[i] = spread + d;
            const float w = oscLevel[i] * oscLevel[i];
            mean += cents[i] * w; wsum += w;
        }
        mean = wsum > 0 ? mean / wsum : 0;  // the (loudness-weighted) average stays in tune; the beating lives around it
        for (int i = 0; i < kOsc; i++) {
            Osc& o = v.osc[i];
            const float m = v.pitch + 12 * p[oscParam(i, 2)] + p[oscParam(i, 3)] + (cents[i] - mean + p[oscParam(i, 4)] + v.temper + vd) / 100;
            o.inc = mtof(m) / (float)sr;
            o.pwPh += kTwoPi * o.pwRate * dt * (1 + chaos * chaosX * .5f);
            if (o.pwPh > kTwoPi) o.pwPh -= kTwoPi;
            o.pw = clampf(.5f + .42f * pwmDepth * std::sin(o.pwPh), .06f, .94f);
            // Morph glides the wave through sine, triangle, saw and pulse, each oscillator at its own pace
            o.morphPh += kTwoPi * o.morphRate * (.4f + life + mot) * dt * (1 + chaos * chaosX * .5f);
            if (o.morphPh > kTwoPi) o.morphPh -= kTwoPi;
            o.morph = 1.5f + 1.5f * std::sin(o.morphPh);
            // which octave copy of a wavetable this pitch may use: no harmonic above half the sample rate
            o.level = std::min(Wavetable::kLevels - 1, std::max(0, (int)std::ceil(std::log2(1024.f / std::max(1.f, std::floor(.5f / std::max(o.inc, 1e-6f)))))));
        }
        const float cutMove = v.cutHold.step(r, dt, 1.5f, 6, 2.5f, .5f * p[FilterMotion] * (.4f + life));
        const float hz = cutoffHz * std::pow(2.f, (v.pitch - 60) / 24 + cutMove) * (.55f + .45f * std::min(1.f, v.env * 1.2f));
        Svf a, b2; a.set(hz, resQ, (float)sr); b2.set(hz, .6f, (float)sr);
        auto coef = [](Svf& dst, const Svf& src) { dst.a1 = src.a1; dst.a2 = src.a2; dst.a3 = src.a3; dst.k = src.k; };
        for (int i = 0; i < kOsc; i++) { coef(v.of[i][0], a); coef(v.of[i][1], b2); }
        for (int f = 0; f < kFamilies; f++) coef(v.lf[f], b2);
        for (Layer& l : v.layer) l.drift.step(r, dt, 3, 3 + 18 * sour);
    }
    disp.subLevel = sub.env * p[SubDrop];
}

float Engine::renderGrains(Voice& v, int fam, const SampleBank& b) {
    Layer& L = v.layer[fam];
    Rng& r = v.rng;
    if (--L.countdown <= 0) {
        // A new grain from a nearby recorded note, pitched to this voice and a little out of tune with the synth.
        const bool tex = fam == kTexture;
        float note = v.pitch + L.drift.x / 100;
        const float lo = b.lo[fam] - 6, hi = b.hi[fam] + 6;
        while (note < lo) note += 12;
        while (note > hi) note -= 12;
        float best = 1e9f;
        for (const Zone& z : b.zones) if (z.family == fam) best = std::min(best, std::abs(z.root - note));
        int pick = -1, seen = 0;
        for (int i = 0; i < (int)b.zones.size(); i++) {
            const Zone& z = b.zones[i];
            if (z.family != fam || std::abs(z.root - note) > best + (tex ? 2.5f : 1.f)) continue;
            if (r.uni() * (++seen) < 1) pick = i;
        }
        int slot = 0;
        for (int k = 1; k < kGrains; k++) if (L.g[k].age >= L.g[k].len && L.g[slot].age < L.g[slot].len) slot = k; else if (L.g[k].age - L.g[k].len > L.g[slot].age - L.g[slot].len) slot = k;
        Grain& g = L.g[slot];
        int len = (int)((tex ? .5f : .16f) * sr * (.8f + .4f * r.uni()));
        if (pick >= 0) {
            const Zone& z = b.zones[pick];
            const double rate = std::pow(2.0, (note - z.root) / 12.0) * z.sr / sr;
            const double n = (double)z.data.size();
            if (len * rate > n * .85) len = (int)(n * .85 / rate);
            const double room = std::max(0.0, n * .92 - len * rate - n * .06);
            g.zone = pick; g.rate = rate; g.pos = n * .06 + r.uni() * room; g.age = 0; g.len = std::max(64, len); g.pan = r.bi() * .6f;
        }
        L.countdown = std::max(16, len / 3);
    }
    float l = 0;
    for (Grain& g : L.g) {
        if (g.zone < 0 || g.age >= g.len || g.zone >= (int)b.zones.size()) continue;
        const std::vector<float>& d = b.zones[g.zone].data;
        const int i = (int)g.pos;
        if (i + 1 >= (int)d.size()) { g.age = g.len; continue; }
        const float f = (float)(g.pos - i), x = d[i] + (d[i + 1] - d[i]) * f;
        const float w = .5f - .5f * std::cos(kTwoPi * g.age / g.len);
        const float s = x * w;
        l += s;
        g.pos += g.rate; g.age++;
    }
    return l * .5f;
}

void Engine::process(float* outL, float* outR, int n) {
    // Never wait for the lock here: if another thread holds it, take the new samples next block.
    if (!bankLock.test_and_set(std::memory_order_acquire)) {
        std::shared_ptr<const SampleBank> old;
        if (bankChanged) {
            old = std::move(bank); bank = pendingBank; bankChanged = false;
            for (Voice& v : voices) for (Layer& l : v.layer) for (Grain& g : l.g) g.zone = -1;
            for (Layer& l : texVoice.layer) for (Grain& g : l.g) g.zone = -1;
        }
        bankLock.clear(std::memory_order_release);
    }
    const SampleBank* b = bank.get();
    const float level = dbToGain(p[Level]), fund = p[SubDrop], tape = p[Tape], dsend = p[Delay] * (.4f + .6f * p[Space]), rev = .85f * p[Space];
    const float subDrive = 1 + 2 * p[Drive], subNorm = 1 / std::tanh(subDrive);
    const float ceiling = .89f, relCoef = 1 - std::exp(-1.f / (0.12f * (float)sr));
    int waves[kOsc];

    for (int s = 0; s < n; s++) {
        if (ctlCount <= 0) {
            controlUpdate(); ctlCount = kCtl;
            for (int i = 0; i < kOsc; i++) waves[i] = (int)std::lround(p[oscParam(i, 1)]);
        } else if (s == 0) for (int i = 0; i < kOsc; i++) waves[i] = (int)std::lround(p[oscParam(i, 1)]);
        ctlCount--;

        if (playing) {
            const long long bar = (long long)std::floor((ppq + 1e-7) / barQuarters);
            if (bar != lastBar) {
                lastBar = bar;
                if (pendingRecompute > 0) subWaiting = true;  // the chord lands on the downbeat: sound it once it is folded out
                else if (!held.empty()) triggerSub();
            }
            ppq += ppqPerSample;
        }
        if (pendingRecompute > 0 && --pendingRecompute == 0) recompute();

        // Voices: each oscillator and each recorded layer sums into its own source
        for (int k = 0; k < kSources; k++) bus[k] = 0;
        float envMax = 0;
        const bool robotChoir = robotAmt > .001f && p[RobotVoice] < .5f && b && b->has(kChoir);
        for (Voice& v : voices) {
            if (!v.active) continue;
            if (v.delay > 0) { v.delay--; continue; }
            if (v.gate) { v.env += (1.3f - v.env) * v.attackCoef; if (v.env > 1) v.env = 1; }
            else { v.env -= v.env * v.releaseCoef; if (v.env < 1e-4f) { v.active = false; continue; } }
            const float a = v.env * v.gain * v.vel;
            envMax = std::max(envMax, v.gate ? v.env : v.env * .5f);
            float prev = v.osc[kOsc - 1].last;
            for (int i = 0; i < kOsc; i++) {
                if (oscLevel[i] <= 0) continue;
                Osc& o = v.osc[i];
                const float inc = std::max(1e-6f, o.inc * (1 + fmIndex * prev));
                o.ph += inc; if (o.ph >= 1) o.ph -= 1;
                auto shape = [&](int w) {
                    switch (w) {
                        case 0: return 2 * o.ph - 1 - polyBlep(o.ph, inc);
                        case 1: { float y = o.ph < o.pw ? 1.f : -1.f; y += polyBlep(o.ph, inc); float t2 = o.ph + 1 - o.pw; if (t2 >= 1) t2 -= 1; return y - polyBlep(t2, inc); }
                        case 2: return 1 - 4 * std::fabs(o.ph - .5f);
                        default: return std::sin(kTwoPi * o.ph);
                    }
                };
                float y;
                if (waves[i] >= 5) {
                    // A wavetable from the recordings, gliding through its frames with the morph
                    const Wavetable* t = b ? &b->tables[std::min(kTables - 1, waves[i] - 5)] : nullptr;
                    if (t && t->frames > 0) {
                        const float fp = o.morph / 3 * (t->frames - 1); const int f0 = std::min(t->frames - 1, (int)fp), f1 = std::min(t->frames - 1, f0 + 1);
                        const float ff = fp - f0, pp = o.ph * Wavetable::N; const int i0 = (int)pp & (Wavetable::N - 1), i1 = (i0 + 1) & (Wavetable::N - 1);
                        const float fr = pp - (int)pp, *A = t->frame(o.level, f0), *B = t->frame(o.level, f1);
                        const float a0 = A[i0] + (A[i1] - A[i0]) * fr, b0 = B[i0] + (B[i1] - B[i0]) * fr;
                        y = (a0 + (b0 - a0) * ff) * 1.4f;
                    } else y = shape(0);
                } else if (waves[i] == 4) {
                    // Morph: sine -> triangle -> saw -> pulse, crossfading between neighbours
                    static const int order[4] = {3, 2, 0, 1};
                    const int m = std::min(2, (int)o.morph); const float f = o.morph - m;
                    y = shape(order[m]) * (1 - f) + shape(order[m + 1]) * f;
                } else y = shape(waves[i]);
                o.last = y; prev = y;
                bus[i] += v.of[i][1].low(v.of[i][0].low(y)) * a;
            }
            if (b) for (int f = 0; f < kFamilies; f++) {
                if (f == kTexture) continue;
                if ((layerLevel[f] <= 0 && !(f == kChoir && robotChoir)) || !b->has(f)) continue;
                bus[kOsc + f] += v.lf[f].low(renderGrains(v, f, *b)) * a;
            }
        }
        airFollow += (envMax - airFollow) * (envMax > airFollow ? .002f : .0004f);
        // Texture: one bed for the whole chord, swelling in and out slowly
        texEnv += (envMax - texEnv) * (envMax > texEnv ? .00004f : .00002f);
        if (b && layerLevel[kTexture] > 0 && b->has(kTexture) && texEnv > 1e-4f && voicing.chord.root >= 0) {
            texVoice.pitch = 48.f + voicing.chord.root;
            bus[kOsc + kTexture] += renderGrains(texVoice, kTexture, *b) * texEnv;
        }

        // Robot: the oscillators speak through the choir, or through machine words on the beat
        float robot = 0;
        if (robotAmt > .001f) {
            float car = 0;
            for (int i = 0; i < kOsc; i++) car += bus[i] * oscLevel[i];
            const int rv = (int)std::lround(p[RobotVoice]);
            float mod;
            if (rv == 2 && !extMod.empty()) {
                // Your own vocal, looped; while the song plays it follows the song position so a loop cut to bars stays in time
                const long long len = (long long)extMod.size();
                if (playing) extPos = (long long)(ppq * 60.0 / bpm * sr) % len; else if (++extPos >= len) extPos = 0;
                mod = extMod[(size_t)extPos] * 2;
            } else mod = robotChoir ? bus[kOsc + kChoir] * 3 : words.sample(playing ? ppq : -1, kWordLen[std::min(3, std::max(0, (int)std::lround(p[RobotRate])))], bpm) * .5f;
            robot = vocoder.process(mod, car) * oscNorm;
        }
        // The sources, each placed in the room
        float L = 0, R = 0;
        const float dry = 1 - .85f * robotAmt;
        for (int k = 0; k < kSources; k++) {
            float x;
            if (k < kOsc) { if (oscLevel[k] <= 0) continue; x = bus[k] * oscLevel[k] * oscNorm * dry; }
            else if (k < kRobotSrc) { const float lv = layerLevel[k - kOsc]; if (lv <= 0) continue; x = bus[k] * lv * kLayerGain[k - kOsc]; }
            else { if (robotAmt <= .001f) continue; x = robot * robotAmt * 1.2f; }
            x *= kVoiceBus;
            if (driveGain > 1.01f) x = std::tanh(x * driveGain) / driveGain;
            space[k].process(x, L, R);
            srcMeter[k] += (std::fabs(x) - srcMeter[k]) * .0005f;
        }
        L = dcL.run(hpL.run(L)); R = dcR.run(hpR.run(R));
        if (voxMix > .001f) {
            float fl = 0, fr = 0;
            for (int k = 0; k < 3; k++) { fl += formL[k].band(L) * kFormGain[k]; fr += formR[k].band(R) * kFormGain[k]; }
            L = L * (1 - .55f * voxMix) + fl * voxMix * 2.2f; R = R * (1 - .55f * voxMix) + fr * voxMix * 2.2f;
        }
        ensL.push(L); ensR.push(R);
        ensPh += .63f / (float)sr; if (ensPh >= 1) ensPh -= 1;
        ensFastPh += 5.7f / (float)sr; if (ensFastPh >= 1) ensFastPh -= 1;
        if (ensembleAmt > .001f) {
            float wl = 0, wr = 0;
            for (int k = 0; k < 3; k++) {
                const float a = kTwoPi * (ensPh + k / 3.f), f = kTwoPi * (ensFastPh + k / 3.f);
                wl += ensL.at((.006f + .0016f * std::sin(a) + .0002f * std::sin(f)) * (float)sr);
                wr += ensR.at((.006f + .0016f * std::sin(a + kPi / 3) + .0002f * std::sin(f + kPi / 3)) * (float)sr);
            }
            L = L * (1 - .5f * ensembleAmt) + wl * (1 / 3.f) * ensembleAmt * 1.1f;
            R = R * (1 - .5f * ensembleAmt) + wr * (1 / 3.f) * ensembleAmt * 1.1f;
        }
        {
            const float m = (L + R) * .5f, sd = (L - R) * .5f * widthAmt * 1.3f;
            L = m + sd; R = m - sd;
        }
        wowPh += .45f / (float)sr; if (wowPh >= 1) wowPh -= 1;
        flutPh += 6.3f / (float)sr; if (flutPh >= 1) flutPh -= 1;
        tapeL.push(L); tapeR.push(R);
        {
            const float d = (.003f + tape * (.0018f * std::sin(kTwoPi * wowPh) + .00012f * std::sin(kTwoPi * flutPh))) * (float)sr;
            L = tapeL.at(d); R = tapeR.at(d + tape * .00004f * (float)sr);
            const float k = 1 + 2.5f * tape;
            L = std::tanh(L * k) / k; R = std::tanh(R * k) / k;
            // hiss only when the tape is pushed: below about a third Analog gives warmth and wow without noise
            const float hiss = hissF.low(rng.bi()) * std::max(0.f, tape - .35f) * .006f;
            L += hiss; R += hiss * .9f;
        }
        L = pocketL.run(L); R = pocketR.run(R);
        // Air: noise tuned to the chord, and breath, rising and falling with the voices
        if (airLevel > .001f && airFollow > 1e-4f) {
            const float nl = rng.bi(), nr = rng.bi();
            float al = 0, ar = 0;
            // (a state-variable band-pass peaks at Q; times k brings the peak to 0 dB)
            for (int k = 0; k < airCount; k++) { al += airL[k].band(nl) * airL[k].k * airGain[k]; ar += airR[k].band(nr) * airR[k].k * airGain[k]; }
            const float bl = breathLpL.low(breathHpL.high(nl)), br = breathLpR.low(breathHpR.high(nr));
            const float g = airLevel * airFollow;
            L += (al * 3.f + bl * .4f * breathAmt) * g; R += (ar * 3.f + br * .4f * breathAmt) * g;
        }

        // Dub delay: ping-pong with the echoes getting darker and thinner each time round
        float yl = dubL.at(dubTime * (float)sr), yr = dubR.at(dubTime * (float)sr);
        {
            const float fb = .35f + .35f * dsend;
            const float back = dubHp.run(dubLp.run(yr));
            dubL.push(L * dsend * .7f + back * fb); dubR.push(yl * fb);
        }
        L += yl * dsend * .8f; R += yr * dsend * .8f;

        // Reverb with shimmer
        preL.push(L); preR.push(R);
        const float pre = .022f * (float)sr;
        const bool freeze = p[Freeze] > .5f;
        // The room starts above the bass, so the tail never booms or builds up DC
        const float inL = freeze ? 0 : revHpL.run(preL.at(pre)), inR = freeze ? 0 : revHpR.run(preR.at(pre));
        float o[8];
        fdnModPh += .37f / (float)sr; if (fdnModPh >= 1) fdnModPh -= 1;
        const float mod = std::sin(kTwoPi * fdnModPh) * .0008f * (float)sr;
        for (int k = 0; k < 8; k++) {
            float x = fdn[k].at(fdnLen[k] + (k == 0 ? mod : k == 3 ? -mod : 0));
            fdnLp[k] += (x - fdnLp[k]) * revDamp;
            o[k] = fdnLp[k];
        }
        const float outRevL = (o[0] + o[2] + o[4] + o[6]) * .3f, outRevR = (o[1] + o[3] + o[5] + o[7]) * .3f;
        float h[8]; std::memcpy(h, o, sizeof h); hadamard8(h);
        for (int k = 0; k < 8; k++) fdn[k].push(((k & 1) ? inR : inL) * .5f + ((k & 2) ? -shimFb : shimFb) * .5f + h[k] * fdnGk[k]);
        // Shimmer: the tail pitched up an octave and fed back in
        shimBuf.push(outRevL + outRevR);
        {
            shimPh -= 1.f / (.1f * (float)sr); if (shimPh < 0) shimPh += 1;
            const float W = .1f * (float)sr, a = shimPh, b2 = shimPh + .5f >= 1 ? shimPh - .5f : shimPh + .5f;
            const float w1 = std::sin(kPi * a), w2 = std::sin(kPi * b2);
            const float y = shimBuf.at(1 + W * a) * w1 * w1 + shimBuf.at(1 + W * b2) * w2 * w2;
            shimFb = freeze ? 0 : shimHp.run(y) * shimmerAmt * .3f;
        }
        L = L * (1 - .3f * rev) + outRevL * rev * 1.1f;
        R = R * (1 - .3f * rev) + outRevR * rev * 1.1f;

        // Fundament: a sine that lands on bar one and fades under the chord
        float sv = 0;
        if (sub.env > 1e-5f || sub.attacking) {
            if (sub.attacking) { sub.env += 1.f / sub.attackLen; if (sub.env >= 1) { sub.env = 1; sub.attacking = false; } }
            else sub.env *= sub.decay;
            sub.ph += sub.freq / sr; if (sub.ph >= 1) sub.ph -= 1;
            sv = std::tanh(std::sin(kTwoPi * (float)sub.ph) * subDrive) * subNorm * sub.env * fund * .5f;
        }
        L = (L + sv) * level; R = (R + sv) * level;

        // Look-ahead limiter: never above -1 dBFS
        const float pk = std::max(std::fabs(L), std::fabs(R));
        limGain[limPos] = pk > ceiling ? ceiling / pk : 1.f;
        limBufL[limPos] = L; limBufR[limPos] = R;
        float g = 1;
        for (int k = 0; k < limLen; k++) g = std::min(g, limGain[k]);
        limEnv += (g - limEnv) * (g < limEnv ? .3f : relCoef);
        limPos = (limPos + 1) % limLen;
        outL[s] = clampf(limBufL[limPos] * limEnv, -ceiling, ceiling);
        outR[s] = clampf(limBufR[limPos] * limEnv, -ceiling, ceiling);
    }
}

}  // namespace ds
