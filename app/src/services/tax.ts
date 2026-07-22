// ============================================================
// Easy Store ERP - محرك الضريبة المركزي (VAT Engine)
// ------------------------------------------------------------
// قواعد:
//  - لا ضريبة على ضريبة (no compounding).
//  - يدعم الأسعار الشاملة وغير الشاملة للضريبة لكل صنف/فاتورة.
//  - ضريبة الخصم والإضافة (Reverse Charge) 1% عند التوريد
//    (خصم/إضافة من المورد/للمورد) — تُحتسب على قيمة التوريد.
//  - الأصناف المعفاة (taxable=false) لا تُحتسب عليها ضريبة.
// كل الدوال نقية (pure) وقابلة للاختبار.
// ============================================================

import type { Item, SaleItem, PurchaseItem } from '@/types';

const DEFAULT_VAT_RATE = 0.14; // مصر 14%
const REVERSE_CHARGE_RATE = 0.01; // خصم/إضافة 1% عند التوريد

// تقريب إلى منزلتين (معالجة أخطاء الفاصلة العائمة)
function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export interface LineTaxInput {
  unitPrice: number;
  quantity: number;
  discount: number;
  taxable: boolean;
  taxRate: number;     // نسبة السطر (override) أو العامة
  includesVat: boolean; // هل سعر الوحدة شامل الضريبة
}

export interface LineTaxResult {
  taxable: boolean;       // هل السطر خاضع للضريبة (للاستخدام الداخلي)
  taxableAmount: number;  // القيمة قبل الضريبة
  taxAmount: number;      // قيمة الضريبة
  totalInclTax: number;   // الإجمالي شامل الضريبة
  lineNet: number;        // صافي السطر (subtotal بعد الخصم، = taxableAmount إن خاضع)
}

/**
 * حساب ضريبة سطر واحد.
 * - includesVat=false: taxableAmount = qty*(price-discount), tax = taxableAmount*rate
 * - includesVat=true:  totalInclTax = qty*(price-discount), tax = total - total/(1+rate)
 */
export function computeLineTax(input: LineTaxInput): LineTaxResult {
  const { unitPrice, quantity, discount, taxable, taxRate, includesVat } = input;
  const grossLine = round2(quantity * (unitPrice - discount));

  if (!taxable || taxRate <= 0) {
    return {
      taxable,
      taxableAmount: grossLine,
      taxAmount: 0,
      totalInclTax: grossLine,
      lineNet: grossLine,
    };
  }

  if (includesVat) {
    // السعر شامل الضريبة — استخرج الضريبة منه
    const totalInclTax = grossLine;
    const taxableAmount = round2(totalInclTax / (1 + taxRate));
    const taxAmount = round2(totalInclTax - taxableAmount);
    return { taxable, taxableAmount, taxAmount, totalInclTax, lineNet: totalInclTax };
  }

  // السعر غير شامل — أضف الضريبة
  const taxableAmount = grossLine;
  const taxAmount = round2(taxableAmount * taxRate);
  const totalInclTax = round2(taxableAmount + taxAmount);
  return { taxable, taxableAmount, taxAmount, totalInclTax, lineNet: taxableAmount };
}

export interface InvoiceTaxInput<T extends { itemId: string; quantity: number; unitPrice: number; discount: number }> {
  lines: T[];
  items: Item[];                    // أصناف المخزون لجلب taxRate/taxable
  defaultTaxRate: number;           // نسبة الضريبة العامة
  pricesIncludeVat: boolean;        // هل أسعار الفاتورة شاملة افتراضيًا
  invoiceDiscount: number;          // خصم على مستوى الفاتورة (يُخصم من القاعدة الخاضعة)
}

export interface InvoiceTaxResult {
  lines: Array<LineTaxResult & { itemId: string }>;
  subtotal: number;          // مجموع صافي الأسطر قبل ضريبة
  taxableAmount: number;     // القاعدة الخاضعة للضريبة (بعد خصم الفاتورة)
  taxAmount: number;          // إجمالي الضريبة
  totalInclTax: number;       // الإجمالي شامل الضريبة
  totalExclTax: number;       // الإجمالي قبل الضريبة (= taxableAmount)
}

/**
 * حساب ضريبة فاتورة كاملة (بيع أو شراء) مع دعم الأسعار الشاملة وغير الشاملة
 * لكل سطر، وخصم على مستوى الفاتورة يُطبّق على القاعدة الخاضعة.
 */
