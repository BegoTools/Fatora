import type { AIResponse } from '@/types/ai';
import type { AppState } from '@/types';

/**
 * Parses queries locally using regex rules to extract actions when Gemini is offline or unconfigured.
 */
export function parseLocally(text: string, _state: AppState): AIResponse | null {
  const query = text.trim().toLowerCase();

  // 1. NAVIGATION
  // e.g. "اذهب الى المخازن", "افتح المبيعات", "شاشة الخزينة", "go to settings", "open inventory"
  const navModules = [
    { keywords: ['مخزن', 'مخازن', 'اصناف', 'أصناف', 'بضاعة', 'منتجات', 'inventory', 'item', 'stock'], module: 'inventory', nameAr: 'المخزون والمنتجات', nameEn: 'Inventory' },
    { keywords: ['مبيعات', 'بيع', 'فاتورة مبيعات', 'كاشير', 'نقاط البيع', 'pos', 'sale', 'invoice'], module: 'sales', nameAr: 'المبيعات ونقاط البيع', nameEn: 'Sales & POS' },
    { keywords: ['مشتريات', 'شراء', 'فاتورة مشتريات', 'موردين', 'purchase'], module: 'purchases', nameAr: 'المشتريات', nameEn: 'Purchases' },
    { keywords: ['خزنة', 'خزينة', 'حسابات', 'سند', 'صرف', 'قبض', 'مالي', 'معاملة', 'treasury', 'safe', 'transaction'], module: 'treasury', nameAr: 'الخزينة والحسابات', nameEn: 'Treasury' },
    { keywords: ['تقرير', 'تقارير', 'احصائيات', 'إحصائيات', 'لوحة التحكم', 'dashboard', 'report', 'analytics'], module: 'reports', nameAr: 'التقارير ولوحة التحكم', nameEn: 'Reports & Dashboard' },
    { keywords: ['موظف', 'موظفين', 'رواتب', 'شؤون موظفين', 'hr', 'payroll', 'employee'], module: 'hr', nameAr: 'الموارد البشرية والرواتب', nameEn: 'HR & Payroll' },
    { keywords: ['اعدادات', 'إعدادات', 'مفتاح', 'ضبط', 'setting', 'api'], module: 'settings', nameAr: 'الإعدادات', nameEn: 'Settings' }
  ];

  const hasNavKeyword = ['اذهب', 'افتح', 'شاش', 'صفح', 'انتقل', 'عرض', 'وريني', 'go', 'open', 'navigate', 'show', 'view'].some(kw => query.includes(kw));
  if (hasNavKeyword) {
    for (const m of navModules) {
      if (m.keywords.some(kw => query.includes(kw))) {
        return {
          type: 'action',
          message: `Navigating to ${m.nameEn} module`,
          messageAr: `جارٍ الانتقال إلى شاشة ${m.nameAr}`,
          action: {
            type: 'NAVIGATE',
            data: { module: m.module },
            message: `Navigate to ${m.nameEn}`,
            messageAr: `الانتقال إلى ${m.nameAr}`
          }
        };
      }
    }
  }

  // 2. ADD ITEM
  // e.g. "اضف صنف كوكا كولا بسعر 10" or "add item Pepsi price 5"
  const addItemKeywords = ['اضف صنف', 'اضافة صنف', 'سجل صنف', 'جديد صنف', 'منتج جديد', 'اضف منتج', 'اضافة منتج', 'add item', 'add product', 'new item'];
  if (addItemKeywords.some(kw => query.includes(kw))) {
    let clean = text;
    for (const kw of addItemKeywords) {
      const idx = clean.toLowerCase().indexOf(kw);
      if (idx !== -1) {
        clean = clean.substring(idx + kw.length);
        break;
      }
    }
    clean = clean.trim();

    let salePrice = 0;
    let purchasePrice = 0;
    
    const saleMatch = clean.match(/(?:سعر بيع|بيع|سعر|بيع بسعر|سعر المبيع|sale|price)\s*(\d+(?:\.\d+)?)/i) || clean.match(/(?:بسعر|at)\s*(\d+(?:\.\d+)?)/i);
    const purchaseMatch = clean.match(/(?:سعر شراء|شراء|شراء بسعر|purchase|buy)\s*(\d+(?:\.\d+)?)/i);

    if (saleMatch) {
      salePrice = parseFloat(saleMatch[1]);
    }
    if (purchaseMatch) {
      purchasePrice = parseFloat(purchaseMatch[1]);
    } else if (salePrice > 0) {
      purchasePrice = Math.round(salePrice * 0.7 * 100) / 100;
    }

    const barcodeMatch = clean.match(/(?:باركود|رقم باركود|كود|barcode|code)\s*(\w+)/i);
    const barcode = barcodeMatch ? barcodeMatch[1] : '';

    const quantityMatch = clean.match(/(?:كمية|عدد|مخزون|كميه|quantity|stock|qty)\s*(\d+)/i);
    const quantity = quantityMatch ? parseInt(quantityMatch[1], 10) : 0;

    let name = clean
      .replace(/(?:سعر بيع|بيع|سعر المبيع|سعر|بيع بسعر|price|sale price)\s*\d+(?:\.\d+)?/gi, '')
      .replace(/(?:بسعر|at)\s*\d+(?:\.\d+)?/gi, '')
      .replace(/(?:سعر شراء|شراء|شراء بسعر|purchase|buy)\s*\d+(?:\.\d+)?/gi, '')
      .replace(/(?:باركود|رقم باركود|كود|barcode|code)\s*\w+/gi, '')
      .replace(/(?:كمية|عدد|مخزون|كميه|quantity|stock|qty)\s*\d+/gi, '')
      .replace(/[،,.]/g, '')
      .trim();

    if (!name) {
      name = 'صنف غير مسمى';
    }

    return {
      type: 'action',
      message: `Adding new item: ${name} (Price: ${salePrice})`,
      messageAr: `إضافة صنف جديد: ${name} (بسعر: ${salePrice})`,
      action: {
        type: 'ADD_ITEM',
        data: {
          name: name,
          nameAr: name,
          salePrice: salePrice,
          purchasePrice: purchasePrice,
          wholesalePrice: Math.round(salePrice * 0.9 * 100) / 100,
          stockQuantity: quantity,
          barcode: barcode || `AI-${Date.now()}`
        },
        message: `Add new product ${name}`,
        messageAr: `إضافة الصنف الجديد ${name}`
      }
    };
  }

  // 3. ADD CUSTOMER
  // e.g. "اضف عميل اسمه احمد تليفون 0102030" or "add customer Ali phone 012"
  const addCustomerKeywords = ['اضف عميل', 'اضافة عميل', 'سجل عميل', 'عميل جديد', 'تنزيل عميل', 'add customer', 'new customer'];
  if (addCustomerKeywords.some(kw => query.includes(kw))) {
    let clean = text;
    for (const kw of addCustomerKeywords) {
      const idx = clean.toLowerCase().indexOf(kw);
      if (idx !== -1) {
        clean = clean.substring(idx + kw.length);
        break;
      }
    }
    clean = clean.trim();

    const phoneMatch = clean.match(/(?:تليفون|تلفون|رقم|موبايل|هاتف|هاتف رقم|phone|mobile|tel)\s*(\d+)/i) || clean.match(/(\d{7,15})/);
    const phone = phoneMatch ? phoneMatch[1] : '';

    let name = clean
      .replace(/(?:تليفون|تلفون|رقم|موبايل|هاتف|هاتف رقم|phone|mobile|tel)\s*\d+/gi, '')
      .replace(/(\d{7,15})/g, '')
      .replace(/(?:اسمه|اسم|name)\s*/gi, '')
      .replace(/[،,.]/g, '')
      .trim();

    if (!name) name = 'عميل جديد';

    return {
      type: 'action',
      message: `Adding customer: ${name} (Phone: ${phone})`,
      messageAr: `إضافة عميل جديد: ${name} (هاتف: ${phone})`,
      action: {
        type: 'ADD_CUSTOMER',
        data: { name, nameAr: name, phone, email: '', address: '' },
        message: `Add customer ${name}`,
        messageAr: `إضافة العميل ${name}`
      }
    };
  }

  // 4. ADD SUPPLIER
  // e.g. "اضف مورد اسمه شركة الامل تليفون 0102030"
  const addSupplierKeywords = ['اضف مورد', 'اضافة مورد', 'سجل مورد', 'مورد جديد', 'تنزيل مورد', 'add supplier', 'new supplier'];
  if (addSupplierKeywords.some(kw => query.includes(kw))) {
    let clean = text;
    for (const kw of addSupplierKeywords) {
      const idx = clean.toLowerCase().indexOf(kw);
      if (idx !== -1) {
        clean = clean.substring(idx + kw.length);
        break;
      }
    }
    clean = clean.trim();

    const phoneMatch = clean.match(/(?:تليفون|تلفون|رقم|موبايل|هاتف|هاتف رقم|phone|mobile|tel)\s*(\d+)/i) || clean.match(/(\d{7,15})/);
    const phone = phoneMatch ? phoneMatch[1] : '';

    let name = clean
      .replace(/(?:تليفون|تلفون|رقم|موبايل|هاتف|هاتف رقم|phone|mobile|tel)\s*\d+/gi, '')
      .replace(/(\d{7,15})/g, '')
      .replace(/(?:اسمه|اسم|name)\s*/gi, '')
      .replace(/[،,.]/g, '')
      .trim();

    if (!name) name = 'مورد جديد';

    return {
      type: 'action',
      message: `Adding supplier: ${name} (Phone: ${phone})`,
      messageAr: `إضافة مورد جديد: ${name} (هاتف: ${phone})`,
      action: {
        type: 'ADD_SUPPLIER',
        data: { name, nameAr: name, phone, email: '', address: '' },
        message: `Add supplier ${name}`,
        messageAr: `إضافة المورد ${name}`
      }
    };
  }

  // 5. ADD TRANSACTION (TREASURY)
  // e.g. "اضف مصروف 500 جنيه كهرباء" or "سجل ايراد 1000 مبيعات"
  const addTxKeywords = ['اضف مصروف', 'سجل مصروف', 'مصروف جديد', 'مصاريف', 'اضف ايراد', 'سجل ايراد', 'ايراد جديد', 'اضافة معاملة', 'add transaction', 'add expense', 'add income'];
  if (addTxKeywords.some(kw => query.includes(kw))) {
    const isExpense = query.includes('مصروف') || query.includes('مصاريف') || query.includes('expense');
    
    const amountMatch = text.match(/(\d+(?:\.\d+)?)/);
    const amount = amountMatch ? parseFloat(amountMatch[1]) : 0;

    let desc = text
      .replace(/(?:اضف مصروف|سجل مصروف|مصروف جديد|مصاريف|اضف ايراد|سجل ايراد|ايراد جديد|اضافة معاملة|add transaction|add expense|add income)/gi, '')
      .replace(/\d+(?:\.\d+)?/g, '')
      .replace(/(?:جنيه|ريال|دولار|egp|usd|sar)/gi, '')
      .replace(/[،,.]/g, '')
      .trim();

    if (!desc) desc = isExpense ? 'مصروفات عامة' : 'إيرادات عامة';

    return {
      type: 'action',
      message: `Adding ${isExpense ? 'expense' : 'income'} of ${amount}: ${desc}`,
      messageAr: `إضافة ${isExpense ? 'مصروف' : 'إيراد'} بقيمة ${amount}: ${desc}`,
      action: {
        type: 'ADD_TRANSACTION',
        data: {
          type: isExpense ? 'expense' : 'income',
          amount,
          description: desc,
          category: isExpense ? 'Utilities' : 'Sales'
        },
        message: `Add ${isExpense ? 'expense' : 'income'} of ${amount} for ${desc}`,
        messageAr: `إضافة ${isExpense ? 'مصروف' : 'إيراد'} بقيمة ${amount} لـ ${desc}`
      }
    };
  }

  // 6. ADD EMPLOYEE
  // e.g. "اضف موظف اسمه احمد براتب 3000 محاسب"
  const addEmpKeywords = ['اضف موظف', 'اضافة موظف', 'سجل موظف', 'موظف جديد', 'add employee', 'new employee'];
  if (addEmpKeywords.some(kw => query.includes(kw))) {
    let clean = text;
    for (const kw of addEmpKeywords) {
      const idx = clean.toLowerCase().indexOf(kw);
      if (idx !== -1) {
        clean = clean.substring(idx + kw.length);
        break;
      }
    }
    clean = clean.trim();

    const salaryMatch = clean.match(/(?:راتب|براتب|مرتب|salary)\s*(\d+)/i);
    const salary = salaryMatch ? parseFloat(salaryMatch[1]) : 0;

    const phoneMatch = clean.match(/(?:تليفون|تلفون|رقم|phone)\s*(\d+)/i);
    const phone = phoneMatch ? phoneMatch[1] : '';

    let jobTitle = '';
    const jobKeywords = ['محاسب', 'كاشير', 'مدير', 'بائع', 'حارس', 'عامل', 'سائق', 'موظف', 'accountant', 'cashier', 'manager', 'salesman'];
    for (const jk of jobKeywords) {
      if (clean.includes(jk)) {
        jobTitle = jk;
        break;
      }
    }

    let name = clean
      .replace(/(?:راتب|براتب|مرتب|salary)\s*\d+/gi, '')
      .replace(/(?:تليفون|تلفون|رقم|phone)\s*\d+/gi, '')
      .replace(new RegExp(jobTitle, 'gi'), '')
      .replace(/(?:اسمه|اسم|name)\s*/gi, '')
      .replace(/[،,.]/g, '')
      .trim();

    if (!name) name = 'موظف جديد';

    return {
      type: 'action',
      message: `Adding employee: ${name} (Salary: ${salary})`,
      messageAr: `إضافة موظف جديد: ${name} (براتب: ${salary})`,
      action: {
        type: 'ADD_EMPLOYEE',
        data: { name, nameAr: name, phone, salary, jobTitle, department: jobTitle ? 'Administration' : '' },
        message: `Add employee ${name}`,
        messageAr: `إضافة الموظف ${name}`
      }
    };
  }

  return null;
}

