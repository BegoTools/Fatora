// ============================================================
// Easy Store ERP - نموذج الفاتورة الموحّد (Invoice Model)
// ------------------------------------------------------------
// يوحّد بيانات فواتير البيع/الشراء ويحلّ النصوص القابلة للتعديل.
// يُستخدم من مكوّن العرض ومن مولّد HTML للطباعة معًا.
// ============================================================

import type {
  SaleInvoice,
  PurchaseInvoice,
  InvoiceType,
  InvoiceDesign,
  Customer,
  Supplier,
} from '@/types';

export interface NormalizedInvoiceItem {
  itemName: string;
  itemId: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface NormalizedInvoice {
  invoiceNumber: string;
  partyName: string;
  createdBy: string;
  createdAt: string;
  items: NormalizedInvoiceItem[];
  subtotal: number;
  discount: number;
  extraCharges: { description: string; amount: number }[];
  total: number;
  paid: number;
  previousBalance: number;
  previousBalanceInvoiceRef?: string; // رقم آخر فاتورة صاحبة الرصيد
  downPayment?: number;               // تحت الحساب (مبلغ مقدّم)
  netAmount?: number;                 // الصافي = الإجمالي + حساب سابق - تحت الحساب
  ownerName1?: string;                // أسماء المالكين (من إعدادات الشركة)
  ownerName2?: string;
}

export function normalizeInvoice(
  invoice: SaleInvoice | PurchaseInvoice,
  party?: Customer | Supplier,
  previousBalance?: number,
  company?: { ownerName1?: string; ownerName2?: string },
): NormalizedInvoice {
  const partyName =
    'customerName' in invoice ? invoice.customerName : invoice.supplierName;
  const prevBal = previousBalance ?? party?.balance ?? 0;
  const downPayment = ('downPayment' in invoice ? invoice.downPayment : undefined) ?? 0;
  const netAmount = invoice.total + prevBal - downPayment;
  return {
    invoiceNumber: invoice.invoiceNumber,
    partyName: partyName || '',
    createdBy: invoice.createdBy || '',
    createdAt: invoice.createdAt,
    items: invoice.items.map(it => ({
      itemName: it.itemName,
      itemId: it.itemId,
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      total: it.total ?? it.unitPrice * it.quantity,
    })),
    subtotal: invoice.subtotal,
    discount: invoice.discount,
    extraCharges: (invoice.extraCharges || []).filter(c => c.amount > 0),
    total: invoice.total,
    paid: invoice.paid,
    previousBalance: prevBal,
    previousBalanceInvoiceRef:
      'previousBalanceInvoiceRef' in invoice ? invoice.previousBalanceInvoiceRef : undefined,
    downPayment,
    netAmount,
    ownerName1: company?.ownerName1,
    ownerName2: company?.ownerName2,
  };
}

// ------------------------------------------------------------
// النصوص الافتراضية
// ------------------------------------------------------------
type LabelKey =
  | 'saleTitle' | 'purchaseTitle' | 'returnTitle'
  | 'dateTime' | 'date' | 'time' | 'invoiceNo' | 'seller' | 'management'
  | 'customer' | 'supplier'
  | 'code' | 'product' | 'qty' | 'price' | 'total'
  | 'subtotal' | 'previousBalance' | 'underAccount' | 'net'
  | 'grandTotal' | 'discount' | 'totalDue' | 'remaining' | 'paid';

const DEFAULT_LABELS: Record<LabelKey, { en: string; ar: string }> = {
  saleTitle: { en: 'Invoice', ar: 'فاتورة بيع' },
  purchaseTitle: { en: 'Purchase Invoice', ar: 'فاتورة شراء' },
  returnTitle: { en: 'Return Invoice', ar: 'فاتورة مرتجع' },
  dateTime: { en: 'Date & Time', ar: 'التاريخ والوقت' },
  date: { en: 'Date', ar: 'التاريخ' },
  time: { en: 'Time', ar: 'الوقت' },
  invoiceNo: { en: 'Invoice #', ar: 'رقم الفاتورة' },
  seller: { en: 'Sales Person', ar: 'البائع' },
  management: { en: 'Management', ar: 'الإدارة' },
  customer: { en: 'Customer', ar: 'العميل' },
  supplier: { en: 'Supplier', ar: 'المورد' },
  code: { en: 'Code', ar: 'كود المنتج' },
  product: { en: 'Product', ar: 'اسم المنتج' },
  qty: { en: 'Qty', ar: 'الكمية' },
  price: { en: 'Price', ar: 'السعر' },
  total: { en: 'Total', ar: 'الإجمالي' },
  subtotal: { en: 'Subtotal', ar: 'الإجمالي' },
  previousBalance: { en: 'Previous Balance', ar: 'حساب سابق' },
  underAccount: { en: 'Under Account', ar: 'تحت الحساب' },
  net: { en: 'Net', ar: 'الصافي' },
  grandTotal: { en: 'Invoice Total', ar: 'إجمالي الفاتورة' },
  discount: { en: 'Discount', ar: 'الخصم' },
  totalDue: { en: 'Total Due', ar: 'إجمالي المطلوب' },
  remaining: { en: 'Remaining', ar: 'المتبقي' },
  paid: { en: 'Paid', ar: 'المدفوع' },
};

// يحلّ النص: يستخدم التعديل المخصّص إن وُجد وإلا الافتراضي
export function invoiceLabel(design: InvoiceDesign, isRTL: boolean, key: LabelKey): string {
  const overrideKey = `${key}${isRTL ? 'Ar' : 'En'}` as keyof InvoiceDesign['labels'];
  const override = design.labels?.[overrideKey];
  if (override && override.trim()) return override;
  return isRTL ? DEFAULT_LABELS[key].ar : DEFAULT_LABELS[key].en;
}

export function invoiceTitle(design: InvoiceDesign, isRTL: boolean, type: InvoiceType): string {
  const key: LabelKey = type === 'purchase' ? 'purchaseTitle' : type === 'return' ? 'returnTitle' : 'saleTitle';
  return invoiceLabel(design, isRTL, key);
}

export function formatMoney(value: number, symbol: string): string {
  return `${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${symbol}`;
}
