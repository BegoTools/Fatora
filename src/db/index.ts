// ============================================================
// Easy Store ERP - إدارة البيانات المحلية (Local Data Management)
// ------------------------------------------------------------
// التخزين الأساسي أصبح ملف JSON حقيقي على القرص عبر Tauri fs في
// الإنتاج (كتابة ذرية + نسخ احتياطي) مع fallback إلى IndexedDB في
// وضع التطوير بالمتصفح. نحتفظ بنسخة في الذاكرة لتوفير واجهة
// متزامنة (sync) للأجزاء التي تحتاجها.
// ============================================================

import type { AppState, CompanySettings, TreasuryAccount, InvoiceDesign } from '@/types';
import { createInvoiceSpreadsheetTemplate } from '@/components/invoice/invoiceSpreadsheetTemplate';
import { idbGet, idbSet } from './idb';
import { loadFromFile, saveToFile, getFileCache, setFileCache, isTauri, clearFileStore } from './fileStore';
import { z } from 'zod';
import { getDefaultWarehouses } from '@/services/warehouse';

const defaultCompany: CompanySettings = {
  name: 'My Store',
  nameAr: 'متجري',
  address: '',
  phone: '',
  email: '',
  commercialRegistration: '',
  currency: 'EGP',
  currencySymbol: 'ج.م',
  fiscalYearStart: `${new Date().getFullYear()}-01-01`,
  // ضريبة افتراضية (مصر: 14%)
  vatRate: 0.14,
  pricesIncludeVat: false,
};

// إعدادات تصميم الفواتير الافتراضية
export function getDefaultInvoiceDesign(): InvoiceDesign {
  return {
    templateId: 'standard',
    accentColor: '#00355f',
    logo: '',
    showLogo: true,
    showManagement: true,
    managementName: '',
    showSalesPerson: true,
    showPreviousBalance: true,
    customField1: { labelEn: '', labelAr: '', value: '' },
    customField2: { labelEn: '', labelAr: '', value: '' },
    footerTextEn: '',
    footerTextAr: '',
    thankYouEn: 'Thank you for your business!',
    thankYouAr: 'شكرًا لتعاملكم معنا',
    labels: {},
    // One persisted sheet is the source of truth for editor, preview, and print.
    spreadsheet: createInvoiceSpreadsheetTemplate(),
    layout: {
      sectionOrder: ['header', 'details', 'items', 'totals', 'footer'],
      fontFamily: 'Arial, sans-serif',
      baseFontSize: 13,
      headerHeight: 112,
      logoWidth: 150,
      tableFontSize: 13,
      showFooter: true,
      tableHeaderColor: '#000000',
      totalsLabelColor: '#434343',
    },
  };
}

// خزينة رئيسية واحدة برصيد صفر حتى يعمل النظام من البداية
function defaultTreasuryAccounts(): TreasuryAccount[] {
  return [
    {
      id: 'acc-1',
      name: 'Main Safe',
      nameAr: 'الخزينة الرئيسية',
      type: 'safe',
      balance: 0,
      isActive: true,
      createdAt: new Date().toISOString(),
    },
  ];
}

// ============================================================
// الحالة الافتراضية = فارغة تمامًا (بداية نظيفة لمستخدم جديد)
// ============================================================
export function getDefaultState(): AppState {
  return {
    company: defaultCompany,
    invoiceDesign: getDefaultInvoiceDesign(),
    categories: [],
    items: [],
    suppliers: [],
    customers: [],
    salesInvoices: [],
    purchaseInvoices: [],
    returns: [],
    exchanges: [],
    customerAdjustments: [],
    creditDebitNotes: [],
    auditLogs: [],
    treasuryAccounts: defaultTreasuryAccounts(),
    transactions: [],
    employees: [],
    attendanceRecords: [],
    payrollRecords: [],
    employeeAdvances: [],
    installments: [],
    fixedAssets: [],
    users: [],
    notifications: [],
    journalEntries: [],
    customerTransactions: [],
    sectorProfile: {
      id: 'general',
      name: 'General Retail & Wholesale',
      nameAr: 'عام / تجارة ومتنوعات',
      descriptionAr: 'قطاع تجاري عام يناسب المتاجر المتنوعة والأنشطة العامة',
      showColorSize: false,
      showWeightScaleBarcode: false,
      showSerialTracking: false,
      showInstallments: true,
      showExpiryDate: false,
      showMaintenanceModule: false,
      defaultModule: 'dashboard',
      allowNegativeStock: false,
      autoItemCoding: true,
    },
    maintenanceReceipts: [],
    warehouses: getDefaultWarehouses(),
    stockTransfers: [],
    bundleAssemblies: [],
  };
}

// حالة فارغة (نفس الافتراضية) — للتصفير الكامل
export function getEmptyState(): AppState {
  return getDefaultState();
}

