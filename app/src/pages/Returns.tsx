import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, X, RotateCcw } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { generateId, generateInvoiceNumber } from '@/db';
import type { ReturnInvoice, SaleItem, AuditLogEntry } from '@/types';

const inp = 'w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-card text-foreground';

export function Returns() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const { state, dispatch } = useApp();
  const { user, can } = useAuth();
  const { returns, salesInvoices, customers } = state.data;

  const [showModal, setShowModal] = useState(false);
  const [invoiceId, setInvoiceId] = useState('');
  const [qtys, setQtys] = useState<Record<string, number>>({});
  const [refund, setRefund] = useState('');
  const [notes, setNotes] = useState('');

  const formatCurrency = (v: number) => `${(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${state.data.company.currencySymbol}`;

  const selectedInvoice = salesInvoices.find(i => i.id === invoiceId);
  const returnItems: SaleItem[] = selectedInvoice
    ? selectedInvoice.items
        .map(li => {
          const q = qtys[li.itemId] || 0;
          return { ...li, quantity: q, total: q * li.unitPrice - 0 };
        })
        .filter(li => li.quantity > 0)
    : [];
  const returnTotal = returnItems.reduce((s, li) => s + li.unitPrice * li.quantity, 0);

  const openNew = () => {
    setInvoiceId(''); setQtys({}); setRefund(''); setNotes(''); setShowModal(true);
  };

  const save = () => {
    if (returnItems.length === 0) return;
    const cust = selectedInvoice?.customerId ? customers.find(c => c.id === selectedInvoice.customerId) : undefined;
    const ret: ReturnInvoice = {
      id: generateId('ret'),
      returnNumber: generateInvoiceNumber('RET', returns.length),
      originalInvoiceId: selectedInvoice?.id || null,
      originalInvoiceNumber: selectedInvoice?.invoiceNumber || '-',
      customerId: selectedInvoice?.customerId || null,
      customerName: cust ? cust.name : (selectedInvoice?.customerName || t('sales.walkInCustomer')),
      items: returnItems,
      total: returnTotal,
      refund: Number(refund) || 0,
      notes: notes.trim(),
      createdAt: new Date().toISOString(),
      createdBy: user?.name || 'System',
    };
    dispatch({ type: 'ADD_RETURN', payload: ret });
    const audit: AuditLogEntry = {
      id: generateId('audit'), action: 'return.create', entityType: 'ReturnInvoice', entityId: ret.id,
      description: `${t('returns.newReturn')} #${ret.returnNumber}`, after: JSON.stringify(ret),
      createdAt: new Date().toISOString(), createdBy: user?.name || 'System',
    };
    dispatch({ type: 'ADD_AUDIT_LOG', payload: audit });
    setShowModal(false);
  };

  return (
    <div className="space-y-4">
      <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2"><RotateCcw size={20} /> {t('returns.title')}</h2>
        {can('returns', 'create') && (
          <button onClick={openNew} className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90">
            <Plus size={16} /> {t('returns.newReturn')}
          </button>
        )}
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/30 text-xs text-muted-foreground uppercase">
                <th className={`px-4 py-3 ${isRTL ? 'text-right' : 'text-left'}`}>{t('returns.returnNumber')}</th>
                <th className={`px-4 py-3 ${isRTL ? 'text-right' : 'text-left'}`}>{t('returns.originalInvoice')}</th>
                <th className={`px-4 py-3 ${isRTL ? 'text-right' : 'text-left'}`}>{t('common.customer')}</th>
                <th className={`px-4 py-3 ${isRTL ? 'text-right' : 'text-left'}`}>{t('common.items')}</th>
                <th className={`px-4 py-3 ${isRTL ? 'text-right' : 'text-left'}`}>{t('common.total')}</th>
                <th className={`px-4 py-3 ${isRTL ? 'text-right' : 'text-left'}`}>{t('returns.refund')}</th>
                <th className={`px-4 py-3 ${isRTL ? 'text-right' : 'text-left'}`}>{t('common.date')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {returns.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">{t('returns.empty')}</td></tr>
              )}
              {returns.slice().reverse().map(r => (
                <tr key={r.id} className="hover:bg-muted/50">
                  <td className="px-4 py-3 font-mono text-primary">{r.returnNumber}</td>
                  <td className="px-4 py-3 font-mono text-muted-foreground">{r.originalInvoiceNumber}</td>
                  <td className="px-4 py-3">{r.customerName}</td>
                  <td className="px-4 py-3 text-muted-foreground">{r.items.length}</td>
                  <td className="px-4 py-3 font-mono">{formatCurrency(r.total)}</td>
                  <td className="px-4 py-3 font-mono text-destructive">{formatCurrency(r.refund)}</td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{new Date(r.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-card rounded-xl shadow-xl w-full max-w-lg max-h-[92vh] overflow-hidden flex flex-col">
            <div className={`p-5 border-b border-border flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
              <h3 className="text-lg font-semibold text-foreground">{t('returns.newReturn')}</h3>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded hover:bg-accent"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-4 overflow-y-auto">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">{t('returns.originalInvoice')}</label>
                <select value={invoiceId} onChange={e => { setInvoiceId(e.target.value); setQtys({}); }} className={inp}>
                  <option value="">{t('returns.selectInvoice')}</option>
                  {salesInvoices.slice().reverse().map(i => (
                    <option key={i.id} value={i.id}>#{i.invoiceNumber} — {i.customerName} — {formatCurrency(i.total)}</option>
                  ))}
                </select>
              </div>

              {selectedInvoice && (
                <div className="border border-border rounded-lg divide-y divide-border">
                  {selectedInvoice.items.map(li => (
                    <div key={li.itemId} className={`flex items-center gap-3 p-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground truncate">{li.itemName}</p>
                        <p className="text-xs text-muted-foreground font-mono">{formatCurrency(li.unitPrice)} × {li.quantity}</p>
                      </div>
                      <input
                        type="number" min={0} max={li.quantity}
                        value={qtys[li.itemId] || 0}
                        onChange={e => setQtys({ ...qtys, [li.itemId]: Math.max(0, Math.min(li.quantity, Number(e.target.value))) })}
                        className="w-16 text-center text-sm font-mono border border-border rounded-md py-1 bg-card focus:ring-2 focus:ring-primary focus:outline-none"
                      />
                    </div>
                  ))}
                </div>
              )}

              <div className={`flex justify-between text-sm font-medium ${isRTL ? 'flex-row-reverse' : ''}`}>
                <span className="text-muted-foreground">{t('returns.returnTotal')}</span>
                <span className="font-mono text-primary">{formatCurrency(returnTotal)}</span>
              </div>

              <div>
                <label className="block text-xs text-muted-foreground mb-1">{t('returns.refund')}</label>
                <input type="number" value={refund} onChange={e => setRefund(e.target.value)} placeholder={String(returnTotal)} className={`${inp} font-mono`} />
                <p className="text-[11px] text-muted-foreground mt-1">{t('returns.refundHint')}</p>
              </div>

              <div>
                <label className="block text-xs text-muted-foreground mb-1">{t('customers.notes')}</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className={inp} />
              </div>

              <div className={`flex justify-end gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <button onClick={() => setShowModal(false)} className="px-4 py-2 border border-border rounded-lg text-sm text-muted-foreground">{t('common.cancel')}</button>
                <button onClick={save} disabled={returnItems.length === 0} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50">{t('common.save')}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
