// Prints the parameter table and the factory presets as JSON, so the browser page builds its controls from the
// same source as the engine.
#include <cstdio>
#include <string>

#include "../dsp/Presets.h"

using namespace ds;

static std::string esc(const char* s) {
    std::string o;
    for (; *s; s++) { if (*s == '"' || *s == '\\') o += '\\'; o += *s; }
    return o;
}

int main() {
    const char* kinds[] = {"float", "int", "bool", "choice"};
    std::printf("{\"params\":[");
    for (int k = 0; k < COUNT; k++) {
        const ParamInfo& p = params()[k];
        std::printf("%s{\"id\":\"%s\",\"name\":\"%s\",\"kind\":\"%s\",\"min\":%g,\"max\":%g,\"def\":%g,\"skew\":%g,\"unit\":\"%s\",\"choices\":[",
                    k ? "," : "", p.id, esc(p.name).c_str(), kinds[(int)p.kind], p.min, p.max, p.def, p.skewCentre, p.unit);
        for (size_t c = 0; c < p.choices.size(); c++) std::printf("%s\"%s\"", c ? "," : "", esc(p.choices[c]).c_str());
        std::printf("]}");
    }
    std::printf("],\"presets\":[");
    bool first = true;
    for (const Preset& pr : presets()) {
        std::printf("%s{\"name\":\"%s\",\"group\":\"%s\",\"set\":{", first ? "" : ",", esc(pr.name).c_str(), pr.group);
        first = false;
        for (size_t i = 0; i < pr.set.size(); i++) std::printf("%s\"%s\":%g", i ? "," : "", params()[pr.set[i].first].id, pr.set[i].second);
        std::printf("}}");
    }
    std::printf("]}\n");
    return 0;
}
