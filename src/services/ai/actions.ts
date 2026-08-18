import type { AIAction, AIActionType } from '@/types/ai';
import type { Item, Supplier, Customer, Transaction, Employee, PurchaseInvoice, PurchaseItem, SaleInvoice, SaleItem, PaymentMethod } from '@/types';

export interface ActionExecutionResult {
  success: boolean;
  message: string;
  payload?: unknown;
}

export type ActionDispatcher = (action: {
  type: string;
  payload: unknown;
}) => void;

const getNextId = (prefix: string, items: { id: string }[]): string => {
  const maxNum = items.reduce((max, item) => {
    const num = parseInt(item.id.replace(`${prefix}-`, ''), 10);
    return isNaN(num) ? max : Math.max(max, num);
  }, 0);
  return `${prefix}-${maxNum + 1}`;
};

const actionHandlers: Record<
  AIActionType,
  (data: Record<string, unknown>, dispatch: ActionDispatcher, context: unknown) => ActionExecutionResult
> = {
  ADD_ITEM: (data, dispatch, context) => {
    const { items } = context as { items: Item[] };
    const newItem: Item = {
      id: getNextId('item', items),
      barcode: (data.barcode as string) || `AI-${Date.now()}`,
      barcodes: [],
      subUnits: [],
      name: data.name as string || '',
      nameAr: data.nameAr as string || data.name as string || '',
      categoryId: data.categoryId as string || '',
      unit: (data.unit as string) || 'piece',
      purchasePrice: Number(data.purchasePrice) || 0,
      salePrice: Number(data.salePrice) || 0,
      wholesalePrice: Number(data.wholesalePrice) || 0,
      stockQuantity: Number(data.stockQuantity) || 0,
      minStockLevel: Number(data.minStockLevel) || 0,
      description: (data.description as string) || '',
      isActive: true,
      createdAt: new Date().toISOString(),
    };
    dispatch({ type: 'ADD_ITEM', payload: newItem });
    return { success: true, message: `Item '${newItem.name}' added`, payload: newItem };
  },

  UPDATE_ITEM: (data, dispatch, context) => {
    const { items } = context as { items: Item[] };
    const itemId = data.id as string;
    const existing = items.find(i => i.id === itemId);
    if (!existing) return { success: false, message: `Item '${itemId}' not found` };
    const updated = { ...existing, ...data, id: itemId };
    dispatch({ type: 'UPDATE_ITEM', payload: updated });
    return { success: true, message: `Item '${updated.name}' updated`, payload: updated };
  },

  ADD_SUPPLIER: (data, dispatch, context) => {
    const { suppliers } = context as { suppliers: Supplier[] };
    const newSupplier: Supplier = {
      id: getNextId('sup', suppliers),
      name: data.name as string || '',
      nameAr: data.nameAr as string || data.name as string || '',
      phone: (data.phone as string) || '',
      email: (data.email as string) || '',
      address: (data.address as string) || '',
      balance: 0,
      isActive: true,
      createdAt: new Date().toISOString(),
    };
    dispatch({ type: 'ADD_SUPPLIER', payload: newSupplier });
    return { success: true, message: `Supplier '${newSupplier.name}' added`, payload: newSupplier };
  },

  ADD_CUSTOMER: (data, dispatch, context) => {
    const { customers } = context as { customers: Customer[] };
    const newCustomer: Customer = {
      id: getNextId('cust', customers),
      name: data.name as string || '',
      nameAr: data.nameAr as string || data.name as string || '',
      phone: (data.phone as string) || '',
      email: (data.email as string) || '',
      address: (data.address as string) || '',
      creditLimit: Number(data.creditLimit) || 0,
      balance: 0,
      isActive: true,
      createdAt: new Date().toISOString(),
    };
    dispatch({ type: 'ADD_CUSTOMER', payload: newCustomer });
    return { success: true, message: `Customer '${newCustomer.name}' added`, payload: newCustomer };
  },

  CREATE_PURCHASE: (data, dispatch, context) => {
    const ctx = context as { items: Item[] };
    const workingItems = [...ctx.items];
    const createdItems: Item[] = [];

    const rawLines = (data.items as Record<string, unknown>[]) || [];
    if (!Array.isArray(rawLines) || rawLines.length === 0) {
      return { success: false, message: 'No items specified for the purchase' };
    }

    const purchaseItems: PurchaseItem[] = [];
    for (const line of rawLines) {
      const lineName = ((line.name || line.itemName || line.nameAr) as string) || '';
      let item = workingItems.find(i =>
        (line.itemId && i.id === line.itemId) ||
        (!!lineName && (i.name.toLowerCase() === lineName.toLowerCase() || i.nameAr === lineName))
      );
      const unitPrice = Number(line.unitPrice ?? line.purchasePrice) || (item ? item.purchasePrice : 0);
      if (!item) {
        const newItem: Item = {
          id: getNextId('item', workingItems),
          barcode: (line.barcode as string) || `AI-${Date.now()}-${workingItems.length}`,
          barcodes: [],
          subUnits: [],
          name: lineName,
          nameAr: (line.nameAr as string) || lineName,
          categoryId: (line.categoryId as string) || '',
          unit: (line.unit as string) || 'piece',
          purchasePrice: Number(line.purchasePrice ?? line.unitPrice) || 0,
          salePrice: Number(line.salePrice) || 0,
          wholesalePrice: Number(line.wholesalePrice) || 0,
          stockQuantity: 0,
          minStockLevel: Number(line.minStockLevel) || 0,
          description: '',
          isActive: true,
          createdAt: new Date().toISOString(),
        };
        dispatch({ type: 'ADD_ITEM', payload: newItem });
        workingItems.push(newItem);
        createdItems.push(newItem);
        item = newItem;
      }
      const qty = Number(line.quantity) || 0;
      purchaseItems.push({
        itemId: item.id,
        itemName: item.name,
        quantity: qty,
        unitPrice,
        discount: 0,
        total: qty * unitPrice,
      });
    }

    const subtotal = purchaseItems.reduce((s, l) => s + l.total, 0);
    const discount = Number(data.discount) || 0;
    const shippingCost = Number(data.shippingCost) || 0;
    const total = subtotal - discount + shippingCost;
    const paid = data.paid !== undefined ? Number(data.paid) : total;
    const remaining = total - paid;

    const invoice: PurchaseInvoice = {
      id: `pur-${Date.now()}`,
      invoiceNumber: `PUR-${Date.now()}`,
      supplierId: (data.supplierId as string) || '',
      supplierName: (data.supplierName as string) || 'مورد نقدي',
      items: purchaseItems,
      subtotal,
      discount,
      shippingCost,
      total,
      paid,
      remaining,
      paymentStatus: remaining <= 0 ? 'paid' : (paid > 0 ? 'partial' : 'unpaid'),
      notes: (data.notes as string) || 'أُنشئت بواسطة المساعد الذكي',
      extraCharges: [],
      createdAt: new Date().toISOString(),
      createdBy: 'AI Assistant',
    };
    dispatch({ type: 'ADD_PURCHASE', payload: invoice });
    const names = purchaseItems.map(l => `${l.itemName} (${l.quantity})`).join(', ');
    return { success: true, message: `Purchase created & stock updated: ${names}`, payload: { invoice, createdItems } };
  },

  CREATE_SALE: (data, dispatch, context) => {
    const ctx = context as { items: Item[] };
    const workingItems = [...ctx.items];

    const rawLines = (data.items as Record<string, unknown>[]) || [];
    if (!Array.isArray(rawLines) || rawLines.length === 0) {
      return { success: false, message: 'No items specified for the sale' };
    }

    const saleItems: SaleItem[] = [];
    for (const line of rawLines) {
      const lineName = ((line.name || line.itemName || line.nameAr) as string) || '';
      const item = workingItems.find(i =>
        (line.itemId && i.id === line.itemId) ||
        (!!lineName && (i.name.toLowerCase() === lineName.toLowerCase() || i.nameAr === lineName))
      );
      if (!item) {
        return { success: false, message: `Item not found for sale: ${lineName}` };
      }
      const qty = Number(line.quantity) || 0;
      const unitPrice = Number(line.unitPrice ?? line.salePrice) || item.salePrice;
      saleItems.push({
        itemId: item.id,
        itemName: item.name,
        quantity: qty,
        unitPrice,
        discount: 0,
        total: qty * unitPrice,
      });
    }

    const subtotal = saleItems.reduce((s, l) => s + l.total, 0);
    const discount = Number(data.discount) || 0;
    const total = subtotal - discount;
    const paid = data.paid !== undefined ? Number(data.paid) : total;
    const remaining = total - paid;

    const invoice: SaleInvoice = {
      id: `sale-${Date.now()}`,
      invoiceNumber: `INV-${Date.now()}`,
      customerId: (data.customerId as string) || null,
      customerName: (data.customerName as string) || 'عميل نقدي',
      items: saleItems,
      subtotal,
      discount,
      total,
      paid,
      remaining,
      paymentMethod: (data.paymentMethod as PaymentMethod) || 'cash',
      paymentStatus: remaining <= 0 ? 'paid' : (paid > 0 ? 'partial' : 'unpaid'),
      notes: (data.notes as string) || 'أُنشئت بواسطة المساعد الذكي',
      extraCharges: [],
      createdAt: new Date().toISOString(),
      createdBy: 'AI Assistant',
    };
    dispatch({ type: 'ADD_SALE', payload: invoice });
    const names = saleItems.map(l => `${l.itemName} (${l.quantity})`).join(', ');
    return { success: true, message: `Sale created & stock updated: ${names}`, payload: { invoice } };
  },

  ADD_TRANSACTION: (data, dispatch, context) => {
    const { treasuryAccounts } = context as { treasuryAccounts: { id: string; name: string; type: string; balance: number }[] };
    const accountId = data.accountId as string;
    const account = accountId ? treasuryAccounts.find(a => a.id === accountId) : treasuryAccounts.find(a => a.type === 'safe');
    if (!account) return { success: false, message: 'No treasury account found' };
    const newTransaction: Transaction = {
      id: `tr-${Date.now()}`,
      accountId: account.id,
      accountName: account.name,
      type: (data.type as 'income' | 'expense') || 'income',
      amount: Number(data.amount) || 0,
      description: (data.description as string) || '',
      referenceNumber: `AI-${Date.now()}`,
      category: (data.category as string) || 'Other',
      date: new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
      createdBy: 'AI Assistant',
    };
    dispatch({ type: 'ADD_TRANSACTION', payload: newTransaction });
    return { success: true, message: `Transaction added: ${newTransaction.description}`, payload: newTransaction };
  },

  ADD_EMPLOYEE: (data, dispatch, context) => {
    const { employees } = context as { employees: Employee[] };
    const newEmployee: Employee = {
      id: getNextId('emp', employees),
      employeeNumber: `EMP-${Date.now()}`,
      name: data.name as string || '',
      nameAr: data.nameAr as string || data.name as string || '',
      phone: (data.phone as string) || '',
      email: (data.email as string) || '',
      address: (data.address as string) || '',
      jobTitle: (data.jobTitle as string) || '',
      department: (data.department as string) || '',
      hireDate: new Date().toISOString().split('T')[0],
      salary: Number(data.salary) || 0,
      commissionRate: Number(data.commissionRate) || 0,
      isActive: true,
      createdAt: new Date().toISOString(),
    };
    dispatch({ type: 'ADD_EMPLOYEE', payload: newEmployee });
    return { success: true, message: `Employee '${newEmployee.name}' added`, payload: newEmployee };
  },

  GENERATE_REPORT: () => {
    return { success: false, message: 'Navigate to Reports page to view detailed reports' };
  },

  NAVIGATE: (data) => {
    const module = data.module as string;
    if (module) {
      return { success: true, message: `Navigating to ${module}`, payload: { navigate: module } };
    }
    return { success: false, message: 'No target module specified' };
  },
};

