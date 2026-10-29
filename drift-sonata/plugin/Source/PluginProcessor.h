#pragma once
// DRIFT SONATA as a plugin: one Engine (dsp/Engine.h), every one of its parameters as a host parameter, the 833 sounds
// of the bank as programs, MIDI in, the host's tempo and position for the Sub-Drop and the Life sequencer, and the
// recordings (choir, cello, strings, brass, textures and wavetables) loaded from a folder the user chooses.
#include <juce_audio_utils/juce_audio_utils.h>
#include "Engine.h"
#include "Bank.h"

class DriftSonataProcessor : public juce::AudioProcessor {
public:
    DriftSonataProcessor();

    void prepareToPlay(double sampleRate, int samplesPerBlock) override;
    void releaseResources() override {}
    bool isBusesLayoutSupported(const BusesLayout& layouts) const override;
    void processBlock(juce::AudioBuffer<float>&, juce::MidiBuffer&) override;

    juce::AudioProcessorEditor* createEditor() override;
    bool hasEditor() const override { return true; }
    const juce::String getName() const override { return "DRIFT SONATA"; }
    bool acceptsMidi() const override { return true; }
    bool producesMidi() const override { return false; }
    double getTailLengthSeconds() const override { return 8.0; }

    int getNumPrograms() override;
    int getCurrentProgram() override { return program; }
    void setCurrentProgram(int index) override;
    const juce::String getProgramName(int index) override;
    void changeProgramName(int, const juce::String&) override {}

    void getStateInformation(juce::MemoryBlock& dest) override;
    void setStateInformation(const void* data, int size) override;

    // The recordings: read on a background thread, handed to the audio thread when ready
    void loadSamples(const juce::File& folder);
    juce::String samplesFolder() const { return folder; }
    int samplesLoaded() const { return zonesLoaded; }

    juce::AudioProcessorValueTreeState state;

private:
    static juce::AudioProcessorValueTreeState::ParameterLayout layout();

    ds::Engine engine;
    ds::Values values{};
    std::array<std::atomic<float>*, ds::COUNT> raw{};
    std::shared_ptr<const ds::SampleBank> current;
    juce::String folder;
    std::atomic<int> zonesLoaded{0};
    int program = 0;
    juce::ThreadPool loader{1};

    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(DriftSonataProcessor)
};
