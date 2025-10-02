use tauri::{AppHandle, Emitter, Manager};
use tauri::async_runtime::Mutex;

mod bridge;

struct AppData {
    welcome_message: &'static str,
    bridge: bridge::MidiManager,
  }
// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str, app: AppHandle) -> String {
  let state = app.state::<Mutex<AppData>>();
  let mut app_data = state.blocking_lock();
  println!("{}", app_data.welcome_message);
  let bridge = &mut app_data.bridge;
  let ports = bridge.midi_in.ports();

  let port_names: Vec<String> = ports.iter()
      .map(|p| bridge.midi_in.port_name(p).unwrap_or("Unknown".to_string()))
      .collect();

  format!("Hello, {}! These are the available ports: {:?}", name, port_names)
}

#[tauri::command]
async fn create_connection(port_name: String, app: AppHandle) {
    let state = app.state::<Mutex<AppData>>();
    let mut app_data = state.lock().await;
    let bridge = &mut app_data.bridge;
    let ports = bridge.midi_in.ports();
    for port in ports {
        let name = bridge.midi_in.port_name(&port).unwrap();
        if name == port_name {
            bridge.connect(&port).unwrap();
            app.emit("connection_created", &format!("Connected to {}", port_name)).unwrap();
            return;
        }
    }
    //app.emit("connection_created", &format!("Port {} not found", port_name)).unwrap();
    println!("create_connection called with port_name: {}", port_name);
}


#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut bridge = bridge::MidiManager::new().expect("Failed to create MIDI manager");
    bridge.list_devices();
    bridge.connect(bridge.midi_in.ports().first().expect("No MIDI input ports found"))
        .expect("Failed to connect to MIDI input port");

    tauri::Builder::default()
      .manage(Mutex::new(AppData {
          welcome_message: "Welcome to Tauri!",
          bridge: bridge,
      }))
      .plugin(tauri_plugin_opener::init())
      .invoke_handler(tauri::generate_handler![greet, print_devices, create_connection, update_devices])
      .run(tauri::generate_context!())
      .expect("error while running tauri application");
}

#[tauri::command]
fn print_devices(app: AppHandle, devices: String) {
  app.emit("print_devices", &devices).unwrap();
}

#[tauri::command]
fn update_devices(app: AppHandle, devices: String) {
  app.emit("update-devices", &devices).unwrap();
}