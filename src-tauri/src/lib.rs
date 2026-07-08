use tauri_plugin_window_state::StateFlags;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        // запоминает позицию/размер окон (главного и пинов) по их label.
        // Только POSITION|SIZE: флаг видимости не трогаем, иначе скрытый на
        // момент выхода пин вернулся бы скрытым.
        .plugin(
            tauri_plugin_window_state::Builder::default()
                .with_state_flags(StateFlags::POSITION | StateFlags::SIZE)
                .build(),
        )
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
