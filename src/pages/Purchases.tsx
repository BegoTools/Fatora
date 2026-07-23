import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Plus, Search, Trash2, Edit2, X, ChevronLeft, ChevronRight, Download, DollarSign, Eye } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { generateId, generateInvoiceNumber } from '@/db';
import type { PurchaseInvoice, Supplier, ExtraCharge } from '@/types';
import { InvoiceView } from '@/components/invoice/InvoiceView';

export function Purchases() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const { state, dispatch } = useApp();
  const { user, can } = useAuth();
  const { purchaseInvoices, suppliers, items } = state.data;

  const [view, setView] = useState<'orders' | 'suppliers'>('orders');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  const [payingInvoice, setPayingInvoice] = useState<PurchaseInvoice | null>(null);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [viewInvoice, setViewInvoice] = useState<PurchaseInvoice | null>(null);

  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [orderItems, setOrderItems] = useState<{ itemId: string; quantity: number; unitPrice: number }[]>([]);
  const [shippingCost, setShippingCost] = useState(0);
  const [extraCharges, setExtraCharges] = useState<ExtraCharge[]>([]);
  const [newExtraDesc, setNewExtraDesc] = useState('');
  const [newExtraAmount, setNewExtraAmount] = useState(0);

  const [supplierForm, setSupplierForm] = useState<Partial<Supplier>>({
    name: '', nameAr: '', phone: '', email: '', address: '', balance: 0, isActive: true,
  });

  const formatCurrency = (val: number) => `${val.toLocaleString(undefined, { minimumFractionDigits: 2 })} ${state.data.company.currencySymbol}`;

  const filteredInvoices = useMemo(() => {
    if (!searchQuery) return purchaseInvoices;
    return purchaseInvoices.filter(inv =>
      inv.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.supplierName.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [purchaseInvoices, searchQuery]);

  const totalPages = Math.ceil(filteredInvoices.length / itemsPerPage);
  const paginatedInvoices = filteredInvoices.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleAddOrder = () => {
    if (!selectedSupplier || orderItems.length === 0) return;
    const supplier = suppliers.find(s => s.id === selectedSupplier);
    if (!supplier) return;

    const subtotal = orderItems.reduce((sum, oi) => sum + (oi.unitPrice * oi.quantity), 0);
    const total = subtotal + shippingCost;

    const newInvoice: PurchaseInvoice = {
      id: generateId('pur'),
      invoiceNumber: generateInvoiceNumber('PO', purchaseInvoices.length),
      supplierId: supplier.id,
      supplierName: supplier.name,
      items: orderItems.map(oi => {
        const item = items.find(i => i.id === oi.itemId);
        return {
          itemId: oi.itemId,
          itemName: item?.name || '',
          quantity: oi.quantity,
          unitPrice: oi.unitPrice,
          discount: 0,
          total: (oi.unitPrice * oi.quantity),
        };
      }),
      subtotal,
      discount: 0,
      extraCharges,
      shippingCost,
      total,
      paid: 0,
      remaining: total,
      paymentStatus: 'unpaid',
      notes: '',
      createdAt: new Date().toISOString(),
      createdBy: user?.name || 'System',
    };

    dispatch({ type: 'ADD_PURCHASE', payload: newInvoice });
    dispatch({ type: 'UPDATE_SUPPLIER', payload: { ...supplier, balance: supplier.balance + total } });
    setShowAddModal(false);
    setSelectedSupplier('');
    setOrderItems([]);
    setShippingCost(0);
    setExtraCharges([]);
    setNewExtraDesc('');
    setNewExtraAmount(0);
    toast.success(t('notifications.itemAdded'));
  };

  const handlePayInvoice = () => {
    if (!payingInvoice || paymentAmount <= 0) return;
    const newPaid = Math.min(payingInvoice.paid + paymentAmount, payingInvoice.total);
    const newRemaining = payingInvoice.total - newPaid;
    const newStatus = newRemaining <= 0 ? 'paid' : newPaid > 0 ? 'partial' : 'unpaid';
    const supplier = suppliers.find(s => s.id === payingInvoice.supplierId);
    dispatch({
      type: 'UPDATE_PURCHASE',
      payload: { ...payingInvoice, paid: newPaid, remaining: newRemaining, paymentStatus: newStatus },
    });
    if (supplier) {
      dispatch({
        type: 'UPDATE_SUPPLIER',
        payload: { ...supplier, balance: Math.max(0, supplier.balance - paymentAmount) },
      });
    }
    setPayingInvoice(null);
    setPaymentAmount(0);
  };

  const handleAddSupplier = () => {
    if (!supplierForm.name) return;
    if (editingSupplier) {
      dispatch({ type: 'UPDATE_SUPPLIER', payload: { ...editingSupplier, ...supplierForm } as Supplier });
    } else {
      dispatch({ type: 'ADD_SUPPLIER', payload: { ...supplierForm, id: generateId('sup'), createdAt: new Date().toISOString() } as Supplier });
    }
    setShowSupplierModal(false);
    setEditingSupplier(null);
    setSupplierForm({ name: '', nameAr: '', phone: '', email: '', address: '', balance: 0, isActive: true });
  };

  const addOrderItem = () => {
    setOrderItems([...orderItems, { itemId: items[0]?.id || '', quantity: 1, unitPrice: 0 }]);
  };

  const updateOrderItem = (index: number, field: string, value: string | number) => {
    setOrderItems(orderItems.map((oi, i) => {
      if (i === index) {
        if (field === 'itemId') {
          const item = items.find(it => it.id === value);
          return { ...oi, itemId: value as string, unitPrice: item?.purchasePrice || 0 };
        }
        return { ...oi, [field]: value };
      }
      return oi;
    }));
  };

  const orderTotal = orderItems.reduce((sum, oi) => sum + (oi.unitPrice * oi.quantity), 0);
  const grandTotal = orderTotal + shippingCost + extraCharges.reduce((sum, ec) => sum + ec.amount, 0);

  const supplierUnpaidCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    purchaseInvoices.forEach(inv => {
      if (inv.remaining > 0) {
        counts[inv.supplierId] = (counts[inv.supplierId] || 0) + 1;
      }
    });
    return counts;
  }, [purchaseInvoices]);

  return (
    <div className="space-y-4">
      <div className={`bg-card rounded-xl border border-border p-1 inline-flex ${isRTL ? 'flex-row-reverse' : ''}`}>
        {(['orders', 'suppliers'] as const).map(v => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${view === v ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'}`}
          >{t(`purchases.${v}`)}</button>
        ))}
      </div>
      <div className={`bg-card rounded-xl border border-border p-4 flex flex-wrap items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
        <div className="relative flex-1 min-w-[200px]">
          <Search className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60 ${isRTL ? 'right-3' : 'left-3'}`} />
          <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder={t('common.search')} className={`w-full ${isRTL ? 'pr-9 pl-3' : 'pl-9 pr-3'} py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary`} />
        </div>
        <button className="flex items-center gap-1.5 px-3 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:bg-muted/50">
          <Download size={14} /> <span className="hidden sm:inline">{t('common.export')}</span>
        </button>
        {can('purchases', 'create') && (
          <button onClick={() => {
            if (view === 'orders') { setShowAddModal(true); }
            else { setEditingSupplier(null); setSupplierForm({ name: '', nameAr: '', phone: '', email: '', address: '', balance: 0, isActive: true }); setShowSupplierModal(true); }
          }} className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90">
            <Plus size={16} /> {view === 'orders' ? t('purchases.newOrder') : t('purchases.newSupplier')}
          </button>
        )}
      </div>
      {view === 'orders' && (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="bg-muted/50">
                <th className={`px-4 py-3 text-xs font-semibold text-muted-foreground uppercase ${isRTL ? 'text-right' : 'text-left'}`}>{t('purchases.orderNumber')}</th>
                <th className={`px-4 py-3 text-xs font-semibold text-muted-foreground uppercase ${isRTL ? 'text-right' : 'text-left'}`}>{t('common.supplier')}</th>
                <th className={`px-4 py-3 text-xs font-semibold text-muted-foreground uppercase ${isRTL ? 'text-right' : 'text-left'}`}>{t('common.items')}</th>
                <th className={`px-4 py-3 text-xs font-semibold text-muted-foreground uppercase ${isRTL ? 'text-right' : 'text-left'}`}>{t('common.total')}</th>
                <th className={`px-4 py-3 text-xs font-semibold text-muted-foreground uppercase ${isRTL ? 'text-right' : 'text-left'}`}>{t('common.remaining')}</th>
                <th className={`px-4 py-3 text-xs font-semibold text-muted-foreground uppercase ${isRTL ? 'text-right' : 'text-left'}`}>{t('common.status')}</th>
                <th className={`px-4 py-3 text-xs font-semibold text-muted-foreground uppercase ${isRTL ? 'text-right' : 'text-left'}`}></th>
              </tr></thead>
              <tbody className="divide-y divide-border">
                {paginatedInvoices.map(inv => (
                  <tr key={inv.id} className="hover:bg-muted/50 transition-colors">
                    <td className="px-4 py-3 font-mono text-primary font-medium">{inv.invoiceNumber}</td>
                    <td className="px-4 py-3">{inv.supplierName}</td>
                    <td className="px-4 py-3 text-muted-foreground">{inv.items.length}</td>
                    <td className="px-4 py-3 font-mono font-medium">{formatCurrency(inv.total)}</td>
                    <td className="px-4 py-3 font-mono font-medium">{inv.remaining > 0 ? <span className="text-amber-600 dark:text-amber-400">{formatCurrency(inv.remaining)}</span> : <span className="text-emerald-600 dark:text-emerald-400">{formatCurrency(0)}</span>}</td>
                    <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full ${inv.paymentStatus === 'paid' ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400' : inv.paymentStatus === 'partial' ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400' : 'bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400'}`}>{t(`common.${inv.paymentStatus}`)}</span></td>
                    <td className="px-4 py-3">
                      <div className={`flex items-center gap-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
                        <button onClick={() => setViewInvoice(inv)} className="p-1.5 rounded hover:bg-primary/10 text-primary"><Eye size={14} /></button>
                        {inv.remaining > 0 && can('purchases', 'edit') && (
                          <button onClick={() => { setPayingInvoice(inv); setPaymentAmount(inv.remaining); }} className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10 rounded transition-colors">
                            <DollarSign size={14} /> {t('common.pay')}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className={`px-4 py-3 border-t border-border flex justify-center gap-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-1 rounded hover:bg-accent disabled:opacity-30">{isRTL ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}</button>
              <span className="text-xs text-muted-foreground px-2">{currentPage} / {totalPages}</span>
              <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-1 rounded hover:bg-accent disabled:opacity-30">{isRTL ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}</button>
            </div>
          )}
        </div>
      )}
      {payingInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-card rounded-xl shadow-xl w-full max-w-sm">
            <div className={`p-5 border-b border-border flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
              <h3 className="text-lg font-semibold text-foreground">{t('common.recordPayment')}</h3>
              <button onClick={() => setPayingInvoice(null)} className="p-1.5 rounded hover:bg-accent"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="space-y-2 text-sm">
                <div className={`flex justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <span className="text-muted-foreground">{t('purchases.orderNumber')}</span>
                  <span className="font-mono font-medium text-primary">{payingInvoice.invoiceNumber}</span>
                </div>
                <div className={`flex justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <span className="text-muted-foreground">{t('common.total')}</span>
                  <span className="font-mono font-medium">{formatCurrency(payingInvoice.total)}</span>
                </div>
                <div className={`flex justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <span className="text-muted-foreground">{t('common.paid')}</span>
                  <span className="font-mono font-medium text-emerald-600 dark:text-emerald-400">{formatCurrency(payingInvoice.paid)}</span>
                </div>
                <div className={`flex justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <span className="text-muted-foreground">{t('common.remaining')}</span>
                  <span className="font-mono font-medium text-amber-600 dark:text-amber-400">{formatCurrency(payingInvoice.remaining)}</span>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">{t('common.paymentAmount')}</label>
                <input type="number" value={paymentAmount} onChange={e => setPaymentAmount(Math.min(Number(e.target.value), payingInvoice.remaining))} min={0} max={payingInvoice.remaining} step={0.01} className="w-full px-3 py-2 border border-border rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div className={`flex justify-end gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <button onClick={() => setPayingInvoice(null)} className="px-4 py-2 border border-border rounded-lg text-sm text-muted-foreground">{t('common.cancel')}</button>
                <button onClick={handlePayInvoice} disabled={paymentAmount <= 0} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50">{t('common.confirm')}</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {view === 'suppliers' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {suppliers.map(sup => {
            const unpaidCount = supplierUnpaidCounts[sup.id] || 0;
            return (
              <div key={sup.id} className="bg-card rounded-xl border border-border p-4 hover:shadow-md transition-shadow">
                <div className={`flex items-start justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <div>
                    <h4 className="font-medium text-foreground">{isRTL ? sup.nameAr : sup.name}</h4>
                    <p className="text-xs text-muted-foreground">{sup.phone}</p>
                  </div>
                  <div className={`flex gap-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
                    {can('purchases', 'edit') && (
                      <button onClick={() => { setEditingSupplier(sup); setSupplierForm({ ...sup }); setShowSupplierModal(true); }} className="p-1.5 rounded hover:bg-primary/10 text-primary"><Edit2 size={14} /></button>
                    )}
                    {can('purchases', 'delete') && (
                      <button onClick={() => { if (confirm(t('notifications.confirmDelete'))) dispatch({ type: 'DELETE_SUPPLIER', payload: sup.id }); }} className="p-1.5 rounded hover:bg-destructive/10 text-red-600 dark:text-red-400"><Trash2 size={14} /></button>
                    )}
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-border space-y-1 text-xs">
                  <div className={`flex justify-between ${isRTL ? 'flex-row-reverse' : ''}`}><span className="text-muted-foreground">{t('common.email')}</span><span>{sup.email}</span></div>
                  <div className={`flex justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <span className="text-muted-foreground">{t('treasury.balance')}</span>
                    <span className={`font-mono font-medium ${sup.balance > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>{formatCurrency(sup.balance)}</span>
                  </div>
                  {unpaidCount > 0 && (
                    <div className={`flex justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <span className="text-muted-foreground">{t('common.unpaidInvoices')}</span>
                      <span className="font-mono font-medium text-red-600 dark:text-red-400">{unpaidCount}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 overflow-y-auto">
          <div className="bg-card rounded-xl shadow-xl w-full max-w-2xl my-8">
            <div className={`p-5 border-b border-border flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
              <h3 className="text-lg font-semibold text-foreground">{t('purchases.newOrder')}</h3>
              <button onClick={() => { setShowAddModal(false); setExtraCharges([]); setNewExtraDesc(''); setNewExtraAmount(0); }} className="p-1.5 rounded hover:bg-accent"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">{t('common.supplier')}</label>
                <div className={`flex gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <select value={selectedSupplier} onChange={e => setSelectedSupplier(e.target.value)} className="flex-1 px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-card">
                    <option value="">{t('common.select')}...</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{isRTL ? s.nameAr : s.name}</option>)}
                  </select>
                  <button onClick={() => { setEditingSupplier(null); setSupplierForm({ name: '', nameAr: '', phone: '', email: '', address: '', balance: 0, isActive: true }); setShowSupplierModal(true); }} className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90">
                    <Plus size={16} />
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <div className={`flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <label className="text-xs font-medium text-muted-foreground">{t('common.items')}</label>
                  <button onClick={addOrderItem} className="text-xs text-primary hover:underline">+ {t('common.add')}</button>
                </div>
                {orderItems.map((oi, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-5">
                      <select value={oi.itemId} onChange={e => updateOrderItem(idx, 'itemId', e.target.value)} className="w-full px-2 py-2 border border-border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary bg-card">
                        {items.map(it => <option key={it.id} value={it.id}>{isRTL ? it.nameAr : it.name}</option>)}
                      </select>
                    </div>
                    <div className="col-span-3"><input type="number" value={oi.quantity} onChange={e => updateOrderItem(idx, 'quantity', Number(e.target.value))} min={1} className="w-full px-2 py-2 border border-border rounded-lg text-xs font-mono" /></div>
                    <div className="col-span-3"><input type="number" value={oi.unitPrice} onChange={e => updateOrderItem(idx, 'unitPrice', Number(e.target.value))} min={0} step={0.01} className="w-full px-2 py-2 border border-border rounded-lg text-xs font-mono" /></div>
                    <div className="col-span-1"><button onClick={() => setOrderItems(orderItems.filter((_, i) => i !== idx))} className="p-2 text-red-600 dark:text-red-400 hover:bg-destructive/10 rounded"><Trash2 size={14} /></button></div>
                  </div>
                ))}
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">{t('purchases.shippingCost')}</label>
                <input type="number" value={shippingCost} onChange={e => setShippingCost(Number(e.target.value))} min={0} step={0.01} className="w-full px-3 py-2 border border-border rounded-lg text-sm font-mono" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">{t('common.extraCharges')}</label>
                <div className={`flex gap-2 mb-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <input type="text" value={newExtraDesc} onChange={e => setNewExtraDesc(e.target.value)} placeholder={t('common.description')} className="flex-1 px-3 py-2 border border-border rounded-lg text-sm" />
                  <input type="number" value={newExtraAmount} onChange={e => setNewExtraAmount(Number(e.target.value))} min={0} step={0.01} className="w-24 px-3 py-2 border border-border rounded-lg text-sm font-mono" />
                  <button onClick={() => { if (newExtraDesc && newExtraAmount > 0) { setExtraCharges([...extraCharges, { id: generateId('ec'), description: newExtraDesc, amount: newExtraAmount }]); setNewExtraDesc(''); setNewExtraAmount(0); } }} className="px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium">{t('common.add')}</button>
                </div>
                {extraCharges.map((ec, idx) => (
                  <div key={idx} className={`flex items-center justify-between bg-muted/50 rounded px-2 py-1 mb-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <span className="text-sm">{ec.description}</span>
                    <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <span className="text-sm font-mono">{formatCurrency(ec.amount)}</span>
                      <button onClick={() => setExtraCharges(extraCharges.filter((_, i) => i !== idx))} className="p-1 text-red-600 hover:bg-destructive/10 rounded"><X size={14} /></button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="bg-muted/50 rounded-lg p-3 space-y-1 text-sm">
                <div className={`flex justify-between ${isRTL ? 'flex-row-reverse' : ''}`}><span className="text-muted-foreground">{t('common.subtotal')}</span><span className="font-mono">{formatCurrency(orderTotal)}</span></div>
                <div className={`flex justify-between ${isRTL ? 'flex-row-reverse' : ''}`}><span className="text-muted-foreground">{t('purchases.shippingCost')}</span><span className="font-mono">{formatCurrency(shippingCost)}</span></div>
                {extraCharges.length > 0 && (
                  <div className={`flex justify-between ${isRTL ? 'flex-row-reverse' : ''}`}><span className="text-muted-foreground">{t('common.extraCharges')}</span><span className="font-mono">{formatCurrency(extraCharges.reduce((s, ec) => s + ec.amount, 0))}</span></div>
                )}
                <div className={`flex justify-between font-bold text-base border-t border-border pt-1 ${isRTL ? 'flex-row-reverse' : ''}`}><span>{t('common.total')}</span><span className="font-mono text-primary">{formatCurrency(grandTotal)}</span></div>
              </div>
              <div className={`flex justify-end gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <button onClick={() => { setShowAddModal(false); setExtraCharges([]); setNewExtraDesc(''); setNewExtraAmount(0); }} className="px-4 py-2 border border-border rounded-lg text-sm text-muted-foreground">{t('common.cancel')}</button>
                <button onClick={handleAddOrder} disabled={!selectedSupplier || orderItems.length === 0} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50">{t('common.save')}</button>
              </div>
            </div>
          </div>
        </div>
      )}
      {showSupplierModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-card rounded-xl shadow-xl w-full max-w-md">
            <div className={`p-5 border-b border-border flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
              <h3 className="text-lg font-semibold">{editingSupplier ? t('common.edit') : t('purchases.newSupplier')}</h3>
              <button onClick={() => setShowSupplierModal(false)} className="p-1.5 rounded hover:bg-accent"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-3">
              {editingSupplier && (
                <div className={`p-3 rounded-lg text-sm ${editingSupplier.balance > 0 ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400' : 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400'}`}>
                  <div className={`flex justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <span>{t('treasury.balance')}</span>
                    <span className="font-mono font-medium">{formatCurrency(editingSupplier.balance)}</span>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs text-muted-foreground mb-1">{t('common.name')} EN</label><input value={supplierForm.name} onChange={e => setSupplierForm({ ...supplierForm, name: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary" /></div>
                <div><label className="block text-xs text-muted-foreground mb-1">{t('common.name')} AR</label><input value={supplierForm.nameAr} onChange={e => setSupplierForm({ ...supplierForm, nameAr: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs text-muted-foreground mb-1">{t('common.phone')}</label><input value={supplierForm.phone} onChange={e => setSupplierForm({ ...supplierForm, phone: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary" /></div>
                <div><label className="block text-xs text-muted-foreground mb-1">{t('common.email')}</label><input value={supplierForm.email} onChange={e => setSupplierForm({ ...supplierForm, email: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary" /></div>
              </div>
              <div><label className="block text-xs text-muted-foreground mb-1">{t('common.address')}</label><input value={supplierForm.address} onChange={e => setSupplierForm({ ...supplierForm, address: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary" /></div>
              <div className={`flex justify-end gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <button onClick={() => setShowSupplierModal(false)} className="px-4 py-2 border border-border rounded-lg text-sm text-muted-foreground">{t('common.cancel')}</button>
                <button onClick={handleAddSupplier} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90">{t('common.save')}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {viewInvoice && (
        <InvoiceView
          invoice={viewInvoice}
          type="purchase"
          party={suppliers.find(s => s.id === viewInvoice.supplierId)}
          onClose={() => setViewInvoice(null)}
        />
      )}
    </div>
  );
}
