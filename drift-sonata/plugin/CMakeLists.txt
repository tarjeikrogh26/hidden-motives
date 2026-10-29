# DRIFT SONATA as a plugin: the engine in dsp/ (the same code the web page runs as WebAssembly) inside JUCE, as a
# VST3 and a standalone app everywhere and an Audio Unit on a Mac.
#
#   cmake -B build -DCMAKE_BUILD_TYPE=Release            (fetches JUCE 8.0.9)
#   cmake -B build -DJUCE_DIR=/path/to/JUCE ...          (or uses a JUCE you have)
#   cmake --build build --config Release
cmake_minimum_required(VERSION 3.22)
project(DriftSonata VERSION 0.9.0 LANGUAGES C CXX)
set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

if(JUCE_DIR)
    add_subdirectory(${JUCE_DIR} JUCE)
else()
    include(FetchContent)
    FetchContent_Declare(JUCE GIT_REPOSITORY https://github.com/juce-framework/JUCE.git GIT_TAG 8.0.9 GIT_SHALLOW TRUE)
    FetchContent_MakeAvailable(JUCE)
endif()

set(DS_FORMATS VST3 Standalone)
if(APPLE)
    list(APPEND DS_FORMATS AU)
endif()

juce_add_plugin(DriftSonata
    COMPANY_NAME "Tarjei Krogh"
    PRODUCT_NAME "DRIFT SONATA"
    PLUGIN_MANUFACTURER_CODE Tkrg
    PLUGIN_CODE Drfs
    FORMATS ${DS_FORMATS}
    IS_SYNTH TRUE
    NEEDS_MIDI_INPUT TRUE
    NEEDS_MIDI_OUTPUT FALSE
    IS_MIDI_EFFECT FALSE
    EDITOR_WANTS_KEYBOARD_FOCUS FALSE
    COPY_PLUGIN_AFTER_BUILD FALSE
    VST3_CATEGORIES Instrument Synth
    AU_MAIN_TYPE kAudioUnitType_MusicDevice)

target_sources(DriftSonata PRIVATE Source/PluginProcessor.cpp Source/PluginEditor.cpp ../dsp/Engine.cpp)
target_include_directories(DriftSonata PRIVATE ../dsp)
target_compile_definitions(DriftSonata PUBLIC
    JUCE_WEB_BROWSER=0 JUCE_USE_CURL=0 JUCE_VST3_CAN_REPLACE_VST2=0 JUCE_DISPLAY_SPLASH_SCREEN=0)
target_link_libraries(DriftSonata
    PRIVATE juce::juce_audio_utils
    PUBLIC juce::juce_recommended_config_flags juce::juce_recommended_lto_flags)

# A check without a host: make the plugin, play chords through it, measure the sound (cmake -DDS_TEST=ON)
option(DS_TEST "Build plugin_test" OFF)
if(DS_TEST)
    juce_add_console_app(plugin_test)
    target_sources(plugin_test PRIVATE Source/PluginTest.cpp)
    target_include_directories(plugin_test PRIVATE ../dsp Source)
    target_compile_definitions(plugin_test PRIVATE JUCE_WEB_BROWSER=0 JUCE_USE_CURL=0)
    target_link_libraries(plugin_test PRIVATE DriftSonata juce::juce_audio_utils PUBLIC juce::juce_recommended_config_flags)
endif()
