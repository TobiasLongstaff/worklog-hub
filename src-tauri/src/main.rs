// Evita que se abra una ventana de consola en Windows (release build)
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    worklog_hub_lib::run()
}
