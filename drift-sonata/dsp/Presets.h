// Factory sounds. Each starts from the defaults and changes what makes it itself.
#pragma once
#include <utility>
#include <vector>

#include "Params.h"

namespace ds {

struct Preset { const char* name; const char* group; std::vector<std::pair<int, float>> set; };

inline int O(int osc, int field) { return oscParam(osc - 1, field); }
enum { On = 0, Wave = 1, Oct = 2, Semi = 3, Fine = 4, Lvl = 5, Pan = 6 };
enum { Saw = 0, Pulse = 1, Tri = 2, Sine = 3 };

inline const std::vector<Preset>& presets() {
    static const std::vector<Preset> list = {
        {"Sonata", "Strings", {}},
        {"Solina", "Strings", {{Drift, .3f}, {Tension, .35f}, {ChordColor, 2}, {Choir, 0}, {Cello, 0}, {Vox, 0}, {Ensemble, 1}, {Cutoff, .7f},
                               {O(5, Wave), Saw}, {O(5, Oct), 1}, {O(6, Oct), 1}, {O(5, Lvl), .5f}, {O(6, Lvl), .5f}, {Attack, .35f}}},
        {"Sour Solina", "Strings", {{Drift, .85f}, {Life, .7f}, {Tension, .6f}, {ChordColor, 1}, {Choir, 0}, {Cello, .1f}, {Vox, 0}, {Ensemble, 1}, {Cutoff, .6f},
                                    {O(5, Wave), Saw}, {O(5, Oct), 1}, {O(6, Oct), 1}, {O(5, Lvl), .5f}, {O(6, Lvl), .45f}, {Tape, .45f}}},
        {"Orbit Lift", "Strings", {{Drift, .35f}, {Tension, .65f}, {ChordColor, 0}, {Ensemble, .85f}, {Cutoff, .72f}, {Space, .55f}, {Choir, .2f}, {Attack, .5f}}},
        {"Clockwork Choir", "Choir", {{ChordColor, 4}, {Drift, .2f}, {Tension, .4f}, {Choir, .5f}, {Vox, .35f}, {Vowel, .55f}, {Ensemble, .3f}, {Cutoff, .55f},
                                      {Space, .45f}, {Tape, .15f}, {O(5, Wave), Pulse}, {O(6, Lvl), .2f}}},
        {"Isotope Hum", "Choir", {{ChordColor, 3}, {Drift, .25f}, {Tension, .5f}, {Vox, .75f}, {Vowel, .15f}, {Choir, .5f}, {Cello, 0}, {Cutoff, .5f}, {Space, .55f},
                                  {Tape, .35f}, {Air, .1f}, {O(1, Wave), Pulse}, {O(2, Wave), Pulse}, {Pwm, .7f}}},
        {"Cosmic Mellotron", "Choir", {{ChordColor, 2}, {Choir, .55f}, {Cello, .3f}, {Vox, .2f}, {Cutoff, .5f}, {FilterMotion, .7f}, {Motion, .8f}, {Space, .7f},
                                       {Shimmer, .45f}, {Tape, .45f}, {Drift, .45f}}},
        {"Burnt Tape", "Dark", {{ChordColor, 1}, {Tape, .85f}, {Drift, .55f}, {Cello, .55f}, {Choir, .15f}, {Cutoff, .45f}, {Space, .45f}, {Delay, .25f},
                                {SubDrop, .35f}, {Pocket, .35f}}},
        {"Dark Waves", "Dark", {{ChordColor, 1}, {Drift, .75f}, {Tension, .62f}, {Cutoff, .45f}, {Chaos, .5f}, {SubDrop, .65f}, {Space, .55f}, {Tape, .4f},
                                {O(5, Wave), Pulse}, {O(6, Oct), -1}, {O(6, Lvl), .45f}, {Choir, .1f}}},
        {"Witch Glass", "Dark", {{ChordColor, 1}, {Drift, 1}, {Life, .8f}, {Tension, .8f}, {Tape, .7f}, {Cutoff, .4f}, {Chaos, .7f}, {Cross, .3f}, {Delay, .3f},
                                 {Choir, .35f}, {Vox, .3f}, {Vowel, .1f}}},
        {"Shoegaze Halo", "Space", {{ChordColor, 0}, {Space, .85f}, {Shimmer, .65f}, {Ensemble, .8f}, {Width, 1}, {Motion, .6f}, {Drift, .4f}, {Air, .3f},
                                    {Cutoff, .66f}}},
        {"Dub Cathedral", "Space", {{ChordColor, 2}, {Space, .85f}, {Delay, .45f}, {Shimmer, .55f}, {Air, .4f}, {Motion, .7f}, {Drift, .35f}, {SubDrop, .6f},
                                    {Choir, .4f}}},
        {"Granular Fog", "Space", {{Choir, .7f}, {Cello, .5f}, {Air, .5f}, {Space, .9f}, {Cutoff, .4f}, {Motion, .8f}, {Drift, .5f}, {Attack, 2.5f}}},
        {"Warm Drone", "Space", {{Tension, .2f}, {SubDrop, .8f}, {Cutoff, .35f}, {Drift, .5f}, {Space, .6f}, {FundFade, 6}, {Attack, 1.8f}, {Cello, .35f}}},
    };
    return list;
}

inline Values presetValues(const Preset& pr) {
    Values v = defaults();
    for (const auto& kv : pr.set) v[kv.first] = kv.second;
    return v;
}

}  // namespace ds
