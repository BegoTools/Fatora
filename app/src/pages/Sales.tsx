import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Search, Trash2, Printer, CreditCard, Banknote, Wallet, Receipt, ShoppingCart, Minus, ChevronRight, ChevronLeft, Eye, Package, ArrowLeftRight, DollarSign, X, Pencil } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { useAuth } from '@/context/AuthContext';
import { generateId, generateInvoiceNumber } from '@/db';
import type { Item, SaleInvoice, ExtraCharge, Customer, AuditLogEntry } from '@/types';
import { InvoiceView } from '@/components/invoice/InvoiceView';

type POSView = 'terminal' | 'invoices' | 'customers';
type PaymentMethod = 'cash' | 'card' | 'wallet' | 'credit';

interface CartItem {
  item: Item;
  quantity: number;
  unitPrice: number;
  discount: number;
}

export function Sales() {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const { state, dispatch } = useApp();
  const { user, can } = useAuth();
  const { items, salesInvoices, customers } = state.data;

  const [view, setView] = useState<POSView>('terminal');
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [amountPaid, setAmountPaid] = useState('');
  const [showReceipt, setShowReceipt] = useState(false);
  const [lastInvoice, setLastInvoice] = useState<SaleInvoice | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [collectTargetInvoice, setCollectTargetInvoice] = useState<SaleInvoice | null>(null);
  const [collectAmount, setCollectAmount] = useState('');
  const [viewInvoice, setViewInvoice] = useState<SaleInvoice | null>(null);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [customerForm, setCustomerForm] = useState({ name: '', nameAr: '', phone: '', email: '', address: '', creditLimit: 0 });
  const [extraCharges, setExtraCharges] = useState<ExtraCharge[]>([]);
  const [extraChargeDesc, setExtraChargeDesc] = useState('');
  const [extraChargeAmount, setExtraChargeAmount] = useState('');
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | null>(null);

  const itemsPerPage = 8;

  const activeItems = items.filter(i => i.isActive && i.stockQuantity > 0);
  const filteredProducts = useMemo(() => {
    if (!searchQuery) return activeItems;
    const q = searchQuery.toLowerCase();
    return activeItems.filter(i =>
      i.name.toLowerCase().includes(q) ||
      i.nameAr.toLowerCase().includes(q) ||
      i.barcode.includes(q)
    );
  }, [activeItems, searchQuery]);

  const productPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const paginatedProducts = filteredProducts.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const cartSubtotal = cart.reduce((sum, ci) => sum + (ci.unitPrice * ci.quantity), 0);
  const cartDiscount = cart.reduce((sum, ci) => sum + ci.discount, 0);
  const cartTotal = cartSubtotal - cartDiscount + extraCharges.reduce((sum, ec) => sum + ec.amount, 0);

  // الحساب السابق = رصيد العميل الحالي قبل أثر هذه الفاتورة (يُستثنى أثر الفاتورة عند التعديل)
  const previousBalance = useMemo(() => {
    const cust = customers.find(c => c.id === selectedCustomer);
    let bal = cust?.balance ?? 0;
    if (editingInvoiceId) {
      const old = salesInvoices.find(s => s.id === editingInvoiceId);
      if (old && old.customerId === (selectedCustomer || null)) bal -= (old.total - old.paid);
    }
    return Math.round(bal * 100) / 100;
  }, [customers, selectedCustomer, editingInvoiceId, salesInvoices]);

  // إجمالي المطلوب = الحساب السابق + إجمالي الفاتورة الحالية
  const grandTotalDue = Math.round((previousBalance + cartTotal) * 100) / 100;

  const paidAmount = Number(amountPaid) || 0;
  const change = paidAmount - grandTotalDue;

  const addToCart = (item: Item) => {
    const existing = cart.find(ci => ci.item.id === item.id);
    if (existing) {
      setCart(cart.map(ci =>
        ci.item.id === item.id ? { ...ci, quantity: ci.quantity + 1 } : ci
      ));
    } else {
      setCart([...cart, { item, quantity: 1, unitPrice: item.salePrice, discount: 0 }]);
    }
  };

  const updateQuantity = (itemId: string, delta: number) => {
    setCart(cart.map(ci => {
      if (ci.item.id === itemId) {
        const newQty = Math.max(1, ci.quantity + delta);
        return { ...ci, quantity: newQty };
      }
      return ci;
    }).filter(ci => ci.quantity > 0));
  };

  const setQuantity = (itemId: string, value: number) => {
    const qty = Math.max(1, Math.floor(value) || 1);
    setCart(cart.map(ci => (ci.item.id === itemId ? { ...ci, quantity: qty } : ci)));
  };

  // تعديل سعر البيع داخل الفاتورة فقط (لا يؤثر على سعر المنتج بالمخزون)
  const setPrice = (itemId: string, value: number) => {
    const price = Math.max(0, value || 0);
    setCart(cart.map(ci => (ci.item.id === itemId ? { ...ci, unitPrice: price } : ci)));
  };

  const removeFromCart = (itemId: string) => {
    setCart(cart.filter(ci => ci.item.id !== itemId));
  };

  const clearCart = () => {
    setCart([]);
    setAmountPaid('');
  };

  const handleCheckout = () => {
    if (cart.length === 0) return;

    const cust = customers.find(c => c.id === selectedCustomer);
    const customerName = cust?.name || t('sales.walkInCustomer');
    const oldInv = editingInvoiceId ? salesInvoices.find(s => s.id === editingInvoiceId) : undefined;

    // المدفوع يُطبَّق على إجمالي المطلوب (الحساب السابق + الفاتورة الحالية)
    // البطاقة/المحفظة = سداد الفاتورة الحالية فقط، وتبقى المديونية السابقة كما هي
    let paid: number;
    if (paymentMethod === 'card' || paymentMethod === 'wallet') {
      paid = cartTotal;
    } else {
      paid = Math.max(0, Math.min(paidAmount, grandTotalDue));
    }
    // المتبقي الجديد = إجمالي المطلوب − المدفوع (يُحفظ كمديونية العميل)
    const remaining = Math.round((grandTotalDue - paid) * 100) / 100;
    const paymentStatus: 'paid' | 'partial' | 'unpaid' | 'credit' =
      remaining <= 0 ? 'paid' : paid > 0 ? 'partial' : 'credit';

    const items = cart.map(ci => ({
      itemId: ci.item.id,
      itemName: isRTL ? ci.item.nameAr : ci.item.name,
      quantity: ci.quantity,
      unitPrice: ci.unitPrice,
      discount: ci.discount,
      total: (ci.unitPrice * ci.quantity) - ci.discount,
    }));

    if (editingInvoiceId && oldInv) {
      const updated: SaleInvoice = {
        ...oldInv,
        customerId: selectedCustomer || null,
        customerName,
        items,
        subtotal: cartSubtotal,
        discount: cartDiscount,
        total: cartTotal,
        extraCharges,
        paid,
        remaining,
        previousBalance,
        paymentMethod,
        paymentStatus,
        updatedAt: new Date().toISOString(),
      };
      dispatch({ type: 'UPDATE_SALE', payload: updated });
      const audit: AuditLogEntry = {
        id: generateId('audit'),
        action: 'sale.update',
        entityType: 'SaleInvoice',
        entityId: updated.id,
        description: `${t('sales.editInvoice')} #${updated.invoiceNumber}`,
        before: JSON.stringify(oldInv),
        after: JSON.stringify(updated),
        createdAt: new Date().toISOString(),
        createdBy: user?.name || 'System',
      };
      dispatch({ type: 'ADD_AUDIT_LOG', payload: audit });
      cancelEdit();
      setView('invoices');
      return;
    }

    const newInvoice: SaleInvoice = {
      id: generateId('sale'),
      invoiceNumber: generateInvoiceNumber('INV', salesInvoices.length),
      customerId: selectedCustomer || null,
      customerName,
      items,
      subtotal: cartSubtotal,
      discount: cartDiscount,
      total: cartTotal,
      extraCharges,
      paid,
      remaining,
      previousBalance,
      paymentMethod,
      paymentStatus,
      notes: '',
      createdAt: new Date().toISOString(),
      createdBy: user?.name || 'System',
    };

    dispatch({ type: 'ADD_SALE', payload: newInvoice });
    setLastInvoice(newInvoice);
    setShowReceipt(true);
    clearCart();
  };

  const startEditInvoice = (inv: SaleInvoice) => {
    const cartItems: CartItem[] = inv.items.map(li => {
      const found = items.find(i => i.id === li.itemId);
      const item: Item = found ?? {
        id: li.itemId, barcode: '', barcodes: [], subUnits: [], name: li.itemName, nameAr: li.itemName,
        categoryId: '', unit: '', purchasePrice: 0, salePrice: li.unitPrice,
        wholesalePrice: 0, stockQuantity: 0, minStockLevel: 0,
        description: '', isActive: true, createdAt: new Date().toISOString(),
      };
      return { item, quantity: li.quantity, unitPrice: li.unitPrice, discount: li.discount };
    });
    setCart(cartItems);
    setSelectedCustomer(inv.customerId || '');
    setExtraCharges(inv.extraCharges || []);
    const pm = (['cash', 'card', 'wallet', 'credit'] as PaymentMethod[]).includes(inv.paymentMethod as PaymentMethod)
      ? (inv.paymentMethod as PaymentMethod) : 'credit';
    setPaymentMethod(pm);
    setAmountPaid(String(inv.paid || ''));
    setEditingInvoiceId(inv.id);
    setView('terminal');
  };

  const cancelEdit = () => {
    setEditingInvoiceId(null);
    clearCart();
    setSelectedCustomer('');
    setExtraCharges([]);
    setPaymentMethod('cash');
  };

  const handleCollectPayment = () => {
    if (!collectTargetInvoice || !collectAmount) return;
    const collectValue = Number(collectAmount);
    if (collectValue <= 0) return;

    const dueTotal = (collectTargetInvoice.previousBalance || 0) + collectTargetInvoice.total;
    const newPaid = Math.min(collectTargetInvoice.paid + collectValue, dueTotal);
    const newRemaining = Math.round((dueTotal - newPaid) * 100) / 100;
    const newPaymentStatus = newRemaining <= 0 ? 'paid' : 'partial';

    dispatch({
      type: 'UPDATE_SALE',
      payload: {
        ...collectTargetInvoice,
        paid: newPaid,
        remaining: newRemaining,
        paymentStatus: newPaymentStatus as 'paid' | 'partial' | 'unpaid' | 'credit',
      },
    });

    setCollectTargetInvoice(null);
    setCollectAmount('');
  };

  const openAddCustomer = () => {
    setCustomerForm({ name: '', nameAr: '', phone: '', email: '', address: '', creditLimit: 0 });
    setShowCustomerModal(true);
  };

  const handleSaveCustomer = () => {
    if (!customerForm.name.trim()) return;
    const customer: Customer = {
      id: generateId('cust'),
      name: customerForm.name.trim(),
      nameAr: customerForm.nameAr.trim() || customerForm.name.trim(),
      phone: customerForm.phone.trim(),
      email: customerForm.email.trim(),
      address: customerForm.address.trim(),
      creditLimit: Number(customerForm.creditLimit) || 0,
      balance: 0,
      isActive: true,
      createdAt: new Date().toISOString(),
    };
    dispatch({ type: 'ADD_CUSTOMER', payload: customer });
    setShowCustomerModal(false);
  };

  const invoicesPerPage = 10;
  const paginatedInvoices = salesInvoices.slice(-invoicesPerPage * currentPage).reverse();

  const formatCurrency = (val: number) => `${val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${state.data.company.currencySymbol}`;

  return (
    <div className="space-y-4">
      <div className={`bg-card rounded-xl border border-border p-1 inline-flex ${isRTL ? 'flex-row-reverse' : ''}`}>
        {(['terminal', 'invoices', 'customers'] as POSView[]).map(v => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              view === v ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'
            }`}
          >
            {t(`sales.${v}`)}
          </button>
        ))}
      </div>

      {view === 'terminal' && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
          <div className="lg:col-span-3 space-y-4">
            <div className="bg-card rounded-xl border border-border p-4">
              <div className="relative">
                <Search className={`absolute top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60 ${isRTL ? 'right-3' : 'left-3'}`} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                  placeholder={t('sales.productSearch')}
                  className={`w-full ${isRTL ? 'pr-9 pl-3' : 'pl-9 pr-3'} py-2.5 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent bg-card text-foreground`}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {paginatedProducts.map(item => (
                <button
                  key={item.id}
                  onClick={() => addToCart(item)}
                  className="bg-card rounded-xl border border-border p-3 hover:shadow-md hover:border-primary transition-all active:scale-95 text-left"
                >
                  <div className="w-full h-20 bg-muted/30 rounded-lg mb-2 flex items-center justify-center">
                    <Package size={28} className="text-muted-foreground/60" />
                  </div>
                  <p className="text-xs font-medium text-foreground truncate">{isRTL ? item.nameAr : item.name}</p>
                  <p className="text-xs text-muted-foreground/60 truncate">{item.barcode}</p>
                  <p className="text-sm font-bold text-primary font-mono mt-1">{formatCurrency(item.salePrice)}</p>
                  <p className="text-[10px] text-muted-foreground/60">{t('common.stock')}: {item.stockQuantity}</p>
                </button>
              ))}
            </div>

            {productPages > 1 && (
              <div className={`flex items-center justify-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-1 rounded hover:bg-accent disabled:opacity-30">
                  {isRTL ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
                </button>
                <span className="text-xs text-muted-foreground">{currentPage} / {productPages}</span>
                <button onClick={() => setCurrentPage(p => Math.min(productPages, p + 1))} disabled={currentPage === productPages} className="p-1 rounded hover:bg-accent disabled:opacity-30">
                  {isRTL ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
                </button>
              </div>
            )}
          </div>

          <div className="lg:col-span-2 bg-card rounded-xl border border-border flex flex-col h-fit sticky top-20">
            <div className={`p-4 border-b border-border flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
              <h3 className="font-semibold text-foreground flex items-center gap-2">
                <ShoppingCart size={18} /> {t('sales.cart')}
              </h3>
              <span className="text-xs text-muted-foreground">{cart.length} {t('common.items')}</span>
            </div>

            <div className="flex-1 max-h-80 overflow-y-auto p-4 space-y-3">
              {cart.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground/60">
                  <ShoppingCart size={40} className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm">{t('sales.cart')} {t('common.empty')}</p>
                </div>
              ) : (
                cart.map(ci => (
                  <div key={ci.item.id} className={`flex items-center gap-3 p-2 rounded-lg bg-muted/30 ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{isRTL ? ci.item.nameAr : ci.item.name}</p>
                      <div className={`flex items-center gap-1 mt-0.5 ${isRTL ? 'flex-row-reverse' : ''}`}>
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={ci.unitPrice}
                          onChange={e => setPrice(ci.item.id, Number(e.target.value))}
                          onFocus={e => e.target.select()}
                          title={t('sales.editPriceHint')}
                          className="w-20 text-xs font-mono text-primary bg-card border border-border rounded px-1.5 py-0.5 focus:ring-2 focus:ring-primary focus:outline-none"
                        />
                        <span className="text-[10px] text-muted-foreground/60">{state.data.company.currencySymbol}</span>
                      </div>
                    </div>
                    <div className={`flex items-center gap-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
                      <button onClick={() => updateQuantity(ci.item.id, -1)} className="w-6 h-6 rounded-full bg-card border border-border flex items-center justify-center hover:bg-accent">
                        <Minus size={12} />
                      </button>
                      <input
                        type="number"
                        min={1}
                        value={ci.quantity}
                        onChange={e => setQuantity(ci.item.id, Number(e.target.value))}
                        onFocus={e => e.target.select()}
                        className="w-14 text-center text-sm font-mono font-medium bg-card border border-border rounded-md py-1 focus:ring-2 focus:ring-primary focus:outline-none"
                      />
                      <button onClick={() => updateQuantity(ci.item.id, 1)} className="w-6 h-6 rounded-full bg-card border border-border flex items-center justify-center hover:bg-accent">
                        <Plus size={12} />
                      </button>
                    </div>
                    <div className={`text-right ${isRTL ? 'text-left' : 'text-right'}`}>
                      <p className="text-sm font-mono font-medium">{formatCurrency(ci.unitPrice * ci.quantity)}</p>
                    </div>
                    <button onClick={() => removeFromCart(ci.item.id)} className="p-1 text-muted-foreground/60 hover:text-destructive">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="px-4 py-2 border-t border-border">
              <select
                value={selectedCustomer}
                onChange={e => setSelectedCustomer(e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-card text-foreground"
              >
                <option value="">{t('sales.walkInCustomer')}</option>
                {customers.map(c => (
                  <option key={c.id} value={c.id}>{c.name} - {c.phone}</option>
                ))}
              </select>
            </div>

            <div className="px-4 py-3 border-t border-border space-y-2">
              <div className={`flex justify-between text-sm ${isRTL ? 'flex-row-reverse' : ''}`}>
                <span className="text-muted-foreground">{t('sales.subtotal')}</span>
                <span className="font-mono">{formatCurrency(cartSubtotal)}</span>
              </div>
              {cartDiscount > 0 && (
                <div className={`flex justify-between text-sm ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <span className="text-muted-foreground">{t('common.discount')}</span>
                  <span className="font-mono text-destructive">-{formatCurrency(cartDiscount)}</span>
                </div>
              )}
              <div className={`flex justify-between text-sm ${isRTL ? 'flex-row-reverse' : ''}`}>
                <span className="text-foreground font-medium">{t('sales.total')}</span>
                <span className="font-mono font-medium">{formatCurrency(cartTotal)}</span>
              </div>
              {selectedCustomer && previousBalance !== 0 && (
                <>
                  <div className={`flex justify-between text-sm ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <span className="text-muted-foreground">{t('invoice.previousBalance')}</span>
                    <span className={`font-mono ${previousBalance > 0 ? 'text-destructive' : 'text-emerald-600'}`}>{formatCurrency(previousBalance)}</span>
                  </div>
                  <div className={`flex justify-between text-base font-bold border-t border-border pt-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <span className="text-foreground">{t('invoice.totalDue')}</span>
                    <span className="font-mono text-primary">{formatCurrency(grandTotalDue)}</span>
                  </div>
                </>
              )}
              {(!selectedCustomer || previousBalance === 0) && (
                <div className={`flex justify-between text-base font-bold border-t border-border pt-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <span className="text-foreground">{t('invoice.totalDue')}</span>
                  <span className="font-mono text-primary">{formatCurrency(grandTotalDue)}</span>
                </div>
              )}
            </div>

            <div className="px-4 py-2 border-t border-border space-y-2">
              <p className="text-xs text-muted-foreground">{t('sales.extraCharges', 'Extra Charges')}</p>
              {extraCharges.map((ec) => (
                <div key={ec.id} className={`flex justify-between text-sm ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <span className="text-muted-foreground">{ec.description}</span>
                  <span className="font-mono text-primary">{formatCurrency(ec.amount)}</span>
                </div>
              ))}
              <div className={`flex gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <input
                  type="text"
                  value={extraChargeDesc}
                  onChange={e => setExtraChargeDesc(e.target.value)}
                  placeholder={t('sales.extraChargeDesc', 'Description')}
                  className="flex-1 px-2 py-1.5 border border-border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary bg-card text-foreground"
                />
                <input
                  type="number"
                  value={extraChargeAmount}
                  onChange={e => setExtraChargeAmount(e.target.value)}
                  placeholder="0"
                  className="w-20 px-2 py-1.5 border border-border rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary bg-card text-foreground"
                />
                <button
                  onClick={() => {
                    if (extraChargeDesc && Number(extraChargeAmount) > 0) {
                      setExtraCharges([...extraCharges, { id: generateId('ec'), description: extraChargeDesc, amount: Number(extraChargeAmount) }]);
                      setExtraChargeDesc('');
                      setExtraChargeAmount('');
                    }
                  }}
                  className="px-2 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:bg-primary/90"
                >
                  {t('common.add', 'Add')}
                </button>
              </div>
            </div>

            <div className="px-4 py-2 border-t border-border">
              <p className="text-xs text-muted-foreground mb-2">{t('sales.paymentMethod')}</p>
              <div className="grid grid-cols-4 gap-2">
                {(['cash', 'card', 'wallet', 'credit'] as PaymentMethod[]).map(pm => (
                  <button
                    key={pm}
                    onClick={() => { setPaymentMethod(pm); setAmountPaid(''); }}
                    className={`flex flex-col items-center gap-1 p-2 rounded-lg border text-xs font-medium transition-colors ${
                      paymentMethod === pm
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground hover:bg-muted/50'
                    }`}
                  >
                    {pm === 'cash' && <Banknote size={18} />}
                    {pm === 'card' && <CreditCard size={18} />}
                    {pm === 'wallet' && <Wallet size={18} />}
                    {pm === 'credit' && <ArrowLeftRight size={18} />}
                    {t(`common.${pm}`, pm.charAt(0).toUpperCase() + pm.slice(1))}
                  </button>
                ))}
              </div>
            </div>

            {(paymentMethod === 'cash' || paymentMethod === 'credit') && (
              <div className="px-4 py-2 border-t border-border">
                <div className={`flex justify-between text-sm mb-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <span className="text-muted-foreground">{paymentMethod === 'credit' ? t('sales.creditAmount', 'Credit Amount') : t('sales.amountPaid')}</span>
                  {paymentMethod === 'cash' && (
                    <span className="font-mono text-emerald-600 dark:text-emerald-400">{change >= 0 ? `${t('sales.change')}: ${formatCurrency(change)}` : ''}</span>
                  )}
                </div>
                <input
                  type="number"
                  value={amountPaid}
                  onChange={e => setAmountPaid(e.target.value)}
                  placeholder={paymentMethod === 'credit' ? '0' : formatCurrency(grandTotalDue)}
                  className="w-full px-3 py-2 border border-border rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary bg-card text-foreground"
                />
              </div>
            )}

            <div className="p-4 border-t border-border">
              {editingInvoiceId && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mb-2 text-center font-medium">{t('sales.editingInvoice')}</p>
              )}
              <button
                onClick={handleCheckout}
                disabled={(editingInvoiceId ? !can('sales', 'edit') : !can('sales', 'create')) || cart.length === 0 || (paymentMethod === 'cash' && paidAmount < cartTotal)}
                className="w-full py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Receipt size={18} /> {editingInvoiceId ? t('sales.saveInvoice') : t('sales.checkout')}
              </button>
              {editingInvoiceId ? (
                <button onClick={cancelEdit} className="w-full mt-2 py-2 text-sm text-muted-foreground hover:bg-accent rounded-lg transition-colors">
                  {t('sales.cancelEdit')}
                </button>
              ) : cart.length > 0 && (
                <button onClick={clearCart} className="w-full mt-2 py-2 text-sm text-destructive hover:bg-destructive/10 rounded-lg transition-colors">
                  {t('sales.clearCart')}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {view === 'invoices' && (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/30">
                  <th className={`px-4 py-3 text-xs font-semibold text-muted-foreground uppercase ${isRTL ? 'text-right' : 'text-left'}`}>{t('sales.invoiceNumber')}</th>
                  <th className={`px-4 py-3 text-xs font-semibold text-muted-foreground uppercase ${isRTL ? 'text-right' : 'text-left'}`}>{t('common.customer')}</th>
                  <th className={`px-4 py-3 text-xs font-semibold text-muted-foreground uppercase ${isRTL ? 'text-right' : 'text-left'}`}>{t('common.items')}</th>
                  <th className={`px-4 py-3 text-xs font-semibold text-muted-foreground uppercase ${isRTL ? 'text-right' : 'text-left'}`}>{t('common.total')}</th>
                  <th className={`px-4 py-3 text-xs font-semibold text-muted-foreground uppercase ${isRTL ? 'text-right' : 'text-left'}`}>{t('common.payment')}</th>
                  <th className={`px-4 py-3 text-xs font-semibold text-muted-foreground uppercase ${isRTL ? 'text-right' : 'text-left'}`}>{t('common.status')}</th>
                  <th className={`px-4 py-3 text-xs font-semibold text-muted-foreground uppercase ${isRTL ? 'text-right' : 'text-left'}`}>{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {paginatedInvoices.map(inv => (
                  <tr key={inv.id} className="hover:bg-muted/50 transition-colors">
                    <td className="px-4 py-3 font-mono text-primary font-medium">{inv.invoiceNumber}</td>
                    <td className="px-4 py-3">{inv.customerName}</td>
                    <td className="px-4 py-3 text-muted-foreground">{inv.items.length}</td>
                    <td className="px-4 py-3 font-mono font-medium">{formatCurrency(inv.total)}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">{t(`common.${inv.paymentMethod}`)}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full inline-block w-fit ${
                          inv.paymentStatus === 'paid'
                            ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400'
                            : 'bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400'
                        }`}>
                          {t(`common.${inv.paymentStatus}`)}
                        </span>
                        {inv.remaining > 0 && (
                          <span className="text-xs font-mono text-destructive">
                            {t('common.remaining', 'Remaining')}: {formatCurrency(inv.remaining)}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {inv.remaining > 0 && can('sales', 'edit') && (
                          <button
                            onClick={() => { setCollectTargetInvoice(inv); setCollectAmount(''); }}
                            title={t('sales.collectPayment')}
                            className="p-1.5 rounded hover:bg-primary/10 text-primary"
                          >
                            <DollarSign size={14} />
                          </button>
                        )}
                        {can('sales', 'edit') && (
                          <button onClick={() => startEditInvoice(inv)} title={t('sales.editInvoice')} className="p-1.5 rounded hover:bg-primary/10 text-primary">
                            <Pencil size={14} />
                          </button>
                        )}
                        <button onClick={() => setViewInvoice(inv)} title={t('invoice.view')} className="p-1.5 rounded hover:bg-primary/10 text-primary">
                          <Eye size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showReceipt && lastInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-card rounded-xl shadow-xl w-full max-w-sm p-6">
            <div className="text-center mb-4">
              <h3 className="text-lg font-bold text-foreground">{state.data.company.name}</h3>
              <p className="text-xs text-muted-foreground">{state.data.company.address}</p>

            </div>
            <div className="border-t border-b border-dashed border-border py-3 space-y-1 text-sm">
              <div className={`flex justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
                <span className="text-muted-foreground">{t('sales.invoiceNumber')}</span>
                <span className="font-mono font-medium">{lastInvoice.invoiceNumber}</span>
              </div>
              <div className={`flex justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
                <span className="text-muted-foreground">{t('common.date')}</span>
                <span>{new Date(lastInvoice.createdAt).toLocaleString()}</span>
              </div>
              <div className={`flex justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
                <span className="text-muted-foreground">{t('common.customer')}</span>
                <span>{lastInvoice.customerName}</span>
              </div>
              <div className={`flex justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
                <span className="text-muted-foreground">{t('sales.paymentMethod')}</span>
                <span>{t(`common.${lastInvoice.paymentMethod}`)}</span>
              </div>
            </div>
            <div className="py-3 space-y-2">
              {lastInvoice.items.map((item, idx) => (
                <div key={idx} className={`flex justify-between text-sm ${isRTL ? 'flex-row-reverse' : ''}`}>
                  <div className={`flex-1 ${isRTL ? 'text-right' : ''}`}>
                    <p className="text-foreground">{item.itemName}</p>
                    <p className="text-xs text-muted-foreground/60">{item.quantity} x {formatCurrency(item.unitPrice)}</p>
                  </div>
                  <span className="font-mono">{formatCurrency(item.total)}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-dashed border-border pt-3 space-y-1">
              <div className={`flex justify-between text-sm ${isRTL ? 'flex-row-reverse' : ''}`}>
                <span className="text-muted-foreground">{t('sales.subtotal')}</span>
                <span className="font-mono">{formatCurrency(lastInvoice.subtotal)}</span>
              </div>
              <div className={`flex justify-between text-lg font-bold ${isRTL ? 'flex-row-reverse' : ''}`}>
                <span>{t('sales.total')}</span>
                <span className="font-mono text-primary">{formatCurrency(lastInvoice.total)}</span>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button onClick={() => { setShowReceipt(false); setViewInvoice(lastInvoice); }} className="flex-1 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 flex items-center justify-center gap-1">
                <Printer size={14} /> {t('sales.printReceipt')}
              </button>
              <button onClick={() => setShowReceipt(false)} className="flex-1 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:bg-accent">
                {t('common.close')}
              </button>
            </div>
          </div>
        </div>
      )}

      {view === 'customers' && (
        <div className="bg-card rounded-xl border border-border p-6">
          <div className={`flex items-center justify-between gap-3 mb-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <p className="text-sm text-muted-foreground">{t('sales.customersCount', { count: customers.length })}</p>
            {can('sales', 'create') && (
              <button onClick={openAddCustomer} className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90">
                <Plus size={16} /> {t('sales.addCustomer')}
              </button>
            )}
          </div>
          {customers.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-8">{t('sales.noCustomers')}</p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {customers.map(cust => {
              const totalRemaining = cust.balance || 0;
              const creditLimit = cust.creditLimit || 0;
              const usagePercent = creditLimit > 0 ? (totalRemaining / creditLimit) * 100 : 0;
              const isOverLimit = totalRemaining > creditLimit && creditLimit > 0;
              const isApproachingLimit = usagePercent >= 80 && usagePercent <= 100 && !isOverLimit;
              return (
                <div key={cust.id} className="border border-border rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className={`flex items-start justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <div>
                      <h4 className="font-medium text-foreground">{isRTL ? cust.nameAr : cust.name}</h4>
                      <p className="text-xs text-muted-foreground">{cust.phone}</p>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-xs font-bold text-primary">{cust.name.charAt(0)}</span>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-border space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">{t('common.balance')}</span>
                      <span className={`font-mono font-medium ${
                        totalRemaining > 0
                          ? isOverLimit
                            ? 'text-destructive'
                            : isApproachingLimit
                              ? 'text-amber-600 dark:text-amber-400'
                              : 'text-primary'
                          : 'text-muted-foreground'
                      }`}>
                        {formatCurrency(totalRemaining)}
                      </span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">{t('common.creditLimit', 'Credit Limit')}</span>
                      <span className="font-mono font-medium text-foreground">{formatCurrency(creditLimit)}</span>
                    </div>
                    {creditLimit > 0 && (
                      <div className="w-full h-1.5 bg-muted/30 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            isOverLimit ? 'bg-destructive' : isApproachingLimit ? 'bg-amber-600 dark:bg-amber-400' : 'bg-primary'
                          }`}
                          style={{ width: `${Math.min(usagePercent, 100)}%` }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {collectTargetInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-card rounded-xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-lg font-bold text-foreground mb-4">{t('sales.collectPayment', 'Collect Payment')}</h3>
            <p className="text-sm text-muted-foreground mb-2">
              {t('sales.invoiceNumber')}: <span className="font-mono font-medium text-foreground">{collectTargetInvoice.invoiceNumber}</span>
            </p>
            {(collectTargetInvoice.previousBalance || 0) !== 0 && (
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted-foreground">{t('invoice.previousBalance')}</span>
                <span className="font-mono font-medium text-foreground">{formatCurrency(collectTargetInvoice.previousBalance || 0)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm mb-1">
              <span className="text-muted-foreground">{t('invoice.totalDue')}</span>
              <span className="font-mono font-medium text-foreground">{formatCurrency((collectTargetInvoice.previousBalance || 0) + collectTargetInvoice.total)}</span>
            </div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-muted-foreground">{t('common.paid')}</span>
              <span className="font-mono font-medium text-emerald-600 dark:text-emerald-400">{formatCurrency(collectTargetInvoice.paid)}</span>
            </div>
            <div className="flex justify-between text-sm mb-4">
              <span className="text-muted-foreground">{t('common.remaining', 'Remaining')}</span>
              <span className="font-mono font-medium text-destructive">{formatCurrency(collectTargetInvoice.remaining)}</span>
            </div>
            <input
              type="number"
              value={collectAmount}
              onChange={e => setCollectAmount(e.target.value)}
              placeholder={formatCurrency(collectTargetInvoice.remaining)}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary bg-card text-foreground mb-4"
            />
            <div className="flex gap-2">
              <button
                onClick={handleCollectPayment}
                disabled={!collectAmount || Number(collectAmount) <= 0}
                className="flex-1 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('common.submit')}
              </button>
              <button
                onClick={() => { setCollectTargetInvoice(null); setCollectAmount(''); }}
                className="flex-1 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:bg-accent"
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {viewInvoice && (
        <InvoiceView
          invoice={viewInvoice}
          type="sale"
          party={customers.find(c => c.id === viewInvoice.customerId)}
          onClose={() => setViewInvoice(null)}
        />
      )}

      {showCustomerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-card rounded-xl shadow-xl w-full max-w-md">
            <div className={`p-5 border-b border-border flex items-center justify-between ${isRTL ? 'flex-row-reverse' : ''}`}>
              <h3 className="text-lg font-semibold text-foreground">{t('sales.addCustomer')}</h3>
              <button onClick={() => setShowCustomerModal(false)} className="p-1.5 rounded hover:bg-accent"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><label className="block text-xs text-muted-foreground mb-1">{t('common.name')} EN</label><input value={customerForm.name} onChange={e => setCustomerForm({ ...customerForm, name: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary" /></div>
                <div><label className="block text-xs text-muted-foreground mb-1">{t('common.name')} AR</label><input value={customerForm.nameAr} onChange={e => setCustomerForm({ ...customerForm, nameAr: e.target.value })} dir="rtl" className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary" /></div>
                <div><label className="block text-xs text-muted-foreground mb-1">{t('common.phone')}</label><input value={customerForm.phone} onChange={e => setCustomerForm({ ...customerForm, phone: e.target.value })} dir="ltr" className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary" /></div>
                <div><label className="block text-xs text-muted-foreground mb-1">{t('common.email')}</label><input value={customerForm.email} onChange={e => setCustomerForm({ ...customerForm, email: e.target.value })} dir="ltr" className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary" /></div>
              </div>
              <div><label className="block text-xs text-muted-foreground mb-1">{t('common.address')}</label><input value={customerForm.address} onChange={e => setCustomerForm({ ...customerForm, address: e.target.value })} className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:ring-2 focus:ring-primary" /></div>
              <div><label className="block text-xs text-muted-foreground mb-1">{t('common.creditLimit', 'Credit Limit')}</label><input type="number" value={customerForm.creditLimit} onChange={e => setCustomerForm({ ...customerForm, creditLimit: Number(e.target.value) })} className="w-full px-3 py-2 border border-border rounded-lg text-sm font-mono focus:ring-2 focus:ring-primary" /></div>
              <div className={`flex justify-end gap-3 pt-1 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <button onClick={() => setShowCustomerModal(false)} className="px-4 py-2 border border-border rounded-lg text-sm text-muted-foreground">{t('common.cancel')}</button>
                <button onClick={handleSaveCustomer} disabled={!customerForm.name.trim()} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50">{t('common.save')}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
