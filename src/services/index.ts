// ============================================================
// Easy Store ERP - طبقة الخدمات (Services Layer)
// ============================================================
// هذه الطبقة تحتوي على منطق الأعمال (Business Logic).
// يتم فصلها تمامًا عن واجهة المستخدم لتسهيل التوسع مستقبلًا.
// ============================================================

import type {
  Item, Supplier, Customer,
  SaleInvoice, PurchaseInvoice, SaleItem, PurchaseItem,
  TreasuryAccount, Transaction,
  AppNotification, PaymentStatus, PaymentMethod, ExtraCharge
} from '@/types';
import { dataRepository } from '@/repository';
import { generateId, generateInvoiceNumber } from '@/db';

// ============================================================
// خدمة إدارة المخزون (Inventory Service)
// ============================================================
export const inventoryService = {
  getItems(): Item[] {
    return dataRepository.load().items;
  },

  getItem(id: string): Item | undefined {
    return dataRepository.load().items.find(i => i.id === id);
  },

  addItem(item: Omit<Item, 'id' | 'createdAt'>): Item {
    const state = dataRepository.load();
    const newItem: Item = {
      ...item,
      id: generateId('item'),
      createdAt: new Date().toISOString(),
    };
    state.items.push(newItem);
    dataRepository.save(state);
    return newItem;
  },

  updateItem(item: Item): void {
    const state = dataRepository.load();
    state.items = state.items.map(i => i.id === item.id ? item : i);
    dataRepository.save(state);
  },

  deleteItem(id: string): void {
    const state = dataRepository.load();
    state.items = state.items.filter(i => i.id !== id);
    dataRepository.save(state);
  },

  // ============================================================
  // تقليل المخزون تلقائيًا عند البيع
  // ============================================================
  deductStock(itemId: string, quantity: number): void {
    const state = dataRepository.load();
    state.items = state.items.map(item =>
      item.id === itemId
        ? { ...item, stockQuantity: Math.max(0, item.stockQuantity - quantity) }
        : item
    );
    dataRepository.save(state);
  },

  // ============================================================
  // زيادة المخزون عند الشراء
  // ============================================================
  addStock(itemId: string, quantity: number): void {
    const state = dataRepository.load();
    state.items = state.items.map(item =>
      item.id === itemId
        ? { ...item, stockQuantity: item.stockQuantity + quantity }
        : item
    );
    dataRepository.save(state);
  },

  getLowStockItems(): Item[] {
    return dataRepository.load().items.filter(
      i => i.stockQuantity > 0 && i.stockQuantity <= i.minStockLevel
    );
  },

  getOutOfStockItems(): Item[] {
    return dataRepository.load().items.filter(i => i.stockQuantity === 0);
  },
};

// ============================================================
// خدمة العملاء (Customer Service)
// ============================================================
export const customerService = {
  getAll(): Customer[] {
    return dataRepository.load().customers;
  },

  getById(id: string): Customer | undefined {
    return dataRepository.load().customers.find(c => c.id === id);
  },

  add(customer: Omit<Customer, 'id' | 'createdAt'>): Customer {
    const state = dataRepository.load();
    const newCustomer: Customer = {
      ...customer,
      id: generateId('cust'),
      createdAt: new Date().toISOString(),
    };
    state.customers.push(newCustomer);
    dataRepository.save(state);
    return newCustomer;
  },

  update(customer: Customer): void {
    const state = dataRepository.load();
    state.customers = state.customers.map(c => c.id === customer.id ? customer : c);
    dataRepository.save(state);
  },

  delete(id: string): void {
    const state = dataRepository.load();
    state.customers = state.customers.filter(c => c.id !== id);
    dataRepository.save(state);
  },

  // ============================================================
  // تحديث رصيد العميل (يزيد عند إضافة فاتورة غير مدفوعة كليًا)
  // ============================================================
  updateBalance(customerId: string | null, amount: number): void {
    if (!customerId) return;
    const state = dataRepository.load();
    state.customers = state.customers.map(c =>
      c.id === customerId
        ? { ...c, balance: c.balance + amount }
        : c
    );
    dataRepository.save(state);
  },

  // ============================================================
  // حساب إجمالي مديونية العميل من جميع الفواتير
  // ============================================================
  getTotalDebt(customerId: string): number {
    const state = dataRepository.load();
    return state.salesInvoices
      .filter(inv => inv.customerId === customerId)
      .reduce((sum, inv) => sum + inv.remaining, 0);
  },
};

