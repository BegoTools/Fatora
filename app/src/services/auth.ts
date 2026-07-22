// ============================================================
// Easy Store ERP - خدمة المصادقة المحلية (Local Auth Service)
// ------------------------------------------------------------
// نظام تسجيل دخول وإنشاء حساب يعمل بالكامل داخل المتصفح،
// تُخزَّن الحسابات في IndexedDB مع تشفير كلمات السر (SHA-256 + salt).
// ============================================================

import type { AuthAccount, User, UserRole } from '@/types';
import { idbGet, idbSet } from '@/db/idb';

const USERS_KEY = 'auth_users';
const SESSION_KEY = 'auth_session';

// ------------------------------------------------------------
// أدوات التشفير (Web Crypto)
// ------------------------------------------------------------
function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function randomSalt(): string {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return toHex(arr.buffer);
}

async function hashPassword(password: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${password}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return toHex(digest);
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
  if (password.length < 6) return { ok: false, error: 'weak_password' };

  const accounts = await getAccounts();
  if (accounts.some(a => a.email === cleanEmail)) {
    return { ok: false, error: 'email_exists' };
  }

  const salt = randomSalt();
  const passwordHash = await hashPassword(password, salt);
  // أول مستخدم يصبح المالك، والباقي موظفون افتراضيًا
  const role: UserRole = accounts.length === 0 ? 'owner' : 'employee';

  const account: AuthAccount = {
    id: `user-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    name: cleanName,
    email: cleanEmail,
    role,
    passwordHash,
    salt,
    isActive: true,
    createdAt: new Date().toISOString(),
  };

  accounts.push(account);
  await saveAccounts(accounts);
  await idbSet(SESSION_KEY, account.id);
  return { ok: true, user: toPublicUser(account) };
}

// ------------------------------------------------------------
// تسجيل الدخول
// ------------------------------------------------------------
export async function login(email: string, password: string): Promise<AuthResult> {
  const cleanEmail = email.trim().toLowerCase();
  const accounts = await getAccounts();
  const account = accounts.find(a => a.email === cleanEmail);
  if (!account) return { ok: false, error: 'invalid_credentials' };
  if (!account.isActive) return { ok: false, error: 'inactive' };

  const hash = await hashPassword(password, account.salt);
  if (hash !== account.passwordHash) return { ok: false, error: 'invalid_credentials' };

  await idbSet(SESSION_KEY, account.id);
  return { ok: true, user: toPublicUser(account) };
}

// ------------------------------------------------------------
// جلسة المستخدم الحالية
// ------------------------------------------------------------
export async function getCurrentUser(): Promise<User | null> {
  const sessionId = await idbGet<string>(SESSION_KEY);
  if (!sessionId) return null;
  const accounts = await getAccounts();
  const account = accounts.find(a => a.id === sessionId);
  return account && account.isActive ? toPublicUser(account) : null;
}

export async function logout(): Promise<void> {
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
  if (password.length < 6) return { ok: false, error: 'weak_password' };
  // لا يمكن إنشاء حساب مالك جديد؛ المالك هو أول من يسجّل فقط
  if (role === 'owner') return { ok: false, error: 'owner_protected' };

  const accounts = await getAccounts();
  if (accounts.some(a => a.email === cleanEmail)) {
    return { ok: false, error: 'email_exists' };
  }

  const salt = randomSalt();
  const passwordHash = await hashPassword(password, salt);
  const account: AuthAccount = {
    id: `user-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    name: cleanName,
    email: cleanEmail,
    role,
    passwordHash,
    salt,
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
  // حماية المالك: لا يمكن تغيير رتبته أو إيقافه
  if (account.role === 'owner' && ((changes.role !== undefined && changes.role !== 'owner') || changes.isActive === false)) {
    return { ok: false, error: 'owner_protected' };
  }
  // لا يمكن ترقية مستخدم آخر إلى مالك
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
  if (newPassword.length < 6) return { ok: false, error: 'weak_password' };
  const accounts = await getAccounts();
  const account = accounts.find(a => a.id === userId);
  if (!account) return { ok: false, error: 'not_found' };

  const oldHash = await hashPassword(oldPassword, account.salt);
  if (oldHash !== account.passwordHash) return { ok: false, error: 'invalid_credentials' };

  account.salt = randomSalt();
  account.passwordHash = await hashPassword(newPassword, account.salt);
  await saveAccounts(accounts);
  return { ok: true, user: toPublicUser(account) };
}
