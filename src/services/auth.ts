// ============================================================
// Easy Store ERP - خدمة المصادقة المحلية (Local Auth Service)
// ------------------------------------------------------------
// نظام تسجيل دخول وإنشاء حساب يعمل بالكامل داخل المتصفح،
// تُخزَّن الحسابات في IndexedDB مع تشفير كلمات السر.
// ============================================================

import type { AuthAccount, User, UserRole } from '@/types';
import { idbGet, idbSet } from '@/db/idb';
import { sha256 } from 'js-sha256';

const USERS_KEY = 'auth_users';
const SESSION_KEY = 'auth_session';
const SESSION_STORE = 'auth_sessions';

// ------------------------------------------------------------
// أدوات مساعدة آمنة للبيئات غير الآمنة (HTTP/Local IP)
// ------------------------------------------------------------
export function safeUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// التشفير القديم باستخدام SHA-256 (مع Fallback في حال عدم توفر SubtleCrypto)
async function hashPasswordLegacy(password: string, salt: string = 'legacy_salt'): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const data = new TextEncoder().encode(`${salt}:${password}`);
    const digest = await crypto.subtle.digest('SHA-256', data);
    return toHex(digest);
  }
  // Secure fallback for non-secure contexts using js-sha256
  return sha256(`${salt}:${password}`);
}

// التشفير الحديث باستخدام PBKDF2
async function hashPasswordPBKDF2(password: string): Promise<string> {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    return await hashPasswordLegacy(password, 'v2');
  }
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );
  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
  const exportedKey = await crypto.subtle.exportKey('raw', key);
  const hashHex = toHex(exportedKey);
  const saltHex = toHex(salt.buffer);
  return `v2$${saltHex}$${hashHex}`;
}

async function verifyPasswordPBKDF2(password: string, storedHash: string): Promise<boolean> {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    return false;
  }
  const parts = storedHash.split('$');
  if (parts.length !== 3) return false;
  const [, saltHex, hashHex] = parts;
  const saltMatch = saltHex.match(/.{1,2}/g);
  if (!saltMatch) return false;
  const salt = new Uint8Array(saltMatch.map(byte => parseInt(byte, 16)));
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );
  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
  const exportedKey = await crypto.subtle.exportKey('raw', key);
  return hashHex === toHex(exportedKey);
}

// ------------------------------------------------------------
// الوصول للحسابات المخزّنة
// ------------------------------------------------------------
async function getAccounts(): Promise<AuthAccount[]> {
  return (await idbGet<AuthAccount[]>(USERS_KEY)) ?? [];
}

async function saveAccounts(accounts: AuthAccount[]): Promise<void> {
  await idbSet(USERS_KEY, accounts);
}

function toPublicUser(acc: AuthAccount): User {
  return {
    id: acc.id,
    name: acc.name,
    email: acc.email,
    role: acc.role,
    isActive: acc.isActive,
  };
}

export interface AuthResult {
  ok: boolean;
  user?: User;
  error?: 'email_exists' | 'invalid_credentials' | 'not_found' | 'inactive' | 'weak_password' | 'invalid_input' | 'owner_protected';
}

// ------------------------------------------------------------
// هل يوجد أي حساب؟ (لتحديد أول مستخدم = المالك)
// ------------------------------------------------------------
export async function hasAnyAccount(): Promise<boolean> {
  const accounts = await getAccounts();
  return accounts.length > 0;
}

