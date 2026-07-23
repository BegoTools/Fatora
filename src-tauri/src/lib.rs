use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_os::init())
        .setup(|app| {
            // تأكد من وجود مجلد البيانات عند بدء التشغيل.
            // طبقة fileStore.ts تتعامل مع الإنشاء أيضًا، لكن هذا احتياط إضافي.
            if let Ok(app_data) = app.path().app_data_dir() {
                let data_dir = app_data.join("EasyStore");
                let _ = std::fs::create_dir_all(&data_dir);
                let backups_dir = data_dir.join("backups");
                let _ = std::fs::create_dir_all(&backups_dir);
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Easy Store ERP");
}