// ============================================================
// خدمة الموردين (Supplier Service)
// ============================================================
export const supplierService = {
  getAll(): Supplier[] {
    return dataRepository.load().suppliers;
  },

  getById(id: string): Supplier | undefined {
    return dataRepository.load().suppliers.find(s => s.id === id);
  },

  add(supplier: Omit<Supplier, 'id' | 'createdAt'>): Supplier {
    const state = dataRepository.load();
    const newSupplier: Supplier = {
      ...supplier,
      id: generateId('sup'),
      createdAt: new Date().toISOString(),
    };
    state.suppliers.push(newSupplier);
    dataRepository.save(state);
    return newSupplier;
  },

  update(supplier: Supplier): void {
    const state = dataRepository.load();
    state.suppliers = state.suppliers.map(s => s.id === supplier.id ? supplier : s);
    dataRepository.save(state);
  },

  delete(id: string): void {
    const state = dataRepository.load();
    state.suppliers = state.suppliers.filter(s => s.id !== id);
    dataRepository.save(state);
  },

  // ============================================================
  // تحديث رصيد المورد
  // ============================================================
  updateBalance(supplierId: string, amount: number): void {
    const state = dataRepository.load();
    state.suppliers = state.suppliers.map(s =>
      s.id === supplierId
        ? { ...s, balance: s.balance + amount }
        : s
    );
    dataRepository.save(state);
  },

  // ============================================================
  // حساب إجمالي مديونية المورد
  // ============================================================
  getTotalDebt(supplierId: string): number {
    const state = dataRepository.load();
    return state.purchaseInvoices
      .filter(inv => inv.supplierId === supplierId)
      .reduce((sum, inv) => sum + inv.remaining, 0);
  },
};

