// ============================================================
// Easy Store ERP - خدمة جرد ومطابقة الخزينة (Cash Audit & Reconciliation)
// ------------------------------------------------------------
// - مقارنة الرصيد النظري الدفتري بالرصيد الفعلي في الصندوق.
// - اكتشاف حالات العجز والزيادة.
// - إنشاء قيد تسوية تلقائي عبر محرك القيود المركزي postJournalEntry.
// ============================================================

import type { AppState, CashAuditRecord, TreasuryAccount } from '@/types';
import { generateId } from '@/db';
import { postJournalEntry } from './journal';
import { round2 } from './tax';

export interface AuditCashParams {
  treasuryAccount: TreasuryAccount;
  actualCashBalance: number;
  notes?: string;
  createdBy?: string;
}

export function performCashAudit(
  state: AppState,
  params: AuditCashParams
): { updatedState: AppState; auditRecord: CashAuditRecord } {
  const bookBalance = round2(params.treasuryAccount.balance);
  const actualCashBalance = round2(params.actualCashBalance);
  const difference = round2(actualCashBalance - bookBalance);

  let status: CashAuditRecord['status'] = 'matched';
  if (difference < -0.01) {
    status = 'deficit';
  } else if (difference > 0.01) {
    status = 'surplus';
  }

  let currentState = state;
  let journalId: string | undefined;

  // في حال وجود عجز أو زيادة، يتم تشغيل قيد تسوية تلقائي عبر postJournalEntry
  if (status !== 'matched') {
    const isDeficit = difference < 0;
    const absDiff = Math.abs(difference);

    const journalRes = postJournalEntry(currentState, {
      sourceType: 'cash_audit',
      sourceId: `audit-${Date.now()}`,
      description: isDeficit
        ? `قيد تسوية عجز خزينة: ${params.treasuryAccount.nameAr || params.treasuryAccount.name}`
        : `قيد تسوية زيادة خزينة: ${params.treasuryAccount.nameAr || params.treasuryAccount.name}`,
      lines: [
        {
          accountId: isDeficit ? 'acc-expense-deficit' : params.treasuryAccount.id,
          accountName: isDeficit ? 'Cash Shortage Expense' : params.treasuryAccount.name,
          accountNameAr: isDeficit ? 'مصروف عجز الخزينة' : params.treasuryAccount.nameAr,
          debit: absDiff,
          credit: 0,
          memo: isDeficit ? 'تسوية عجز صندوق' : 'إيداع فائض صندوق',
        },
        {
          accountId: isDeficit ? params.treasuryAccount.id : 'acc-income-surplus',
          accountName: isDeficit ? params.treasuryAccount.name : 'Cash Surplus Income',
          accountNameAr: isDeficit ? params.treasuryAccount.nameAr : 'إيراد زيادة الخزينة',
          debit: 0,
          credit: absDiff,
          memo: isDeficit ? 'خصم من الخزينة' : 'تسوية زيادة صندوق',
        },
      ],
      createdBy: params.createdBy,
    });

    currentState = journalRes.updatedState;
    journalId = journalRes.entry.id;

    // تحديث رصيد الخزينة إلى الرصيد الفعلي
    const updatedTreasuries = currentState.treasuryAccounts.map(a =>
      a.id === params.treasuryAccount.id ? { ...a, balance: actualCashBalance } : a
    );
    currentState = { ...currentState, treasuryAccounts: updatedTreasuries };
  }

  const auditRecord: CashAuditRecord = {
    id: generateId('ca'),
    auditNumber: `AUD-${Date.now().toString().slice(-6)}`,
    treasuryAccountId: params.treasuryAccount.id,
    treasuryAccountName: params.treasuryAccount.nameAr || params.treasuryAccount.name,
    bookBalance,
    actualCashBalance,
    difference,
    status,
    adjustmentJournalId: journalId,
    notes: params.notes,
    createdAt: new Date().toISOString(),
    createdBy: params.createdBy || 'Cashier',
  };

  return {
    updatedState: currentState,
    auditRecord,
  };
}
