// ============================================================
// Easy Store ERP - دمج الفروع للقراءة فقط (Branch Rollup - Phase 9 / L3)
// ------------------------------------------------------------
// - تصدير بيانات الفرع المحلي إلى ملف snapshot موقّع `.esbranch`.
// - تحميل واستيراد 1..N ملفات فروع في ذاكرة العرض فقط (Memory Rollup).
// - تجميع الأرقام المدمجة (المبيعات، المشتريات، أرصدة الخزائن، المخزون)
//   بدون إجراء أي تعديل أو دمج في قاعدة البيانات المحلية العاملة.
// ============================================================

import type { AppState } from '@/types';
import { round2 } from './tax';

export interface BranchExportPackage {
  version: '1.0';
  branchId: string;
  branchName: string;
  branchNameAr: string;
  exportedAt: string;
  deviceFingerprint: string;
  snapshot: AppState;
}

export interface ConsolidatedBranchSummary {
  branchId: string;
  branchName: string;
  totalSales: number;
  totalPurchases: number;
  totalCustomerBalances: number;
  totalSupplierBalances: number;
  treasuryBalance: number;
  itemCount: number;
  salesCount: number;
}

export interface BranchRollupReport {
  generatedAt: string;
  branches: ConsolidatedBranchSummary[];
  grandTotalSales: number;
  grandTotalPurchases: number;
  grandTotalTreasury: number;
  grandTotalCustomerBalances: number;
  grandTotalSupplierBalances: number;
}

// ============================================================
// 1. تصدير الفرع المحلي كـ .esbranch Package
// ============================================================
export function exportBranchPackage(state: AppState, deviceFingerprint: string): string {
  const pkg: BranchExportPackage = {
    version: '1.0',
    branchId: `branch-${state.company.taxId || 'local'}`,
    branchName: state.company.name || 'Local Branch',
    branchNameAr: state.company.nameAr || 'الفرع المحلي',
    exportedAt: new Date().toISOString(),
    deviceFingerprint,
    snapshot: state,
  };
  return JSON.stringify(pkg, null, 2);
}

// ============================================================
// 2. تحليل وتجميع ملفات الفروع في ذاكرة العرض فقط
// ============================================================
export function buildBranchRollupReport(branchPackagesJson: string[]): BranchRollupReport {
  const summaries: ConsolidatedBranchSummary[] = [];

  for (const jsonStr of branchPackagesJson) {
    try {
      const pkg = JSON.parse(jsonStr) as BranchExportPackage;
      if (!pkg.snapshot) continue;

      const snap = pkg.snapshot;
      const totalSales = round2(snap.salesInvoices.reduce((s, inv) => s + inv.total, 0));
      const totalPurchases = round2(snap.purchaseInvoices.reduce((s, inv) => s + inv.total, 0));
      const totalCustomerBalances = round2(snap.customers.reduce((s, c) => s + Math.max(0, c.balance), 0));
      const totalSupplierBalances = round2(snap.suppliers.reduce((s, sup) => s + Math.max(0, sup.balance), 0));
      const treasuryBalance = round2(snap.treasuryAccounts.reduce((s, a) => s + a.balance, 0));

      summaries.push({
        branchId: pkg.branchId,
        branchName: pkg.branchNameAr || pkg.branchName,
        totalSales,
        totalPurchases,
        totalCustomerBalances,
        totalSupplierBalances,
        treasuryBalance,
        itemCount: snap.items.length,
        salesCount: snap.salesInvoices.length,
      });
    } catch {
      /* تجاهل الحزم التالفة */
    }
  }

  const grandTotalSales = round2(summaries.reduce((s, b) => s + b.totalSales, 0));
  const grandTotalPurchases = round2(summaries.reduce((s, b) => s + b.totalPurchases, 0));
  const grandTotalTreasury = round2(summaries.reduce((s, b) => s + b.treasuryBalance, 0));
  const grandTotalCustomerBalances = round2(summaries.reduce((s, b) => s + b.totalCustomerBalances, 0));
  const grandTotalSupplierBalances = round2(summaries.reduce((s, b) => s + b.totalSupplierBalances, 0));

  return {
    generatedAt: new Date().toISOString(),
    branches: summaries,
    grandTotalSales,
    grandTotalPurchases,
    grandTotalTreasury,
    grandTotalCustomerBalances,
    grandTotalSupplierBalances,
  };
}
