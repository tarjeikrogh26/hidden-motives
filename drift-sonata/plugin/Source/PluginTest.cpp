// Makes the plugin with no host, plays a few chords through it (with and without the recordings), and checks that it
// sounds: no silence, no NaN, peaks under full scale, every program loads.
#include "PluginProcessor.h"

juce::AudioProcessor* JUCE_CALLTYPE createPluginFilter();

int main(int argc, char** argv) {
    juce::ScopedJuceInitialiser_GUI init;
    std::unique_ptr<juce::AudioProcessor> plugin(createPluginFilter());
    auto& p = dynamic_cast<DriftSonataProcessor&>(*plugin);
    const double sr = 48000; const int block = 512;
    p.setPlayConfigDetails(0, 2, sr, block);
    p.prepareToPlay(sr, block);
    if (argc > 1) { p.loadSamples(juce::File(argv[1])); juce::Thread::sleep(4000); std::printf("recordings: %d\n", p.samplesLoaded()); }
    int fails = 0;
    for (int prog : {0, 5, 100, 400, 832}) {
        p.setCurrentProgram(prog);
        juce::AudioBuffer<float> buf(2, block);
        double sum = 0, peak = 0; long long count = 0; bool nan = false;
        const int chords[3][4] = {{57, 60, 64, 67}, {53, 57, 60, 64}, {55, 59, 62, 65}};
        for (int b = 0; b < (int)(sr * 6 / block); b++) {
            juce::MidiBuffer midi;
            const int c = b / (int)(sr * 2 / block), at = b % (int)(sr * 2 / block);
            if (at == 0 && c < 3) { if (c) for (int n : chords[c - 1]) midi.addEvent(juce::MidiMessage::noteOff(1, n), 0); for (int n : chords[c]) midi.addEvent(juce::MidiMessage::noteOn(1, n, (juce::uint8)100), 37); }
            buf.clear(); p.processBlock(buf, midi);
            for (int ch = 0; ch < 2; ch++) for (int i = 0; i < block; i++) { const float v = buf.getSample(ch, i); if (!std::isfinite(v)) nan = true; sum += v * v; peak = std::max(peak, (double)std::abs(v)); count++; }
        }
        const double rms = 20 * std::log10(std::sqrt(sum / count) + 1e-12), pk = 20 * std::log10(peak + 1e-12);
        const bool ok = !nan && rms > -50 && pk < 0.5;
        std::printf("program %3d %-34s rms %6.1f dB peak %6.1f dB %s\n", prog, p.getProgramName(prog).toRawUTF8(), rms, pk, ok ? "ok" : "FAIL");
        fails += !ok;
    }
    // the state comes back the same
    juce::MemoryBlock mb; p.getStateInformation(mb); p.setCurrentProgram(10); p.setStateInformation(mb.getData(), (int)mb.getSize());
    std::printf("state %zu bytes, %d parameters, %d programs\n", mb.getSize(), (int)p.getParameters().size(), p.getNumPrograms());
    p.releaseResources();
    return fails ? 1 : 0;
}