// ------------------------------------------------------------
// إنشاء حساب جديد
// ------------------------------------------------------------
export async function register(name: string, email: string, password: string): Promise<AuthResult> {
  const cleanName = name.trim();
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanName || !cleanEmail) return { ok: false, error: 'invalid_input' };
  if (password.length < 8) return { ok: false, error: 'weak_password' };

  const accounts = await getAccounts();
  if (accounts.some(a => a.email === cleanEmail)) {
    return { ok: false, error: 'email_exists' };
  }

  const passwordHash = await hashPasswordPBKDF2(password);
  const role: UserRole = accounts.length === 0 ? 'owner' : 'employee';

  const account: AuthAccount = {
    id: safeUUID(),
    name: cleanName,
    email: cleanEmail,
    role,
    passwordHash,
    salt: 'v2', // لم يعد مستخدماً فعلياً في v2، لكن نحتفظ به لتوافق النوع
    isActive: true,
    createdAt: new Date().toISOString(),
  };

  accounts.push(account);
  await saveAccounts(accounts);
  
  const token = safeUUID();
  const expiresAt = Date.now() + 1000 * 60 * 60 * 24 * 7;
  const session = { id: safeUUID(), token, accountId: account.id, expiresAt, createdAt: Date.now() };
  
  const sessions = (await idbGet<Record<string, unknown>[]>(SESSION_STORE)) ?? [];
  sessions.push(session);
  await idbSet(SESSION_STORE, sessions);
  await idbSet(SESSION_KEY, token);

  return { ok: true, user: toPublicUser(account) };
}

// ------------------------------------------------------------
// تسجيل الدخول
// ------------------------------------------------------------
export async function login(email: string, password: string): Promise<AuthResult> {
  const cleanEmail = email.trim().toLowerCase();
  
  const RATE_LIMIT_KEY = 'auth_attempts_' + cleanEmail;
  const attempts = ((await idbGet<number[]>(RATE_LIMIT_KEY)) ?? []).filter((t: number) => t > Date.now() - 15 * 60 * 1000);
  if (attempts.length >= 5) return { ok: false, error: 'invalid_credentials' };

  const accounts = await getAccounts();
  const account = accounts.find(a => a.email === cleanEmail);
  if (!account) {
    attempts.push(Date.now());
    await idbSet(RATE_LIMIT_KEY, attempts);
    return { ok: false, error: 'invalid_credentials' };
  }
  if (!account.isActive) return { ok: false, error: 'inactive' };

  let valid = false;
  let needsMigration = false;
  
  if (account.passwordHash.startsWith('v2$')) {
    valid = await verifyPasswordPBKDF2(password, account.passwordHash);
  } else {
    // Legacy Hash Check
    const legacyHash = await hashPasswordLegacy(password, account.salt);
    if (account.passwordHash === legacyHash) {
      valid = true;
      needsMigration = true;
    } else {
      // Insecure fallback check
      const insecureHash = btoa(password + account.salt).split('').reverse().join('');
      if (account.passwordHash === insecureHash) {
        valid = true;
        needsMigration = true;
      }
    }
  }

  if (!valid) {
    attempts.push(Date.now());
    await idbSet(RATE_LIMIT_KEY, attempts);
    return { ok: false, error: 'invalid_credentials' };
  }

  if (needsMigration) {
    account.passwordHash = await hashPasswordPBKDF2(password);
    await saveAccounts(accounts);
  }

  await idbSet(RATE_LIMIT_KEY, []);

  const token = safeUUID();
  const expiresAt = Date.now() + 1000 * 60 * 60 * 24 * 7;
  const session = { id: safeUUID(), token, accountId: account.id, expiresAt, createdAt: Date.now() };
  
  const sessions = (await idbGet<Record<string, unknown>[]>(SESSION_STORE)) ?? [];
  // تنظيف الجلسات المنتهية
  const activeSessions = sessions.filter(s => (s.expiresAt as number) > Date.now());
  activeSessions.push(session);
  await idbSet(SESSION_STORE, activeSessions);
  await idbSet(SESSION_KEY, token);

  return { ok: true, user: toPublicUser(account) };
}

// ------------------------------------------------------------
// جلسة المستخدم الحالية
// ------------------------------------------------------------
export async function getCurrentUser(): Promise<User | null> {
  const token = await idbGet<string>(SESSION_KEY);
  if (!token) return null;
  
  const accounts = await getAccounts();
  
  // التوافق مع الجلسات القديمة التي تستخدم userId مباشرة كـ SESSION_KEY
  const legacyAccount = accounts.find(a => a.id === token);
  if (legacyAccount && legacyAccount.isActive) {
    return toPublicUser(legacyAccount);
  }

  const sessions = (await idbGet<Record<string, unknown>[]>(SESSION_STORE)) ?? [];
  const session = sessions.find(s => s.token === token && (s.expiresAt as number) > Date.now());
  if (!session) return null;
  
  const account = accounts.find(a => a.id === session.accountId);
  return account && account.isActive ? toPublicUser(account) : null;
}

