// ============================================================
// Easy Store ERP - نظام الترخيص المحلي (Local Licensing)
// ------------------------------------------------------------
// - بصمة جهاز (device fingerprint) من معطيات التشغيل.
// - مفتاح ترخيص موقّع HMAC محليًا (offline، لا سيرفر).
// - حالات: trial (14 يوم) / active / expired.
// - عند انتهاء الصلاحية: التطبيق يصبح للقراءة فقط (لا حذف للبيانات).
// ملاحظة: هذا حد معقول للحد من النسخ السهل، وليس DRM كاملًا.
// ============================================================

import { isTauri } from '@/db/fileStore';

export type LicenseStatus = 'trial' | 'active' | 'expired';

export interface LicenseInfo {
  status: LicenseStatus;
  deviceFingerprint: string;
  activatedAt?: string;
  expiryAt?: string;       // تاريخ انتهاء الصلاحية (active)
  trialStartedAt?: string; // بداية فترة التجربة
  trialEndsAt?: string;    // نهاية فترة التجربة (14 يومًا)
  licenseKey?: string;
  customerName?: string;
  isReadOnly: boolean;     // true عند انتهاء الصلاحية (قراءة فقط)
}

const TRIAL_DAYS = 14;
const TRIAL_STORAGE_KEY = 'easy_store_trial_start';
const LICENSE_STORAGE_KEY = 'easy_store_active_license';

const memStorage: Record<string, string> = {};

function safeGetItem(key: string): string | null {
  if (typeof localStorage !== 'undefined' && localStorage.getItem) {
    return localStorage.getItem(key);
  }
  return memStorage[key] ?? null;
}

function safeSetItem(key: string, value: string): void {
  if (typeof localStorage !== 'undefined' && localStorage.setItem) {
    localStorage.setItem(key, value);
  } else {
    memStorage[key] = value;
  }
}

function safeRemoveItem(key: string): void {
  if (typeof localStorage !== 'undefined' && localStorage.removeItem) {
    localStorage.removeItem(key);
  } else {
    delete memStorage[key];
  }
}

// مفتاح توقيع HMAC للترخيص (سر التحقق). يُستخدم للتحقق من أن المفتاح
// صدر بواسطة أداة المولّد لديك (تقييد النسخ). ليس سريًا مشفرًا قويًا
// لكنه كافٍ للحد من التفعيل العشوائي.
const LICENSE_SIGNING_SECRET = 'easy_store_license_signing_v1';

// ============================================================
// بصمة الجهاز: تجميع معطيات البيئة في hash مستقر.
// تحت Tauri: hostname + platform + arch + memory.
// في المتصفح: userAgent + لغة + دقة الشاشة + timezone.
// ============================================================
async function sha256(input: string): Promise<string> {
  try {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
      return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
    }
  } catch { /* fallback */ }
  // fallback بسيط
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0');
}

export async function getDeviceFingerprint(): Promise<string> {
  const parts: string[] = [];
  if (isTauri()) {
    try {
      const os = await import('@tauri-apps/plugin-os');
      parts.push('tauri');
      try { parts.push(await os.hostname() || 'unknown'); } catch { /* قد لا يتوفر */ }
      try { parts.push(os.platform()); } catch { /* تجاهل */ }
      try { parts.push(os.arch()); } catch { /* تجاهل */ }
      try { parts.push(String(os.version())); } catch { /* تجاهل */ }
    } catch {
      parts.push('tauri-unknown');
    }
  } else {
    parts.push('web');
    if (typeof navigator !== 'undefined') {
      parts.push(navigator.userAgent);
      parts.push(navigator.language);
    }
    if (typeof screen !== 'undefined') {
      parts.push(`${screen.width}x${screen.height}x${screen.colorDepth}`);
    }
    if (typeof Intl !== 'undefined') {
      parts.push(Intl.DateTimeFormat().resolvedOptions().timeZone || '');
    }
  }
  return sha256(parts.join('|'));
}

// ============================================================
// توقيع HMAC للترخيص (التحقق من صحة المفتاح)
// ============================================================
async function signLicense(message: string): Promise<string> {
  try {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const enc = new TextEncoder().encode(LICENSE_SIGNING_SECRET);
      const key = await crypto.subtle.importKey(
        'raw', enc, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
      );
      const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
      return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
    }
  } catch { /* fallback */ }
  return sha256(LICENSE_SIGNING_SECRET + message);
}

// ============================================================
// التحقق من مفتاح الترخيص.
// تنسيق المفتاح: <payloadBase64Url>.<signatureHex>
// payload = JSON { device, customerName, issuedAt, expiryAt, type: 'license' }
// ============================================================
export interface LicensePayload {
  device: string;
  customerName: string;
  issuedAt: string;
  expiryAt: string;
  type: 'license';
}

