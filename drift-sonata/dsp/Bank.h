// The sound bank: 533 sounds, numbered like STAB LAB's.
//  - 333 variations of the factory sounds: each nudges its base a little, then leans the way its word says.
//  - 200 clean electronic sounds, designed from ten archetypes and varied hard in sound, effects and 3D. No air, no
//    tape hiss and no recorded layers: only oscillators (classic, morph, and the wavetables, which are rebuilt from
//    harmonics and carry no noise).
// Every other sound is a clean electronic one, so noise never piles up in a row. Each sound also gets a level trim
// (BankLevels.h, measured by tools/level_bank.cpp) so the sounds come out about equally loud.
#pragma once
#include <algorithm>
#include <cmath>
#include <cstdint>
#include <string>
#include <unordered_map>
#include <vector>

#include "BankLevels.h"
#include "Presets.h"

namespace ds {

struct BankSound { std::string name; bool clean = false; Values values{}; };

// The same small random generator as the web page (mulberry32), so both build identical sounds.
struct Rng32 {
    uint32_t s;
    explicit Rng32(uint32_t seed) : s(seed) {}
    double operator()() {
        s += 0x6D2B79F5u;
        uint32_t x = (s ^ (s >> 15)) * (1u | s);
        x = (x + ((x ^ (x >> 7)) * (61u | x))) ^ x;
        return (double)(x ^ (x >> 14)) / 4294967296.0;
    }
};

inline int paramIndex(const std::string& id) {
    static const std::unordered_map<std::string, int> map = [] {
        std::unordered_map<std::string, int> m;
        for (int k = 0; k < COUNT; k++) m[params()[k].id] = k;
        return m;
    }();
    auto it = map.find(id);
    return it == map.end() ? -1 : it->second;
}

namespace bank_detail {

struct Setter {
    Values& v;
    void set(const std::string& id, double x) const {
        const int k = paramIndex(id); if (k < 0) return;
        const ParamInfo& p = params()[k];
        v[k] = (float)std::min((double)p.max, std::max((double)p.min, x));
    }
    double get(const std::string& id) const { const int k = paramIndex(id); return k < 0 ? 0 : v[k]; }
};

inline const char* const kWords[9] = {"", "Pearl", "Gilded", "Low tide", "Night choir", "Glass hall", "Sour milk", "Moonwax", "Orbit"};

inline Values variation(const Preset& base, int w, uint32_t seed) {
    Values vals = presetValues(base);
    if (!w) return vals;
    Rng32 R(seed); Setter s{vals};
    const bool clean = std::string(base.group) == "Electronic";
    const std::pair<const char*, double> nudges[] = {{"drift", .15}, {"tension", .12}, {"cutoff", .08}, {"space", .12}, {"subdrop", .12},
                                                     {"tape", .12}, {"air", .1}, {"motion", .2}, {"chaos", .2}, {"shimmer", .15}};
    for (const auto& n : nudges) {
        if (clean && (std::string(n.first) == "tape" || std::string(n.first) == "air")) continue;  // the electronic sounds stay free of noise
        s.set(n.first, s.get(n.first) + (R() * 2 - 1) * n.second);
    }
    if (clean) {
        switch (w) {
            case 1: s.set("shimmer", s.get("shimmer") + .25); s.set("cutoff", s.get("cutoff") + .06); break;
            case 2: s.set("color", 0); s.set("ensemble", 1); break;
            case 3: s.set("subdrop", s.get("subdrop") + .25); s.set("o6oct", -1); break;
            case 4: s.set("o5wave", 4); s.set("o6wave", 4); s.set("motion", s.get("motion") + .2); break;
            case 5: s.set("space", s.get("space") + .25); s.set("o5wave", 2); s.set("o6wave", 3); break;
            case 6: s.set("drift", s.get("drift") + .3); s.set("life", .8); break;
            case 7: s.set("color", 1); s.set("cutoff", s.get("cutoff") - .1); s.set("attack", std::max(s.get("attack"), 1.6)); break;
            case 8: s.set("orbit", s.get("orbit") + .4); s.set("orbitspeed", s.get("orbitspeed") + .2); s.set("overhead", s.get("overhead") + .3); break;
        }
        return vals;
    }
    switch (w) {
        case 1: s.set("choir", s.get("choir") + .25); s.set("cutoff", s.get("cutoff") + .05); break;
        case 2: s.set("color", 0); s.set("ensemble", 1); s.set("shimmer", s.get("shimmer") + .2); break;
        case 3: s.set("subdrop", s.get("subdrop") + .25); s.set("cutoff", s.get("cutoff") - .08); s.set("o6oct", -1); break;
        case 4: s.set("vox", s.get("vox") + .35); s.set("vowel", R() * .4); break;
        case 5: s.set("space", s.get("space") + .25); s.set("o5wave", 2); s.set("o6wave", 3); break;
        case 6: s.set("drift", s.get("drift") + .3); s.set("life", .8); s.set("tape", s.get("tape") + .2); break;
        case 7: s.set("cello", s.get("cello") + .3); s.set("color", 1); s.set("attack", std::max(s.get("attack"), 1.6)); break;
        case 8: s.set("orbit", s.get("orbit") + .4); s.set("orbitspeed", s.get("orbitspeed") + .2); s.set("overhead", s.get("overhead") + .3); break;
    }
    return vals;
}

struct Range { const char* id; double a, b; };
struct Archetype { std::vector<int> waves; std::vector<Range> lean; };

inline const std::vector<Archetype>& archetypes() {
    static const std::vector<Archetype> a = {
        {{3, 2, 3, 2, 4}, {{"cutoff", .7, .95}, {"shimmer", .3, .8}, {"space", .5, .9}, {"cross", 0, .15}}},                 // glass
        {{1, 1, 0, 1}, {{"pwm", .5, 1}, {"cutoff", .45, .75}, {"filtermotion", .4, .9}, {"drift", .3, .7}}},                 // neon pulse
        {{4, 4, 4, 2}, {{"motion", .5, 1}, {"life", .5, 1}, {"orbit", .5, 1}, {"space", .5, .9}}},                           // morph cloud
        {{0, 0, 0, 0, 1}, {{"ensemble", .7, 1}, {"cutoff", .55, .8}, {"drift", .2, .6}}},                                    // clean machine
        {{5, 6, 7, 8, 9, 9}, {{"cutoff", .6, .9}, {"life", .4, .9}, {"drift", .2, .6}}},                                     // wavetable
        {{3, 3, 2}, {{"cross", .3, .7}, {"cutoff", .75, 1}, {"attack", .01, .3}, {"release", 2, 7}}},                        // fm bell
        {{0, 2, 3, 4, 9}, {{"cutoff", .3, .5}, {"subdrop", .6, 1}, {"tension", .2, .5}, {"drift", .4, .9}}},                 // dark drone
        {{4, 1, 3, 2}, {{"orbit", .8, 1}, {"orbitspeed", .5, 1}, {"overhead", .5, 1}, {"chaos", .3, .8}}},                   // orbit storm
        {{0, 1, 4, 3}, {{"delay", .35, .7}, {"space", .6, .95}, {"cutoff", .45, .7}}},                                       // dub space
        {{2, 3, 6, 9}, {{"shimmer", .6, 1}, {"space", .75, 1}, {"attack", 1, 4}, {"cutoff", .6, .9}}},                       // frozen glass
    };
    return a;
}

inline Values generated(int gen, uint32_t seed) {
    Values vals = defaults();
    Rng32 R(seed); Setter s{vals};
    auto r = [&](double a, double b) { return a + R() * (b - a); };
    auto pick = [&](const std::vector<double>& v) { return v[(size_t)std::floor(R() * v.size())]; };
    const Archetype& arch = archetypes()[gen % archetypes().size()];
    std::vector<double> waves(arch.waves.begin(), arch.waves.end());
    const int count = 3 + (int)std::floor(R() * 4);
    static const std::vector<std::vector<double>> octChoices = {{0, 0, 0, 0, 1, -1}, {0, 0, 1, 1, 2, -1}, {-1, 0, 0, 1, 1, 0}, {0, 0, 0, 0, 0, 1}, {0, 7 / 12., 0, 0, 1, -1}};
    const std::vector<double>& octs = octChoices[(size_t)std::floor(R() * octChoices.size())];
    for (int o = 1; o <= 6; o++) {
        const std::string n = "o" + std::to_string(o);
        s.set(n + "on", o <= count ? 1 : 0); s.set(n + "wave", pick(waves));
        const double oc = octs[o - 1];
        s.set(n + "oct", std::round(oc));
        s.set(n + "semi", std::fmod(oc, 1) != 0 ? 7 : (R() < .1 ? pick({7, -5, 12}) : 0));
        s.set(n + "level", r(.35, .9)); s.set(n + "pan", r(-1, 1)); s.set(n + "fine", R() < .3 ? r(-12, 12) : 0);
    }
    // sound, harmony, movement, effects and the 3D room, all varied widely
    static const Range wide[] = {{"drift", .1, .8}, {"tension", .3, .9}, {"subdrop", 0, .8}, {"space", .2, .95}, {"cutoff", .45, .9}, {"resonance", 0, .55},
        {"filtermotion", 0, .8}, {"attack", .05, 2.5}, {"release", 1, 7}, {"pwm", 0, .9}, {"cross", 0, .3}, {"chaos", 0, .7}, {"life", .2, .9}, {"motion", .1, .9},
        {"ensemble", 0, 1}, {"width", .6, 1}, {"shimmer", 0, .7}, {"size", .2, .95}, {"delay", 0, .45}, {"orbit", 0, 1}, {"orbitspeed", .05, .8}, {"distance", 0, .8},
        {"overhead", 0, .8}, {"space3d", .5, 1}, {"vox", 0, .25}, {"vowel", 0, 1}, {"drive", 0, .4}, {"tape", 0, .3}, {"glide", 0, .3}, {"unfold", .2, 2.5}};
    for (const Range& w : wide) s.set(w.id, r(w.a, w.b));
    for (const Range& w : arch.lean) s.set(w.id, r(w.a, w.b));
    s.set("color", pick({0, 0, 1, 1, 2, 3, 4})); s.set("delaytime", std::floor(R() * 5)); s.set("motionbars", std::floor(R() * 4));
    for (const char* id : {"air", "choir", "cello", "stringlayer", "brass", "texture", "robot"}) s.set(id, 0);
    // some get a sub rhythm instead of bar one only (drawn last, so the rest of the sound stays as it was)
    s.set("subrhythm", pick({0, 0, 0, 0, 1, 2, 3, 4, 5, 6}));
    return vals;
}

}  // namespace bank_detail

inline const std::vector<BankSound>& soundBank() {
    static const std::vector<BankSound> bank = [] {
        using namespace bank_detail;
        const auto& pr = presets();
        std::vector<BankSound> varied, clean, out;
        for (int i = 0; i < 333; i++) {
            const Preset& base = pr[i % pr.size()];
            const int v = i / (int)pr.size(), w = v ? ((v - 1) % 8) + 1 : 0;
            BankSound b; b.name = std::string(base.name) + (w ? std::string(" · ") + kWords[w] : "");
            b.clean = std::string(base.group) == "Electronic"; b.values = variation(base, w, 171u + (uint32_t)i * 77u);
            varied.push_back(std::move(b));
        }
        static const char* film[] = {"The {} Who Fell to Earth", "Eternal Sunshine of the {}", "Do Androids Dream of {}?", "Blade {}", "2001: A {} Odyssey",
            "Close Encounters of the {} Kind", "The {} Identity", "Lost in {}", "Everything Everywhere All at {}", "The Grand {} Hotel", "A Clockwork {}",
            "The {} Strikes Back", "Back to the {}", "Mulholland {}", "The Shape of {}", "Once Upon a Time in {}", "The Spy Who Loved {}", "Interstellar {}",
            "The {} Supremacy", "Fjord of the {}", "The Silence of the {}", "Pulp {}", "No Country for Old {}", "The {} of Wall Street", "Fear and {} in Las Vegas",
            "The Good, the Bad & the {}", "Breakfast at {}", "Apocalypse {}", "The {} Runner", "Solaris {}"};
        static const char* stuff[] = {"Sine", "Prism", "Neon", "Chrome", "Glass", "Mercury", "Ozone", "Quartz", "Satellite", "Vapour", "Circuit", "Halo", "Pulse",
            "Ion", "Nebula", "Orbit", "Phase", "Lumen", "Saturn", "Comet", "Laser", "Polar Light", "Magnets", "Silicon", "Crystal", "Aurora", "Pixels", "Gravity",
            "Signals", "Moonbeams", "Plasma", "Frost", "Velvet Code", "Starlight", "Hologram", "Cobalt", "Diamonds", "Lightyears", "Ultraviolet", "Mirrors"};
        const int nf = sizeof film / sizeof *film, ns = sizeof stuff / sizeof *stuff;
        Rng32 R(20261028u);
        std::vector<std::string> seen;
        for (int i = 0; clean.size() < 200 && i < 5000; i++) {
            std::string t = film[(int)std::floor(R() * nf)];
            const std::string w = stuff[(int)std::floor(R() * ns)];
            t.replace(t.find("{}"), 2, w);
            if (std::find(seen.begin(), seen.end(), t) != seen.end()) continue;
            seen.push_back(t);
            BankSound b; b.name = t; b.clean = true;
            b.values = generated((int)clean.size(), 9000u + (uint32_t)clean.size() * 131u);
            clean.push_back(std::move(b));
        }
        size_t a = 0, c = 0;
        for (int i = 0; a < varied.size() || c < clean.size(); i++) {
            if (i % 2 == 0 && a < varied.size()) out.push_back(varied[a++]);
            else if (c < clean.size()) out.push_back(clean[c++]);
            else out.push_back(varied[a++]);
        }
        // each sound its own Life patterns
        for (size_t i = 0; i < out.size(); i++) out[i].values[LifeSeed] = (float)(i + 1);
        // level trims, measured
        for (size_t i = 0; i < out.size() && i < sizeof kBankTrim / sizeof *kBankTrim; i++) out[i].values[Trim] = kBankTrim[i];
        return out;
    }();
    return bank;
}

}  // namespace ds
