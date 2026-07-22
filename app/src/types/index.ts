// ============================================================
// Easy Store ERP - تعريفات الأنواع (Type Definitions)
// ============================================================

// --- دعم التوسع المستقبلي: إضافة roles/new types هنا ---

// ============================================================
// الصلاحيات المستقبلية (Future Roles)
// ============================================================
// الرتب المدمجة المعروفة (Built-in roles) + دعم رتب مخصّصة (custom string ids)
export type BuiltinRole =
  | 'owner'
  | 'admin'
  | 'manager'
  | 'sales'
  | 'accountant'
  | 'cashier'
  | 'warehouse'
  | 'purchasing'
  | 'customer_service'
  | 'employee';
export type UserRole = BuiltinRole | (string & {});

// ============================================================
// حالات الدفع (Payment Statuses)
// ============================================================
export type PaymentStatus = 'paid' | 'partial' | 'unpaid' | 'credit';
export type PaymentMethod = 'cash' | 'card' | 'installment' | 'wallet' | 'credit';

export interface Category {
  id: string;
  name: string;
  nameAr: string;
  parentId: string | null;
  color: string;
  createdAt: string;
}

export interface ItemSubUnit {
  name: string;
  factor: number; // number of base units contained in one of this sub-unit (1 carton = 12 pieces => factor 12)
}

export interface Item {
  id: string;
  barcode: string;
  barcodes: string[]; // additional/scanned barcodes mapped to the same item
  name: string;
  nameAr: string;
  categoryId: string;
  unit: string;
  subUnits: ItemSubUnit[]; // conversion units (carton -> strip -> piece)
  size?: string;
  color?: string;
  manufacturer?: string; // brand / manufacturing company
  supplierId?: string;
  purchasePrice: number;
  salePrice: number;
  wholesalePrice: number;
  profitMargin?: number; // percentage used to auto-compute sale price
  stockQuantity: number;
  minStockLevel: number;
  description: string;
  isActive: boolean;
  createdAt: string;
  image?: string;
  // ── الضريبة (Tax) ──
  taxable?: boolean;            // هل الصنف خاضع للضريبة (افتراضي true)
  taxRateOverride?: number;     // نسبة ضريبة خاصة بهذا الصنف (يتجاوز الإعداد العام)
  pricesIncludeVat?: boolean;  // هل سعر هذا الصنف شامل الضريبة
}

export interface Supplier {
  id: string;
  name: string;
  nameAr: string;
  phone: string;
  email: string;
  address: string;
  balance: number;
  isActive: boolean;
  createdAt: string;
}

export interface Customer {
  id: string;
  name: string;
  nameAr: string;
  phone: string;
  email: string;
  address: string;
  creditLimit: number;
  balance: number;
  notes?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface SaleInvoice {
  id: string;
  invoiceNumber: string;
  customerId: string | null;
  customerName: string;
  items: SaleItem[];
  subtotal: number;
  discount: number;
  total: number;
  paid: number;
  remaining: number;
  previousBalance?: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  notes: string;
  extraCharges: ExtraCharge[];
  createdAt: string;
  createdBy: string;
  updatedAt?: string;
  // ── الضريبة (VAT) ──
  pricesIncludeVat?: boolean;  // هل الأسعار شاملة الضريبة في هذه الفاتورة
  taxRate?: number;            // نسبة الضريبة المطبّقة
  taxableAmount?: number;      // صافي القيمة الخاضعة للضريبة (قبل الضريبة)
  taxAmount?: number;          // قيمة الضريبة
  totalInclTax?: number;       // الإجمالي شامل الضريبة
}

export interface SaleItem {
  itemId: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  total: number;
  // ── الضريبة (VAT) لكل سطر ──
  taxable?: boolean;            // هل السطر خاضع للضريبة
  taxRate?: number;             // نسبة ضريبة السطر (override)
  taxAmount?: number;           // ضريبة السطر
  totalInclTax?: number;        // إجمالي السطر شامل الضريبة
}

export interface PurchaseInvoice {
  id: string;
  invoiceNumber: string;
  supplierId: string;
  supplierName: string;
  items: PurchaseItem[];
  subtotal: number;
  discount: number;
  shippingCost: number;
  total: number;
  paid: number;
  remaining: number;
  paymentStatus: PaymentStatus;
  notes: string;
  extraCharges: ExtraCharge[];
  createdAt: string;
  createdBy: string;
  // ── الضريبة (VAT) ──
  pricesIncludeVat?: boolean;
  taxRate?: number;
  taxableAmount?: number;
  taxAmount?: number;
  totalInclTax?: number;
}

export interface PurchaseItem {
  itemId: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  total: number;
  // ── الضريبة (VAT) لكل سطر ──
  taxable?: boolean;
  taxRate?: number;
  taxAmount?: number;
  totalInclTax?: number;
}

export interface ReturnInvoice {
  id: string;
  returnNumber: string;
  originalInvoiceId: string | null;
  originalInvoiceNumber: string;
  customerId: string | null;
  customerName: string;
  items: SaleItem[];
  total: number;
  refund: number;
  notes: string;
  createdAt: string;
  createdBy: string;
}

export interface ExchangeInvoice {
  id: string;
  exchangeNumber: string;
  originalInvoiceId: string | null;
  originalInvoiceNumber: string;
  customerId: string | null;
  customerName: string;
  returnedItems: SaleItem[];
  newItems: SaleItem[];
  returnedTotal: number;
  newTotal: number;
  priceDifference: number;
  paid: number;
  notes: string;
  createdAt: string;
  createdBy: string;
}

export interface CustomerAdjustment {
  id: string;
  customerId: string;
  amount: number;
  reason: string;
  createdAt: string;
  createdBy: string;
}

// ============================================================
// إشعارات الخصم والإضافة (Credit / Debit Notes) — المرحلة 2.6
// - CreditNote: إشعار دائن (يقلل مديونية العميل / يعيد مبلغ) — مرتجع ضريبي
// - DebitNote:  إشعار مدين (يزيد مديونية العميل) — إضافة رسوم/فروقات
// كلاهما مرتبط بطرف (عميل/مورد) وقد يرتبط بفاتورة أصلية.
// ============================================================
export type NotePartyType = 'customer' | 'supplier';
export type NoteDirection = 'credit' | 'debit';

export interface CreditDebitNote {
  id: string;
  number: string;            // رقم الإشعار
  direction: NoteDirection;  // credit (دائن) | debit (مدين)
  partyType: NotePartyType;  // customer | supplier
  partyId: string;           // معرّف العميل/المورد
  partyName: string;
  originalInvoiceId?: string | null; // فاتورة أصلية مرتبطة (اختياري)
  originalInvoiceNumber?: string;
  reason: string;
  amount: number;            // القيمة الصافية (قبل الضريبة إن وُجدت)
  taxRate?: number;
  taxAmount?: number;
  totalInclTax?: number;
  createdAt: string;
  createdBy: string;
  notes?: string;
}

export interface AuditLogEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  description: string;
  before?: string;
  after?: string;
  createdAt: string;
  createdBy: string;
}

