// ============================================================
// Easy Store ERP - خدمة الرتب والصلاحيات (Roles Service)
// ------------------------------------------------------------
// تُخزَّن تعريفات الرتب في IndexedDB. الرتب المدمجة تُزرع تلقائياً.
// المالك (owner) رتبة نظام لا يمكن حذفها وتملك كل الصلاحيات دائماً.
// ============================================================

import { idbGet, idbSet } from '@/db/idb';
import type { RoleDefinition, PermissionModule, PermissionAction } from '@/types/permissions';
import {
  fullPermissions,
  makePermissions,
  normalizePermissions,
  canDo,
} from '@/types/permissions';

const ROLES_KEY = 'auth_roles';

// ------------------------------------------------------------
// الرتب المدمجة الافتراضية
// ------------------------------------------------------------
export function defaultRoles(): RoleDefinition[] {
  return [
    {
      id: 'owner',
      name: 'Owner',
      nameAr: 'المالك',
      description: 'Full control over the entire system.',
      descriptionAr: 'تحكم كامل في جميع أجزاء النظام.',
      isSystem: true,
      permissions: fullPermissions(),
    },
    {
      id: 'admin',
      name: 'Admin',
      nameAr: 'مدير النظام',
      description: 'System administration and user management.',
      descriptionAr: 'إدارة النظام والمستخدمين.',
      isSystem: true,
      permissions: fullPermissions(),
    },
    {
      id: 'manager',
      name: 'Manager',
      nameAr: 'مدير',
      description: 'Oversees operations, reports and approvals.',
      descriptionAr: 'متابعة العمليات والتقارير والاعتماد.',
      isSystem: true,
      permissions: makePermissions({
        dashboard: { view: true },
        inventory: { view: true, create: true, edit: true },
        sales: { view: true, create: true, edit: true },
        customers: { view: true, create: true, edit: true, delete: true },
        returns: { view: true, create: true, edit: true },
        exchange: { view: true, create: true, edit: true },
        purchases: { view: true, create: true, edit: true },
        expenses: { view: true, create: true, edit: true, delete: true },
        treasury: { view: true },
        reports: { view: true },
        hr: { view: true, edit: true },
        users: { view: true },
      }),
    },
    {
      id: 'sales',
      name: 'Sales',
      nameAr: 'مبيعات',
      description: 'Create quotes and sales invoices, manage customers.',
      descriptionAr: 'إنشاء عروض الأسعار وفواتير البيع وإدارة العملاء.',
      isSystem: true,
      permissions: makePermissions({
        dashboard: { view: true },
        inventory: { view: true },
        sales: { view: true, create: true, edit: true },
        customers: { view: true, create: true, edit: true },
        returns: { view: true, create: true },
        exchange: { view: true, create: true },
      }),
    },
    {
      id: 'accountant',
      name: 'Accountant',
      nameAr: 'محاسب',
      description: 'Payments, financial reports, expenses and revenues.',
      descriptionAr: 'المدفوعات والتقارير المالية والمصروفات والإيرادات.',
      isSystem: true,
      permissions: makePermissions({
        dashboard: { view: true },
        sales: { view: true },
        purchases: { view: true },
        expenses: { view: true, create: true, edit: true },
        treasury: { view: true, create: true, edit: true },
        reports: { view: true },
      }),
    },
    {
      id: 'cashier',
      name: 'Cashier',
      nameAr: 'كاشير',
      description: 'Point of sale and quick invoicing.',
      descriptionAr: 'نقطة البيع والفوترة السريعة.',
      isSystem: true,
      permissions: makePermissions({
        dashboard: { view: true },
        inventory: { view: true },
        sales: { view: true, create: true },
        customers: { view: true, create: true },
        returns: { view: true, create: true },
        exchange: { view: true, create: true },
      }),
    },
    {
      id: 'warehouse',
      name: 'Warehouse',
      nameAr: 'المخزن',
      description: 'Inventory, stocktaking, receiving and delivering goods.',
      descriptionAr: 'المخزون والجرد واستلام وتسليم البضائع.',
      isSystem: true,
      permissions: makePermissions({
        dashboard: { view: true },
        inventory: { view: true, create: true, edit: true, delete: true },
        purchases: { view: true },
      }),
    },
    {
      id: 'purchasing',
      name: 'Purchasing',
      nameAr: 'المشتريات',
      description: 'Purchase orders and supplier management.',
      descriptionAr: 'أوامر الشراء وإدارة الموردين.',
      isSystem: true,
      permissions: makePermissions({
        dashboard: { view: true },
        inventory: { view: true },
        purchases: { view: true, create: true, edit: true },
        expenses: { view: true, create: true },
      }),
    },
    {
      id: 'customer_service',
      name: 'Customer Service',
      nameAr: 'خدمة العملاء',
      description: 'View customers and sales, handle inquiries.',
      descriptionAr: 'عرض العملاء والمبيعات والتعامل مع الاستفسارات.',
      isSystem: true,
      permissions: makePermissions({
        dashboard: { view: true },
        sales: { view: true },
        customers: { view: true, create: true, edit: true },
        returns: { view: true },
        exchange: { view: true },
      }),
    },
    {
      id: 'employee',
      name: 'Employee',
      nameAr: 'موظف',
      description: 'Basic access to the dashboard.',
      descriptionAr: 'وصول أساسي للوحة التحكم.',
      isSystem: true,
      permissions: makePermissions({
        dashboard: { view: true },
      }),
    },
  ];
}