export function executeAction(
  action: AIAction,
  dispatch: ActionDispatcher,
  context: unknown
): ActionExecutionResult {
  const handler = actionHandlers[action.type];
  if (!handler) {
    return { success: false, message: `Unknown action type: ${action.type}` };
  }
  return handler(action.data, dispatch, context);
}

interface PlanWorkingContext {
  items: Item[];
  suppliers: Supplier[];
  customers: Customer[];
  employees: Employee[];
  treasuryAccounts: { id: string; name: string; type: string; balance: number }[];
  [key: string]: unknown;
}

export interface PlanStepResult extends ActionExecutionResult {
  action: AIAction;
}

// تنفيذ خطة متعددة الخطوات بالترتيب مع تمرير العناصر المُنشأة للخطوات التالية
export function executeActionPlan(
  actions: AIAction[],
  dispatch: ActionDispatcher,
  context: unknown
): { results: PlanStepResult[]; navigate?: string } {
  const ctx = context as PlanWorkingContext;
  const working: PlanWorkingContext = {
    ...ctx,
    items: [...(ctx.items || [])],
    suppliers: [...(ctx.suppliers || [])],
    customers: [...(ctx.customers || [])],
    employees: [...(ctx.employees || [])],
    treasuryAccounts: [...(ctx.treasuryAccounts || [])],
  };

  const results: PlanStepResult[] = [];
  let navigate: string | undefined;

  for (const action of actions) {
    const result = executeAction(action, dispatch, working);
    results.push({ ...result, action });

    if (result.success && result.payload) {
      const payload = result.payload as Record<string, unknown>;
      switch (action.type) {
        case 'ADD_ITEM':
          working.items.push(payload as unknown as Item);
          break;
        case 'ADD_SUPPLIER':
          working.suppliers.push(payload as unknown as Supplier);
          break;
        case 'ADD_CUSTOMER':
          working.customers.push(payload as unknown as Customer);
          break;
        case 'ADD_EMPLOYEE':
          working.employees.push(payload as unknown as Employee);
          break;
        case 'CREATE_PURCHASE':
          if (Array.isArray(payload.createdItems)) {
            working.items.push(...(payload.createdItems as Item[]));
          }
          break;
        case 'NAVIGATE':
          if (payload.navigate) navigate = payload.navigate as string;
          break;
      }
    }
  }

  return { results, navigate };
}