export function computeInvoiceTax<T extends { itemId: string; quantity: number; unitPrice: number; discount: number }>(
  input: InvoiceTaxInput<T>
): InvoiceTaxResult {
  const { lines, items, defaultTaxRate, pricesIncludeVat, invoiceDiscount } = input;
  const itemMap = new Map(items.map(i => [i.id, i]));

  const computedLines = lines.map(line => {
    const item = itemMap.get(line.itemId);
    const taxable = item?.taxable ?? true;
    const taxRate = item?.taxRateOverride ?? defaultTaxRate;
    const includesVat = item?.pricesIncludeVat ?? pricesIncludeVat;
    const result = computeLineTax({
      unitPrice: line.unitPrice,
      quantity: line.quantity,
      discount: line.discount,
      taxable,
      taxRate,
      includesVat,
    });
    return { ...result, itemId: line.itemId };
  });

  // مجموع القيم الخاضعة (قبل خصم الفاتورة)
  const grossTaxable = computedLines.reduce((s, l) => s + (l.taxable ? l.taxableAmount : 0), 0);
  const grossNonTaxable = computedLines.reduce((s, l) => s + (l.taxable ? 0 : l.taxableAmount), 0);

  // خصم الفاتورة يُطبّق على القاعدة الخاضعة فقط (تناسبيًا)
  const discountRatio = grossTaxable > 0 ? Math.max(0, 1 - invoiceDiscount / grossTaxable) : 1;
  const taxableAmount = round2(grossTaxable * discountRatio + grossNonTaxable);

  // إعادة احتساب الضريبة على القاعدة بعد الخصم
  let taxAmount = 0;
  for (const l of computedLines) {
    if (l.taxable || l.taxAmount > 0) {
      taxAmount += round2(l.taxableAmount * (l.taxAmount > 0 ? (l.taxAmount / (l.taxableAmount || 1)) : 0) * discountRatio);
    }
  }
  // بديل أبسط وأدق: احسب الضريبة من القاعدة بعد الخصم باستخدام النسبة الفعلية
  taxAmount = 0;
  const lineTaxable = computedLines.filter(l => l.taxable && l.taxableAmount > 0);
  for (const l of lineTaxable) {
    const rate = l.taxableAmount > 0 ? l.taxAmount / l.taxableAmount : 0;
    taxAmount += round2(l.taxableAmount * discountRatio * rate);
  }
  taxAmount = round2(taxAmount);

  const subtotal = round2(computedLines.reduce((s, l) => s + l.lineNet, 0));
  const totalExclTax = taxableAmount;
  const totalInclTax = round2(taxableAmount + taxAmount);

  return {
    lines: computedLines,
    subtotal,
    taxableAmount,
    taxAmount,
    totalInclTax,
    totalExclTax,
  };
}

/**
 * ضريبة الخصم والإضافة (Reverse Charge) عند التوريد:
 * - تُحتسب 1% على قيمة التوريد (للموردين غير المسجلين).
 * - تُخصم من المورد (يُحمل عليها) بدل أن تُضاف لفاتورة الشراء.
 */
export function computeReverseCharge(taxableAmount: number, rate: number = REVERSE_CHARGE_RATE): number {
  return round2(taxableAmount * rate);
}

/**
 * إضافة الضريبة (addTax): تحويل قيمة صافية إلى شاملة الضريبة.
 */
export function addTax(netAmount: number, rate: number = DEFAULT_VAT_RATE): { tax: number; total: number } {
  const tax = round2(netAmount * rate);
  return { tax, total: round2(netAmount + tax) };
}

/**
 * استخراج الضريبة (extractTax): تحويل قيمة شاملة إلى صافية + ضريبة.
 */
export function extractTax(grossAmount: number, rate: number = DEFAULT_VAT_RATE): { net: number; tax: number } {
  const net = round2(grossAmount / (1 + rate));
  return { net, tax: round2(grossAmount - net) };
}

export { DEFAULT_VAT_RATE, REVERSE_CHARGE_RATE, round2 };

// ============================================================
// بناء عناصر الفاتورة مع ضريبة لكل سطر (مساعد للواجهات)
// ============================================================
export function buildTaxedSaleLines(
  lines: SaleItem[],
  items: Item[],
  defaultTaxRate: number,
  pricesIncludeVat: boolean
): SaleItem[] {
  return lines.map(line => {
    const item = items.find(i => i.id === line.itemId);
    const taxable = item?.taxable ?? true;
    const taxRate = item?.taxRateOverride ?? defaultTaxRate;
    const includesVat = item?.pricesIncludeVat ?? pricesIncludeVat;
    const r = computeLineTax({
      unitPrice: line.unitPrice,
      quantity: line.quantity,
      discount: line.discount,
      taxable,
      taxRate,
      includesVat,
    });
    return {
      ...line,
      taxable,
      taxRate,
      taxAmount: r.taxAmount,
      totalInclTax: r.totalInclTax,
      total: r.lineNet,
    };
  });
}

export function buildTaxedPurchaseLines(
  lines: PurchaseItem[],
  items: Item[],
  defaultTaxRate: number,
  pricesIncludeVat: boolean
): PurchaseItem[] {
  return lines.map(line => {
    const item = items.find(i => i.id === line.itemId);
    const taxable = item?.taxable ?? true;
    const taxRate = item?.taxRateOverride ?? defaultTaxRate;
    const includesVat = item?.pricesIncludeVat ?? pricesIncludeVat;
    const r = computeLineTax({
      unitPrice: line.unitPrice,
      quantity: line.quantity,
      discount: line.discount,
      taxable,
      taxRate,
      includesVat,
    });
    return {
      ...line,
      taxable,
      taxRate,
      taxAmount: r.taxAmount,
      totalInclTax: r.totalInclTax,
      total: r.lineNet,
    };
  });
}
