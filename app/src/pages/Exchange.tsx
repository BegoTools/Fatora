import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, X, ArrowLeftRight, Trash2 } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { generateId, generateInvoiceNumber } from '@/db';
import type { ExchangeInvoice, SaleItem, AuditLogEntry } from '@/types';

const inp = 'w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-card text-foreground';

export function Exchange() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const { state, dispatch } = useApp();
  const { user, can } = useAuth();
  const { exchanges, salesInvoices, customers, items } = state.data;

  const [showModal, setShowModal] = useState(false);
  const [invoiceId, setInvoiceId] = useState('');
  const [returnedQtys, setReturnedQtys] = useState<Record<string, number>>({});
  const [newRows, setNewRows] = useState<SaleItem[]>([]);
  const [addItemId, setAddItemId] = useState('');
  const [paid, setPaid] = useState('');
  const [notes, setNotes] = useState('');

  const formatCurrency = (v: number) => `${(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${state.data.company.currencySymbol}`;

  const selectedInvoice = salesInvoices.find(i => i.id === invoiceId);
  const returnedItems: SaleItem[] = selectedInvoice
    ? selectedInvoice.items
        .map(li => ({ ...li, quantity: returnedQtys[li.itemId] || 0, total: (returnedQtys[li.itemId] || 0) * li.unitPrice }))
        .filter(li => li.quantity > 0)
    : [];
  const returnedTotal = returnedItems.reduce((s, li) => s + li.unitPrice * li.quantity, 0);
  const newTotal = newRows.reduce((s, li) => s + li.unitPrice * li.quantity, 0);
  const priceDifference = Math.round((newTotal - returnedTotal) * 100) / 100;

  const openNew = () => {
    setInvoiceId(''); setReturnedQtys({}); setNewRows([]); setAddItemId(''); setPaid(''); setNotes(''); setShowModal(true);
  };

  const addNewRow = (itemId: string) => {
    const it = items.find(i => i.id === itemId);
    if (!it) return;
    if (newRows.some(r => r.itemId === itemId)) return;
    setNewRows([...newRows, { itemId: it.id, itemName: isRTL ? it.nameAr : it.name, quantity: 1, unitPrice: it.salePrice, discount: 0, total: it.salePrice }]);
    setAddItemId('');
  };

  const updateRow = (itemId: string, patch: Partial<SaleItem>) => {
    setNewRows(newRows.map(r => (r.itemId === itemId ? { ...r, ...patch, total: (patch.quantity ?? r.quantity) * (patch.unitPrice ?? r.unitPrice) } : r)));
  };

  const save = () => {
    if (returnedItems.length === 0 && newRows.length === 0) return;
    const cust = selectedInvoice?.customerId ? customers.find(c => c.id === selectedInvoice.customerId) : undefined;
    const ex: ExchangeInvoice = {
      id: generateId('exch'),
      exchangeNumber: generateInvoiceNumber('EXC', exchanges.length),
      originalInvoiceId: selectedInvoice?.id || null,
      originalInvoiceNumber: selectedInvoice?.invoiceNumber || '-',
      customerId: selectedInvoice?.customerId || null,
      customerName: cust ? cust.name : (selectedInvoice?.customerName || t('sales.walkInCustomer')),
      returnedItems,
      newItems: newRows,
      returnedTotal,
      newTotal,
      priceDifference,
      paid: paid === '' ? 0 : Number(paid),
      notes: notes.trim(),
      createdAt: new Date().toISOString(),
      createdBy: user?.name || 'System',
    };
    dispatch({ type: 'ADD_EXCHANGE', payload: ex });
    const audit: AuditLogEntry = {
      id: generateId('audit'), action: 'exchange.create', entityType: 'ExchangeInvoice', entityId: ex.id,
      description: `${t('exchange.newExchange')} #${ex.exchangeNumber}`, after: JSON.stringify(ex),
      createdAt: new Date().toISOString(), createdBy: user?.name || 'System',
    };
    dispatch({ type: 'ADD_AUDIT_LOG', payload: audit });
    setShowModal(false);
  };

  return (
    <div className="space-y-4">
      <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2"><ArrowLeftRight size={20} /> {t('exchange.title')}</h2>
        {can('exchange', 'create') && (
          <button onClick={openNew} className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90">
            <Plus size={16} /> {t('exchange.newExchange')}
          </button>
        )}
      </div>

      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/30 text-xs text-muted-foreground uppercase">
                <th className={`px-4 py-3 ${isRTL ? 'text-right' : 'text-left'}`}>{t('exchange.exchangeNumber')}</th>
                <th className={`px-4 py-3 ${isRTL ? 'text-right' : 'text-left'}`}>{t('returns.originalInvoice')}</th>
                <th className={`px-4 py-3 ${isRTL ? 'text-right' : 'text-left'}`}>{t('common.customer')}</th>
                <th className={`px-4 py-3 ${isRTL ? 'text-right' : 'text-left'}`}>{t('exchange.returnedTotal')}</th>
                <th className={`px-4 py-3 ${isRTL ? 'text-right' : 'text-left'}`}>{t('exchange.newTotal')}</th>
                <th className={`px-4 py-3 ${isRTL ? 'text-right' : 'text-left'}`}>{t('exchange.priceDifference')}</th>
                <th className={`px-4 py-3 ${isRTL ? 'text-right' : 'text-left'}`}>{t('common.date')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {exchanges.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">{t('exchange.empty')}</td></tr>
              )}
              {exchanges.slice().reverse().map(e => (
                <tr key={e.id} className="hover:bg-muted/50">
                  <td className="px-4 py-3 font-mono text-primary">{e.exchangeNumber}</td>
                  <td className="px-4 py-3 font-mono text-muted-foreground">{e.originalInvoiceNumber}</td>
                  <td className="px-4 py-3">{e.customerName}</td>
                  <td className="px-4 py-3 font-mono">{formatCurrency(e.returnedTotal)}</td>
                  <td className="px-4 py-3 font-mono">{formatCurrency(e.newTotal)}</td>
                  <td className={`px-4 py-3 font-mono ${e.priceDifference >= 0 ? 'text-primary' : 'text-emerald-600'}`}>{formatCurrency(e.priceDifference)}</td>
                  <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{new Date(e.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-card rounded-xl shadow-xl w-full max-w-2xl max-h-[92vh] overflow-hidden flex flex-col">
            <div className={`p-5 border-b border-border flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
              <h3 className="text-lg font-semibold text-foreground">{t('exchange.newExchange')}</h3>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded hover:bg-accent"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-4 overflow-y-auto">
              <div>
                <label className="block text-xs text-muted-foreground mb-1">{t('returns.originalInvoice')}</label>
                <select value={invoiceId} onChange={e => { setInvoiceId(e.target.value); setReturnedQtys({}); }} className={inp}>
                  <option value="">{t('returns.selectInvoice')}</option>
                  {salesInvoices.slice().reverse().map(i => (
                    <option key={i.id} value={i.id}>#{i.invoiceNumber} — {i.customerName} — {formatCurrency(i.total)}</option>
                  ))}
                </select>
              </div>

              {selectedInvoice && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground mb-1">{t('exchange.returnedItems')}</p>
                  <div className="border border-border rounded-lg divide-y divide-border">
                    {selectedInvoice.items.map(li => (
                      <div key={li.itemId} className={`flex items-center gap-3 p-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-foreground truncate">{li.itemName}</p>
                          <p className="text-xs text-muted-foreground font-mono">{formatCurrency(li.unitPrice)} × {li.quantity}</p>
                        </div>
                        <input type="number" min={0} max={li.quantity} value={returnedQtys[li.itemId] || 0}
                          onChange={e => setReturnedQtys({ ...returnedQtys, [li.itemId]: Math.max(0, Math.min(li.quantity, Number(e.target.value))) })}
                          className="w-16 text-center text-sm font-mono border border-border rounded-md py-1 bg-card focus:ring-2 focus:ring-primary focus:outline-none" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1">{t('exchange.newItems')}</p>
                <div className={`flex gap-2 mb-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <select value={addItemId} onChange={e => addNewRow(e.target.value)} className={inp}>
                    <option value="">{t('exchange.addProduct')}</option>
                    {items.filter(i => i.isActive).map(i => (
                      <option key={i.id} value={i.id}>{isRTL ? i.nameAr : i.name} — {formatCurrency(i.salePrice)}</option>
                    ))}
                  </select>
                </div>
                {newRows.length > 0 && (
                  <div className="border border-border rounded-lg divide-y divide-border">
                    {newRows.map(r => (
                      <div key={r.itemId} className={`flex items-center gap-2 p-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                        <p className="flex-1 min-w-0 text-sm text-foreground truncate">{r.itemName}</p>
                        <input type="number" min={1} value={r.quantity} onChange={e => updateRow(r.itemId, { quantity: Math.max(1, Number(e.target.value)) })}
                          className="w-14 text-center text-sm font-mono border border-border rounded-md py-1 bg-card focus:ring-2 focus:ring-primary focus:outline-none" title={t('common.quantity')} />
                        <input type="number" min={0} step="0.01" value={r.unitPrice} onChange={e => updateRow(r.itemId, { unitPrice: Math.max(0, Number(e.target.value)) })}
                          className="w-20 text-center text-sm font-mono border border-border rounded-md py-1 bg-card focus:ring-2 focus:ring-primary focus:outline-none" title={t('common.price')} />
                        <button onClick={() => setNewRows(newRows.filter(x => x.itemId !== r.itemId))} className="p-1 text-muted-foreground hover:text-destructive"><Trash2 size={14} /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="border-t border-border pt-3 space-y-1 text-sm">
                <div className={`flex justify-between ${isRTL ? 'flex-row-reverse' : ''}`}><span className="text-muted-foreground">{t('exchange.returnedTotal')}</span><span className="font-mono">{formatCurrency(returnedTotal)}</span></div>
                <div className={`flex justify-between ${isRTL ? 'flex-row-reverse' : ''}`}><span className="text-muted-foreground">{t('exchange.newTotal')}</span><span className="font-mono">{formatCurrency(newTotal)}</span></div>
                <div className={`flex justify-between font-bold ${isRTL ? 'flex-row-reverse' : ''}`}><span className="text-foreground">{t('exchange.priceDifference')}</span><span className={`font-mono ${priceDifference >= 0 ? 'text-primary' : 'text-emerald-600'}`}>{formatCurrency(priceDifference)}</span></div>
              </div>

              <div>
                <label className="block text-xs text-muted-foreground mb-1">{t('exchange.paid')}</label>
                <input type="number" value={paid} onChange={e => setPaid(e.target.value)} placeholder={String(Math.max(0, priceDifference))} className={`${inp} font-mono`} />
                <p className="text-[11px] text-muted-foreground mt-1">{t('exchange.paidHint')}</p>
              </div>

              <div>
                <label className="block text-xs text-muted-foreground mb-1">{t('customers.notes')}</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className={inp} />
              </div>

              <div className={`flex justify-end gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <button onClick={() => setShowModal(false)} className="px-4 py-2 border border-border rounded-lg text-sm text-muted-foreground">{t('common.cancel')}</button>
                <button onClick={save} disabled={returnedItems.length === 0 && newRows.length === 0} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50">{t('common.save')}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