export interface TreasuryAccount {
  id: string;
  name: string;
  nameAr: string;
  type: 'safe' | 'bank' | 'wallet';
  balance: number;
  accountNumber?: string;
  bankName?: string;
  isActive: boolean;
  createdAt: string;
}

export interface Transaction {
  id: string;
  accountId: string;
  accountName: string;
  type: 'income' | 'expense' | 'transfer_in' | 'transfer_out' | 'tax' | 'cheque' | 'loan' | 'drawing' | 'opening_balance';
  amount: number;
  description: string;
  referenceNumber: string;
  category: string;
  date: string;
  createdAt: string;
  createdBy: string;
}

export interface Employee {
  id: string;
  employeeNumber: string;
  name: string;
  nameAr: string;
  phone: string;
  email: string;
  address: string;
  jobTitle: string;
  department: string;
  hireDate: string;
  salary: number;
  commissionRate: number;
  isActive: boolean;
  userId?: string;
  createdAt: string;
}

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string;
  checkIn: string;
  checkOut: string;
  status: 'present' | 'absent' | 'late' | 'leave' | 'holiday';
  notes: string;
}

export interface PayrollRecord {
  id: string;
  employeeId: string;
  employeeName: string;
  month: string;
  year: number;
  baseSalary: number;
  commission: number;
  bonus: number;
  deductions: number;
  socialInsurance: number;
  netSalary: number;
  status: 'draft' | 'approved' | 'paid';
  createdAt: string;
}

export interface EmployeeAdvance {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string;
  amount: number;
  reason: string;
  repaidAmount: number;
  status: 'pending' | 'partial' | 'repaid';
  notes: string;
  createdAt: string;
}

export interface Installment {
  id: string;
  invoiceId: string;
  customerName: string;
  amount: number;
  paidAmount: number;
  dueDate: string;
  installmentNumber: number;
  totalInstallments: number;
  status: 'pending' | 'partial' | 'paid' | 'overdue';
  createdAt: string;
}

export interface FixedAsset {
  id: string;
  name: string;
  nameAr: string;
  category: string;
  purchaseDate: string;
  purchasePrice: number;
  salvageValue: number;
  usefulLife: number;
  depreciationMethod: 'straight_line';
  annualDepreciation: number;
  accumulatedDepreciation: number;
  netBookValue: number;
  isActive: boolean;
}

// ============================================================
// User: تم تحديث الحقل role ليدعم جميع الصلاحيات المستقبلية
// ============================================================
export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  isActive: boolean;
}

// حساب المصادقة المحلي (يُخزَّن في IndexedDB مع كلمة سر مُشفَّرة)
export interface AuthAccount {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  passwordHash: string;
  salt: string;
  isActive: boolean;
  createdAt: string;
}

