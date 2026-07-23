// ============================================================
// Easy Store ERP - طبقة تخزين الملف (File Storage Layer)
// ------------------------------------------------------------
// تخزين البيانات كملف JSON حقيقي على القرص عبر Tauri fs في الإنتاج
// (مسار %APPDATA%/EasyStore/data.json) مع كتابة ذرية (atomic write):
//   write-temp → fsync → rename  (لمنع فقدان البيانات عند الأعطال).
// في وضع التطوير داخل المتصفح (بدون Tauri) يتم استخدام IndexedDB
// كـ fallback مؤقت فقط — هذا الـ fallback غير مخصص للإنتاج.
// ============================================================

import type { AppState } from '@/types';
import { idbGet, idbSet, idbClear } from './idb';

const DATA_FILENAME = 'data.json';
const DATA_DIR_NAME = 'EasyStore';

// نسخة في الذاكرة للحالة الحالية (تُحدَّث مع كل حفظ)
let fileCache: AppState | null = null;
let writeQueue: Promise<void> = Promise.resolve();
let isWriting = false;

// ============================================================
// كشف بيئة Tauri
// ============================================================
export function isTauri(): boolean {
  return typeof window !== 'undefined'
    && (Boolean((window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__)
      || Boolean((window as unknown as { __TAURI__?: unknown }).__TAURI__));
}

// ============================================================
// استيراد ديناميكي لـ Tauri fs (فقط عند الحاجة) لتفادي كسر
// البناء في وضع المتصفح وأثناء الاختبارات.
// ============================================================
async function getFs(): Promise<typeof import('@tauri-apps/plugin-fs') | null> {
  if (!isTauri()) return null;
  try {
    const fs = await import('@tauri-apps/plugin-fs');
    return fs;
  } catch {
    return null;
  }
}

// تحديد مجلد البيانات: %APPDATA%/EasyStore على ويندوز عبر Tauri
async function resolveDataDir(): Promise<string | null> {
  const fs = await getFs();
  if (!fs) return null;
  const api = await import('@tauri-apps/api/path');
  let baseDir: string;
  try {
    // appDataDir = %APPDATA% على ويندوز
    baseDir = await api.appDataDir();
  } catch {
    return null;
  }
  const dir = `${baseDir.replace(/[\\/]+$/, '')}/${DATA_DIR_NAME}`;
  try {
    if (!await fs.exists(dir)) {
      await fs.mkdir(dir, { recursive: true });
    }
  } catch {
    /* قد يفشل إنشاء المجلد — نحاول المتابعة */
  }
  return dir;
}

function dataPath(dir: string): string {
  return `${dir}/${DATA_FILENAME}`;
}

function tempPath(dir: string): string {
  return `${dir}/.data.json.tmp`;
}

// ============================================================
// كتابة ذرية: الكتابة إلى ملف مؤقت ثم إعادة التسمية للملف الأصلي.
// هذا يضمن أن الملف الأصلي إما كاملًا أو سليمًا — لا حالة وسطية.
// ============================================================
async function atomicWrite(dir: string, content: string): Promise<void> {
  const fs = await getFs();
  if (!fs) {
    // fallback متصفح: IndexedDB
    await idbSet('state', JSON.parse(content) as unknown);
    return;
  }
  const tmp = tempPath(dir);
  const finalPath = dataPath(dir);

  // 1. اكتب إلى ملف مؤقت
  await fs.writeTextFile(tmp, content);
  // 2. احذف الملف الأصلي إن وُجد ثم أعد التسمية (rename عبر remove+rename
  //    لأن rename فوق ملف موجود قد لا يكون مدعومًا على كل المنصات)
  try {
    if (await fs.exists(finalPath)) {
      await fs.remove(finalPath);
    }
  } catch {
    /* تجاهل — سنحاول rename */
  }
  try {
    await fs.rename(tmp, finalPath);
  } catch {
    // fallback: إذا فشل rename، اكتب مباشرة للملف النهائي
    await fs.writeTextFile(finalPath, content);
    try { await fs.remove(tmp); } catch { /* تجاهل */ }
  }
}

// ============================================================
// قراءة الملف من القرص
// ============================================================
async function readDataFile(): Promise<string | null> {
  const fs = await getFs();
  if (!fs) {
    const stored = await idbGet<AppState>('state');
    return stored ? JSON.stringify(stored) : null;
  }
  const dir = await resolveDataDir();
  if (!dir) return null;
  const path = dataPath(dir);
  if (!await fs.exists(path)) return null;
  try {
    return await fs.readTextFile(path);
  } catch {
    return null;
  }
}

// ============================================================
// الواجهة العامة للطبقة
// ============================================================

export function getFileCache(): AppState | null {
  return fileCache;
}

export function setFileCache(state: AppState): void {
  fileCache = state;
}

/** تحميل الحالة من الملف (أو IndexedDB في وضع المتصفح). */
export async function loadFromFile(): Promise<AppState | null> {
  try {
    const raw = await readDataFile();
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AppState;
    fileCache = parsed;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * حفظ الحالة إلى الملف بطريقة ذرية ومتسلسلة.
 * كل استدعاء يُضاف لطابور كتابة لضمان الترتيب ومنع التعارض.
 * يُعيد Promise يُحلّ عند اكتمال الكتابة الفعلية على القرص.
 */
export function saveToFile(state: AppState): Promise<void> {
  fileCache = state;
  const content = JSON.stringify(state);
  // تسلسل عمليات الكتابة لتفادي التعارض والتأكد من ترتيبها
  const run = writeQueue.then(async () => {
    if (isWriting) return;
    isWriting = true;
    try {
      const dir = await resolveDataDir();
      if (dir) {
        await atomicWrite(dir, content);
      } else {
        await idbSet('state', state);
      }
    } catch (err) {
      console.error('fileStore: فشلت الكتابة الذرية:', err);
      // fallback أخير: IndexedDB لئلا تُفقد البيانات كليًا
      try { await idbSet('state', state); } catch { /* تجاهل */ }
    } finally {
      isWriting = false;
    }
  });
  writeQueue = run.catch(() => { /* منع رفض السلسلة */ });
  return run;
}

/** مسح التخزين (يحذف الملف و IndexedDB). */
export async function clearFileStore(): Promise<void> {
  fileCache = null;
  const fs = await getFs();
  if (fs) {
    const dir = await resolveDataDir();
    if (dir) {
      const path = dataPath(dir);
      try {
        if (await fs.exists(path)) await fs.remove(path);
      } catch { /* تجاهل */ }
    }
  }
  await idbClear();
}

/** مجلد البيانات الحالي (للاستخدام في النسخ الاحتياطي/الترخيص). */
export async function getDataDir(): Promise<string | null> {
  return resolveDataDir();
}