// ============================================================
// خدمة المبيعات (Sales Service)
// ============================================================
export const salesService = {
  getAll(): SaleInvoice[] {
    return dataRepository.load().salesInvoices;
  },

  getById(id: string): SaleInvoice | undefined {
    return dataRepository.load().salesInvoices.find(s => s.id === id);
  },

  // ============================================================
  // إنشاء فاتورة مبيعات جديدة مع:
  // - خصم المخزون تلقائيًا
  // - تحديث رصيد العميل
  // - إضافة معاملة خزينة
  // ============================================================
  createInvoice(params: {
    customerId: string | null;
    customerName: string;
    items: SaleItem[];
    subtotal: number;
    discount: number;
    extraCharges: ExtraCharge[];
    total: number;
    paid: number;
    paymentMethod: PaymentMethod;
    createdBy: string;
  }): SaleInvoice {
    const state = dataRepository.load();
    const remaining = params.total - params.paid;

    let paymentStatus: PaymentStatus = 'paid';
    if (params.paid <= 0) {
      paymentStatus = 'unpaid';
    } else if (remaining > 0) {
      paymentStatus = 'partial';
    }

    const newInvoice: SaleInvoice = {
      id: generateId('sale'),
      invoiceNumber: generateInvoiceNumber('INV', state.salesInvoices.length),
      customerId: params.customerId,
      customerName: params.customerName,
      items: params.items,
      subtotal: params.subtotal,
      discount: params.discount,
      extraCharges: params.extraCharges,
      total: params.total,
      paid: params.paid,
      remaining,
      paymentMethod: params.paymentMethod,
      paymentStatus,
      notes: '',
      createdAt: new Date().toISOString(),
      createdBy: params.createdBy,
    };

    state.salesInvoices.push(newInvoice);

    // خصم المخزون
    params.items.forEach(soldItem => {
      state.items = state.items.map(item =>
        item.id === soldItem.itemId
          ? { ...item, stockQuantity: Math.max(0, item.stockQuantity - soldItem.quantity) }
          : item
      );
    });

    // تحديث رصيد العميل
    if (params.customerId) {
      state.customers = state.customers.map(c =>
        c.id === params.customerId
          ? { ...c, balance: c.balance + remaining }
          : c
      );
    }

    // إضافة إلى الخزينة
    const safeAccount = state.treasuryAccounts.find(a => a.type === 'safe');
    if (safeAccount && params.paid > 0) {
      state.treasuryAccounts = state.treasuryAccounts.map(a =>
        a.id === safeAccount.id ? { ...a, balance: a.balance + params.paid } : a
      );
      state.transactions.push({
        id: `tr-${Date.now()}`,
        accountId: safeAccount.id,
        accountName: safeAccount.name,
        type: 'income',
        amount: params.paid,
        description: `فاتورة مبيعات ${newInvoice.invoiceNumber}`,
        referenceNumber: newInvoice.invoiceNumber,
        category: 'Sales',
        date: new Date().toISOString().split('T')[0],
        createdAt: new Date().toISOString(),
        createdBy: params.createdBy,
      });
    }

    dataRepository.save(state);
    return newInvoice;
  },

  update(invoice: SaleInvoice): void {
    const state = dataRepository.load();
    state.salesInvoices = state.salesInvoices.map(s => s.id === invoice.id ? invoice : s);
    dataRepository.save(state);
  },

  // ============================================================
  // تسجيل دفعة على فاتورة
  // ============================================================
  recordPayment(invoiceId: string, amount: number): void {
    const state = dataRepository.load();
    const invoice = state.salesInvoices.find(s => s.id === invoiceId);
    if (!invoice) return;

    invoice.paid += amount;
    invoice.remaining = Math.max(0, invoice.total - invoice.paid);
    invoice.paymentStatus = invoice.remaining <= 0 ? 'paid' : 'partial';

    if (invoice.customerId) {
      state.customers = state.customers.map(c =>
        c.id === invoice.customerId
          ? { ...c, balance: Math.max(0, c.balance - amount) }
          : c
      );
    }

    dataRepository.save(state);
  },

  getTotalRevenue(): number {
    return dataRepository.load().salesInvoices.reduce((sum, inv) => sum + inv.total, 0);
  },

  getTodaySales(): SaleInvoice[] {
    const today = new Date().toISOString().split('T')[0];
    return dataRepository.load().salesInvoices.filter(s => s.createdAt.startsWith(today));
  },
};

