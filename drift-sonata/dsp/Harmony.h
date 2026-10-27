// Harmony: recognises the chord in the notes the player holds and folds it out to a wide, open voicing.
// Pure functions without audio, so the rules can be tested in a table (tools/test_harmony.cpp).
#pragma once
#include <algorithm>
#include <cmath>
#include <cstdlib>
#include <string>
#include <vector>

namespace ds {

enum class Color { Bright, Dark, Neutral, Kraftwerk, Carlos };
enum class Quality { Major, Minor, Dim, Aug, Sus2, Sus4, Power, Unknown };

struct ChordInfo {
    int root = -1;          // pitch class 0..11, -1 = no notes
    Quality q = Quality::Unknown;
    int seventh = 0;        // 10 or 11 if the player already plays a seventh, else 0
    bool dominant = false;  // a major chord on the fifth of the chosen key
};

// role: 0 = played, 1 = bass/fifth added under the chord, 2 = colour added inside the chord
// order: when an added note swells in (0 = with the chord, 1.. = later)
struct VoicedNote { int midi; int role; int order; };

struct ExpandOptions {
    int level = 3;               // 0 as played, 1 + octave and fifth, 2 + seventh, 3 + ninth (five notes), 4 + 11/13
    Color color = Color::Bright;
    int key = -1;                // -1 = no key; 0..11 = tonic
    bool keyMinor = false;
    bool keepBass = false;       // keep the lowest played note as the bass (slash chords)
};

struct Voicing { ChordInfo chord; std::vector<VoicedNote> notes; };

inline int pcOf(int m) { return ((m % 12) + 12) % 12; }

inline ChordInfo recognise(std::vector<int> notes, const ExpandOptions& o = {}) {
    ChordInfo c;
    if (notes.empty()) return c;
    std::sort(notes.begin(), notes.end());
    notes.erase(std::unique(notes.begin(), notes.end()), notes.end());
    std::vector<int> pcs;
    for (int m : notes) { int p = pcOf(m); if (std::find(pcs.begin(), pcs.end(), p) == pcs.end()) pcs.push_back(p); }
    const int low = notes.front();

    if (pcs.size() == 1) {
        c.root = pcOf(low); c.q = Quality::Power;
    } else if (pcs.size() == 2) {
        // Two notes: a third has its root below, a sixth is an upside-down third, a fourth an upside-down fifth.
        const int a = pcOf(low), b = (pcs[0] == a ? pcs[1] : pcs[0]), iv = pcOf(b - a);
        switch (iv) {
            case 3: c.root = a; c.q = Quality::Minor; break;
            case 4: c.root = a; c.q = Quality::Major; break;
            case 8: c.root = b; c.q = Quality::Major; break;
            case 9: c.root = b; c.q = Quality::Minor; break;
            case 7: c.root = a; c.q = Quality::Power; break;
            case 5: c.root = b; c.q = Quality::Power; break;
            case 2: c.root = a; c.q = Quality::Sus2; break;
            case 10: c.root = a; c.q = Quality::Power; c.seventh = 10; break;
            default: c.root = a; c.q = Quality::Unknown; break;
        }
    } else {
        struct T { std::vector<int> iv; Quality q; int sev; };
        static const std::vector<T> templates = {
            {{0, 4, 7}, Quality::Major, 0},   {{0, 3, 7}, Quality::Minor, 0},  {{0, 3, 6}, Quality::Dim, 0},
            {{0, 4, 8}, Quality::Aug, 0},     {{0, 5, 7}, Quality::Sus4, 0},   {{0, 2, 7}, Quality::Sus2, 0},
            {{0, 7}, Quality::Power, 0},      {{0, 4, 7, 11}, Quality::Major, 11}, {{0, 4, 7, 10}, Quality::Major, 10},
            {{0, 3, 7, 10}, Quality::Minor, 10}, {{0, 3, 6, 10}, Quality::Dim, 10}, {{0, 3, 6, 9}, Quality::Dim, 9},
            {{0, 5, 7, 10}, Quality::Sus4, 10}, {{0, 4, 10}, Quality::Major, 10}, {{0, 3, 10}, Quality::Minor, 10},
        };
        double best = -1e9;
        for (int r : pcs) {
            std::vector<int> rel;
            for (int p : pcs) rel.push_back(pcOf(p - r));
            for (const T& t : templates) {
                int hit = 0, extra = 0, miss = 0;
                for (int x : rel) (std::find(t.iv.begin(), t.iv.end(), x) != t.iv.end() ? hit : extra)++;
                for (int x : t.iv) if (std::find(rel.begin(), rel.end(), x) == rel.end()) miss++;
                double s = hit * 2.0 - extra * 3.0 - miss * 1.0 + (r == pcOf(low) ? 0.75 : 0.0) - t.iv.size() * 0.01;
                if (s > best) { best = s; c.root = r; c.q = t.q; c.seventh = t.sev; }
            }
        }
    }
    if (o.key >= 0) {
        // In a key, a lone note or a bare fifth gets the third that belongs to the key.
        static const int majorScale[7] = {0, 2, 4, 5, 7, 9, 11}, minorScale[7] = {0, 2, 3, 5, 7, 8, 10};
        const int* sc = o.keyMinor ? minorScale : majorScale;
        auto inKey = [&](int pc) { for (int i = 0; i < 7; i++) if (pcOf(o.key + sc[i]) == pc) return true; return false; };
        if (c.q == Quality::Power && c.seventh == 0) {
            if (inKey(pcOf(c.root + 4)) && !inKey(pcOf(c.root + 3))) c.q = Quality::Major;
            else if (inKey(pcOf(c.root + 3)) && !inKey(pcOf(c.root + 4))) c.q = Quality::Minor;
        }
        c.dominant = c.q == Quality::Major && c.root == pcOf(o.key + 7) && c.seventh != 11;
    }
    return c;
}

// Which notes (intervals over the root) each colour adds, in the order the levels bring them in.
inline std::vector<int> extensions(const ChordInfo& c, Color color) {
    const Quality q = c.q;
    if (color == Color::Kraftwerk) return {12, 19, 24};
    if (color == Color::Carlos) {
        int third = q == Quality::Major || q == Quality::Aug ? 16 : q == Quality::Minor || q == Quality::Dim ? 15 : 17;
        return {12, 19, third};
    }
    if (c.dominant) return {10, 14, 21};
    switch (color) {
        case Color::Bright:
            switch (q) {
                case Quality::Major: return {11, 14, 21};
                case Quality::Minor: return {10, 14, 21};
                case Quality::Dim: return {10, 17};
                case Quality::Aug: return {11, 14};
                case Quality::Sus4: return {10, 14};
                case Quality::Sus2: return {11, 21};
                default: return {14, 11, 21};
            }
        case Color::Dark:
            switch (q) {
                case Quality::Major: return {14, 9, 11};
                case Quality::Minor: return {10, 14, 17};
                case Quality::Dim: return {10, 17};
                case Quality::Aug: return {11, 14};
                case Quality::Sus4: return {10, 14};
                case Quality::Sus2: return {10, 17};
                default: return {14, 10, 17};
            }
        default:  // Neutral
            switch (q) {
                case Quality::Major: return {14, 9, 19};
                case Quality::Minor: return {14, 17, 10};
                case Quality::Dim: return {10, 17};
                case Quality::Aug: return {14, 11};
                default: return {14, 17, 21};
            }
    }
}

// Close intervals low down turn to mud; a minor ninth or a semitone between two voices never sounds nice.
inline bool fits(int m, const std::vector<VoicedNote>& v) {
    for (const VoicedNote& n : v) {
        int d = std::abs(m - n.midi), lo = std::min(m, n.midi);
        if (d == 0 || d == 1 || d == 13) return false;
        if (lo < 45 && d < 7) return false;
        if (lo < 52 && d < 5) return false;
    }
    return true;
}

inline Voicing expand(std::vector<int> played, const ExpandOptions& o, const std::vector<int>& prev = {}) {
    Voicing out;
    std::sort(played.begin(), played.end());
    played.erase(std::unique(played.begin(), played.end()), played.end());
    if (played.empty()) return out;
    out.chord = recognise(played, o);
    for (int m : played) out.notes.push_back({m, 0, 0});
    if (o.level <= 0 || out.chord.root < 0) return out;

    const int low = played.front(), melody = played.back(), root = out.chord.root;
    // The bass: the root in C2..B2, under everything the player holds (unless the lowest note should stay the bass).
    int bass = low;
    if (!o.keepBass) {
        int b = 36 + pcOf(root - 36);
        if (b < low) { out.notes.push_back({b, 1, 0}); bass = b; }
        else if (pcOf(low) != root) { b = low - pcOf(low - root); if (b >= 28) { out.notes.push_back({b, 1, 0}); bass = b; } }
    }
    // Level 1: the fifth over the bass, and the bass an octave up when there is a wide gap.
    const int rootBass = o.keepBass ? low - pcOf(low - root) : bass;
    auto addIfFits = [&](int m, int role, int order) {
        if (m <= bass || m >= melody) return false;
        for (const VoicedNote& n : out.notes) if (n.midi == m) return false;
        if (!fits(m, out.notes)) return false;
        out.notes.push_back({m, role, order});
        return true;
    };
    if (out.chord.q != Quality::Dim && out.chord.q != Quality::Aug) addIfFits(rootBass + 7, 1, 0);

    const std::vector<int> ext = extensions(out.chord, o.color);
    const bool doubling = o.color == Color::Kraftwerk || o.color == Color::Carlos;
    for (int i = 0; i < (int)ext.size() && i < o.level - 1; i++) {
        const int pc = pcOf(root + ext[i]);
        if (doubling) {
            // Octaves and fifths stacked from the bass, in the octave nearest the one asked for.
            for (int m : {rootBass + ext[i], rootBass + ext[i] + 12, rootBass + ext[i] - 12})
                if (addIfFits(m, 2, i + 1)) break;
            continue;
        }
        bool present = false;
        for (const VoicedNote& n : out.notes) if (pcOf(n.midi) == pc) present = true;
        if (present) continue;
        int bestM = -1; double best = -1e9;
        for (int m = bass + 1; m < melody; m++) {
            if (pcOf(m) != pc || !fits(m, out.notes)) continue;
            int nearest = 99;
            for (const VoicedNote& n : out.notes) nearest = std::min(nearest, std::abs(m - n.midi));
            double s = std::min(nearest, 7) * 0.6 - std::abs(m - 62) * 0.08;
            for (int p : prev) { if (p == m) s += 3; else if (pcOf(p) == pc) s -= std::abs(m - p) * 0.3; }
            if (s > best) { best = s; bestM = m; }
        }
        if (bestM >= 0) out.notes.push_back({bestM, 2, i + 1});
    }
    // The bass an octave up fills a wide gap, after the colours so it never takes their place.
    if (low - bass > 12) addIfFits(rootBass + 12, 1, 0);
    std::sort(out.notes.begin(), out.notes.end(), [](const VoicedNote& a, const VoicedNote& b) { return a.midi < b.midi; });
    return out;
}

inline std::string noteName(int m) {
    static const char* n[12] = {"C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"};
    return std::string(n[pcOf(m)]) + std::to_string(m / 12 - 1);
}

inline const char* qualityName(Quality q) {
    switch (q) {
        case Quality::Major: return "dur"; case Quality::Minor: return "moll"; case Quality::Dim: return "forminsket";
        case Quality::Aug: return "forstorret"; case Quality::Sus2: return "sus2"; case Quality::Sus4: return "sus4";
        case Quality::Power: return "kvint"; default: return "?";
    }
}

}  // namespace ds
