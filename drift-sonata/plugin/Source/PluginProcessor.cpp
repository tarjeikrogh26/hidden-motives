#include "PluginProcessor.h"
#include "PluginEditor.h"
#include "SampleLoader.h"

using namespace ds;

// Every parameter of the engine, as the host sees it: floats with their own centre, whole numbers, switches and choices
juce::AudioProcessorValueTreeState::ParameterLayout DriftSonataProcessor::layout() {
    juce::AudioProcessorValueTreeState::ParameterLayout l;
    for (const auto& p : params()) {
        const juce::ParameterID id{p.id, 1};
        switch (p.kind) {
            case Kind::Float: {
                juce::NormalisableRange<float> r(p.min, p.max);
                if (p.skewCentre > p.min && p.skewCentre < p.max) r.setSkewForCentre(p.skewCentre);
                l.add(std::make_unique<juce::AudioParameterFloat>(id, p.name, r, p.def, juce::AudioParameterFloatAttributes().withLabel(p.unit)));
                break;
            }
            case Kind::Int: l.add(std::make_unique<juce::AudioParameterInt>(id, p.name, (int)p.min, (int)p.max, (int)p.def)); break;
            case Kind::Bool: l.add(std::make_unique<juce::AudioParameterBool>(id, p.name, p.def > .5f)); break;
            case Kind::Choice: {
                juce::StringArray names; for (auto* c : p.choices) names.add(c);
                l.add(std::make_unique<juce::AudioParameterChoice>(id, p.name, names, (int)p.def));
                break;
            }
        }
    }
    return l;
}

DriftSonataProcessor::DriftSonataProcessor()
    : AudioProcessor(BusesProperties().withOutput("Output", juce::AudioChannelSet::stereo(), true)),
      state(*this, nullptr, "DriftSonata", layout()) {
    const auto& ps = params();
    for (int i = 0; i < COUNT; i++) raw[i] = state.getRawParameterValue(ps[i].id);
    values = defaults();
}

bool DriftSonataProcessor::isBusesLayoutSupported(const BusesLayout& layouts) const {
    return layouts.getMainOutputChannelSet() == juce::AudioChannelSet::stereo();
}

void DriftSonataProcessor::prepareToPlay(double sampleRate, int) {
    engine.prepare(sampleRate, 128);
    engine.setSeed(0x5eed1u);
    for (int i = 0; i < COUNT; i++) values[i] = raw[i]->load();
    engine.setParams(values);
    if (auto b = std::atomic_load(&current)) engine.setSamples(b);
}

void DriftSonataProcessor::processBlock(juce::AudioBuffer<float>& buffer, juce::MidiBuffer& midi) {
    juce::ScopedNoDenormals noDenormals;
    // the parameters, when one has moved
    bool changed = false;
    for (int i = 0; i < COUNT; i++) { const float v = raw[i]->load(); if (v != values[i]) { values[i] = v; changed = true; } }
    if (changed) engine.setParams(values);
    // the host's transport: the Sub-Drop lands on its bar one, the Life sequencer runs in its time
    if (auto* ph = getPlayHead())
        if (auto pos = ph->getPosition()) {
            const auto sig = pos->getTimeSignature().orFallback(juce::AudioPlayHead::TimeSignature{});
            engine.setTransport(pos->getIsPlaying(), pos->getPpqPosition().orFallback(0.0), pos->getBpm().orFallback(120.0), sig.numerator, sig.denominator);
        }
    // the block, cut where the notes are, in pieces of at most 128 samples
    float* left = buffer.getWritePointer(0);
    float* right = buffer.getNumChannels() > 1 ? buffer.getWritePointer(1) : nullptr;
    float tmpR[128];
    const int n = buffer.getNumSamples();
    int done = 0;
    auto render = [&](int upTo) {
        while (done < upTo) {
            const int k = std::min(128, upTo - done);
            engine.process(left + done, right ? right + done : tmpR, k);
            done += k;
        }
    };
    for (const auto m : midi) {
        const auto msg = m.getMessage();
        render(std::clamp(m.samplePosition, 0, n));
        if (msg.isNoteOn()) engine.noteOn(msg.getNoteNumber(), msg.getFloatVelocity());
        else if (msg.isNoteOff()) engine.noteOff(msg.getNoteNumber());
        else if (msg.isAllNotesOff() || msg.isAllSoundOff()) engine.allNotesOff();
    }
    render(n);
    for (int c = 2; c < buffer.getNumChannels(); c++) buffer.clear(c, 0, n);
}

// The programs: the 833 sounds of the bank
int DriftSonataProcessor::getNumPrograms() { return (int)soundBank().size(); }
const juce::String DriftSonataProcessor::getProgramName(int index) {
    const auto& b = soundBank();
    return index >= 0 && index < (int)b.size() ? juce::String(b[(size_t)index].name) : juce::String();
}
void DriftSonataProcessor::setCurrentProgram(int index) {
    const auto& b = soundBank();
    if (index < 0 || index >= (int)b.size()) return;
    program = index;
    const auto& v = b[(size_t)index].values;
    const auto& ps = params();
    for (int i = 0; i < COUNT; i++)
        if (auto* p = state.getParameter(ps[i].id)) p->setValueNotifyingHost(p->convertTo0to1(v[i]));
}

void DriftSonataProcessor::loadSamples(const juce::File& dir) {
    folder = dir.getFullPathName();
    const std::string path = folder.toStdString();
    loader.addJob([this, path] {
        std::shared_ptr<const SampleBank> bank = loadSampleFolder(path);
        zonesLoaded = (int)bank->zones.size();
        std::atomic_store(&current, bank);
        engine.setSamples(bank);  // the engine takes it up at the start of its next block
    });
}

// The state: every parameter, the program, and where the recordings are
void DriftSonataProcessor::getStateInformation(juce::MemoryBlock& dest) {
    auto s = state.copyState();
    s.setProperty("program", program, nullptr);
    s.setProperty("samples", folder, nullptr);
    if (auto xml = s.createXml()) copyXmlToBinary(*xml, dest);
}
void DriftSonataProcessor::setStateInformation(const void* data, int size) {
    if (auto xml = getXmlFromBinary(data, size)) {
        auto s = juce::ValueTree::fromXml(*xml);
        if (!s.isValid()) return;
        program = s.getProperty("program", 0);
        const juce::String dir = s.getProperty("samples", "");
        state.replaceState(s);
        if (dir.isNotEmpty() && juce::File(dir).isDirectory()) loadSamples(juce::File(dir));
    }
}

juce::AudioProcessorEditor* DriftSonataProcessor::createEditor() { return new DriftSonataEditor(*this); }

juce::AudioProcessor* JUCE_CALLTYPE createPluginFilter() { return new DriftSonataProcessor(); }
