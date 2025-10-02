use midir::{MidiInput, MidiInputConnection, MidiInputPort, MidiOutput};
use wmidi::MidiMessage;
use std::error::Error;


pub struct MidiManager{
    pub midi_in: MidiInput,
    midi_connections: Vec<MidiInputConnection<()>>,
    pub midi_out: MidiOutput
}

impl MidiManager {
    pub fn new() -> Result<Self, Box<dyn Error>> {
        Ok(Self {
            midi_in: MidiInput::new("MIDI Input")?,
            midi_out: MidiOutput::new("MIDI Output")?,
            midi_connections: Vec::new(),
        })
    }

    pub fn list_devices(&self) {
        for port in self.midi_in.ports() {
            println!("Input port: {}", self.midi_in.port_name(&port).unwrap());
        }

        for port in self.midi_out.ports() {
            println!("Output port: {}", self.midi_out.port_name(&port).unwrap());
        }
    }

    pub fn connect(&mut self, port: &MidiInputPort) -> Result<(), Box<dyn Error>> {
        let connection = MidiInput::new("Listener")?.connect(
            &port,
            "midir‑in",
            |_, message, _| {
                match MidiMessage::from_bytes(message) {
                    Ok(msg) => println!("Received: {:?}", msg),
                    Err(_) => println!("Raw bytes: {:?}", message),
                }
            },
            (),
        )?;

        self.midi_connections.push(connection);

        Ok(())
    }
}