export async function logout(): Promise<void> {
  const token = await idbGet<string>(SESSION_KEY);
  if (token) {
    const sessions = (await idbGet<Record<string, unknown>[]>(SESSION_STORE)) ?? [];
    await idbSet(SESSION_STORE, sessions.filter(s => s.token !== token));
  }
  await idbSet(SESSION_KEY, null);
}

// ------------------------------------------------------------
// إدارة الحسابات (للمالك/المدير)
// ------------------------------------------------------------
export async function listAccounts(): Promise<User[]> {
  const accounts = await getAccounts();
  return accounts.map(toPublicUser);
}

export async function adminCreateAccount(
  name: string,
  email: string,
  password: string,
  role: UserRole,
): Promise<AuthResult> {
  const cleanName = name.trim();
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanName || !cleanEmail) return { ok: false, error: 'invalid_input' };
  if (password.length < 8) return { ok: false, error: 'weak_password' };
  if (role === 'owner') return { ok: false, error: 'owner_protected' };

  const accounts = await getAccounts();
  if (accounts.some(a => a.email === cleanEmail)) {
    return { ok: false, error: 'email_exists' };
  }

  const passwordHash = await hashPasswordPBKDF2(password);
  const account: AuthAccount = {
    id: safeUUID(),
    name: cleanName,
    email: cleanEmail,
    role,
    passwordHash,
    salt: 'v2',
    isActive: true,
    createdAt: new Date().toISOString(),
  };
  accounts.push(account);
  await saveAccounts(accounts);
  return { ok: true, user: toPublicUser(account) };
}

export async function updateAccount(
  id: string,
  changes: { name?: string; role?: UserRole; isActive?: boolean },
): Promise<AuthResult> {
  const accounts = await getAccounts();
  const account = accounts.find(a => a.id === id);
  if (!account) return { ok: false, error: 'not_found' };
  
  if (account.role === 'owner' && ((changes.role !== undefined && changes.role !== 'owner') || changes.isActive === false)) {
    return { ok: false, error: 'owner_protected' };
  }
  if (account.role !== 'owner' && changes.role === 'owner') {
    return { ok: false, error: 'owner_protected' };
  }
  if (changes.name !== undefined) account.name = changes.name.trim() || account.name;
  if (changes.role !== undefined) account.role = changes.role;
  if (changes.isActive !== undefined) account.isActive = changes.isActive;
  await saveAccounts(accounts);
  return { ok: true, user: toPublicUser(account) };
}

export async function deleteAccount(id: string): Promise<AuthResult> {
  const accounts = await getAccounts();
  const account = accounts.find(a => a.id === id);
  if (!account) return { ok: false, error: 'not_found' };
  if (account.role === 'owner') return { ok: false, error: 'owner_protected' };
  await saveAccounts(accounts.filter(a => a.id !== id));
  return { ok: true };
}

// ------------------------------------------------------------
// تغيير كلمة السر للمستخدم الحالي
// ------------------------------------------------------------
export async function changePassword(userId: string, oldPassword: string, newPassword: string): Promise<AuthResult> {
  if (newPassword.length < 8) return { ok: false, error: 'weak_password' };
  const accounts = await getAccounts();
  const account = accounts.find(a => a.id === userId);
  if (!account) return { ok: false, error: 'not_found' };

  let valid = false;
  if (account.passwordHash.startsWith('v2$')) {
    valid = await verifyPasswordPBKDF2(oldPassword, account.passwordHash);
  } else {
    const legacyHash = await hashPasswordLegacy(oldPassword, account.salt);
    valid = account.passwordHash === legacyHash;
    if (!valid) {
      const insecureHash = btoa(oldPassword + account.salt).split('').reverse().join('');
      valid = account.passwordHash === insecureHash;
    }
  }
  
  if (!valid) return { ok: false, error: 'invalid_credentials' };

  account.passwordHash = await hashPasswordPBKDF2(newPassword);
  await saveAccounts(accounts);
  return { ok: true, user: toPublicUser(account) };
}
