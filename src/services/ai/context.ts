// ============================================================
// Easy Store ERP - بناء سياق البيانات للذكاء الاصطناعي
// ============================================================
// يجمع هذا الملف بيانات من حالة التطبيق لإرسالها مع طلب AI
// ============================================================

import type { AppState } from '@/types';

// ============================================================
// بناء ملخص للبيانات الحالية لإرساله مع طلب AI
// ============================================================
export function buildAIContext(state: AppState): string {
  const { items, customers, suppliers, salesInvoices, purchaseInvoices } = state;

  // حساب الإحصائيات الأساسية
  const totalItems = items.length;
  const lowStock = items.filter(i => i.stockQuantity > 0 && i.stockQuantity <= i.minStockLevel).length;
  const outOfStock = items.filter(i => i.stockQuantity === 0).length;
  const totalCustomers = customers.length;
  const totalSuppliers = suppliers.length;
  const totalSales = salesInvoices.reduce((sum, inv) => sum + inv.total, 0);
  const totalPurchases = purchaseInvoices.reduce((sum, inv) => sum + inv.total, 0);

  const totalCostOfGoodsSold = salesInvoices.reduce((sum, inv) => {
    return sum + inv.items.reduce((itemSum, saleItem) => {
      const item = items.find(i => i.id === saleItem.itemId);
      const cost = item ? (item.purchasePrice * saleItem.quantity) : 0;
      return itemSum + cost;
    }, 0);
  }, 0);

  const totalExpenses = (state.transactions || [])
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalProfit = totalSales - totalCostOfGoodsSold - totalExpenses;
  
  const totalCustomerDebt = customers.reduce((sum, c) => sum + c.balance, 0);
  const totalSupplierDebt = suppliers.reduce((sum, s) => sum + s.balance, 0);

  return `
## إحصائيات النظام:
- إجمالي الأصناف: ${totalItems}
- أصناف منخفضة المخزون: ${lowStock}
- أصناف نفذت من المخزون: ${outOfStock}
- إجمالي العملاء: ${totalCustomers}
- إجمالي الموردين: ${totalSuppliers}
- إجمالي المبيعات: ${totalSales.toLocaleString()}
- إجمالي المشتريات: ${totalPurchases.toLocaleString()}
- إجمالي الأرباح: ${totalProfit.toLocaleString()}
- إجمالي مديونية العملاء: ${totalCustomerDebt.toLocaleString()}
- إجمالي مديونية الموردين: ${totalSupplierDebt.toLocaleString()}

## آخر 5 مبيعات:
${salesInvoices.slice(-5).map(inv =>
  `- ${inv.invoiceNumber}: ${inv.customerName} - ${inv.total.toLocaleString()} (${inv.paymentStatus})`
).join('\n')}

## آخر 5 مشتريات:
${purchaseInvoices.slice(-5).map(inv =>
  `- ${inv.invoiceNumber}: ${inv.supplierName} - ${inv.total.toLocaleString()} (${inv.paymentStatus})`
).join('\n')}
  `.trim();
}
