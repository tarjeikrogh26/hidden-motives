#include "PluginEditor.h"

namespace {
const juce::Colour cream(0xfffaf3ee), ink(0xff1e3c42), teal(0xff4fa3a3), rose(0xffd7799f), gold(0xffc9a227);
// the controls on the face, in the colours of the page: [parameter, label, colour]
const std::vector<std::tuple<const char*, const char*, juce::Colour>> kFace = {
    {"drift", "Drift", rose}, {"tension", "Tension", gold}, {"subdrop", "Sub-Drop", rose}, {"space", "Space", teal},
    {"twist", "Twist", gold}, {"intensity", "Intensity", rose}, {"air", "Air", teal}, {"level", "Level", gold}};
}

DriftSonataEditor::DriftSonataEditor(DriftSonataProcessor& p) : AudioProcessorEditor(&p), proc(p) {
    for (int i = 0; i < proc.getNumPrograms(); i++) sounds.addItem(juce::String(i + 1).paddedLeft('0', 3) + " / " + proc.getProgramName(i), i + 1);
    sounds.setSelectedId(proc.getCurrentProgram() + 1, juce::dontSendNotification);
    sounds.onChange = [this] { proc.setCurrentProgram(sounds.getSelectedId() - 1); };
    addAndMakeVisible(sounds);
    folderButton.onClick = [this] {
        chooser = std::make_unique<juce::FileChooser>("The folder with the recordings (choir_, cello_, strings_, brass_, texture_, wt_ files)");
        chooser->launchAsync(juce::FileBrowserComponent::openMode | juce::FileBrowserComponent::canSelectDirectories, [this](const juce::FileChooser& fc) {
            if (fc.getResult().isDirectory()) proc.loadSamples(fc.getResult());
        });
    };
    addAndMakeVisible(folderButton);
    folderLabel.setColour(juce::Label::textColourId, ink.withAlpha(.7f));
    addAndMakeVisible(folderLabel);
    for (const auto& [id, name, col] : kFace) {
        auto k = std::make_unique<Knob>();
        k->slider.setSliderStyle(juce::Slider::RotaryVerticalDrag);
        k->slider.setTextBoxStyle(juce::Slider::TextBoxBelow, false, 70, 18);
        k->slider.setColour(juce::Slider::rotarySliderFillColourId, col);
        k->slider.setColour(juce::Slider::rotarySliderOutlineColourId, ink.withAlpha(.15f));
        k->slider.setColour(juce::Slider::thumbColourId, ink);
        k->slider.setColour(juce::Slider::textBoxTextColourId, ink);
        k->slider.setColour(juce::Slider::textBoxOutlineColourId, juce::Colours::transparentBlack);
        k->label.setText(name, juce::dontSendNotification);
        k->label.setJustificationType(juce::Justification::centred);
        k->label.setColour(juce::Label::textColourId, ink);
        k->label.setFont(juce::FontOptions(17.0f, juce::Font::italic));
        if (proc.state.getParameter(id)) k->attach = std::make_unique<juce::AudioProcessorValueTreeState::SliderAttachment>(proc.state, id, k->slider);
        addAndMakeVisible(k->slider); addAndMakeVisible(k->label);
        knobs.push_back(std::move(k));
    }
    setSize(720, 420);
    startTimerHz(4);
}

void DriftSonataEditor::timerCallback() {
    const auto f = proc.samplesFolder();
    folderLabel.setText(f.isEmpty() ? "No recordings: the synth alone" : f + "  (" + juce::String(proc.samplesLoaded()) + " recordings)", juce::dontSendNotification);
    if (sounds.getSelectedId() != proc.getCurrentProgram() + 1) sounds.setSelectedId(proc.getCurrentProgram() + 1, juce::dontSendNotification);
}

void DriftSonataEditor::paint(juce::Graphics& g) {
    g.fillAll(cream);
    g.setColour(ink);
    g.setFont(juce::FontOptions(34.0f, juce::Font::italic | juce::Font::bold));
    g.drawText("DRIFT SONATA", 24, 14, 400, 44, juce::Justification::centredLeft);
    g.setFont(juce::FontOptions(13.0f));
    g.setColour(ink.withAlpha(.6f));
    g.drawText("by Tarjei Krogh", 26, 54, 300, 18, juce::Justification::centredLeft);
    g.setColour(gold.withAlpha(.5f));
    g.drawLine(24.0f, 82.0f, (float)getWidth() - 24.0f, 82.0f, 1.0f);
}

void DriftSonataEditor::resized() {
    sounds.setBounds(24, 96, getWidth() - 48, 30);
    folderButton.setBounds(24, 136, 190, 26);
    folderLabel.setBounds(222, 136, getWidth() - 246, 26);
    const int cols = 4, w = (getWidth() - 48) / cols, top = 180, h = 112;
    for (size_t i = 0; i < knobs.size(); i++) {
        const int x = 24 + (int)(i % cols) * w, y = top + (int)(i / cols) * h;
        knobs[i]->label.setBounds(x, y, w, 20);
        knobs[i]->slider.setBounds(x + 8, y + 20, w - 16, h - 26);
    }
}