// ============================================================
// خدمة المشتريات (Purchases Service)
// ============================================================
export const purchaseService = {
  getAll(): PurchaseInvoice[] {
    return dataRepository.load().purchaseInvoices;
  },

  getById(id: string): PurchaseInvoice | undefined {
    return dataRepository.load().purchaseInvoices.find(p => p.id === id);
  },

  // ============================================================
  // إنشاء فاتورة مشتريات جديدة مع تحديث رصيد المورد
  // ============================================================
  createInvoice(params: {
    supplierId: string;
    supplierName: string;
    items: PurchaseItem[];
    subtotal: number;
    discount: number;
    extraCharges: ExtraCharge[];
    shippingCost: number;
    total: number;
    paid: number;
    createdBy: string;
  }): PurchaseInvoice {
    const state = dataRepository.load();
    const remaining = params.total - params.paid;

    let paymentStatus: PaymentStatus = 'paid';
    if (params.paid <= 0) {
      paymentStatus = 'unpaid';
    } else if (remaining > 0) {
      paymentStatus = 'partial';
    }

    const newInvoice: PurchaseInvoice = {
      id: generateId('pur'),
      invoiceNumber: generateInvoiceNumber('PO', state.purchaseInvoices.length),
      supplierId: params.supplierId,
      supplierName: params.supplierName,
      items: params.items,
      subtotal: params.subtotal,
      discount: params.discount,
      extraCharges: params.extraCharges,
      shippingCost: params.shippingCost,
      total: params.total,
      paid: params.paid,
      remaining,
      paymentStatus,
      notes: '',
      createdAt: new Date().toISOString(),
      createdBy: params.createdBy,
    };

    state.purchaseInvoices.push(newInvoice);

    // زيادة المخزون
    params.items.forEach(purchasedItem => {
      state.items = state.items.map(item =>
        item.id === purchasedItem.itemId
          ? { ...item, stockQuantity: item.stockQuantity + purchasedItem.quantity }
          : item
      );
    });

    // تحديث رصيد المورد
    state.suppliers = state.suppliers.map(s =>
      s.id === params.supplierId
        ? { ...s, balance: s.balance + remaining }
        : s
    );

    dataRepository.save(state);
    return newInvoice;
  },

  update(invoice: PurchaseInvoice): void {
    const state = dataRepository.load();
    state.purchaseInvoices = state.purchaseInvoices.map(p => p.id === invoice.id ? invoice : p);
    dataRepository.save(state);
  },

  // ============================================================
  // تسجيل دفعة لمورد
  // ============================================================
  recordPayment(invoiceId: string, amount: number): void {
    const state = dataRepository.load();
    const invoice = state.purchaseInvoices.find(p => p.id === invoiceId);
    if (!invoice) return;

    invoice.paid += amount;
    invoice.remaining = Math.max(0, invoice.total - invoice.paid);
    invoice.paymentStatus = invoice.remaining <= 0 ? 'paid' : 'partial';

    state.suppliers = state.suppliers.map(s =>
      s.id === invoice.supplierId
        ? { ...s, balance: Math.max(0, s.balance - amount) }
        : s
    );

    dataRepository.save(state);
  },
};

// ============================================================
// خدمة الخزينة (Treasury Service)
// ============================================================
export const treasuryService = {
  getAllAccounts(): TreasuryAccount[] {
    return dataRepository.load().treasuryAccounts;
  },

  getTotalBalance(): number {
    return dataRepository.load().treasuryAccounts.reduce((sum, a) => sum + a.balance, 0);
  },

  addTransaction(transaction: Omit<Transaction, 'id' | 'createdAt'>): Transaction {
    const state = dataRepository.load();
    const newTransaction: Transaction = {
      ...transaction,
      id: generateId('tr'),
      createdAt: new Date().toISOString(),
    };
    state.transactions.push(newTransaction);

    const account = state.treasuryAccounts.find(a => a.id === transaction.accountId);
    if (account) {
      const delta = transaction.type === 'expense' || transaction.type === 'transfer_out'
        ? -transaction.amount : transaction.amount;
      state.treasuryAccounts = state.treasuryAccounts.map(a =>
        a.id === account.id ? { ...a, balance: a.balance + delta } : a
      );
    }

    dataRepository.save(state);
    return newTransaction;
  },
};

// ============================================================
// خدمة الإشعارات (Notification Service)
// ============================================================
export const notificationService = {
  add(notification: Omit<AppNotification, 'id' | 'createdAt'>): void {
    const state = dataRepository.load();
    const newNotification: AppNotification = {
      ...notification,
      id: generateId('notif'),
      createdAt: new Date().toISOString(),
    };
    state.notifications.unshift(newNotification);
    dataRepository.save(state);
  },

  markRead(id: string): void {
    const state = dataRepository.load();
    state.notifications = state.notifications.map(n =>
      n.id === id ? { ...n, isRead: true } : n
    );
    dataRepository.save(state);
  },

  getUnreadCount(): number {
    return dataRepository.load().notifications.filter(n => !n.isRead).length;
  },
};

// ============================================================
// خدمة التوليد (ID Generator Service)
// ============================================================
export { generateId, generateInvoiceNumber };
