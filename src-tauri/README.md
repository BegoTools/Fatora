# Easy Store ERP — بناء تطبيق ويندوز (Tauri)

هذا المجلد يحتوي على إعدادات Tauri لبناء تطبيق ويندوز أصلي (`.exe` / `.msi`)
يغلّف واجهة React الحالية. التطبيق يعمل بالكامل offline ولا يحتاج سيرفر.

## المتطلبات (مرة واحدة على جهاز المطوّر)

1. **Node.js** 20+ (مثبّت بالفعل).
2. **Rust toolchain** — ثبّته من https://rustup.rs/ ثم أعد فتح الطرفية وتحقق:
   ```powershell
   rustc --version
   cargo --version
   ```
3. **Microsoft C++ Build Tools** — حمّل VS Build Tools من
   https://aka.ms/vs/17/release/vs_BuildTools.exe وفعّل عبء العمل
   «Desktop development with C++» (يتضمن MSVC + Windows SDK).
4. **WebView2** — مثبّت افتراضيًا على ويندوز 10/11 الحديثة.

## البناء

من مجلد `app/`:

```powershell
npm install
npm run tauri:build
```

الناتج في `app/src-tauri/target/release/bundle/`:
- `msi/Easy Store ERP_1.0.0_x64_en-US.msi`
- `nsis/Easy Store ERP_1.0.0_x64-setup.exe`

## التطوير (نافذة Tauri مع Hot Reload)

```powershell
npm run tauri:dev
```

## استبدال الأيقونة

الأيقونات الحالية في `src-tauri/icons/` مؤقتة. لتوليد أيقونات حقيقية من صورة:
```powershell
npx tauri icon path/to/logo.png
```

## ملاحظات

- كل بيانات المستخدم تُخزَّن في `%APPDATA%/EasyStore/data.json` (كتابة ذرية + نسخ احتياطي).
- لا حاجة لأي تكوين إضافي — التطبيق جاهز للعمل فور البناء.