const SYSTEM_ROLE_IDS = defaultRoles().map(r => r.id);

export function isSystemRoleId(id: string): boolean {
  return SYSTEM_ROLE_IDS.includes(id);
}

// ------------------------------------------------------------
// التحميل والحفظ (مع زرع الرتب المدمجة وضمان اكتمال الهيكل)
// ------------------------------------------------------------
import { supabase } from '@/services/supabase';
import { getCurrentUser } from '@/services/auth';

export async function getRoles(): Promise<RoleDefinition[]> {
  const defaults = defaultRoles();
  const byId = new Map<string, RoleDefinition>();

  for (const def of defaults) byId.set(def.id, def);

  let stored: RoleDefinition[] = [];
  try {
    const user = await getCurrentUser();
    if (user && user.teamId) {
      const { data, error } = await supabase
        .from('team_data')
        .select('state_json')
        .eq('team_id', user.teamId)
        .single();
      
      if (!error && data?.state_json?.customRoles) {
        stored = data.state_json.customRoles;
        // Keep IDB as a local backup
        await idbSet(ROLES_KEY, stored);
      } else {
        stored = (await idbGet<RoleDefinition[]>(ROLES_KEY)) ?? [];
      }
    } else {
      stored = (await idbGet<RoleDefinition[]>(ROLES_KEY)) ?? [];
    }
  } catch {
    stored = (await idbGet<RoleDefinition[]>(ROLES_KEY)) ?? [];
  }

  for (const role of stored) {
    if (role.id === 'owner') continue; // المالك دائماً كامل الصلاحيات
    const existing = byId.get(role.id);
    byId.set(role.id, {
      ...(existing ?? role),
      ...role,
      isSystem: existing ? existing.isSystem : false,
      permissions: role.id === 'owner' ? fullPermissions() : normalizePermissions(role.permissions),
    });
  }

  // ترتيب: الرتب المدمجة أولاً بترتيبها ثم المخصّصة
  const order = new Map(defaults.map((r, i) => [r.id, i]));
  return Array.from(byId.values()).sort((a, b) => {
    const ai = order.has(a.id) ? order.get(a.id)! : 999;
    const bi = order.has(b.id) ? order.get(b.id)! : 999;
    if (ai !== bi) return ai - bi;
    return (a.createdAt ?? '').localeCompare(b.createdAt ?? '');
  });
}

async function saveRoles(roles: RoleDefinition[]): Promise<void> {
  const customRoles = roles.filter(r => r.id !== 'owner');
  await idbSet(ROLES_KEY, customRoles);
  
  try {
    const user = await getCurrentUser();
    if (user && user.teamId) {
      // Fetch current state, append customRoles, save back
      const { data } = await supabase
        .from('team_data')
        .select('state_json')
        .eq('team_id', user.teamId)
        .single();
      
      if (data) {
        const state_json = { ...data.state_json, customRoles };
        await supabase
          .from('team_data')
          .update({ state_json, updated_at: new Date().toISOString() })
          .eq('team_id', user.teamId);
      }
    }
  } catch (err) {
    console.error('Failed to sync roles to supabase:', err);
  }
}

