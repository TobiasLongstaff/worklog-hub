use tauri_plugin_shell::ShellExt;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            // Levanta el servidor Bun (backlog API + MCP + static files en dev)
            // como proceso sidecar gestionado por Tauri.
            // En modo release, el binario compilado se empaqueta en bundle/binaries/.
            let shell = app.shell();
            let sidecar = shell
                .sidecar("worklog-server")
                .expect("sidecar 'worklog-server' no encontrado — ejecutá 'bun run build:server:win' antes de empaquetar");

            let (_rx, _child) = sidecar
                .spawn()
                .expect("No se pudo iniciar el servidor de Worklog Hub");

            // El proceso vive mientras _child no sea dropeado.
            // Tauri lo gestiona y lo mata al cerrar la app.
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("Error iniciando la aplicación Tauri");
}
