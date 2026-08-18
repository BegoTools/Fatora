// ============================================================
// Easy Store ERP - أدوات صيانة وتنظيف قاعدة البيانات (Section 7.4)
// ------------------------------------------------------------
// 1. مسح وإعادة ضبط الكل (Clear All / Reset to Zero).
// 2. مسح الحركات المالية فقط والإبقاء على بطاقات الأصناف والعملاء والموردين (Clear Transactions Only)
//    لبداية سنة مالية جديدة نظيفة.
// ============================================================

import type { AppState } from '@/types';
import { getDefaultState, saveState } from '@/db';

/**
 * إعادة تصفير قاعدة البيانات بالكامل (Clean Reset)
 */
export function resetEntireDatabase(): AppState {
  const fresh = getDefaultState();
  saveState(fresh);
  return fresh;
}

/**
 * مسح جميع الحركات والفواتير والعمليات المالية مع الحفاظ على البطاقات
 * (الأصناف، الفئات، العملاء، الموردين، والموظفين) لبدء دورة مالية جديدة.
 */
export function clearTransactionsOnly(state: AppState): AppState {
  // إعادة تصفير أرصدة العملاء والموردين
  const resetCustomers = state.customers.map(c => ({ ...c, balance: 0 }));
  const resetSuppliers = state.suppliers.map(s => ({ ...s, balance: 0 }));
  const resetTreasury = state.treasuryAccounts.map(t => ({ ...t, balance: 0 }));

  const cleanedState: AppState = {
    ...state,
    customers: resetCustomers,
    suppliers: resetSuppliers,
    treasuryAccounts: resetTreasury,
    salesInvoices: [],
    purchaseInvoices: [],
    returns: [],
    exchanges: [],
    customerAdjustments: [],
    creditDebitNotes: [],
    transactions: [],
    attendanceRecords: [],
    payrollRecords: [],
    employeeAdvances: [],
    installments: [],
    journalEntries: [],
    maintenanceReceipts: [],
    notifications: [],
    auditLogs: [
      {
        id: `audit-${Date.now()}`,
        action: 'CLEAR_TRANSACTIONS',
        entityType: 'database',
        entityId: 'all',
        description: 'تم مسح الحركات المالية لبداية سنة مالية جديدة مع الحفاظ على البيانات الأساسية.',
        createdAt: new Date().toISOString(),
        createdBy: 'النظام',
      },
    ],
  };

  saveState(cleanedState);
  return cleanedState;
}
