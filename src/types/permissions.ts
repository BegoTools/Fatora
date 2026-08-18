// ============================================================
// Easy Store ERP - نظام الصلاحيات (Permissions Model)
// ------------------------------------------------------------
// صلاحيات على مستوى الوحدة (module) لكل إجراء: عرض/إنشاء/تعديل/حذف.
// الرتب (Roles) قابلة للإنشاء والتعديل والحذف من قبل المالك.
// ============================================================

export type PermissionModule =
  | 'dashboard'
  | 'inventory'
  | 'sales'
  | 'customers'
  | 'returns'
  | 'exchange'
  | 'purchases'
  | 'expenses'
  | 'treasury'
  | 'reports'
  | 'hr'
  | 'settings'
  | 'users';

export type PermissionAction = 'view' | 'create' | 'edit' | 'delete';

export type ModulePermissions = Record<PermissionAction, boolean>;

export type RolePermissions = Record<PermissionModule, ModulePermissions>;

export interface RoleDefinition {
  id: string;
  name: string;
  nameAr: string;
  description?: string;
  descriptionAr?: string;
  isSystem: boolean;
  permissions: RolePermissions;
  createdAt?: string;
}

export const PERMISSION_MODULES: PermissionModule[] = [
  'dashboard',
  'inventory',
  'sales',
  'customers',
  'returns',
  'exchange',
  'purchases',
  'expenses',
  'treasury',
  'reports',
  'hr',
  'settings',
  'users',
];

export const PERMISSION_ACTIONS: PermissionAction[] = ['view', 'create', 'edit', 'delete'];

// ------------------------------------------------------------
// أدوات بناء الصلاحيات
// ------------------------------------------------------------
export function emptyModulePermissions(): ModulePermissions {
  return { view: false, create: false, edit: false, delete: false };
}

export function fullModulePermissions(): ModulePermissions {
  return { view: true, create: true, edit: true, delete: true };
}

export function emptyPermissions(): RolePermissions {
  const perms = {} as RolePermissions;
  for (const m of PERMISSION_MODULES) perms[m] = emptyModulePermissions();
  return perms;
}

export function fullPermissions(): RolePermissions {
  const perms = {} as RolePermissions;
  for (const m of PERMISSION_MODULES) perms[m] = fullModulePermissions();
  return perms;
}

// يبني صلاحيات من وصف جزئي (باقي الوحدات = لا شيء)
export function makePermissions(
  partial: Partial<Record<PermissionModule, Partial<ModulePermissions>>>,
): RolePermissions {
  const perms = emptyPermissions();
  for (const key of Object.keys(partial) as PermissionModule[]) {
    perms[key] = { ...emptyModulePermissions(), ...partial[key] };
  }
  return perms;
}

// يدمج صلاحيات محفوظة مع الهيكل الكامل (لضمان وجود كل الوحدات/الإجراءات)
export function normalizePermissions(input?: Partial<RolePermissions> | null): RolePermissions {
  const base = emptyPermissions();
  if (!input) return base;
  for (const m of PERMISSION_MODULES) {
    const mod = input[m];
    if (mod) base[m] = { ...base[m], ...mod };
  }
  return base;
}

export function canDo(
  permissions: RolePermissions,
  module: PermissionModule,
  action: PermissionAction,
): boolean {
  return !!permissions[module]?.[action];
}
