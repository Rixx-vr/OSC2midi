// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod bridge;

fn main() {
    let mut bridge = bridge::MidiManager::new().expect("Failed to create MIDI manager");

    bridge.list_devices();

    bridge.connect(bridge.midi_in.ports().first().expect("No MIDI input ports found"))
        .expect("Failed to connect to MIDI input port");

    midi_osc_bridge_lib::run()
}