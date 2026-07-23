import React, { createContext, useContext, useReducer, useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import type { AppState, ModuleId, Item, Category, Supplier, Customer, SaleInvoice, PurchaseInvoice, ReturnInvoice, ExchangeInvoice, CustomerAdjustment, CreditDebitNote, AuditLogEntry, TreasuryAccount, Transaction, Employee, AttendanceRecord, PayrollRecord, EmployeeAdvance, Installment, FixedAsset, CompanySettings, InvoiceDesign, AppNotification, User, JournalEntry, SectorProfile, MaintenanceReceipt, MaintenanceStatus } from '@/types';
import { getDefaultState, loadStateAsync, saveState } from '@/db';
import { runDailyBackupIfNeeded } from '@/db/backup';

// ─── Action Types ──────────────────────────────────────────────

type Action =
  | { type: 'SET_STATE'; payload: AppState }
  | { type: 'SET_MODULE'; payload: ModuleId }
  | { type: 'ADD_ITEM'; payload: Item }
  | { type: 'UPDATE_ITEM'; payload: Item }
  | { type: 'DELETE_ITEM'; payload: string }
  | { type: 'STOCK_RECEIPT'; payload: { itemId: string; quantity: number; note?: string } }
  | { type: 'STOCK_ISSUE'; payload: { itemId: string; quantity: number; note?: string } }
  | { type: 'STOCK_DAMAGE'; payload: { itemId: string; quantity: number; note?: string } }
  | { type: 'STOCK_ADJUST'; payload: { itemId: string; newQuantity: number; note?: string } }
  | { type: 'ADD_CATEGORY'; payload: Category }
  | { type: 'UPDATE_CATEGORY'; payload: Category }
  | { type: 'DELETE_CATEGORY'; payload: string }
  | { type: 'ADD_SUPPLIER'; payload: Supplier }
  | { type: 'UPDATE_SUPPLIER'; payload: Supplier }
  | { type: 'DELETE_SUPPLIER'; payload: string }
  | { type: 'ADD_CUSTOMER'; payload: Customer }
  | { type: 'UPDATE_CUSTOMER'; payload: Customer }
  | { type: 'DELETE_CUSTOMER'; payload: string }
  | { type: 'ADD_SALE'; payload: SaleInvoice }
  | { type: 'UPDATE_SALE'; payload: SaleInvoice }
  | { type: 'DELETE_SALE'; payload: string }
  | { type: 'ADD_PURCHASE'; payload: PurchaseInvoice }
  | { type: 'UPDATE_PURCHASE'; payload: PurchaseInvoice }
  | { type: 'ADD_RETURN'; payload: ReturnInvoice }
  | { type: 'ADD_EXCHANGE'; payload: ExchangeInvoice }
  | { type: 'ADD_CUSTOMER_ADJUSTMENT'; payload: CustomerAdjustment }
  | { type: 'ADD_CREDIT_DEBIT_NOTE'; payload: CreditDebitNote }
  | { type: 'ADD_AUDIT_LOG'; payload: AuditLogEntry }
  | { type: 'ADD_TRANSACTION'; payload: Transaction }
  | { type: 'DELETE_TRANSACTION'; payload: string }
  | { type: 'UPDATE_TREASURY_ACCOUNT'; payload: TreasuryAccount }
  | { type: 'ADD_EMPLOYEE'; payload: Employee }
  | { type: 'UPDATE_EMPLOYEE'; payload: Employee }
  | { type: 'DELETE_EMPLOYEE'; payload: string }
  | { type: 'ADD_ATTENDANCE'; payload: AttendanceRecord }
  | { type: 'UPDATE_ATTENDANCE'; payload: AttendanceRecord }
  | { type: 'ADD_PAYROLL'; payload: PayrollRecord }
  | { type: 'UPDATE_PAYROLL'; payload: PayrollRecord }
  | { type: 'ADD_EMPLOYEE_ADVANCE'; payload: EmployeeAdvance }
  | { type: 'UPDATE_EMPLOYEE_ADVANCE'; payload: EmployeeAdvance }
  | { type: 'DELETE_EMPLOYEE_ADVANCE'; payload: string }
  | { type: 'ADD_INSTALLMENT'; payload: Installment }
  | { type: 'UPDATE_INSTALLMENT'; payload: Installment }
  | { type: 'ADD_FIXED_ASSET'; payload: FixedAsset }
  | { type: 'UPDATE_FIXED_ASSET'; payload: FixedAsset }
  | { type: 'DELETE_FIXED_ASSET'; payload: string }
  | { type: 'UPDATE_COMPANY'; payload: CompanySettings }
  | { type: 'UPDATE_INVOICE_DESIGN'; payload: InvoiceDesign }
  | { type: 'ADD_NOTIFICATION'; payload: AppNotification }
  | { type: 'MARK_NOTIFICATION_READ'; payload: string }
  | { type: 'UPDATE_USER'; payload: User }
  | { type: 'ADD_USER'; payload: User }
  | { type: 'DELETE_USER'; payload: string }
  | { type: 'SET_SECTOR_PROFILE'; payload: SectorProfile }
  | { type: 'ADD_JOURNAL_ENTRY'; payload: JournalEntry }
  | { type: 'ADD_MAINTENANCE_RECEIPT'; payload: MaintenanceReceipt }
  | { type: 'UPDATE_MAINTENANCE_STATUS'; payload: { id: string; status: MaintenanceStatus } }
  | { type: 'RESET_DEMO' };

// ─── State Shape ───────────────────────────────────────────────

interface UIState {
  currentModule: ModuleId;
  sidebarOpen: boolean;
  isLoading: boolean;
  toast: { message: string; type: 'success' | 'error' | 'warning' | 'info' } | null;
}

interface AppContextState {
  data: AppState;
  ui: UIState;
}

// ─── Helpers ───────────────────────────────────────────────────

// إعادة حساب رصيد كل عميل من جميع المستندات (فواتير/مرتجعات/استبدال/تعديلات)
// القاعدة: الرصيد = Σ(إجمالي الفاتورة − المدفوع) + Σ(مرتجع) + Σ(استبدال) + Σ(تعديلات يدوية)
export function recalcCustomerBalances(data: AppState): AppState {
  const balances = new Map<string, number>();
  const add = (cid: string | null | undefined, amt: number) => {
    if (!cid) return;
    balances.set(cid, (balances.get(cid) ?? 0) + amt);
  };
  data.salesInvoices.forEach(inv => add(inv.customerId, (inv.total || 0) - (inv.paid || 0)));
  (data.returns || []).forEach(r => add(r.customerId, (r.refund || 0) - (r.total || 0)));
  (data.exchanges || []).forEach(e => add(e.customerId, (e.priceDifference || 0) - (e.paid || 0)));
  (data.customerAdjustments || []).forEach(a => add(a.customerId, a.amount || 0));
  // إشعارات الخصم/الإضافة: credit (دائن) يقلل مديونية العميل، debit (مدين) يزيدها
  (data.creditDebitNotes || []).forEach(n => {
    if (n.partyType !== 'customer') return;
    const total = n.totalInclTax ?? n.amount ?? 0;
    add(n.partyId, n.direction === 'credit' ? -total : total);
  });
  return {
    ...data,
    customers: data.customers.map(c => ({
      ...c,
      balance: Math.round((balances.get(c.id) ?? 0) * 100) / 100,
    })),
  };
}

function applyStockDelta(items: Item[], itemId: string, delta: number): Item[] {
  return items.map(item =>
    item.id === itemId
      ? { ...item, stockQuantity: Math.max(0, item.stockQuantity + delta) }
      : item,
  );
}

// ─── Reducer ───────────────────────────────────────────────────

function appReducer(state: AppContextState, action: Action): AppContextState {
  let newData: AppState;

  switch (action.type) {
    case 'SET_STATE':
      return { ...state, data: recalcCustomerBalances(action.payload) };

    case 'SET_MODULE':
      return { ...state, ui: { ...state.ui, currentModule: action.payload } };

    case 'ADD_ITEM':
      newData = { ...state.data, items: [...state.data.items, action.payload] };
      saveState(newData);
      return { ...state, data: newData };

    case 'UPDATE_ITEM':
      newData = { ...state.data, items: state.data.items.map(i => i.id === action.payload.id ? action.payload : i) };
      saveState(newData);
      return { ...state, data: newData };

    case 'STOCK_RECEIPT':
      newData = { ...state.data, items: applyStockDelta(state.data.items, action.payload.itemId, action.payload.quantity) };
      saveState(newData);
      return { ...state, data: newData };

    case 'STOCK_ISSUE':
      newData = { ...state.data, items: applyStockDelta(state.data.items, action.payload.itemId, -action.payload.quantity) };
      saveState(newData);
      return { ...state, data: newData };

    case 'STOCK_DAMAGE':
      newData = { ...state.data, items: applyStockDelta(state.data.items, action.payload.itemId, -action.payload.quantity) };
      saveState(newData);
      return { ...state, data: newData };

    case 'STOCK_ADJUST': {
      const target = state.data.items.find(i => i.id === action.payload.itemId);
      if (!target) return state;
      const newQty = Math.max(0, action.payload.newQuantity);
      newData = { ...state.data, items: state.data.items.map(i => i.id === action.payload.itemId ? { ...i, stockQuantity: newQty } : i) };
      saveState(newData);
      return { ...state, data: newData };
    }

    case 'DELETE_ITEM':
      newData = { ...state.data, items: state.data.items.filter(i => i.id !== action.payload) };
      saveState(newData);
      return { ...state, data: newData };

    case 'ADD_CATEGORY':
      newData = { ...state.data, categories: [...state.data.categories, action.payload] };
      saveState(newData);
      return { ...state, data: newData };

    case 'UPDATE_CATEGORY':
      newData = { ...state.data, categories: state.data.categories.map(c => c.id === action.payload.id ? action.payload : c) };
      saveState(newData);
      return { ...state, data: newData };

    case 'DELETE_CATEGORY':
      newData = { ...state.data, categories: state.data.categories.filter(c => c.id !== action.payload) };
      saveState(newData);
      return { ...state, data: newData };

    case 'ADD_SUPPLIER':
      newData = { ...state.data, suppliers: [...state.data.suppliers, action.payload] };
      saveState(newData);
      return { ...state, data: newData };

    case 'UPDATE_SUPPLIER':
      newData = { ...state.data, suppliers: state.data.suppliers.map(s => s.id === action.payload.id ? action.payload : s) };
      saveState(newData);
      return { ...state, data: newData };

    case 'DELETE_SUPPLIER':
      newData = { ...state.data, suppliers: state.data.suppliers.filter(s => s.id !== action.payload) };
      saveState(newData);
      return { ...state, data: newData };

    case 'ADD_CUSTOMER':
      newData = { ...state.data, customers: [...state.data.customers, action.payload] };
      saveState(newData);
      return { ...state, data: newData };

    case 'UPDATE_CUSTOMER':
      newData = { ...state.data, customers: state.data.customers.map(c => c.id === action.payload.id ? action.payload : c) };
      saveState(newData);
      return { ...state, data: newData };

    case 'DELETE_CUSTOMER':
      newData = { ...state.data, customers: state.data.customers.filter(c => c.id !== action.payload) };
      saveState(newData);
      return { ...state, data: newData };

    case 'ADD_SALE': {
      newData = { ...state.data, salesInvoices: [...state.data.salesInvoices, action.payload] };
      // Update item stock
      action.payload.items.forEach(soldItem => {
        newData.items = newData.items.map(item =>
          item.id === soldItem.itemId
            ? { ...item, stockQuantity: Math.max(0, item.stockQuantity - soldItem.quantity) }
            : item
        );
      });
      // Update treasury
      const safeAccount = newData.treasuryAccounts.find(a => a.type === 'safe');
      if (safeAccount && action.payload.paymentMethod !== 'installment') {
        newData.treasuryAccounts = newData.treasuryAccounts.map(a =>
          a.id === safeAccount.id ? { ...a, balance: a.balance + action.payload.paid } : a
        );
        // Add transaction
        newData.transactions = [...newData.transactions, {
          id: `tr-${Date.now()}`,
          accountId: safeAccount.id,
          accountName: safeAccount.name,
          type: 'income',
          amount: action.payload.paid,
          description: `Sale ${action.payload.invoiceNumber}`,
          referenceNumber: action.payload.invoiceNumber,
          category: 'Sales',
          date: new Date().toISOString().split('T')[0],
          createdAt: new Date().toISOString(),
          createdBy: 'System',
        }];
      }
      newData = recalcCustomerBalances(newData);
      saveState(newData);
      return { ...state, data: newData };
    }

    case 'UPDATE_SALE': {
      const oldInv = state.data.salesInvoices.find(s => s.id === action.payload.id);
      newData = { ...state.data, salesInvoices: state.data.salesInvoices.map(s => s.id === action.payload.id ? action.payload : s) };
      if (oldInv) {
        // مطابقة المخزون: إرجاع كميات الفاتورة القديمة ثم خصم كميات الجديدة
        const delta = new Map<string, number>();
        oldInv.items.forEach(it => delta.set(it.itemId, (delta.get(it.itemId) ?? 0) + it.quantity));
        action.payload.items.forEach(it => delta.set(it.itemId, (delta.get(it.itemId) ?? 0) - it.quantity));
        delta.forEach((d, itemId) => { if (d !== 0) newData.items = applyStockDelta(newData.items, itemId, d); });
        // مطابقة الخزينة بفرق المدفوع
        const safe = newData.treasuryAccounts.find(a => a.type === 'safe');
        const paidDiff = (action.payload.paid || 0) - (oldInv.paid || 0);
        if (safe && paidDiff !== 0) {
          newData.treasuryAccounts = newData.treasuryAccounts.map(a => a.id === safe.id ? { ...a, balance: a.balance + paidDiff } : a);
        }
      }
      newData = recalcCustomerBalances(newData);
      saveState(newData);
      return { ...state, data: newData };
    }

    case 'DELETE_SALE': {
      const inv = state.data.salesInvoices.find(s => s.id === action.payload);
      newData = { ...state.data, salesInvoices: state.data.salesInvoices.filter(s => s.id !== action.payload) };
      if (inv) {
        // إرجاع المخزون
        inv.items.forEach(it => { newData.items = applyStockDelta(newData.items, it.itemId, it.quantity); });
        // عكس المدفوع من الخزينة
        const safe = newData.treasuryAccounts.find(a => a.type === 'safe');
        if (safe && inv.paid) {
          newData.treasuryAccounts = newData.treasuryAccounts.map(a => a.id === safe.id ? { ...a, balance: a.balance - inv.paid } : a);
        }
      }
      newData = recalcCustomerBalances(newData);
      saveState(newData);
      return { ...state, data: newData };
    }

    case 'ADD_RETURN': {
      const r = action.payload;
      newData = { ...state.data, returns: [...(state.data.returns || []), r] };
      // المرتجع يعيد الأصناف إلى المخزون
      r.items.forEach(it => { newData.items = applyStockDelta(newData.items, it.itemId, it.quantity); });
      // استرداد نقدي من الخزينة
      const safe = newData.treasuryAccounts.find(a => a.type === 'safe');
      if (safe && r.refund) {
        newData.treasuryAccounts = newData.treasuryAccounts.map(a => a.id === safe.id ? { ...a, balance: a.balance - r.refund } : a);
        newData.transactions = [...newData.transactions, {
          id: `tr-${Date.now()}`,
          accountId: safe.id,
          accountName: safe.name,
          type: 'expense',
          amount: r.refund,
          description: `Return ${r.returnNumber}`,
          referenceNumber: r.returnNumber,
          category: 'Returns',
          date: new Date().toISOString().split('T')[0],
          createdAt: new Date().toISOString(),
          createdBy: r.createdBy || 'System',
        }];
      }
      newData = recalcCustomerBalances(newData);
      saveState(newData);
      return { ...state, data: newData };
    }

    case 'ADD_EXCHANGE': {
      const ex = action.payload;
      newData = { ...state.data, exchanges: [...(state.data.exchanges || []), ex] };
      // الأصناف المرتجعة تعود للمخزون، والجديدة تُخصم
      ex.returnedItems.forEach(it => { newData.items = applyStockDelta(newData.items, it.itemId, it.quantity); });
      ex.newItems.forEach(it => { newData.items = applyStockDelta(newData.items, it.itemId, -it.quantity); });
      // فرق السعر المدفوع نقدًا (موجب = دخل، سالب = استرداد)
      const safe = newData.treasuryAccounts.find(a => a.type === 'safe');
      if (safe && ex.paid) {
        newData.treasuryAccounts = newData.treasuryAccounts.map(a => a.id === safe.id ? { ...a, balance: a.balance + ex.paid } : a);
        newData.transactions = [...newData.transactions, {
          id: `tr-${Date.now()}`,
          accountId: safe.id,
          accountName: safe.name,
          type: ex.paid >= 0 ? 'income' : 'expense',
          amount: Math.abs(ex.paid),
          description: `Exchange ${ex.exchangeNumber}`,
          referenceNumber: ex.exchangeNumber,
          category: 'Exchange',
          date: new Date().toISOString().split('T')[0],
          createdAt: new Date().toISOString(),
          createdBy: ex.createdBy || 'System',
        }];
      }
      newData = recalcCustomerBalances(newData);
      saveState(newData);
      return { ...state, data: newData };
    }

    case 'ADD_CUSTOMER_ADJUSTMENT': {
      newData = { ...state.data, customerAdjustments: [...(state.data.customerAdjustments || []), action.payload] };
      newData = recalcCustomerBalances(newData);
      saveState(newData);
      return { ...state, data: newData };
    }

    case 'ADD_CREDIT_DEBIT_NOTE': {
      const note = action.payload;
      newData = { ...state.data, creditDebitNotes: [...(state.data.creditDebitNotes || []), note] };
      // إشعار دائن (credit) للعميل = استرداد نقدي من الخزينة
      // إشعار مدين (debit) للعميل = تحصيل نقدي للخزينة
      if (note.partyType === 'customer') {
        const safe = newData.treasuryAccounts.find(a => a.type === 'safe');
        const total = note.totalInclTax ?? note.amount ?? 0;
        if (safe && total > 0) {
          const isCredit = note.direction === 'credit';
          newData.treasuryAccounts = newData.treasuryAccounts.map(a =>
            a.id === safe.id ? { ...a, balance: a.balance + (isCredit ? -total : total) } : a
          );
          newData.transactions = [...newData.transactions, {
            id: `tr-${Date.now()}`,
            accountId: safe.id,
            accountName: safe.name,
            type: isCredit ? 'expense' : 'income',
            amount: total,
            description: `${isCredit ? 'Credit Note' : 'Debit Note'} ${note.number}`,
            referenceNumber: note.number,
            category: 'Notes',
            date: new Date().toISOString().split('T')[0],
            createdAt: new Date().toISOString(),
            createdBy: note.createdBy || 'System',
          }];
        }
      }
      newData = recalcCustomerBalances(newData);
      saveState(newData);
      return { ...state, data: newData };
    }

    case 'ADD_AUDIT_LOG':
      newData = { ...state.data, auditLogs: [action.payload, ...(state.data.auditLogs || [])].slice(0, 1000) };
      saveState(newData);
      return { ...state, data: newData };

    case 'ADD_PURCHASE':
      newData = { ...state.data, purchaseInvoices: [...state.data.purchaseInvoices, action.payload] };
      // Update item stock
      action.payload.items.forEach(purchasedItem => {
        newData.items = newData.items.map(item =>
          item.id === purchasedItem.itemId
            ? { ...item, stockQuantity: item.stockQuantity + purchasedItem.quantity }
            : item
        );
      });
      saveState(newData);
      return { ...state, data: newData };

    case 'UPDATE_PURCHASE':
      newData = { ...state.data, purchaseInvoices: state.data.purchaseInvoices.map(p => p.id === action.payload.id ? action.payload : p) };
      saveState(newData);
      return { ...state, data: newData };

    case 'ADD_TRANSACTION': {
      newData = { ...state.data, transactions: [...state.data.transactions, action.payload] };
      // Update account balance
      const account = newData.treasuryAccounts.find(a => a.id === action.payload.accountId);
      if (account) {
        const delta = action.payload.type === 'expense' || action.payload.type === 'transfer_out'
          ? -action.payload.amount : action.payload.amount;
        newData.treasuryAccounts = newData.treasuryAccounts.map(a =>
          a.id === account.id ? { ...a, balance: a.balance + delta } : a
        );
      }
      saveState(newData);
      return { ...state, data: newData };
    }

    case 'DELETE_TRANSACTION': {
      const target = state.data.transactions.find(t => t.id === action.payload);
      newData = { ...state.data, transactions: state.data.transactions.filter(t => t.id !== action.payload) };
      if (target) {
        const account = newData.treasuryAccounts.find(a => a.id === target.accountId);
        if (account) {
          const delta = target.type === 'expense' || target.type === 'transfer_out'
            ? target.amount : -target.amount;
          newData.treasuryAccounts = newData.treasuryAccounts.map(a =>
            a.id === account.id ? { ...a, balance: a.balance + delta } : a
          );
        }
      }
      saveState(newData);
      return { ...state, data: newData };
    }

    case 'UPDATE_TREASURY_ACCOUNT':
      newData = { ...state.data, treasuryAccounts: state.data.treasuryAccounts.map(a => a.id === action.payload.id ? action.payload : a) };
      saveState(newData);
      return { ...state, data: newData };

    case 'ADD_EMPLOYEE':
      newData = { ...state.data, employees: [...state.data.employees, action.payload] };
      saveState(newData);
      return { ...state, data: newData };

    case 'UPDATE_EMPLOYEE':
      newData = { ...state.data, employees: state.data.employees.map(e => e.id === action.payload.id ? action.payload : e) };
      saveState(newData);
      return { ...state, data: newData };

    case 'DELETE_EMPLOYEE':
      newData = { ...state.data, employees: state.data.employees.filter(e => e.id !== action.payload) };
      saveState(newData);
      return { ...state, data: newData };

    case 'ADD_ATTENDANCE':
      newData = { ...state.data, attendanceRecords: [...state.data.attendanceRecords, action.payload] };
      saveState(newData);
      return { ...state, data: newData };

    case 'UPDATE_ATTENDANCE':
      newData = { ...state.data, attendanceRecords: state.data.attendanceRecords.map(a => a.id === action.payload.id ? action.payload : a) };
      saveState(newData);
      return { ...state, data: newData };

    case 'ADD_PAYROLL':
      newData = { ...state.data, payrollRecords: [...state.data.payrollRecords, action.payload] };
      saveState(newData);
      return { ...state, data: newData };

    case 'UPDATE_PAYROLL':
      newData = { ...state.data, payrollRecords: state.data.payrollRecords.map(p => p.id === action.payload.id ? action.payload : p) };
      saveState(newData);
      return { ...state, data: newData };

    case 'ADD_EMPLOYEE_ADVANCE':
      newData = { ...state.data, employeeAdvances: [...state.data.employeeAdvances, action.payload] };
      saveState(newData);
      return { ...state, data: newData };

    case 'UPDATE_EMPLOYEE_ADVANCE':
      newData = { ...state.data, employeeAdvances: state.data.employeeAdvances.map(a => a.id === action.payload.id ? action.payload : a) };
      saveState(newData);
      return { ...state, data: newData };

    case 'DELETE_EMPLOYEE_ADVANCE':
      newData = { ...state.data, employeeAdvances: state.data.employeeAdvances.filter(a => a.id !== action.payload) };
      saveState(newData);
      return { ...state, data: newData };

    case 'ADD_INSTALLMENT':
      newData = { ...state.data, installments: [...state.data.installments, action.payload] };
      saveState(newData);
      return { ...state, data: newData };

    case 'UPDATE_INSTALLMENT':
      newData = { ...state.data, installments: state.data.installments.map(i => i.id === action.payload.id ? action.payload : i) };
      saveState(newData);
      return { ...state, data: newData };

    case 'ADD_FIXED_ASSET':
      newData = { ...state.data, fixedAssets: [...state.data.fixedAssets, action.payload] };
      saveState(newData);
      return { ...state, data: newData };

    case 'UPDATE_FIXED_ASSET':
      newData = { ...state.data, fixedAssets: state.data.fixedAssets.map(f => f.id === action.payload.id ? action.payload : f) };
      saveState(newData);
      return { ...state, data: newData };

    case 'DELETE_FIXED_ASSET':
      newData = { ...state.data, fixedAssets: state.data.fixedAssets.filter(f => f.id !== action.payload) };
      saveState(newData);
      return { ...state, data: newData };

    case 'UPDATE_COMPANY':
      newData = { ...state.data, company: action.payload };
      saveState(newData);
      return { ...state, data: newData };

    case 'UPDATE_INVOICE_DESIGN':
      newData = { ...state.data, invoiceDesign: action.payload };
      saveState(newData);
      return { ...state, data: newData };

    case 'ADD_NOTIFICATION':
      newData = { ...state.data, notifications: [action.payload, ...state.data.notifications] };
      saveState(newData);
      return { ...state, data: newData };

    case 'MARK_NOTIFICATION_READ':
      newData = { ...state.data, notifications: state.data.notifications.map(n => n.id === action.payload ? { ...n, isRead: true } : n) };
      saveState(newData);
      return { ...state, data: newData };

    case 'ADD_USER':
      newData = { ...state.data, users: [...state.data.users, action.payload] };
      saveState(newData);
      return { ...state, data: newData };

    case 'UPDATE_USER':
      newData = { ...state.data, users: state.data.users.map(u => u.id === action.payload.id ? action.payload : u) };
      saveState(newData);
      return { ...state, data: newData };

    case 'DELETE_USER':
      newData = { ...state.data, users: state.data.users.filter(u => u.id !== action.payload) };
      saveState(newData);
      return { ...state, data: newData };

    case 'SET_SECTOR_PROFILE':
      newData = { ...state.data, sectorProfile: action.payload };
      saveState(newData);
      return { ...state, data: newData };

    case 'ADD_JOURNAL_ENTRY':
      newData = { ...state.data, journalEntries: [action.payload, ...(state.data.journalEntries || [])] };
      saveState(newData);
      return { ...state, data: newData };

    case 'ADD_MAINTENANCE_RECEIPT':
      newData = { ...state.data, maintenanceReceipts: [action.payload, ...(state.data.maintenanceReceipts || [])] };
      saveState(newData);
      return { ...state, data: newData };

    case 'UPDATE_MAINTENANCE_STATUS':
      newData = {
        ...state.data,
        maintenanceReceipts: (state.data.maintenanceReceipts || []).map(r =>
          r.id === action.payload.id ? { ...r, status: action.payload.status } : r
        ),
      };
      saveState(newData);
      return { ...state, data: newData };

    case 'RESET_DEMO': {
      const fresh = getDefaultState();
      saveState(fresh);
      return { ...state, data: fresh };
    }

    default:
      return state;
  }
}

// ─── Context ───────────────────────────────────────────────────

interface AppContextValue {
  state: AppContextState;
  dispatch: React.Dispatch<Action>;
  setModule: (module: ModuleId) => void;
  showToast: (message: string, type: 'success' | 'error' | 'warning' | 'info') => void;
  clearToast: () => void;
  readOnly: boolean;
  setReadOnly: (v: boolean) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

// الإجراءات المسموح بها في وضع القراءة فقط (تنقل/قراءة) — لا تعديل للبيانات
const READ_ONLY_ALLOWED_ACTIONS = new Set<Action['type']>(['SET_STATE', 'SET_MODULE', 'MARK_NOTIFICATION_READ']);

// ─── Provider ──────────────────────────────────────────────────

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, rawDispatch] = useReducer(appReducer, {
    data: getDefaultState(),
    ui: {
      currentModule: 'dashboard',
      sidebarOpen: true,
      isLoading: true,
      toast: null,
    },
  });
  const [booted, setBooted] = useState(false);
  const [readOnly, setReadOnly] = useState(false);

  // غلاف dispatch يمنع إجراءات الكتابة عند انتهاء صلاحية الترخيص (قراءة فقط)
  const dispatch: React.Dispatch<Action> = useCallback((action: Action) => {
    if (readOnly && !READ_ONLY_ALLOWED_ACTIONS.has(action.type)) {
      toast.warning('انتهت صلاحية الترخيص — التطبيق في وضع القراءة فقط. جدّد الترخيص لإجراء التعديلات.');
      return;
    }
    rawDispatch(action);
  }, [readOnly]);

  // تحميل الحالة من قاعدة البيانات المحلية (IndexedDB) عند الإقلاع
  useEffect(() => {
    let mounted = true;
    (async () => {
      const stored = await loadStateAsync();
      if (mounted) {
        dispatch({ type: 'SET_STATE', payload: stored });
        setBooted(true);
        // تشغيل النسخ الاحتياطي التلقائي اليومي بعد الإقلاع (تحت Tauri فقط)
        void runDailyBackupIfNeeded(stored);
      }
    })();
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setModule = useCallback((module: ModuleId) => {
    dispatch({ type: 'SET_MODULE', payload: module });
  }, [dispatch]);

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'warning' | 'info') => {
    switch (type) {
      case 'success':
        toast.success(message);
        break;
      case 'error':
        toast.error(message);
        break;
      case 'warning':
        toast.warning(message);
        break;
      case 'info':
      default:
        toast.info(message);
        break;
    }
  }, []);

  const clearToast = useCallback(() => {
    toast.dismiss();
  }, []);

  // Persist on unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      saveState(state.data);
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [state.data]);

  const value: AppContextValue = {
    state,
    dispatch,
    setModule,
    showToast,
    clearToast,
    readOnly,
    setReadOnly,
  };

  if (!booted) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-background text-foreground">
        <div className="w-10 h-10 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
        <p className="text-sm text-muted-foreground">جارٍ تحميل البيانات...</p>
      </div>
    );
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

// ─── Hook ──────────────────────────────────────────────────────

export function useApp(): AppContextValue {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