/**
 * Provides responses for general queries related to current AppState when Gemini is offline.
 */
export function handleOfflineQuery(query: string, state: AppState): AIResponse {
  const q = query.toLowerCase();
  const items = state.items || [];
  const customers = state.customers || [];
  const suppliers = state.suppliers || [];
  const salesInvoices = state.salesInvoices || [];
  const purchaseInvoices = state.purchaseInvoices || [];

  const totalItems = items.length;
  const lowStock = items.filter(i => i.stockQuantity > 0 && i.stockQuantity <= i.minStockLevel).length;
  const outOfStock = items.filter(i => i.stockQuantity === 0).length;
  const totalCustomers = customers.length;
  const totalSuppliers = suppliers.length;
  const totalSales = salesInvoices.reduce((sum, inv) => sum + inv.total, 0);
  const totalPurchases = purchaseInvoices.reduce((sum, inv) => sum + inv.total, 0);
  const totalProfit = totalSales - totalPurchases;
  const totalCustomerDebt = customers.reduce((sum, c) => sum + c.balance, 0);
  const totalSupplierDebt = suppliers.reduce((sum, s) => sum + s.balance, 0);

  if (q.includes('مبيعات') || q.includes('بيع') || q.includes('sales')) {
    return {
      type: 'question',
      message: `Total sales is ${totalSales.toLocaleString()} EGP across ${salesInvoices.length} invoices.`,
      messageAr: `إجمالي المبيعات هو ${totalSales.toLocaleString()} جنيه عبر ${salesInvoices.length} فاتورة مبيعات.`
    };
  }
  
  if (q.includes('مشتريات') || q.includes('شراء') || q.includes('purchases')) {
    return {
      type: 'question',
      message: `Total purchases is ${totalPurchases.toLocaleString()} EGP across ${purchaseInvoices.length} invoices.`,
      messageAr: `إجمالي المشتريات هو ${totalPurchases.toLocaleString()} جنيه عبر ${purchaseInvoices.length} فاتورة مشتريات.`
    };
  }

  if (q.includes('ارباح') || q.includes('أرباح') || q.includes('ربح') || q.includes('profit')) {
    return {
      type: 'question',
      message: `Total net profit is ${totalProfit.toLocaleString()} EGP (Sales: ${totalSales.toLocaleString()}, Purchases: ${totalPurchases.toLocaleString()}).`,
      messageAr: `إجمالي صافي الأرباح هو ${totalProfit.toLocaleString()} جنيه (المبيعات: ${totalSales.toLocaleString()}، المشتريات: ${totalPurchases.toLocaleString()}).`
    };
  }

  if (q.includes('مخزن') || q.includes('مخزون') || q.includes('اصناف') || q.includes('أصناف') || q.includes('منتجات') || q.includes('inventory') || q.includes('stock')) {
    return {
      type: 'question',
      message: `Inventory status: ${totalItems} total items, ${lowStock} low stock, ${outOfStock} out of stock.`,
      messageAr: `حالة المخزن: إجمالي الأصناف ${totalItems} صنف، منها ${lowStock} منخفض المخزون، و ${outOfStock} نفذت تماماً.`
    };
  }

  if (q.includes('ديون') || q.includes('مديونية') || q.includes('مستحقات') || q.includes('debt')) {
    return {
      type: 'question',
      message: `Outstanding debts: Customers owe you ${totalCustomerDebt.toLocaleString()} EGP. You owe suppliers ${totalSupplierDebt.toLocaleString()} EGP.`,
      messageAr: `المديونيات المستحقة: العملاء يدينون لك بـ ${totalCustomerDebt.toLocaleString()} جنيه. وأنت تدين للموردين بـ ${totalSupplierDebt.toLocaleString()} جنيه.`
    };
  }

  if (q.includes('عميل') || q.includes('عملاء') || q.includes('customers')) {
    return {
      type: 'question',
      message: `You have ${totalCustomers} customers registered. Total customer balance is ${totalCustomerDebt.toLocaleString()} EGP.`,
      messageAr: `لديك ${totalCustomers} عميل مسجل. إجمالي مستحقاتك لدى العملاء هو ${totalCustomerDebt.toLocaleString()} جنيه.`
    };
  }

  if (q.includes('مورد') || q.includes('موردين') || q.includes('suppliers')) {
    return {
      type: 'question',
      message: `You have ${totalSuppliers} suppliers registered. Total supplier debt is ${totalSupplierDebt.toLocaleString()} EGP.`,
      messageAr: `لديك ${totalSuppliers} مورد مسجل. إجمالي ديونك للموردين هو ${totalSupplierDebt.toLocaleString()} جنيه.`
    };
  }

  return {
    type: 'question',
    message: `[Offline Mode] Could not connect to Gemini API. Please check your API key in Settings. You can still use commands to navigate, add items, customers, or query stats.`,
    messageAr: `[وضع العمل المحلي / بدون اتصال]: تعذر الاتصال بـ Gemini API (يرجى التحقق من المفتاح في الإعدادات). يمكنك سؤالي محلياً عن إحصائيات المخزن، المبيعات، الأرباح، الديون، أو طلب فتح شاشة معينة أو إضافة أصناف/عملاء.`
  };
}
