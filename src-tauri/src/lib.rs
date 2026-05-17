use tauri::Manager;
use tauri_plugin_shell::ShellExt;

// Config de ejemplo embebida en el binario para copiar en el primer arranque.
const EXAMPLE_CONFIG: &str = include_str!("../../worklog.config.example.json");

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            // Directorio de datos del usuario: AppData\Roaming\{bundle.identifier}
            let data_dir = app
                .path()
                .app_data_dir()
                .expect("No se pudo obtener el directorio de datos de la aplicación");

            std::fs::create_dir_all(&data_dir)
                .expect("No se pudo crear el directorio de datos");

            // Primer arranque: crear worklog.config.json desde la plantilla embebida.
            // El usuario puede editarlo luego para apuntar a sus proyectos.
            let config_path = data_dir.join("worklog.config.json");
            if !config_path.exists() {
                std::fs::write(&config_path, EXAMPLE_CONFIG)
                    .expect("No se pudo crear el archivo de configuración inicial");
            }

            // En producción: levantar el servidor Bun como sidecar con WORKLOG_DATA_DIR.
            // En dev: el servidor ya está corriendo (iniciado por dev-all.ts).
            #[cfg(not(debug_assertions))]
            {
                let data_dir_str = data_dir.to_string_lossy().to_string();
                let shell = app.shell();
                let (_rx, _child) = shell
                    .sidecar("worklog-server")
                    .expect(
                        "sidecar 'worklog-server' no encontrado — \
                         ejecutá 'bun run build:server:win' antes de empaquetar",
                    )
                    .env("WORKLOG_DATA_DIR", data_dir_str)
                    .spawn()
                    .expect("No se pudo iniciar el servidor de Worklog Hub");
                // _child se dropea acá pero el proceso sigue corriendo.
                // Tauri lo termina automáticamente al cerrar la app.
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("Error iniciando la aplicación Tauri");
}
