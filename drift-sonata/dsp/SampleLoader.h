// Reads a folder of single-note recordings into a SampleBank.
// File names say what they are: <family>_<midi note>[_anything].wav, e.g. "choir_69.92_03.wav" or "cello_41.wav".
// Families: choir, cello. WAV only (16/24-bit PCM or 32-bit float, mono or stereo).
#pragma once
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <filesystem>
#include <memory>
#include <string>

#include "Engine.h"

namespace ds {

inline bool readWav(const std::string& path, std::vector<float>& out, float& rate) {
    FILE* f = std::fopen(path.c_str(), "rb");
    if (!f) return false;
    std::vector<unsigned char> d;
    unsigned char buf[65536]; size_t got;
    while ((got = std::fread(buf, 1, sizeof buf, f)) > 0) d.insert(d.end(), buf, buf + got);
    std::fclose(f);
    if (d.size() < 44 || std::memcmp(d.data(), "RIFF", 4) || std::memcmp(d.data() + 8, "WAVE", 4)) return false;
    auto u16 = [&](size_t o) { return (unsigned)d[o] | (unsigned)d[o + 1] << 8; };
    auto u32 = [&](size_t o) { return u16(o) | u16(o + 2) << 16; };
    int fmt = 0, ch = 0, bits = 0; size_t pos = 12;
    while (pos + 8 <= d.size()) {
        const size_t len = u32(pos + 4), body = pos + 8;
        if (!std::memcmp(d.data() + pos, "fmt ", 4) && body + 16 <= d.size()) {
            fmt = u16(body); ch = u16(body + 2); rate = (float)u32(body + 4); bits = u16(body + 14);
            if (fmt == 0xFFFE && len >= 26) fmt = u16(body + 24);
        } else if (!std::memcmp(d.data() + pos, "data", 4) && ch > 0) {
            const size_t bytes = std::min(len, d.size() - body), frameBytes = (size_t)ch * bits / 8;
            if (!frameBytes) return false;
            const size_t frames = bytes / frameBytes;
            out.assign(frames, 0);
            for (size_t i = 0; i < frames; i++) {
                float sum = 0;
                for (int c = 0; c < ch; c++) {
                    const unsigned char* s = d.data() + body + i * frameBytes + c * bits / 8;
                    float x = 0;
                    if (fmt == 1 && bits == 16) x = (int16_t)(s[0] | s[1] << 8) / 32768.f;
                    else if (fmt == 1 && bits == 24) x = (int32_t)((uint32_t)s[0] << 8 | (uint32_t)s[1] << 16 | (uint32_t)s[2] << 24) / 2147483648.f;
                    else if (fmt == 3 && bits == 32) { std::memcpy(&x, s, 4); }
                    else return false;
                    sum += x;
                }
                out[i] = sum / ch;
            }
            return true;
        }
        pos = body + len + (len & 1);
    }
    return false;
}

inline std::shared_ptr<SampleBank> loadSampleFolder(const std::string& folder) {
    namespace fs = std::filesystem;
    auto bank = std::make_shared<SampleBank>();
    std::error_code ec;
    if (!fs::is_directory(folder, ec)) return bank;
    for (const auto& e : fs::directory_iterator(folder, ec)) {
        const std::string name = e.path().filename().string();
        if (e.path().extension() != ".wav" && e.path().extension() != ".WAV") continue;
        int fam = name.rfind("choir_", 0) == 0 ? kChoir : name.rfind("cello_", 0) == 0 ? kCello : -1;
        if (fam < 0) continue;
        const float root = std::strtof(name.c_str() + 6, nullptr);
        if (root < 12 || root > 120) continue;
        Zone z; z.family = fam; z.root = root;
        if (!readWav(e.path().string(), z.data, z.sr) || z.data.size() < 1024) continue;
        bank->zones.push_back(std::move(z));
    }
    bank->finish();
    return bank;
}

}  // namespace ds