// ============================================================
// واجهة متزامنة (تعتمد على النسخة المخزّنة في الذاكرة)
// ============================================================
export function loadState(): AppState {
  return getFileCache() ?? getDefaultState();
}

/**
 * حفظ الحالة. يستخدم طبقة تخزين الملف الذرية في الإنتاج (Tauri fs)
 * مع fallback لـ IndexedDB في وضع المتصفح. الكتابة متسلسلة وآمنة.
 * يُعيد Promise يمكن للمستدعي انتظاره لضمان الاستمرارية.
 */
export function saveState(state: AppState): void {
  setFileCache(state);
  // الكتابة للملف بشكل ذرّي ومتسلسل (fire-and-forget آمن: يُسلسل في طابور)
  void saveToFile(state);
}

// ============================================================
// التحميل غير المتزامن من طبقة التخزين عند بدء التطبيق.
// يتضمن ترحيلًا تلقائيًا للبيانات القديمة من IndexedDB إلى ملف القرص
// عند أول إقلاع تحت Tauri (1.3): قراءة من IndexedDB → كتابة للملف
// → تعليم الترحيل تمّ.
// ============================================================
const MIGRATION_FLAG = 'easy_store_migrated_to_file';

export async function loadStateAsync(): Promise<AppState> {
  // 1. اقرأ من الملف (طبقة fileStore) أولًا
  const fromFile = await loadFromFile();
  if (fromFile) {
    const migrated = migrate(fromFile);
    setFileCache(migrated);
    void saveToFile(migrated);
    return migrated;
  }

  // 2. ترحيل من IndexedDB القديم عند أول إقلاع تحت Tauri
  if (isTauri()) {
    try {
      const migratedFlag = localStorage.getItem(MIGRATION_FLAG);
      const stored = await idbGet<AppState>('state');
      if (stored && !migratedFlag) {
        // ترحيل البيانات القديمة إلى الملف
        const migrated = migrate(stored);
        setFileCache(migrated);
        await saveToFile(migrated);
        localStorage.setItem(MIGRATION_FLAG, new Date().toISOString());
        // تعطيل IndexedDB كـ source أساسي (نبقيه فقط كنسخة تراثية للقراءة)
        console.info('EasyStore: تم ترحيل البيانات من IndexedDB إلى ملف القرص بنجاح.');
        return migrated;
      }
    } catch {
      /* تجاهل — نكمل بالحالة الافتراضية */
    }
  } else {
    // وضع المتصفح (تطوير): استخدم IndexedDB مباشرة
    try {
      const stored = await idbGet<AppState>('state');
      if (stored) {
        const migrated = migrate(stored);
        setFileCache(migrated);
        void idbSet('state', migrated).catch(() => {});
        return migrated;
      }
    } catch {
      /* تجاهل */
    }
  }

  // 3. بداية نظيفة
  const fresh = getDefaultState();
  setFileCache(fresh);
  void saveToFile(fresh);
  return fresh;
}

// دمج أي حقول ناقصة مع الحالة الافتراضية (توافق مع الإصدارات الأقدم)
export function migrate(state: Partial<AppState>): AppState {
  const base = getDefaultState();
  const migrated: AppState = {
    ...base,
    ...state,
    company: { ...base.company, ...(state.company || {}) },
    invoiceDesign: {
      ...base.invoiceDesign,
      ...(state.invoiceDesign || {}),
      customField1: { ...base.invoiceDesign.customField1, ...(state.invoiceDesign?.customField1 || {}) },
      customField2: { ...base.invoiceDesign.customField2, ...(state.invoiceDesign?.customField2 || {}) },
      labels: { ...base.invoiceDesign.labels, ...(state.invoiceDesign?.labels || {}) },
    },
  };
  // Normalize items so newly-added fields exist on old data
  migrated.items = (state.items || []).map(it => ({
    ...it,
    barcodes: it.barcodes || [],
    subUnits: it.subUnits || [],
    taxable: it.taxable ?? true,
  }));
  migrated.employeeAdvances = state.employeeAdvances || [];
  migrated.creditDebitNotes = state.creditDebitNotes || [];
  migrated.journalEntries = state.journalEntries || [];
  migrated.maintenanceReceipts = state.maintenanceReceipts || [];
  migrated.customerTransactions = state.customerTransactions || [];
  migrated.warehouses = state.warehouses || getDefaultWarehouses();
  migrated.stockTransfers = state.stockTransfers || [];
  migrated.bundleAssemblies = state.bundleAssemblies || [];
  migrated.sectorProfile = state.sectorProfile || base.sectorProfile;
  return migrated;
}

export function resetState(): AppState {
  const fresh = getDefaultState();
  saveState(fresh);
  return fresh;
}

export function resetToZero(): AppState {
  const fresh = getEmptyState();
  saveState(fresh);
  return fresh;
}

