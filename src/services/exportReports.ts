// ============================================================
// Easy Store ERP — تصدير التقارير إلى Excel
// Read-only: لا يعدّل أي بيانات في قاعدة البيانات
// ============================================================
import * as XLSX from 'xlsx';
import type { SaleInvoice, Customer, Item, PurchaseInvoice } from '@/types';

interface DateRange {
  from: string;
  to: string;
}

function filterByDate<T extends { createdAt: string }>(records: T[], range: DateRange): T[] {
  return records.filter(
    (r) => r.createdAt >= range.from && r.createdAt <= range.to + 'T23:59:59',
  );
}

function writeExcel(
  sheets: { name: string; rows: Record<string, unknown>[] }[],
  fileName: string,
) {
  const wb = XLSX.utils.book_new();
  for (const sheet of sheets) {
    const ws = XLSX.utils.json_to_sheet(sheet.rows.length > 0 ? sheet.rows : [{ '': 'لا توجد بيانات' }]);
    XLSX.utils.book_append_sheet(wb, ws, sheet.name);
  }
  XLSX.writeFile(wb, fileName);
}

// ─── تقرير المبيعات ───────────────────────────────────────────
export function exportSalesReport(
  invoices: SaleInvoice[],
  range: DateRange,
  currencySymbol = '',
): void {
  const filtered = filterByDate(invoices, range);

  const rows = filtered.map((inv, i) => ({
    '#': i + 1,
    'رقم الفاتورة': inv.invoiceNumber,
    'العميل': inv.customerName,
    'التاريخ': new Date(inv.createdAt).toLocaleDateString('ar-EG'),
    [`الإجمالي (${currencySymbol})`]: inv.total,
    [`المدفوع (${currencySymbol})`]: inv.paid,
    [`المتبقي (${currencySymbol})`]: inv.remaining,
    'طريقة الدفع': inv.paymentMethod,
    'الحالة': inv.paymentStatus,
  }));

  const totalSales = filtered.reduce((s, i) => s + i.total, 0);
  const totalPaid = filtered.reduce((s, i) => s + i.paid, 0);
  const totalRemaining = filtered.reduce((s, i) => s + i.remaining, 0);

  const summary = [
    { 'البيان': 'عدد الفواتير', 'القيمة': filtered.length },
    { 'البيان': `إجمالي المبيعات (${currencySymbol})`, 'القيمة': +totalSales.toFixed(2) },
    { 'البيان': `إجمالي المحصّل (${currencySymbol})`, 'القيمة': +totalPaid.toFixed(2) },
    { 'البيان': `إجمالي المتبقي (${currencySymbol})`, 'القيمة': +totalRemaining.toFixed(2) },
  ];

  writeExcel(
    [
      { name: 'فواتير المبيعات', rows },
      { name: 'ملخص', rows: summary },
    ],
    `sales_report_${range.from}_${range.to}.xlsx`,
  );
}

// ─── تقرير ديون العملاء ──────────────────────────────────────
export function exportCustomerDebtsReport(
  customers: Customer[],
  invoices: SaleInvoice[],
  currencySymbol = '',
): void {
  const debtors = customers
    .filter((c) => c.balance > 0)
    .sort((a, b) => b.balance - a.balance);

  const rows = debtors.map((c, i) => {
    const custInvoices = invoices.filter((inv) => inv.customerId === c.id);
    const unpaidInvoices = custInvoices.filter((inv) => inv.remaining > 0);
    return {
      '#': i + 1,
      'اسم العميل': c.nameAr || c.name,
      'الهاتف': c.phone,
      [`الرصيد الدائن (${currencySymbol})`]: c.balance,
      'عدد الفواتير الغير مسددة': unpaidInvoices.length,
      'آخر فاتورة': custInvoices.length > 0
        ? new Date(
            custInvoices.reduce((last, i) =>
              i.createdAt > last ? i.createdAt : last,
              custInvoices[0].createdAt,
            ),
          ).toLocaleDateString('ar-EG')
        : '-',
    };
  });

  writeExcel(
    [{ name: 'ديون العملاء', rows }],
    `customer_debts_${new Date().toISOString().slice(0, 10)}.xlsx`,
  );
}

// ─── تقرير المخزون ───────────────────────────────────────────
export function exportInventoryReport(items: Item[], currencySymbol = ''): void {
  const rows = items.map((it, i) => ({
    '#': i + 1,
    'اسم الصنف': it.nameAr || it.name,
    'الكمية': it.stockQuantity,
    [`سعر الشراء (${currencySymbol})`]: it.purchasePrice,
    [`سعر البيع (${currencySymbol})`]: it.salePrice,
    [`قيمة المخزون (${currencySymbol})`]: +(it.purchasePrice * it.stockQuantity).toFixed(2),
    'الحالة': it.stockQuantity === 0 ? 'نفد' : it.stockQuantity <= it.minStockLevel ? 'منخفض' : 'جيد',
  }));

  writeExcel(
    [{ name: 'تقرير المخزون', rows }],
    `inventory_report_${new Date().toISOString().slice(0, 10)}.xlsx`,
  );
}

// ─── تقرير المشتريات ──────────────────────────────────────────
export function exportPurchasesReport(
  invoices: PurchaseInvoice[],
  range: DateRange,
  currencySymbol = '',
): void {
  const filtered = filterByDate(invoices, range);

  const rows = filtered.map((inv, i) => ({
    '#': i + 1,
    'رقم فاتورة الشراء': inv.invoiceNumber,
    'المورد': inv.supplierName,
    'التاريخ': new Date(inv.createdAt).toLocaleDateString('ar-EG'),
    [`الإجمالي (${currencySymbol})`]: inv.total,
    [`المدفوع (${currencySymbol})`]: inv.paid,
    [`المتبقي (${currencySymbol})`]: inv.remaining,
    'الحالة': inv.paymentStatus,
  }));

  writeExcel(
    [{ name: 'فواتير المشتريات', rows }],
    `purchases_report_${range.from}_${range.to}.xlsx`,
  );
}

export interface CustomerStatementExportRow {
  date: string;
  type: string;
  reference: string;
  debit: number;
  credit: number;
  balance: number;
  reason?: string;
}

export function exportCustomerStatement(
  customerName: string,
  rows: CustomerStatementExportRow[],
  currencySymbol = '',
): void {
  writeExcel([{
    name: 'كشف الحساب',
    rows: rows.map((row, index) => ({
      '#': index + 1,
      'التاريخ': new Date(row.date).toLocaleDateString('ar-EG'),
      'النوع': row.type,
      'المرجع': row.reference,
      [`مدين (${currencySymbol})`]: row.debit || '',
      [`دائن (${currencySymbol})`]: row.credit || '',
      [`الرصيد (${currencySymbol})`]: row.balance,
      'السبب / الملاحظة': row.reason || '',
    })),
  }], `customer_statement_${customerName.replace(/[^\w-]+/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}
