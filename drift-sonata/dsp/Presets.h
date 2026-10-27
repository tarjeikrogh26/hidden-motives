// Factory sounds, named like films (as in STAB LAB). Each starts from the defaults and changes what makes it itself.
#pragma once
#include <utility>
#include <vector>

#include "Params.h"

namespace ds {

struct Preset { const char* name; const char* group; std::vector<std::pair<int, float>> set; };

inline int O(int osc, int field) { return oscParam(osc - 1, field); }
enum { On = 0, Wave = 1, Oct = 2, Semi = 3, Fine = 4, Lvl = 5, Pan = 6 };
enum { Saw = 0, Pulse = 1, Tri = 2, Sine = 3, MorphW = 4, TCello = 5, TChoir = 6, TStrings = 7, TBrass = 8, TChimera = 9 };

inline const std::vector<Preset>& presets() {
    static const std::vector<Preset> list = {
        {"Sonata in Drift Minor", "Strings", {}},
        {"Solina Solaris", "Strings", {{Drift, .3f}, {Tension, .35f}, {ChordColor, 2}, {Choir, 0}, {Cello, 0}, {Vox, 0}, {Ensemble, 1}, {Cutoff, .7f},
                               {O(5, Wave), Saw}, {O(5, Oct), 1}, {O(6, Oct), 1}, {O(5, Lvl), .5f}, {O(6, Lvl), .5f}, {Attack, .35f}}},
        {"The Sour of the Lambs", "Strings", {{Drift, .85f}, {Life, .7f}, {Tension, .6f}, {ChordColor, 1}, {Choir, 0}, {Cello, .1f}, {Vox, 0}, {Ensemble, 1}, {Cutoff, .6f},
                                    {O(5, Wave), Saw}, {O(5, Oct), 1}, {O(6, Oct), 1}, {O(5, Lvl), .5f}, {O(6, Lvl), .45f}, {Tape, .45f}}},
        {"Fjord of the Strings", "Strings", {{Drift, .35f}, {Tension, .7f}, {ChordColor, 0}, {Choir, .45f}, {Cello, .35f}, {Space, .7f}, {Shimmer, .5f},
                                             {Attack, 1.4f}, {Air, .25f}, {Cutoff, .66f}}},
        {"2001: A Space Ensemble", "Strings", {{Drift, .35f}, {Tension, .65f}, {ChordColor, 0}, {Ensemble, .85f}, {Cutoff, .72f}, {Space, .55f}, {Choir, .2f}, {Attack, .5f}}},
        {"A Clockwork Choir", "Choir", {{ChordColor, 4}, {Drift, .2f}, {Tension, .4f}, {Choir, .5f}, {Vox, .35f}, {Vowel, .55f}, {Ensemble, .3f}, {Cutoff, .55f},
                                      {Space, .45f}, {Tape, .15f}, {O(5, Wave), Pulse}, {O(6, Lvl), .2f}}},
        {"Dr. Strangechord", "Choir", {{ChordColor, 3}, {Drift, .25f}, {Tension, .5f}, {Vox, .75f}, {Vowel, .15f}, {Choir, .5f}, {Cello, 0}, {Cutoff, .5f}, {Space, .55f},
                                  {Tape, .35f}, {Air, .3f}, {O(1, Wave), Pulse}, {O(2, Wave), Pulse}, {Pwm, .7f}}},
        {"Mellotron Drive", "Choir", {{ChordColor, 2}, {Choir, .55f}, {Cello, .3f}, {Vox, .2f}, {Cutoff, .5f}, {FilterMotion, .7f}, {Motion, .8f}, {Space, .7f},
                                       {Shimmer, .45f}, {Tape, .45f}, {Drift, .45f}}},
        {"Lost in Saturation", "Dark", {{ChordColor, 1}, {Tape, .85f}, {Drift, .55f}, {Cello, .55f}, {Choir, .15f}, {Cutoff, .45f}, {Space, .45f}, {Delay, .25f},
                                {SubDrop, .35f}, {Pocket, .35f}}},
        {"Only Drifters Left Alive", "Dark", {{ChordColor, 1}, {Drift, .75f}, {Tension, .62f}, {Cutoff, .45f}, {Chaos, .5f}, {SubDrop, .65f}, {Space, .55f}, {Tape, .4f},
                                {O(5, Wave), Pulse}, {O(6, Oct), -1}, {O(6, Lvl), .45f}, {Choir, .1f}}},
        {"The Fall of the Witch House", "Dark", {{ChordColor, 1}, {Drift, 1}, {Life, .8f}, {Tension, .8f}, {Tape, .7f}, {Cutoff, .4f}, {Chaos, .7f}, {Cross, .3f}, {Delay, .3f},
                                 {Choir, .35f}, {Vox, .3f}, {Vowel, .1f}}},
        {"Shoegaze in Venice", "Space", {{ChordColor, 0}, {Space, .85f}, {Shimmer, .65f}, {Ensemble, .8f}, {Width, 1}, {Motion, .6f}, {Drift, .4f}, {Air, .3f},
                                    {Cutoff, .66f}}},
        {"Apocalypse Dub", "Space", {{ChordColor, 2}, {Space, .85f}, {Delay, .45f}, {Shimmer, .55f}, {Air, .4f}, {Motion, .7f}, {Drift, .35f}, {SubDrop, .6f},
                                    {Choir, .4f}}},
        {"The Grains of Wrath", "Space", {{Choir, .7f}, {Cello, .5f}, {Air, .5f}, {Space, .9f}, {Cutoff, .4f}, {Motion, .8f}, {Drift, .5f}, {Attack, 2.5f}}},
        // Electronic: pure synthesis that turns and moves round the head
        {"Close Encounters of the Sine Kind", "Electronic", {{O(1, Wave), Sine}, {O(2, Wave), Sine}, {O(3, Wave), Tri}, {O(4, Wave), Tri}, {O(5, Wave), MorphW}, {O(6, Wave), MorphW},
            {Orbit, .85f}, {OrbitSpeed, .45f}, {Overhead, .6f}, {Cross, .2f}, {Choir, 0}, {Cello, 0}, {StringLayer, 0}, {TextureLayer, 0}, {Tension, .6f}, {Drift, .3f},
            {Space, .7f}, {Shimmer, .5f}, {ChordColor, 0}, {Air, .3f}}},
        {"The Pulse Who Fell to Earth", "Electronic", {{O(1, Wave), Pulse}, {O(2, Wave), Pulse}, {O(3, Wave), Pulse}, {O(4, Wave), Pulse}, {O(5, Wave), Pulse}, {O(6, Wave), Pulse},
            {Pwm, .9f}, {Orbit, .7f}, {Chaos, .5f}, {FilterMotion, .7f}, {Cutoff, .55f}, {Drift, .45f}, {ChordColor, 1}, {Delay, .3f}, {Choir, 0}, {Cello, 0}, {StringLayer, 0}, {TextureLayer, 0}}},
        {"Do Androids Dream of Electric Pads?", "Electronic", {{O(1, Wave), MorphW}, {O(2, Wave), MorphW}, {O(3, Wave), MorphW}, {O(4, Wave), MorphW}, {O(5, Wave), MorphW}, {O(6, Wave), MorphW},
            {Orbit, .6f}, {Motion, .8f}, {Robot, .45f}, {RobotVoice, 1}, {Tension, .65f}, {Space, .75f}, {Choir, 0}, {Cello, 0}, {StringLayer, 0}, {TextureLayer, 0}}},
        {"Interstellar Morph", "Electronic", {{O(1, Wave), MorphW}, {O(2, Wave), MorphW}, {O(3, Wave), MorphW}, {O(4, Wave), MorphW}, {O(5, Wave), MorphW}, {O(6, Wave), MorphW},
            {O(1, Oct), -1}, {O(5, Oct), 1}, {O(6, Oct), 2}, {O(6, Lvl), .25f}, {Orbit, 1}, {OrbitSpeed, .25f}, {Distance, .7f}, {Space, .9f}, {Shimmer, .7f}, {SubDrop, .7f}, {Drift, .25f},
            {Choir, 0}, {Cello, 0}, {StringLayer, 0}, {TextureLayer, .25f}}},
        {"Solaris Spin", "Electronic", {{O(1, Wave), Tri}, {O(2, Wave), Sine}, {O(3, Wave), Tri}, {O(4, Wave), Sine}, {O(5, Wave), MorphW}, {O(6, Wave), MorphW},
            {Orbit, .9f}, {OrbitSpeed, .7f}, {Cross, .35f}, {Chaos, .6f}, {ChordColor, 2}, {Delay, .35f}, {Choir, 0}, {Cello, 0}, {StringLayer, 0}, {TextureLayer, 0}}},
        {"The Grid Who Loved Me", "Electronic", {{O(5, Wave), Pulse}, {O(6, Wave), Pulse}, {Cutoff, .6f}, {Resonance, .5f}, {FilterMotion, .9f}, {Orbit, .5f}, {Ensemble, .3f}, {Tape, 0},
            {Drive, .4f}, {ChordColor, 3}, {Choir, 0}, {Cello, 0}, {StringLayer, 0}, {TextureLayer, 0}}},
        {"Robot with a Soul", "Electronic", {{Robot, .8f}, {RobotVoice, 1}, {RobotRate, 2}, {ChordColor, 3}, {Vox, .3f}, {Orbit, .4f}, {Choir, 0}, {Cello, 0}, {StringLayer, 0}, {TextureLayer, .15f}}},
        {"Blade Runner 2049 Hz", "Electronic", {{O(5, Wave), MorphW}, {O(6, Wave), MorphW}, {Drift, .6f}, {Orbit, .6f}, {Space, .85f}, {Tape, .3f}, {ChordColor, 1}, {SubDrop, .6f},
            {Choir, 0}, {Cello, 0}, {StringLayer, 0}, {TextureLayer, .2f}}},
        // Hybrid: the recordings become the oscillators' waves, and everything melts into everything
        {"Celloverse", "Hybrid", {{O(1, Wave), TCello}, {O(2, Wave), TCello}, {O(3, Wave), TCello}, {O(4, Wave), TCello}, {O(5, Wave), TChimera}, {O(6, Wave), TChoir},
            {Cello, .3f}, {Drift, .5f}, {Orbit, .5f}, {Cutoff, .7f}, {Choir, 0}}},
        {"The Choir Machine", "Hybrid", {{O(1, Wave), TChoir}, {O(2, Wave), TChoir}, {O(3, Wave), TChoir}, {O(4, Wave), TChoir}, {O(5, Wave), TChimera}, {O(6, Wave), TChimera},
            {O(6, Oct), 1}, {Robot, .3f}, {Orbit, .6f}, {TextureLayer, .4f}, {Choir, .3f}, {Cutoff, .72f}}},
        {"Ghost in the Brass", "Hybrid", {{O(1, Wave), TBrass}, {O(2, Wave), TBrass}, {O(3, Wave), TBrass}, {O(4, Wave), TStrings}, {O(5, Wave), TStrings}, {O(6, Wave), TStrings},
            {Cutoff, .6f}, {Drift, .45f}, {BrassLayer, .3f}, {Orbit, .5f}, {ChordColor, 1}, {Choir, 0}}},
        {"Chimera Sonata", "Hybrid", {{O(1, Wave), TChimera}, {O(2, Wave), TChimera}, {O(3, Wave), TChimera}, {O(4, Wave), TChimera}, {O(5, Wave), TChimera}, {O(6, Wave), TChimera},
            {Life, .8f}, {Orbit, .7f}, {TextureLayer, .35f}, {Space, .75f}, {Cutoff, .7f}}},
        {"Stringularity", "Hybrid", {{O(1, Wave), TStrings}, {O(2, Wave), TStrings}, {O(3, Wave), TStrings}, {O(4, Wave), TStrings}, {StringLayer, .4f}, {Tension, .7f}, {Orbit, .5f}, {Cutoff, .7f}}},
        {"Texture Cathedral", "Hybrid", {{TextureLayer, .7f}, {Choir, .3f}, {O(1, Wave), Sine}, {O(2, Wave), Tri}, {O(3, Wave), Sine}, {O(4, Wave), Tri}, {Space, .9f}, {Orbit, .7f}, {Air, .5f}}},
        {"There Will Be Drone", "Space", {{Tension, .2f}, {SubDrop, .8f}, {Cutoff, .35f}, {Drift, .5f}, {Space, .6f}, {FundFade, 6}, {Attack, 1.8f}, {Cello, .35f}}},
    };
    return list;
}

inline Values presetValues(const Preset& pr) {
    Values v = defaults();
    for (const auto& kv : pr.set) v[kv.first] = kv.second;
    return v;
}

}  // namespace ds
