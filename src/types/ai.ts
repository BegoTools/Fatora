import type { UserRole } from './index';

export type AIActionType =
  | 'ADD_ITEM'
  | 'UPDATE_ITEM'
  | 'ADD_SUPPLIER'
  | 'ADD_CUSTOMER'
  | 'CREATE_SALE'
  | 'CREATE_PURCHASE'
  | 'ADD_TRANSACTION'
  | 'ADD_EMPLOYEE'
  | 'GENERATE_REPORT'
  | 'NAVIGATE';

export interface AIAction {
  type: AIActionType;
  data: Record<string, unknown>;
  message: string;
  messageAr: string;
}

export interface AIActionPlan {
  summary: string;
  summaryAr: string;
  actions: AIAction[];
}

export interface AIResponse {
  type: 'question' | 'action' | 'plan' | 'error';
  message: string;
  messageAr?: string;
  action?: AIAction;
  plan?: AIActionPlan;
}

export type AIPermissionMap = Partial<Record<UserRole, AIActionType[]>> & { employee: AIActionType[] };

export const AI_PERMISSIONS: AIPermissionMap = {
  owner: [
    'ADD_ITEM', 'UPDATE_ITEM', 'ADD_SUPPLIER', 'ADD_CUSTOMER',
    'CREATE_SALE', 'CREATE_PURCHASE', 'ADD_TRANSACTION',
    'ADD_EMPLOYEE', 'GENERATE_REPORT', 'NAVIGATE',
  ],
  admin: [
    'ADD_ITEM', 'UPDATE_ITEM', 'ADD_SUPPLIER', 'ADD_CUSTOMER',
    'CREATE_SALE', 'CREATE_PURCHASE', 'ADD_TRANSACTION',
    'ADD_EMPLOYEE', 'GENERATE_REPORT', 'NAVIGATE',
  ],
  manager: [
    'ADD_ITEM', 'UPDATE_ITEM', 'ADD_SUPPLIER', 'ADD_CUSTOMER',
    'CREATE_SALE', 'CREATE_PURCHASE', 'ADD_TRANSACTION',
    'GENERATE_REPORT', 'NAVIGATE',
  ],
  cashier: [
    'CREATE_SALE', 'ADD_CUSTOMER', 'NAVIGATE',
  ],
  accountant: [
    'ADD_TRANSACTION', 'GENERATE_REPORT', 'NAVIGATE',
  ],
  employee: [
    'NAVIGATE',
  ],
};

export const ACTION_LABELS: Record<AIActionType, { en: string; ar: string }> = {
  ADD_ITEM: { en: 'Add Item', ar: 'إضافة صنف' },
  UPDATE_ITEM: { en: 'Update Item', ar: 'تحديث صنف' },
  ADD_SUPPLIER: { en: 'Add Supplier', ar: 'إضافة مورد' },
  ADD_CUSTOMER: { en: 'Add Customer', ar: 'إضافة عميل' },
  CREATE_SALE: { en: 'Create Sale', ar: 'إنشاء فاتورة مبيعات' },
  CREATE_PURCHASE: { en: 'Create Purchase Order', ar: 'إنشاء أمر شراء' },
  ADD_TRANSACTION: { en: 'Add Transaction', ar: 'إضافة معاملة' },
  ADD_EMPLOYEE: { en: 'Add Employee', ar: 'إضافة موظف' },
  GENERATE_REPORT: { en: 'Generate Report', ar: 'إنشاء تقرير' },
  NAVIGATE: { en: 'Navigate', ar: 'تنقل' },
};
