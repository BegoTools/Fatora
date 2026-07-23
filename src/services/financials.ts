// ============================================================
// Easy Store ERP - المحاسبة المالية المتقدمة والتقارير (Financials & Reports - v2)
// ------------------------------------------------------------
// - إدارة الشيكات (Cheques).
// - القروض/السلف المالية (Loans & Financing).
// - مسحوبات الشركاء (Personal Drawings) وجارى الشركاء.
// - حساب إهلاك الأصول الثابتة (Fixed Asset Depreciation).
// - التقارير المالية المتقدمة: ميزان المراجعة (Trial Balance)،
//   قائمة الدخل (Income Statement / P&L)، والمركز المالي (Balance Sheet).
// ============================================================

import type { AppState, FixedAsset } from '@/types';
import { round2 } from './tax';

export interface Cheque {
  id: string;
  chequeNumber: string;
  bankName: string;
  type: 'incoming' | 'outgoing'; // وارد (من عميل) / صادر (لمورد)
  amount: number;
  dueDate: string;
  issueDate: string;
  partyName: string;            // اسم العميل أو المورد
  status: 'pending' | 'collected' | 'bounced' | 'cancelled';
  notes?: string;
  createdAt: string;
}

export interface FinancingLoan {
  id: string;
  lenderName: string;            // البنك أو الجهة المقرضة
  principalAmount: number;       // مبلغ القرض الأصلي
  interestRate: number;          // نسبة الفائدة (مئوية)
  totalAmountWithInterest: number;
  paidAmount: number;
  remainingAmount: number;
  startDate: string;
  dueDate: string;
  status: 'active' | 'settled';
  createdAt: string;
}

export interface PartnerDrawing {
  id: string;
  partnerName: string;
  amount: number;
  date: string;
  reason: string;
  treasuryAccountId: string;
  createdAt: string;
}

export interface TrialBalanceRow {
  accountName: string;
  accountNameAr: string;
  accountType: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
  debit: number;   // مدين
  credit: number;  // دائن
  netBalance: number;
}

export interface IncomeStatementReport {
  periodStart: string;
  periodEnd: string;
  totalSalesRevenue: number;
  costOfGoodsSold: number;
  grossProfit: number;
  totalOperatingExpenses: number;
  assetDepreciationExpense: number;
  netProfit: number;
}

// ============================================================
// حساب إهلاك الأصول الثابتة (Depreciation Calculator)
// ============================================================
export function calculateAssetDepreciation(asset: FixedAsset, currentDateISO = new Date().toISOString()): {
  annualDepreciation: number;
  accumulatedDepreciation: number;
  currentBookValue: number;
} {
  const purchaseDate = new Date(asset.purchaseDate);
  const currentDate = new Date(currentDateISO);

  const yearsElapsed = Math.max(0, (currentDate.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25));
  const rate = (((asset as any).depreciationRate as number) || 10) / 100;

  const annualDepreciation = round2(asset.purchasePrice * rate);
  const maxDepreciable = Math.max(0, asset.purchasePrice - (asset.salvageValue || 0));
  const rawAccumulated = annualDepreciation * yearsElapsed;
  const accumulatedDepreciation = round2(Math.min(maxDepreciable, rawAccumulated));
  const currentBookValue = round2(Math.max(asset.salvageValue || 0, asset.purchasePrice - accumulatedDepreciation));

  return {
    annualDepreciation,
    accumulatedDepreciation,
    currentBookValue,
  };
}

