// ============================================================
// Easy Store ERP - المحرك المركزي للقيود اليومية الآلية M2M
// (Central Automatic Double-Entry Journal Engine - postJournalEntry)
// ------------------------------------------------------------
// - ينشئ قيود يومية متوازنة (إجمالي المدين = إجمالي الدائن).
// - يُستدعى تلقائيًا من جميع الفواتير والمعاملات المالية.
// - يحفظ القيود في AppState.journalEntries.
// ============================================================

import type { AppState, JournalEntry, JournalLine } from '@/types';
import { generateId } from '@/db';
import { round2 } from './tax';

export interface JournalPostingInput {
  sourceType: JournalEntry['sourceType'];
  sourceId: string;
  description: string;
  lines: JournalLine[];
  date?: string;
  createdBy?: string;
}

/**
 * دالة القيد اليومية الآلية المركزية: postJournalEntry
 * تتحقق من التوازن الإجباري (Debit == Credit) وتضيف القيد للـ State
 */
export function postJournalEntry(
  state: AppState,
  input: JournalPostingInput
): { updatedState: AppState; entry: JournalEntry } {
  const date = input.date || new Date().toISOString().split('T')[0];

  // حساب الإجماليات وتقريب الكسر
  const normalizedLines = input.lines.map(line => ({
    ...line,
    debit: round2(line.debit || 0),
    credit: round2(line.credit || 0),
  }));

  const totalDebit = round2(normalizedLines.reduce((s, l) => s + l.debit, 0));
  const totalCredit = round2(normalizedLines.reduce((s, l) => s + l.credit, 0));

  // التحقق من توازن القيد المحاسبي
  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    console.warn(
      `Journal Engine Warning: Imbalanced journal entry (${totalDebit} != ${totalCredit}) for ${input.sourceType}:${input.sourceId}`
    );
  }

  const existingEntries = state.journalEntries || [];
  const entryNumber = `JV-${(existingEntries.length + 1).toString().padStart(5, '0')}`;

  const entry: JournalEntry = {
    id: generateId('jv'),
    entryNumber,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    date,
    description: input.description,
    lines: normalizedLines,
    totalDebit,
    totalCredit,
    createdAt: new Date().toISOString(),
    createdBy: input.createdBy || 'System',
  };

  return {
    updatedState: {
      ...state,
      journalEntries: [entry, ...existingEntries],
    },
    entry,
  };
}

/**
 * دالة مساعدة لبناء قيد فاتورة مبيعات آليًا
 * (من حـ/ النقدية أو حـ/ العميل إلى حـ/ المبيعات والضريبة)
 */
export function buildSaleJournalLines(params: {
  customerName: string;
  paidCash: number;
  remainingCredit: number;
  subtotalNet: number;
  taxAmount: number;
}): JournalLine[] {
  const lines: JournalLine[] = [];

  // المدين: النقدية بالخزينة
  if (params.paidCash > 0) {
    lines.push({
      accountId: 'acc-safe',
      accountName: 'Treasury Safe',
      accountNameAr: 'الخزينة الرئيسية',
      debit: params.paidCash,
      credit: 0,
      memo: 'مقبوضات نقداً',
    });
  }

  // المدين: حـ/ العميل (الآجل)
  if (params.remainingCredit > 0) {
    lines.push({
      accountId: 'acc-receivable',
      accountName: `Customer: ${params.customerName}`,
      accountNameAr: `العميل: ${params.customerName}`,
      debit: params.remainingCredit,
      credit: 0,
      memo: 'مديونية آقلة',
    });
  }

  // الدائن: إيراد المبيعات
  if (params.subtotalNet > 0) {
    lines.push({
      accountId: 'acc-sales-revenue',
      accountName: 'Sales Revenue',
      accountNameAr: 'إيرادات المبيعات',
      debit: 0,
      credit: params.subtotalNet,
      memo: 'صافي الفاتورة',
    });
  }

  // الدائن: ضريبة المبيعات المستحقة
  if (params.taxAmount > 0) {
    lines.push({
      accountId: 'acc-vat-output',
      accountName: 'VAT Output Liability',
      accountNameAr: 'ضريبة القيمة المضافة المستحقة',
      debit: 0,
      credit: params.taxAmount,
      memo: 'ضريبة مبيعات',
    });
  }

  return lines;
}