export interface CompanySettings {
  name: string;
  nameAr: string;
  address: string;
  phone: string;
  email: string;
  commercialRegistration: string;
  currency: string;
  currencySymbol: string;
  fiscalYearStart: string;
  logo?: string;
  // ── الضريبة (Tax) ──
  taxId?: string;            // الرقم الضريبي (EG: VAT registration number)
  vatRate?: number;          // نسبة الضريبة الافتراضية (مصر 0.14)
  taxAuthority?: string;    // جهة الضرائب
  pricesIncludeVat?: boolean; // هل الأسعار شاملة الضريبة افتراضيًا
}

export interface ExtraCharge {
  id: string;
  description: string;
  amount: number;
}

// ============================================================
// تصميم الفواتير (Invoice Designer)
// إعدادات تُطبَّق تلقائيًا على جميع الفواتير عند الحفظ.
// ============================================================
export type InvoiceType = 'sale' | 'purchase' | 'return';

export interface InvoiceCustomField {
  labelEn: string;
  labelAr: string;
  value: string;
}

// نصوص الفاتورة الثابتة القابلة للتعديل (فارغة = استخدام الافتراضي)
export interface InvoiceLabelOverrides {
  saleTitleEn?: string;
  saleTitleAr?: string;
  purchaseTitleEn?: string;
  purchaseTitleAr?: string;
  returnTitleEn?: string;
  returnTitleAr?: string;
  dateTimeEn?: string;
  dateTimeAr?: string;
  dateEn?: string;
  dateAr?: string;
  timeEn?: string;
  timeAr?: string;
  totalDueEn?: string;
  totalDueAr?: string;
  remainingEn?: string;
  remainingAr?: string;
  paidEn?: string;
  paidAr?: string;
  invoiceNoEn?: string;
  invoiceNoAr?: string;
  sellerEn?: string;
  sellerAr?: string;
  managementEn?: string;
  managementAr?: string;
  customerEn?: string;
  customerAr?: string;
  supplierEn?: string;
  supplierAr?: string;
  codeEn?: string;
  codeAr?: string;
  productEn?: string;
  productAr?: string;
  qtyEn?: string;
  qtyAr?: string;
  priceEn?: string;
  priceAr?: string;
  totalEn?: string;
  totalAr?: string;
  subtotalEn?: string;
  subtotalAr?: string;
  previousBalanceEn?: string;
  previousBalanceAr?: string;
  underAccountEn?: string;
  underAccountAr?: string;
  netEn?: string;
  netAr?: string;
  grandTotalEn?: string;
  grandTotalAr?: string;
  discountEn?: string;
  discountAr?: string;
}

export interface InvoiceDesign {
  templateId: 'standard';
  accentColor: string;
  logo?: string;
  showLogo: boolean;
  showManagement: boolean;
  managementName: string;
  showSalesPerson: boolean;
  showPreviousBalance: boolean;
  customField1: InvoiceCustomField;
  customField2: InvoiceCustomField;
  footerTextEn: string;
  footerTextAr: string;
  thankYouEn: string;
  thankYouAr: string;
  labels: InvoiceLabelOverrides;
}

export interface AppState {
  company: CompanySettings;
  invoiceDesign: InvoiceDesign;
  categories: Category[];
  items: Item[];
  suppliers: Supplier[];
  customers: Customer[];
  salesInvoices: SaleInvoice[];
  purchaseInvoices: PurchaseInvoice[];
  returns: ReturnInvoice[];
  exchanges: ExchangeInvoice[];
  customerAdjustments: CustomerAdjustment[];
  creditDebitNotes: CreditDebitNote[];
  auditLogs: AuditLogEntry[];
  treasuryAccounts: TreasuryAccount[];
  transactions: Transaction[];
  employees: Employee[];
  attendanceRecords: AttendanceRecord[];
  payrollRecords: PayrollRecord[];
  employeeAdvances: EmployeeAdvance[];
  installments: Installment[];
  fixedAssets: FixedAsset[];
  users: User[];
  notifications: AppNotification[];
}

export interface AppNotification {
  id: string;
  title: string;
  titleAr: string;
  message: string;
  messageAr: string;
  type: 'info' | 'warning' | 'error' | 'success';
  isRead: boolean;
  createdAt: string;
}

export type ModuleId =
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
  | 'settings';

export interface NavItem {
  id: ModuleId;
  label: string;
  labelAr: string;
  icon: string;
  badge?: number;
}

// ============================================================
// واجهة مزود الذكاء الاصطناعي (AI Provider Interface)
// تسمح بتبديل مزود الخدمة (Gemini, OpenAI, Claude...) بسهولة
// ============================================================
export interface AIProvider {
  name: string;
  generateResponse(prompt: string, context?: string): Promise<string>;
  isAvailable(): boolean;
}

// ============================================================
// واجهة التخزين (Repository Interface)
// تجرد طبقة التخزين (localStorage, IndexedDB, API, SQL...)
// ============================================================
export interface IDataRepository {
  load(): AppState;
  save(state: AppState): void;
  reset(): AppState;
  export(): string;
  import(json: string): boolean;
}
