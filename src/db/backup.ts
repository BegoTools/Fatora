// ============================================================
// Easy Store ERP - النسخ الاحتياطي والاستعادة (Backup & Restore)
// ------------------------------------------------------------
// - نسخ تلقائي يومي: يحتفظ بآخر 7 نسخ بجانب ملف البيانات.
// - نسخ يدوي: تصدير ملف .esbak موقّع (توقيع HMAC بسيط للتحقق).
// - استعادة: من ملف .esbak أو .json مع تحقق التوقيع عند وجوده.
// كل العمليات محلية على جهاز المستخدم — لا سيرفر.
// ============================================================

import type { AppState } from '@/types';
import { isTauri, getDataDir } from './fileStore';

const BACKUP_PREFIX = 'data.daily-';
const BACKUP_COUNT = 7;
const BACKUP_SIGNATURE_SECRET = 'easy_store_local_backup_v1';

// ============================================================
// توقيع بسيط (hash) للتحقق من سلامة النسخة الاحتياطية.
// يستخدم SubtleCrypto عند توفره، وإلا hash نصي بسيط.
// ملاحظة: هذا التوقيع للتحقق من السلامة (integrity) وليس أمانًا
// مشفرًا قويًا — يكفي لرصد التلف/العبث العرضي.
// ============================================================
async function sign(content: string): Promise<string> {
  try {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const enc = new TextEncoder().encode(BACKUP_SIGNATURE_SECRET);
      const key = await crypto.subtle.importKey(
        'raw', enc, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
      );
      const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(content));
      return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
    }
  } catch {
    /* fallback أدناه */
  }
  // fallback بسيط (فقط إذا لم يتوفر SubtleCrypto)
  let h = 0;
  const s = BACKUP_SIGNATURE_SECRET + content;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return `f:${(h >>> 0).toString(16)}`;
}

// ============================================================
// تنسيق ملف النسخة الاحتياطية (.esbak)
// ============================================================
export interface BackupEnvelope {
  version: 1;
  app: 'easy-store-erp';
  createdAt: string;
  signature: string;
  state: AppState;
}

// ============================================================
// إنشاء نسخة احتياطية موقّعة (للتصدير اليدوي)
// ============================================================
export async function createSignedBackup(state: AppState): Promise<string> {
  const content = JSON.stringify(state);
  const signature = await sign(content);
  const envelope: BackupEnvelope = {
    version: 1,
    app: 'easy-store-erp',
    createdAt: new Date().toISOString(),
    signature,
    state,
  };
  return JSON.stringify(envelope, null, 2);
}

// ============================================================
// التحقق من توقيع نسخة احتياطية واستخراج الحالة
// ============================================================
export async function restoreSignedBackup(json: string): Promise<{ ok: true; state: AppState } | { ok: false; error: string }> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { ok: false, error: 'ملف غير صالح (JSON تالف)' };
  }
  // دعم ملف .esbak موقّع أو ملف JSON خام للحالة
  if (parsed && typeof parsed === 'object' && (parsed as BackupEnvelope).app === 'easy-store-erp' && (parsed as BackupEnvelope).signature) {
    const env = parsed as BackupEnvelope;
    const expected = await sign(JSON.stringify(env.state));
    if (expected !== env.signature) {
      return { ok: false, error: 'فشل التحقق من التوقيع — الملف معبث به أو تالف' };
    }
    return { ok: true, state: env.state };
  }
  // ملف JSON خام للحالة (تصدير قديم)
  if (parsed && typeof parsed === 'object' && Array.isArray((parsed as AppState).items)) {
    return { ok: true, state: parsed as AppState };
  }
  return { ok: false, error: 'بنية الملف غير معروفة' };
}

// ============================================================
// نسخ احتياطي تلقائي يومي (يحتفظ بآخر 7 نسخ على القرص بجانب البيانات)
// ============================================================
export async function runDailyBackupIfNeeded(state: AppState): Promise<void> {
  if (!isTauri()) return; // النسخ التلقائي على القرص متاح فقط تحت Tauri
  const fs = await import('@tauri-apps/plugin-fs');
  const dir = await getDataDir();
  if (!dir) return;

  const today = new Date().toISOString().split('T')[0];
  const flagKey = 'easy_store_last_daily_backup';

  // نفذ نسخًا واحدًا فقط في اليوم
  if (localStorage.getItem(flagKey) === today) return;

  try {
    const backupName = `${BACKUP_PREFIX}${today}.json`;
    const backupPath = `${dir}/backups/${backupName}`;
    if (!await fs.exists(`${dir}/backups`)) {
      await fs.mkdir(`${dir}/backups`, { recursive: true });
    }
    const signed = await createSignedBackup(state);
    await fs.writeTextFile(backupPath, signed);
    localStorage.setItem(flagKey, today);

    // تدوير النسخ: احذف الأقدم من BACKUP_COUNT
    await rotateBackups(dir);
  } catch (err) {
    console.warn('fileStore: فشل النسخ الاحتياطي التلقائي:', err);
  }
}

async function rotateBackups(dir: string): Promise<void> {
  const fs = await import('@tauri-apps/plugin-fs');
  const backupsDir = `${dir}/backups`;
  if (!await fs.exists(backupsDir)) return;
  try {
    const entries = await fs.readDir(backupsDir);
    const daily = entries
      .filter(e => e.name.startsWith(BACKUP_PREFIX) && e.isFile)
      .map(e => ({ name: e.name, path: `${backupsDir}/${e.name}` }))
      .sort((a, b) => b.name.localeCompare(a.name));
    for (const old of daily.slice(BACKUP_COUNT)) {
      try { await fs.remove(old.path); } catch { /* تجاهل */ }
    }
  } catch {
    /* تجاهل */
  }
}

// ============================================================
// قائمة النسخ الاحتياطية اليومية المتاحة (للواجهة)
// ============================================================
export async function listDailyBackups(): Promise<{ name: string; date: string }[]> {
  if (!isTauri()) return [];
  const fs = await import('@tauri-apps/plugin-fs');
  const dir = await getDataDir();
  if (!dir) return [];
  const backupsDir = `${dir}/backups`;
  if (!await fs.exists(backupsDir)) return [];
  try {
    const entries = await fs.readDir(backupsDir);
    return entries
      .filter(e => e.name.startsWith(BACKUP_PREFIX) && e.isFile)
      .map(e => ({ name: e.name, date: e.name.replace(BACKUP_PREFIX, '').replace('.json', '') }))
      .sort((a, b) => b.date.localeCompare(a.date));
  } catch {
    return [];
  }
}

// ============================================================
// استعادة نسخة يومية محددة بالاسم
// ============================================================
export async function restoreDailyBackup(name: string): Promise<{ ok: true; state: AppState } | { ok: false; error: string }> {
  if (!isTauri()) return { ok: false, error: 'الاستعادة من القرص متاحة فقط في نسخة سطح المكتب' };
  const fs = await import('@tauri-apps/plugin-fs');
  const dir = await getDataDir();
  if (!dir) return { ok: false, error: 'تعذّر تحديد مجلد البيانات' };
  const path = `${dir}/backups/${name}`;
  if (!await fs.exists(path)) return { ok: false, error: 'النسخة غير موجودة' };
  try {
    const raw = await fs.readTextFile(path);
    return restoreSignedBackup(raw);
  } catch {
    return { ok: false, error: 'فشلت قراءة النسخة الاحتياطية' };
  }
}