export async function validateLicenseKey(key: string, expectedDevice: string): Promise<{ ok: true; payload: LicensePayload } | { ok: false; error: string }> {
  const trimmed = key.trim();
  const dot = trimmed.lastIndexOf('.');
  if (dot <= 0 || dot >= trimmed.length - 1) {
    return { ok: false, error: 'صيغة المفتاح غير صحيحة' };
  }
  const payloadB64 = trimmed.substring(0, dot);
  const signature = trimmed.substring(dot + 1);
  let payloadStr: string;
  try {
    payloadStr = atob(payloadB64);
  } catch {
    return { ok: false, error: 'تعذّر فك ترميز المفتاح' };
  }
  const expectedSig = await signLicense(payloadStr);
  if (expectedSig !== signature.toLowerCase()) {
    return { ok: false, error: 'التوقيع غير صالح — مفتاح مزيف أو معبث' };
  }
  let payload: LicensePayload;
  try {
    payload = JSON.parse(payloadStr);
  } catch {
    return { ok: false, error: 'بيانات الترخيص تالفة' };
  }
  if (payload.type !== 'license') {
    return { ok: false, error: 'نوع المفتاح غير مدعوم' };
  }
  if (payload.device !== expectedDevice) {
    return { ok: false, error: 'هذا المفتاح مخصص لجهاز آخر' };
  }
  // تحقق من عدم انتهاء الصلاحية
  const expiry = new Date(payload.expiryAt).getTime();
  if (Number.isNaN(expiry)) {
    return { ok: false, error: 'تاريخ انتهاء غير صالح' };
  }
  return { ok: true, payload };
}

// ============================================================
// تفعيل الترخيص (تخزين محلي)
// ============================================================
export async function activateLicense(key: string): Promise<{ ok: true; info: LicenseInfo } | { ok: false; error: string }> {
  const device = await getDeviceFingerprint();
  const result = await validateLicenseKey(key, device);
  if (!result.ok) return result;

  const info: LicenseInfo = {
    status: 'active',
    deviceFingerprint: device,
    activatedAt: result.payload.issuedAt,
    expiryAt: result.payload.expiryAt,
    licenseKey: key.trim(),
    customerName: result.payload.customerName,
    isReadOnly: false,
  };
  safeSetItem(LICENSE_STORAGE_KEY, JSON.stringify(info));
  return { ok: true, info };
}

// ============================================================
// فترة التجربة (14 يومًا) — تبدأ تلقائيًا عند أول إقلاع
// ============================================================
function startTrialIfNeeded(): string {
  let start = safeGetItem(TRIAL_STORAGE_KEY);
  if (!start) {
    start = new Date().toISOString();
    safeSetItem(TRIAL_STORAGE_KEY, start);
  }
  return start;
}

function trialEndsAt(startISO: string): string {
  const start = new Date(startISO);
  start.setDate(start.getDate() + TRIAL_DAYS);
  return start.toISOString();
}

// ============================================================
// إلغاء التفعيل (إزالة الترخيص المحلي)
// ============================================================
export function deactivateLicense(): void {
  safeRemoveItem(LICENSE_STORAGE_KEY);
}

// ============================================================
// الحصول على حالة الترخيص الحالية
// ============================================================
export async function getLicenseInfo(): Promise<LicenseInfo> {
  const device = await getDeviceFingerprint();

  // 1. تحقق من الترخيص المفعّل
  const stored = safeGetItem(LICENSE_STORAGE_KEY);
  if (stored) {
    try {
      const info = JSON.parse(stored) as LicenseInfo;
      if (info.status === 'active' && info.expiryAt) {
        const now = Date.now();
        const expiry = new Date(info.expiryAt).getTime();
        if (now > expiry) {
          // انتهت الصلاحية → قراءة فقط
          return {
            ...info,
            status: 'expired',
            deviceFingerprint: device,
            isReadOnly: true,
          };
        }
        return { ...info, deviceFingerprint: device, isReadOnly: false };
      }
    } catch {
      /* بيانات تالفة — نكمل للتجربة */
    }
  }

  // 2. فترة التجربة
  const trialStart = startTrialIfNeeded();
  const trialEnd = trialEndsAt(trialStart);
  const now = Date.now();
  if (now > new Date(trialEnd).getTime()) {
    return {
      status: 'expired',
      deviceFingerprint: device,
      trialStartedAt: trialStart,
      trialEndsAt: trialEnd,
      isReadOnly: true,
    };
  }
  return {
    status: 'trial',
    deviceFingerprint: device,
    trialStartedAt: trialStart,
    trialEndsAt: trialEnd,
    isReadOnly: false,
  };
}

// ============================================================
// إعادة ضبط التجربة (للاختبار فقط — لا تُستخدم في الإنتاج)
// ============================================================
export function _resetTrialForTesting(): void {
  safeRemoveItem(TRIAL_STORAGE_KEY);
  safeRemoveItem(LICENSE_STORAGE_KEY);
}

// ============================================================
// مساعدة: أيام متبقية في التجربة
// ============================================================
export function getTrialDaysRemaining(info: LicenseInfo): number {
  if (info.status !== 'trial' || !info.trialEndsAt) return 0;
  const ms = new Date(info.trialEndsAt).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}

// ============================================================
// مساعدة: إعادة بناء مفتاح ترخيص من payload (للأداة المولّدة جانبًا).
// هذه الدالة تُصدَّر فقط ليستخدمها سكربت المولّد، ولا تُستدعى داخل التطبيق.
// ============================================================
export async function buildLicenseKey(payload: LicensePayload): Promise<string> {
  const payloadStr = JSON.stringify(payload);
  const b64 = btoa(payloadStr);
  const sig = await signLicense(payloadStr);
  return `${b64}.${sig}`;
}
