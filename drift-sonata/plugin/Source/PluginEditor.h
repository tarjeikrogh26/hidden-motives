#pragma once
// The plugin's face: the sound (one of the 833), the folder of recordings, and the big controls; every other parameter
// is in the host's own list.
#include "PluginProcessor.h"

class DriftSonataEditor : public juce::AudioProcessorEditor, private juce::Timer {
public:
    explicit DriftSonataEditor(DriftSonataProcessor&);
    ~DriftSonataEditor() override = default;
    void paint(juce::Graphics&) override;
    void resized() override;

private:
    void timerCallback() override;
    struct Knob { juce::Slider slider; juce::Label label; std::unique_ptr<juce::AudioProcessorValueTreeState::SliderAttachment> attach; };
    DriftSonataProcessor& proc;
    juce::ComboBox sounds;
    juce::TextButton folderButton{"Recordings folder..."};
    juce::Label folderLabel;
    std::vector<std::unique_ptr<Knob>> knobs;
    std::unique_ptr<juce::FileChooser> chooser;
    JUCE_DECLARE_NON_COPYABLE_WITH_LEAK_DETECTOR(DriftSonataEditor)
};