export async function getRole(id: string): Promise<RoleDefinition | undefined> {
  const roles = await getRoles();
  return roles.find(r => r.id === id);
}

export function slugifyRoleId(name: string): string {
  const base = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return base || `role_${Date.now()}`;
}

export interface RoleSaveResult {
  ok: boolean;
  role?: RoleDefinition;
  error?: 'exists' | 'invalid' | 'protected' | 'not_found';
}

export async function createRole(
  name: string,
  nameAr: string,
  permissions: RoleDefinition['permissions'],
  extra?: { description?: string; descriptionAr?: string; id?: string },
): Promise<RoleSaveResult> {
  const cleanName = name.trim();
  if (!cleanName) return { ok: false, error: 'invalid' };
  const roles = await getRoles();
  const id = extra?.id?.trim() || slugifyRoleId(cleanName);
  if (roles.some(r => r.id === id)) return { ok: false, error: 'exists' };

  const role: RoleDefinition = {
    id,
    name: cleanName,
    nameAr: nameAr.trim() || cleanName,
    description: extra?.description,
    descriptionAr: extra?.descriptionAr,
    isSystem: false,
    permissions: normalizePermissions(permissions),
    createdAt: new Date().toISOString(),
  };
  await saveRoles([...roles, role]);
  return { ok: true, role };
}

export async function updateRole(
  id: string,
  changes: Partial<Pick<RoleDefinition, 'name' | 'nameAr' | 'description' | 'descriptionAr' | 'permissions'>>,
): Promise<RoleSaveResult> {
  if (id === 'owner') return { ok: false, error: 'protected' };
  const roles = await getRoles();
  const role = roles.find(r => r.id === id);
  if (!role) return { ok: false, error: 'not_found' };

  const updated: RoleDefinition = {
    ...role,
    name: changes.name?.trim() || role.name,
    nameAr: changes.nameAr?.trim() || role.nameAr,
    description: changes.description ?? role.description,
    descriptionAr: changes.descriptionAr ?? role.descriptionAr,
    permissions: changes.permissions ? normalizePermissions(changes.permissions) : role.permissions,
  };
  const next = roles.map(r => (r.id === id ? updated : r));
  await saveRoles(next);

  // Sync these updated permissions to all users who have this role
  if (changes.permissions) {
    try {
      const user = await getCurrentUser();
      if (user && user.teamId) {
        const { data: members } = await supabase
          .from('team_members')
          .select('id')
          .eq('team_id', user.teamId)
          .eq('role', id);
        
        if (members && members.length > 0) {
          const permsToInsert: any[] = [];
          for (const member of members) {
            for (const [module, p] of Object.entries(updated.permissions)) {
              permsToInsert.push({
                team_member_id: member.id,
                team_id: user.teamId,
                module,
                can_view: p.view || false,
                can_create: p.create || false,
                can_edit: p.edit || false,
                can_delete: p.delete || false,
                updated_at: new Date().toISOString(),
              });
            }
          }
          if (permsToInsert.length > 0) {
            const { error: upsertErr } = await supabase.from('permissions').upsert(permsToInsert, { onConflict: 'team_member_id, module' });
            if (upsertErr) console.warn('updateRole permissions sync warning:', upsertErr.message);
            
            // Broadcast the change to immediately update connected clients
            for (const member of members) {
              await supabase.channel(`team_${user.teamId}`).send({
                type: 'broadcast',
                event: 'permissions_updated',
                payload: { team_member_id: member.id }
              });
            }
          }
        }
      }
    } catch (err) {
      console.error('Failed to sync updated role permissions to users:', err);
    }
  }

  return { ok: true, role: updated };
}

export async function deleteRole(id: string): Promise<RoleSaveResult> {
  if (isSystemRoleId(id)) return { ok: false, error: 'protected' };
  const roles = await getRoles();
  if (!roles.some(r => r.id === id)) return { ok: false, error: 'not_found' };
  await saveRoles(roles.filter(r => r.id !== id));
  return { ok: true };
}

// ------------------------------------------------------------
// التحقق من صلاحية
// ------------------------------------------------------------
export function roleCan(
  role: RoleDefinition | undefined,
  module: PermissionModule,
  action: PermissionAction,
): boolean {
  if (!role) return false;
  if (role.id === 'owner') return true;
  return canDo(role.permissions, module, action);
}