// ============================================================
// توليد قائمة الدخل (Income Statement / P&L)
// ============================================================
export function generateIncomeStatement(
  state: AppState,
  startDate?: string,
  endDate?: string
): IncomeStatementReport {
  const start = startDate ? new Date(startDate).getTime() : 0;
  const end = endDate ? new Date(endDate).getTime() : Infinity;

  // 1. إيرادات المبيعات
  const filteredSales = state.salesInvoices.filter(inv => {
    const t = new Date(inv.createdAt).getTime();
    return t >= start && t <= end;
  });
  const totalSalesRevenue = round2(filteredSales.reduce((sum, inv) => sum + inv.total, 0));

  // 2. تكلفة البضاعة المباعة (COGS)
  let costOfGoodsSold = 0;
  const itemMap = new Map(state.items.map(i => [i.id, i]));
  for (const inv of filteredSales) {
    for (const item of inv.items) {
      const dbItem = itemMap.get(item.itemId);
      const costPerUnit = dbItem?.purchasePrice ?? 0;
      costOfGoodsSold += item.quantity * costPerUnit;
    }
  }
  costOfGoodsSold = round2(costOfGoodsSold);
  const grossProfit = round2(totalSalesRevenue - costOfGoodsSold);

  // 3. المصروفات التشغيلية
  const filteredTransactions = state.transactions.filter(t => {
    const time = new Date(t.createdAt).getTime();
    return time >= start && time <= end && t.type === 'expense';
  });
  const totalOperatingExpenses = round2(filteredTransactions.reduce((sum, t) => sum + t.amount, 0));

  // 4. إهلاك الأصول عن الفترة
  let assetDepreciationExpense = 0;
  for (const asset of state.fixedAssets) {
    const dep = calculateAssetDepreciation(asset);
    assetDepreciationExpense += dep.annualDepreciation;
  }
  assetDepreciationExpense = round2(assetDepreciationExpense);

  const netProfit = round2(grossProfit - totalOperatingExpenses - assetDepreciationExpense);

  return {
    periodStart: startDate || 'Beginning',
    periodEnd: endDate || new Date().toISOString().split('T')[0],
    totalSalesRevenue,
    costOfGoodsSold,
    grossProfit,
    totalOperatingExpenses,
    assetDepreciationExpense,
    netProfit,
  };
}

// ============================================================
// توليد ميزان المراجعة (Trial Balance)
// ============================================================
export function generateTrialBalance(state: AppState): TrialBalanceRow[] {
  const rows: TrialBalanceRow[] = [];

  // النقدية والقبوضات (الأصول)
  const treasuryTotal = state.treasuryAccounts.reduce((s, a) => s + a.balance, 0);
  rows.push({
    accountName: 'Treasury & Cash',
    accountNameAr: 'الخزائن والنقدية',
    accountType: 'asset',
    debit: Math.max(0, treasuryTotal),
    credit: Math.max(0, -treasuryTotal),
    netBalance: treasuryTotal,
  });

  // أرصدة العملاء (مدينون - أصول)
  const totalCustomerReceivables = state.customers.reduce((s, c) => s + Math.max(0, c.balance), 0);
  rows.push({
    accountName: 'Accounts Receivable (Customers)',
    accountNameAr: 'أرصدة العملاء (مدينون)',
    accountType: 'asset',
    debit: totalCustomerReceivables,
    credit: 0,
    netBalance: totalCustomerReceivables,
  });

  // قيمة المخزون (أصول)
  const totalInventoryValue = round2(
    state.items.reduce((s, i) => s + i.stockQuantity * i.purchasePrice, 0)
  );
  rows.push({
    accountName: 'Inventory Value',
    accountNameAr: 'قيمة المخزون السلعي',
    accountType: 'asset',
    debit: totalInventoryValue,
    credit: 0,
    netBalance: totalInventoryValue,
  });

  // أرصدة الموردين (دائنون - التزامات)
  const totalSupplierPayables = state.suppliers.reduce((s, sup) => s + Math.max(0, sup.balance), 0);
  rows.push({
    accountName: 'Accounts Payable (Suppliers)',
    accountNameAr: 'أرصدة الموردين (دائنون)',
    accountType: 'liability',
    debit: 0,
    credit: totalSupplierPayables,
    netBalance: -totalSupplierPayables,
  });

  // إجمالي الأصول الثابتة
  const totalAssetsBookValue = round2(
    state.fixedAssets.reduce((s, a) => s + calculateAssetDepreciation(a).currentBookValue, 0)
  );
  rows.push({
    accountName: 'Fixed Assets (Net Book Value)',
    accountNameAr: 'الأصول الثابتة (الصافي)',
    accountType: 'asset',
    debit: totalAssetsBookValue,
    credit: 0,
    netBalance: totalAssetsBookValue,
  });

  // إجمالي إيرادات المبيعات
  const salesRev = state.salesInvoices.reduce((s, i) => s + i.total, 0);
  rows.push({
    accountName: 'Sales Revenue',
    accountNameAr: 'إيرادات المبيعات',
    accountType: 'revenue',
    debit: 0,
    credit: salesRev,
    netBalance: -salesRev,
  });

  return rows;
}
