// Every parameter in one table: the plugin, the presets and the render tool all read it from here.
#pragma once
#include <array>
#include <vector>

namespace ds {

enum P {
    // The four main knobs, then the colour cards
    Drift, Tension, SubDrop, Space, Intensity, Tape, Air,
    // Six oscillators: on, wave, octave, semitone, fine, level, pan
    O1On, O1Wave, O1Oct, O1Semi, O1Fine, O1Level, O1Pan,
    O2On, O2Wave, O2Oct, O2Semi, O2Fine, O2Level, O2Pan,
    O3On, O3Wave, O3Oct, O3Semi, O3Fine, O3Level, O3Pan,
    O4On, O4Wave, O4Oct, O4Semi, O4Fine, O4Level, O4Pan,
    O5On, O5Wave, O5Oct, O5Semi, O5Fine, O5Level, O5Pan,
    O6On, O6Wave, O6Oct, O6Semi, O6Fine, O6Level, O6Pan,
    // Tone and movement
    Cutoff, Resonance, FilterMotion, Attack, Release, Pwm, Cross, Chaos, Life, Drive,
    // Layers
    Choir, Cello, Vox, Vowel, StringLayer, BrassLayer, TextureLayer,
    // Harmony
    Expand, ChordColor, Key, KeyMinor, KeepBass, Unfold, Glide,
    // Fundament
    FundFade, FundFollow, FundRoot,
    // Space
    Ensemble, Width, Shimmer, Size, Freeze, Delay, DelayTime, Pocket, Motion, MotionBars, Level,
    // 3D orbit and the vocoder
    Orbit, OrbitSpeed, Distance, Overhead, Space3D, Robot, RobotVoice, RobotRate,
    COUNT
};

constexpr int kOscParams = 7;
inline int oscParam(int osc, int field) { return O1On + osc * kOscParams + field; }  // field: 0 on .. 6 pan

enum class Kind { Float, Int, Bool, Choice };

struct ParamInfo {
    const char* id;
    const char* name;
    Kind kind;
    float min, max, def;
    float skewCentre;  // value that sits in the middle of the knob (0 = linear)
    const char* unit;
    std::vector<const char*> choices;
};

inline const std::vector<ParamInfo>& params() {
    static const std::vector<ParamInfo> t = [] {
        std::vector<ParamInfo> v(COUNT);
        auto f = [&](P p, const char* id, const char* name, float lo, float hi, float d, float skew = 0, const char* unit = "") { v[p] = {id, name, Kind::Float, lo, hi, d, skew, unit, {}}; };
        auto i = [&](P p, const char* id, const char* name, float lo, float hi, float d) { v[p] = {id, name, Kind::Int, lo, hi, d, 0, "", {}}; };
        auto b = [&](P p, const char* id, const char* name, bool d) { v[p] = {id, name, Kind::Bool, 0, 1, d ? 1.f : 0.f, 0, "", {}}; };
        auto c = [&](P p, const char* id, const char* name, std::vector<const char*> ch, int d) { v[p] = {id, name, Kind::Choice, 0, (float)ch.size() - 1, (float)d, 0, "", ch}; };

        // Drift: how far the oscillators wander and beat against each other. Tension: how far the chord is folded
        // out and how its intervals are tuned (pure below the middle, pushed apart above). Sub-Drop: the bass note
        // on bar one. Space: room, shimmer and echoes.
        f(Drift, "drift", "Drift", 0, 1, .4f);
        f(Tension, "tension", "Tension", 0, 1, .55f);
        f(SubDrop, "subdrop", "Sub-Drop", 0, 1, .55f);
        f(Space, "space", "Space", 0, 1, .5f);
        f(Intensity, "intensity", "Intensity", 0, 1, 1);
        f(Tape, "tape", "Analog", 0, 1, .3f);
        f(Air, "air", "Air", 0, 1, .35f);

        static const char* oscIds[6][7] = {
            {"o1on", "o1wave", "o1oct", "o1semi", "o1fine", "o1level", "o1pan"}, {"o2on", "o2wave", "o2oct", "o2semi", "o2fine", "o2level", "o2pan"},
            {"o3on", "o3wave", "o3oct", "o3semi", "o3fine", "o3level", "o3pan"}, {"o4on", "o4wave", "o4oct", "o4semi", "o4fine", "o4level", "o4pan"},
            {"o5on", "o5wave", "o5oct", "o5semi", "o5fine", "o5level", "o5pan"}, {"o6on", "o6wave", "o6oct", "o6semi", "o6fine", "o6level", "o6pan"}};
        static const char* oscNames[6][7] = {
            {"Osc 1 on", "Osc 1 wave", "Osc 1 octave", "Osc 1 semitone", "Osc 1 fine", "Osc 1 level", "Osc 1 pan"},
            {"Osc 2 on", "Osc 2 wave", "Osc 2 octave", "Osc 2 semitone", "Osc 2 fine", "Osc 2 level", "Osc 2 pan"},
            {"Osc 3 on", "Osc 3 wave", "Osc 3 octave", "Osc 3 semitone", "Osc 3 fine", "Osc 3 level", "Osc 3 pan"},
            {"Osc 4 on", "Osc 4 wave", "Osc 4 octave", "Osc 4 semitone", "Osc 4 fine", "Osc 4 level", "Osc 4 pan"},
            {"Osc 5 on", "Osc 5 wave", "Osc 5 octave", "Osc 5 semitone", "Osc 5 fine", "Osc 5 level", "Osc 5 pan"},
            {"Osc 6 on", "Osc 6 wave", "Osc 6 octave", "Osc 6 semitone", "Osc 6 fine", "Osc 6 level", "Osc 6 pan"}};
        // A string-machine start: four saws, a pulse, and a saw an octave up.
        const int waves[6] = {0, 0, 0, 0, 1, 0}, octs[6] = {0, 0, 0, 0, 0, 1};
        const float levels[6] = {.8f, .8f, .7f, .7f, .55f, .35f}, pans[6] = {-.7f, .7f, -.3f, .3f, 0, 0};
        for (int o = 0; o < 6; o++) {
            P base = (P)oscParam(o, 0);
            b(base, oscIds[o][0], oscNames[o][0], true);
            c((P)(base + 1), oscIds[o][1], oscNames[o][1], {"Saw", "Pulse", "Triangle", "Sine", "Morph", "Cello", "Choir", "Strings", "Brass", "Chimera"}, waves[o]);
            i((P)(base + 2), oscIds[o][2], oscNames[o][2], -2, 2, (float)octs[o]);
            i((P)(base + 3), oscIds[o][3], oscNames[o][3], -12, 12, 0);
            f((P)(base + 4), oscIds[o][4], oscNames[o][4], -50, 50, 0, 0, "ct");
            f((P)(base + 5), oscIds[o][5], oscNames[o][5], 0, 1, levels[o]);
            f((P)(base + 6), oscIds[o][6], oscNames[o][6], -1, 1, pans[o]);
        }

        f(Cutoff, "cutoff", "Cutoff", 0, 1, .62f);
        f(Resonance, "resonance", "Resonance", 0, 1, .15f);
        f(FilterMotion, "filtermotion", "Filter motion", 0, 1, .35f);
        f(Attack, "attack", "Attack", .005f, 12, .9f, 1.2f, "s");
        f(Release, "release", "Release", .05f, 20, 3, 3, "s");
        f(Pwm, "pwm", "PWM", 0, 1, .45f);
        f(Cross, "cross", "Cross-mod", 0, 1, .12f);
        f(Chaos, "chaos", "Chaos", 0, 1, .25f);
        f(Life, "life", "Drift speed", 0, 1, .55f);
        f(Drive, "drive", "Drive", 0, 1, .2f);

        f(Choir, "choir", "Choir", 0, 1, .3f);
        f(Cello, "cello", "Cello", 0, 1, .2f);
        f(Vox, "vox", "Vox", 0, 1, .15f);
        f(Vowel, "vowel", "Vowel", 0, 1, .3f);
        f(StringLayer, "stringlayer", "Strings", 0, 1, .2f);
        f(BrassLayer, "brass", "Brass", 0, 1, 0);
        f(TextureLayer, "texture", "Texture", 0, 1, .2f);

        c(Expand, "expand", "Expand", {"Auto", "As played", "Octave & fifth", "Seventh", "Five notes", "Eleven & thirteen"}, 0);
        c(ChordColor, "color", "Colour", {"Bright", "Dark", "Neutral", "Kraftwerk", "Carlos"}, 0);
        c(Key, "key", "Key", {"Off", "C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"}, 0);
        b(KeyMinor, "keyminor", "Minor key", false);
        b(KeepBass, "keepbass", "Keep bass", false);
        f(Unfold, "unfold", "Unfold", 0, 4, 1.2f, 1, "s");
        f(Glide, "glide", "Glide", 0, 1, .15f, .2f, "s");

        f(FundFade, "fundfade", "Sub fade", .5f, 8, 3, 0, "beats");
        b(FundFollow, "fundfollow", "Sub follows chord changes", false);
        c(FundRoot, "fundroot", "Sub note", {"Root", "Lowest"}, 0);

        f(Ensemble, "ensemble", "Ensemble", 0, 1, .6f);
        f(Width, "width", "Width", 0, 1, .75f);
        f(Shimmer, "shimmer", "Shimmer", 0, 1, .4f);
        f(Size, "size", "Size", 0, 1, .6f);
        b(Freeze, "freeze", "Freeze", false);
        f(Delay, "delay", "Dub delay", 0, 1, .1f);
        c(DelayTime, "delaytime", "Delay time", {"1/4", "1/8 dotted", "1/8", "3/16", "1/2"}, 1);
        f(Pocket, "pocket", "Vocal pocket", 0, 1, .2f);
        f(Motion, "motion", "Motion", 0, 1, .45f);
        c(MotionBars, "motionbars", "Motion bars", {"4", "8", "16", "32"}, 2);
        f(Level, "level", "Level", -24, 6, 0, 0, "dB");

        // Each oscillator, the choir, the cello and the robot is its own sound source around the listener's head.
        f(Orbit, "orbit", "Orbit", 0, 1, .35f);
        f(OrbitSpeed, "orbitspeed", "Orbit speed", 0, 1, .3f);
        f(Distance, "distance", "Distance", 0, 1, .3f);
        f(Overhead, "overhead", "Overhead", 0, 1, .3f);
        f(Space3D, "space3d", "Binaural", 0, 1, .85f);
        f(Robot, "robot", "Robot", 0, 1, 0);
        c(RobotVoice, "robotvoice", "Robot voice", {"Choir", "Machine words"}, 0);
        c(RobotRate, "robotrate", "Words", {"1/2", "1/4", "1/8", "1/16"}, 2);
        return v;
    }();
    return t;
}

using Values = std::array<float, COUNT>;

inline Values defaults() {
    Values v{};
    for (int k = 0; k < COUNT; k++) v[k] = params()[k].def;
    return v;
}

}  // namespace ds
