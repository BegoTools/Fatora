import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Search, Pencil, Trash2, X, Wallet, FileText, ArrowLeft, ArrowRight, Eye } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { generateId } from '@/db';
import type { Customer, AuditLogEntry, CustomerAdjustment, SaleInvoice } from '@/types';
import { InvoiceView } from '@/components/invoice/InvoiceView';

const emptyForm = { name: '', nameAr: '', phone: '', email: '', address: '', creditLimit: 0, notes: '' };
const inp = 'w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-card text-foreground';

export function Customers() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const { state, dispatch } = useApp();
  const { user, can } = useAuth();
  const { customers, salesInvoices, returns, exchanges, customerAdjustments } = state.data;

  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [adjustTarget, setAdjustTarget] = useState<Customer | null>(null);
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [accountId, setAccountId] = useState<string | null>(null);
  const [viewInvoice, setViewInvoice] = useState<SaleInvoice | null>(null);

  const formatCurrency = (val: number) => `${(val || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${state.data.company.currencySymbol}`;

  const stats = (id: string) => {
    const invs = salesInvoices.filter(inv => inv.customerId === id);
    const totalPurchases = invs.reduce((s, i) => s + (i.total || 0), 0);
    const totalPayments = invs.reduce((s, i) => s + (i.paid || 0), 0);
    const lastPurchase = invs.reduce<string | null>((last, i) => (!last || i.createdAt > last ? i.createdAt : last), null);
    return { count: invs.length, totalPurchases, totalPayments, lastPurchase };
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.nameAr.toLowerCase().includes(q) ||
      c.phone.includes(q) ||
      (c.email || '').toLowerCase().includes(q),
    );
  }, [customers, search]);

  const openAdd = () => { setEditing(null); setForm(emptyForm); setShowModal(true); };
  const openEdit = (c: Customer) => {
    setEditing(c);
    setForm({ name: c.name, nameAr: c.nameAr, phone: c.phone, email: c.email, address: c.address, creditLimit: c.creditLimit || 0, notes: c.notes || '' });
    setShowModal(true);
  };

  const saveCustomer = () => {
    if (!form.name.trim()) return;
    if (editing) {
      const updated: Customer = {
        ...editing,
        name: form.name.trim(),
        nameAr: form.nameAr.trim() || form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        address: form.address.trim(),
        creditLimit: Number(form.creditLimit) || 0,
        notes: form.notes.trim(),
        updatedAt: new Date().toISOString(),
      };
      dispatch({ type: 'UPDATE_CUSTOMER', payload: updated });
    } else {
      const created: Customer = {
        id: generateId('cust'),
        name: form.name.trim(),
        nameAr: form.nameAr.trim() || form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        address: form.address.trim(),
        creditLimit: Number(form.creditLimit) || 0,
        notes: form.notes.trim(),
        balance: 0,
        isActive: true,
        createdAt: new Date().toISOString(),
      };
      dispatch({ type: 'ADD_CUSTOMER', payload: created });
    }
    setShowModal(false);
  };

  const deleteCustomer = (c: Customer) => {
    if (!window.confirm(t('customers.confirmDelete'))) return;
    dispatch({ type: 'DELETE_CUSTOMER', payload: c.id });
    const audit: AuditLogEntry = {
      id: generateId('audit'), action: 'customer.delete', entityType: 'Customer', entityId: c.id,
      description: `${t('customers.deleteCustomer')}: ${c.name}`, before: JSON.stringify(c),
      createdAt: new Date().toISOString(), createdBy: user?.name || 'System',
    };
    dispatch({ type: 'ADD_AUDIT_LOG', payload: audit });
  };

  const saveAdjustment = () => {
    if (!adjustTarget) return;
    const amount = Number(adjustAmount);
    if (!amount || !adjustReason.trim()) return;
    const adj: CustomerAdjustment = {
      id: generateId('adj'), customerId: adjustTarget.id, amount,
      reason: adjustReason.trim(), createdAt: new Date().toISOString(), createdBy: user?.name || 'System',
    };
    dispatch({ type: 'ADD_CUSTOMER_ADJUSTMENT', payload: adj });
    const audit: AuditLogEntry = {
      id: generateId('audit'), action: 'customer.balance_adjust', entityType: 'Customer', entityId: adjustTarget.id,
      description: `${t('customers.adjustBalance')}: ${adjustTarget.name} (${amount > 0 ? '+' : ''}${amount}) — ${adjustReason.trim()}`,
      createdAt: new Date().toISOString(), createdBy: user?.name || 'System',
    };
    dispatch({ type: 'ADD_AUDIT_LOG', payload: audit });
    setAdjustTarget(null); setAdjustAmount(''); setAdjustReason('');
  };

  // ─── Account statement view ───
  const accountCustomer = accountId ? customers.find(c => c.id === accountId) : null;
  if (accountCustomer) {
    const invs = salesInvoices.filter(i => i.customerId === accountCustomer.id);
    const custReturns = returns.filter(r => r.customerId === accountCustomer.id);
    const custExchanges = exchanges.filter(e => e.customerId === accountCustomer.id);
    const custAdj = customerAdjustments.filter(a => a.customerId === accountCustomer.id);
    const st = stats(accountCustomer.id);

    type Row = { date: string; type: string; ref: string; debit: number; credit: number; note: string; inv?: SaleInvoice };
    const rows: Row[] = [];
    invs.forEach(i => rows.push({ date: i.createdAt, type: t('customers.stmtInvoice'), ref: i.invoiceNumber, debit: i.total || 0, credit: i.paid || 0, note: '', inv: i }));
    custReturns.forEach(r => rows.push({ date: r.createdAt, type: t('customers.stmtReturn'), ref: r.returnNumber, debit: 0, credit: r.total || 0, note: r.notes }));
    custExchanges.forEach(e => rows.push({ date: e.createdAt, type: t('customers.stmtExchange'), ref: e.exchangeNumber, debit: Math.max(0, e.priceDifference || 0), credit: e.paid || 0, note: e.notes }));
    custAdj.forEach(a => rows.push({ date: a.createdAt, type: t('customers.stmtAdjust'), ref: '-', debit: a.amount > 0 ? a.amount : 0, credit: a.amount < 0 ? -a.amount : 0, note: a.reason }));
    rows.sort((a, b) => a.date.localeCompare(b.date));
    let running = 0;

    return (
      <div className="space-y-4">
        <button onClick={() => setAccountId(null)} className={`flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground ${isRTL ? 'flex-row-reverse' : ''}`}>
          {isRTL ? <ArrowRight size={16} /> : <ArrowLeft size={16} />} {t('common.back')}
        </button>

        <div className="bg-card rounded-xl border border-border p-6">
          <div className={`flex items-start justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
            <div>
              <h2 className="text-xl font-bold text-foreground">{isRTL ? accountCustomer.nameAr : accountCustomer.name}</h2>
              <p className="text-sm text-muted-foreground">{accountCustomer.phone}</p>
              {accountCustomer.address && <p className="text-sm text-muted-foreground">{accountCustomer.address}</p>}
            </div>
            <div className={isRTL ? 'text-left' : 'text-right'}>
              <p className="text-xs text-muted-foreground">{t('customers.currentBalance')}</p>
              <p className={`text-2xl font-bold font-mono ${accountCustomer.balance > 0 ? 'text-destructive' : accountCustomer.balance < 0 ? 'text-emerald-600' : 'text-foreground'}`}>{formatCurrency(accountCustomer.balance)}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
            <StatCard label={t('customers.totalDebt')} value={formatCurrency(Math.max(0, accountCustomer.balance))} />
            <StatCard label={t('customers.totalPurchases')} value={formatCurrency(st.totalPurchases)} />
            <StatCard label={t('customers.totalPayments')} value={formatCurrency(st.totalPayments)} />
            <StatCard label={t('customers.invoiceCount')} value={String(st.count)} />
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border font-semibold text-foreground">{t('customers.accountStatement')}</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/30 text-xs text-muted-foreground uppercase">
                  <th className={`px-3 py-2 ${isRTL ? 'text-right' : 'text-left'}`}>{t('common.date')}</th>
                  <th className={`px-3 py-2 ${isRTL ? 'text-right' : 'text-left'}`}>{t('common.type')}</th>
                  <th className={`px-3 py-2 ${isRTL ? 'text-right' : 'text-left'}`}>{t('sales.invoiceNumber')}</th>
                  <th className={`px-3 py-2 ${isRTL ? 'text-right' : 'text-left'}`}>{t('customers.debit')}</th>
                  <th className={`px-3 py-2 ${isRTL ? 'text-right' : 'text-left'}`}>{t('customers.credit')}</th>
                  <th className={`px-3 py-2 ${isRTL ? 'text-right' : 'text-left'}`}>{t('common.balance')}</th>
                  <th className={`px-3 py-2 ${isRTL ? 'text-right' : 'text-left'}`}>{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.length === 0 && (
                  <tr><td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">{t('customers.noTransactions')}</td></tr>
                )}
                {rows.map((r, idx) => {
                  running += r.debit - r.credit;
                  return (
                    <tr key={idx} className="hover:bg-muted/40">
                      <td className="px-3 py-2 whitespace-nowrap">{new Date(r.date).toLocaleDateString()}</td>
                      <td className="px-3 py-2">{r.type}</td>
                      <td className="px-3 py-2 font-mono text-primary">{r.ref}</td>
                      <td className="px-3 py-2 font-mono text-destructive">{r.debit ? formatCurrency(r.debit) : '-'}</td>
                      <td className="px-3 py-2 font-mono text-emerald-600">{r.credit ? formatCurrency(r.credit) : '-'}</td>
                      <td className="px-3 py-2 font-mono font-medium">{formatCurrency(running)}</td>
                      <td className="px-3 py-2">
                        {r.inv && (
                          <button onClick={() => setViewInvoice(r.inv!)} className="p-1 rounded hover:bg-primary/10 text-primary"><Eye size={14} /></button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {viewInvoice && (
          <InvoiceView invoice={viewInvoice} type="sale" party={accountCustomer} onClose={() => setViewInvoice(null)} />
        )}
      </div>
    );
  }

  // ─── List view ───
  return (
    <div className="space-y-4">
      <div className={`flex items-center justify-between gap-3 flex-wrap ${isRTL ? 'flex-row-reverse' : ''}`}>
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60 ${isRTL ? 'right-3' : 'left-3'}`} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('customers.search')}
            className={`w-full ${isRTL ? 'pr-9 pl-3' : 'pl-9 pr-3'} py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-card text-foreground`} />
        </div>
        {can('customers', 'create') && (
          <button onClick={openAdd} className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90">
            <Plus size={16} /> {t('customers.addCustomer')}
          </button>
        )}
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/30 text-xs text-muted-foreground uppercase">
                <th className={`px-4 py-3 ${isRTL ? 'text-right' : 'text-left'}`}>{t('common.name')}</th>
                <th className={`px-4 py-3 ${isRTL ? 'text-right' : 'text-left'}`}>{t('common.phone')}</th>
                <th className={`px-4 py-3 ${isRTL ? 'text-right' : 'text-left'}`}>{t('common.balance')}</th>
                <th className={`px-4 py-3 ${isRTL ? 'text-right' : 'text-left'}`}>{t('customers.totalPurchases')}</th>
                <th className={`px-4 py-3 ${isRTL ? 'text-right' : 'text-left'}`}>{t('customers.invoiceCount')}</th>
                <th className={`px-4 py-3 ${isRTL ? 'text-right' : 'text-left'}`}>{t('customers.lastPurchase')}</th>
                <th className={`px-4 py-3 ${isRTL ? 'text-right' : 'text-left'}`}>{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">{t('customers.empty')}</td></tr>
              )}
              {filtered.map(c => {
                const s = stats(c.id);
                return (
                  <tr key={c.id} className="hover:bg-muted/50">
                    <td className="px-4 py-3">
                      <button onClick={() => setAccountId(c.id)} className="font-medium text-primary hover:underline">{isRTL ? c.nameAr : c.name}</button>
                      {c.notes && <p className="text-xs text-muted-foreground truncate max-w-[180px]">{c.notes}</p>}
                    </td>
                    <td className="px-4 py-3 font-mono text-muted-foreground">{c.phone}</td>
                    <td className={`px-4 py-3 font-mono font-medium ${c.balance > 0 ? 'text-destructive' : c.balance < 0 ? 'text-emerald-600' : 'text-muted-foreground'}`}>{formatCurrency(c.balance)}</td>
                    <td className="px-4 py-3 font-mono">{formatCurrency(s.totalPurchases)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{s.count}</td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{s.lastPurchase ? new Date(s.lastPurchase).toLocaleDateString() : '-'}</td>
                    <td className="px-4 py-3">
                      <div className={`flex items-center gap-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
                        <button onClick={() => setAccountId(c.id)} title={t('customers.viewAccount')} className="p-1.5 rounded hover:bg-primary/10 text-primary"><FileText size={14} /></button>
                        {can('customers', 'edit') && (
                          <button onClick={() => { setAdjustTarget(c); setAdjustAmount(''); setAdjustReason(''); }} title={t('customers.adjustBalance')} className="p-1.5 rounded hover:bg-primary/10 text-primary"><Wallet size={14} /></button>
                        )}
                        {can('customers', 'edit') && (
                          <button onClick={() => openEdit(c)} title={t('common.edit')} className="p-1.5 rounded hover:bg-primary/10 text-primary"><Pencil size={14} /></button>
                        )}
                        {can('customers', 'delete') && (
                          <button onClick={() => deleteCustomer(c)} title={t('common.delete')} className="p-1.5 rounded hover:bg-destructive/10 text-destructive"><Trash2 size={14} /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-card rounded-xl shadow-xl w-full max-w-md">
            <div className={`p-5 border-b border-border flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
              <h3 className="text-lg font-semibold text-foreground">{editing ? t('customers.editCustomer') : t('customers.addCustomer')}</h3>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded hover:bg-accent"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field label={`${t('common.name')} EN`}><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className={inp} /></Field>
                <Field label={`${t('common.name')} AR`}><input value={form.nameAr} onChange={e => setForm({ ...form, nameAr: e.target.value })} dir="rtl" className={inp} /></Field>
                <Field label={t('common.phone')}><input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} dir="ltr" className={inp} /></Field>
                <Field label={t('common.email')}><input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} dir="ltr" className={inp} /></Field>
              </div>
              <Field label={t('common.address')}><input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} className={inp} /></Field>
              <Field label={t('common.creditLimit')}><input type="number" value={form.creditLimit} onChange={e => setForm({ ...form, creditLimit: Number(e.target.value) })} className={`${inp} font-mono`} /></Field>
              <Field label={t('customers.notes')}><textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} className={inp} /></Field>
              <div className={`flex justify-end gap-3 pt-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <button onClick={() => setShowModal(false)} className="px-4 py-2 border border-border rounded-lg text-sm text-muted-foreground">{t('common.cancel')}</button>
                <button onClick={saveCustomer} disabled={!form.name.trim()} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50">{t('common.save')}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {adjustTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-card rounded-xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-lg font-bold text-foreground mb-1">{t('customers.adjustBalance')}</h3>
            <p className="text-sm text-muted-foreground mb-4">{isRTL ? adjustTarget.nameAr : adjustTarget.name} — {t('common.balance')}: <span className="font-mono">{formatCurrency(adjustTarget.balance)}</span></p>
            <label className="block text-xs text-muted-foreground mb-1">{t('customers.adjustAmount')}</label>
            <input type="number" value={adjustAmount} onChange={e => setAdjustAmount(e.target.value)} placeholder="+/-" className={`${inp} font-mono mb-1`} />
            <p className="text-[11px] text-muted-foreground mb-3">{t('customers.adjustHint')}</p>
            <label className="block text-xs text-muted-foreground mb-1">{t('customers.adjustReason')}</label>
            <input value={adjustReason} onChange={e => setAdjustReason(e.target.value)} className={`${inp} mb-4`} />
            <div className={`flex gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <button onClick={saveAdjustment} disabled={!Number(adjustAmount) || !adjustReason.trim()} className="flex-1 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50">{t('common.save')}</button>
              <button onClick={() => setAdjustTarget(null)} className="flex-1 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:bg-accent">{t('common.cancel')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-muted/30 rounded-lg p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-base font-bold font-mono text-foreground mt-1">{value}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs text-muted-foreground mb-1">{label}</label>
      {children}
    </div>
  );
}
