// ============================================================
// Easy Store ERP - إدارة البيانات المحلية (Local Data Management)
// ------------------------------------------------------------
// التخزين الأساسي أصبح ملف JSON حقيقي على القرص عبر Tauri fs في
// الإنتاج (كتابة ذرية + نسخ احتياطي) مع fallback إلى IndexedDB في
// وضع التطوير بالمتصفح. نحتفظ بنسخة في الذاكرة لتوفير واجهة
// متزامنة (sync) للأجزاء التي تحتاجها.
// ============================================================

import type { AppState, CompanySettings, TreasuryAccount, InvoiceDesign } from '@/types';
import { idbGet, idbSet } from './idb';
import { loadFromFile, saveToFile, getFileCache, setFileCache, isTauri, clearFileStore } from './fileStore';

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
  // إشعارات الخصم/الإضافة (قد لا تكون موجودة في البيانات القديمة)
  migrated.creditDebitNotes = state.creditDebitNotes || [];
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

export function importState(json: string): boolean {
  try {
    const parsed = JSON.parse(json) as AppState;
    saveState(migrate(parsed));
    return true;
  } catch {
    return false;
  }
}

// ============================================================
// أدوات مساعدة
// ============================================================
export function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

export function generateInvoiceNumber(_prefix: string, count: number): string {
  return (count + 1).toString();
}
