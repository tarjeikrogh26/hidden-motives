// Prints how the harmony expansion folds out a table of played chords, and checks the rules that keep it nice.
#include "../dsp/Harmony.h"
#include <cstdio>

using namespace ds;

int main() {
    struct Case { const char* what; std::vector<int> notes; Color color; int level; int key; };
    const std::vector<Case> cases = {
        {"C-dur, treklang C4", {60, 64, 67}, Color::Bright, 3, -1},
        {"A-moll, treklang A3", {57, 60, 64}, Color::Bright, 3, -1},
        {"A-moll, Mork", {57, 60, 64}, Color::Dark, 3, -1},
        {"A-moll, Mork, nivaa 4", {57, 60, 64}, Color::Dark, 4, -1},
        {"F-dur, Lys, nivaa 4", {53, 57, 60}, Color::Bright, 4, -1},
        {"C-dur forste omvending (E G C)", {64, 67, 72}, Color::Bright, 3, -1},
        {"C-dur andre omvending (G C E)", {55, 60, 64}, Color::Bright, 3, -1},
        {"To toner: C E (stor ters)", {60, 64}, Color::Bright, 3, -1},
        {"To toner: C Eb (liten ters)", {60, 63}, Color::Dark, 3, -1},
        {"To toner: E C (sekst = omvendt ters)", {64, 72}, Color::Bright, 3, -1},
        {"To toner: C A (stor sekst = A-moll)", {60, 69}, Color::Dark, 3, -1},
        {"To toner: C G (kvint)", {60, 67}, Color::Neutral, 3, -1},
        {"To toner: G C (kvart = omvendt kvint)", {55, 60}, Color::Bright, 3, -1},
        {"En tone: D4", {62}, Color::Bright, 3, -1},
        {"En tone: D4 i C-dur (D-moll)", {62}, Color::Bright, 3, 0},
        {"G-dur i C-dur (dominant)", {55, 59, 62}, Color::Bright, 3, 0},
        {"G-dur i C-dur, nivaa 4", {55, 59, 62}, Color::Bright, 4, 0},
        {"Bm7b5 (B D F A)", {59, 62, 65, 69}, Color::Bright, 3, -1},
        {"Csus4", {60, 65, 67}, Color::Bright, 3, -1},
        {"Lav treklang C3", {48, 52, 55}, Color::Bright, 3, -1},
        {"Hoy treklang C5", {72, 76, 79}, Color::Bright, 4, -1},
        {"C-dur, Kraftwerk", {60, 64, 67}, Color::Kraftwerk, 4, -1},
        {"C-dur, Carlos", {60, 64, 67}, Color::Carlos, 4, -1},
        {"C-dur, Noytral", {60, 64, 67}, Color::Neutral, 4, -1},
        {"Cmaj7 spilt (C E G B)", {60, 64, 67, 71}, Color::Bright, 3, -1},
        {"F-dur andre omvending (A C F)", {57, 60, 65}, Color::Bright, 3, -1},
        {"F-dur andre omvending, Mork", {57, 60, 65}, Color::Dark, 4, -1},
        {"Am, nivaa 0 (som spilt)", {57, 60, 64}, Color::Bright, 0, -1},
        {"Am, nivaa 1 (oktav og kvint)", {57, 60, 64}, Color::Bright, 1, -1},
    };
    int bad = 0;
    for (const Case& c : cases) {
        ExpandOptions o; o.level = c.level; o.color = c.color; o.key = c.key;
        Voicing v = expand(c.notes, o);
        std::printf("%-40s -> %s %-6s :", c.what, v.chord.root >= 0 ? noteName(v.chord.root + 60).c_str() : "-", qualityName(v.chord.q));
        for (const VoicedNote& n : v.notes) std::printf(" %s%s", noteName(n.midi).c_str(), n.role == 0 ? "*" : n.role == 1 ? "_" : "+");
        std::printf("   (%zu toner)\n", v.notes.size());
        // The rules: the melody stays on top, no semitones or minor ninths between added notes and the rest.
        int top = *std::max_element(c.notes.begin(), c.notes.end());
        if (v.notes.back().midi != top) { std::printf("   FEIL: melodien er ikke overst\n"); bad++; }
        for (size_t i = 0; i < v.notes.size(); i++)
            for (size_t j = i + 1; j < v.notes.size(); j++) {
                if (v.notes[i].role == 0 && v.notes[j].role == 0) continue;
                int d = std::abs(v.notes[i].midi - v.notes[j].midi);
                if (d == 1 || d == 13) { std::printf("   FEIL: %s og %s gnisser\n", noteName(v.notes[i].midi).c_str(), noteName(v.notes[j].midi).c_str()); bad++; }
            }
    }
    std::printf("\n* = spilt   _ = bass/kvint lagt under   + = farge lagt til\n%s\n", bad ? "REGLER BRUTT" : "Alle regler holder.");
    return bad ? 1 : 0;
}