export async function clearDatabase(): Promise<void> {
  setFileCache(getDefaultState());
  await clearFileStore();
}

// ============================================================
// تصدير / استيراد البيانات
// ============================================================
export function exportState(): string {
  return JSON.stringify(loadState(), null, 2);
}

const importSchema = z.object({
  company: z.record(z.string(), z.any()).optional(),
  invoiceDesign: z.record(z.string(), z.any()).optional(),
  categories: z.array(z.any()).optional(),
  items: z.array(z.any()).optional(),
  suppliers: z.array(z.any()).optional(),
  customers: z.array(z.any()).optional(),
  sales: z.array(z.any()).optional(),
  salesInvoices: z.array(z.any()).optional(),
  purchases: z.array(z.any()).optional(),
  purchaseInvoices: z.array(z.any()).optional(),
  returns: z.array(z.any()).optional(),
  exchanges: z.array(z.any()).optional(),
  customerAdjustments: z.array(z.any()).optional(),
  creditDebitNotes: z.array(z.any()).optional(),
  auditLogs: z.array(z.any()).optional(),
  treasuryAccounts: z.array(z.any()).optional(),
  transactions: z.array(z.any()).optional(),
  employees: z.array(z.any()).optional(),
  attendanceRecords: z.array(z.any()).optional(),
  payrollRecords: z.array(z.any()).optional(),
  employeeAdvances: z.array(z.any()).optional(),
  installments: z.array(z.any()).optional(),
  fixedAssets: z.array(z.any()).optional(),
  users: z.array(z.any()).optional(),
  notifications: z.array(z.any()).optional(),
  journalEntries: z.array(z.any()).optional(),
  customerTransactions: z.array(z.any()).optional(),
  sectorProfile: z.record(z.string(), z.any()).optional(),
  maintenanceReceipts: z.array(z.any()).optional(),
  warehouses: z.array(z.any()).optional(),
  stockTransfers: z.array(z.any()).optional(),
  bundleAssemblies: z.array(z.any()).optional()
}).passthrough();

export function importState(json: string): boolean {
  try {
    const parsed = JSON.parse(json);
    if (typeof parsed !== 'object' || parsed === null) return false;
    
    const validationResult = importSchema.safeParse(parsed);
    if (!validationResult.success) {
      console.error('Import validation failed:', validationResult.error);
      return false;
    }
    const safeData = validationResult.data;
    
    const state: Record<string, unknown> = {};
    const arrayKeys = [
      'items', 'customers', 'suppliers', 'categories', 'returns', 'exchanges', 'customerAdjustments', 'creditDebitNotes',
      'auditLogs', 'treasuryAccounts', 'transactions', 'employees', 'attendanceRecords', 'payrollRecords', 'employeeAdvances',
      'installments', 'maintenanceReceipts', 'fixedAssets',
      'users', 'notifications', 'journalEntries', 'customerTransactions', 'warehouses', 'stockTransfers', 'bundleAssemblies'
    ];
    
    for (const key of arrayKeys) {
      state[key] = Array.isArray(safeData[key]) ? safeData[key] : [];
    }
    
    state.salesInvoices = Array.isArray(safeData.salesInvoices) ? safeData.salesInvoices : (Array.isArray(safeData.sales) ? safeData.sales : []);
    state.purchaseInvoices = Array.isArray(safeData.purchaseInvoices) ? safeData.purchaseInvoices : (Array.isArray(safeData.purchases) ? safeData.purchases : []);
    
    state.company = typeof safeData.company === 'object' && safeData.company !== null ? safeData.company : {};
    state.invoiceDesign = typeof safeData.invoiceDesign === 'object' && safeData.invoiceDesign !== null ? safeData.invoiceDesign : {};
    state.sectorProfile = typeof safeData.sectorProfile === 'object' && safeData.sectorProfile !== null ? safeData.sectorProfile : getDefaultState().sectorProfile;
    
    saveState(migrate(state as unknown as AppState));
    return true;
  } catch {
    return false;
  }
}

// ============================================================
// أدوات مساعدة
// ============================================================
export function generateId(prefix: string): string {
  try {
    return `${prefix}-${crypto.randomUUID()}`;
  } catch {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  }
}

export function generateInvoiceNumber(prefix: string, existingNumbers: string[] | number): string {
  let count = 0;
  if (Array.isArray(existingNumbers)) {
    if (existingNumbers.length === 0) {
      count = 0;
    } else {
      const numbers = existingNumbers.map(n => {
        const match = n.match(/\d+$/);
        return match ? parseInt(match[0], 10) : 0;
      });
      count = Math.max(...numbers);
    }
  } else {
    count = existingNumbers;
  }
  return `${prefix}-${String(count + 1).padStart(5, '0')}`;
}
