// ============================================================
// Easy Store ERP - خدمة المخازن والتحويلات (Warehouse & Stock Transfers - v2)
// ------------------------------------------------------------
// - إدارة المخازن المتعددة (Warehouses).
// - التحويل بين المخازن (Stock Transfers).
// - تجميع وتفكيك الأصناف المركبة (Bundles Assembly / Disassembly).
// - جرد الأصناف بالباركود مع تسجيل أسباب التسوية والتكامل مع Audit Log.
// ============================================================

import type { AppState, Item } from '@/types';
import { generateId } from '@/db';

export interface Warehouse {
  id: string;
  name: string;
  nameAr: string;
  code: string;
  address?: string;
  isMain: boolean;
  isActive: boolean;
  createdAt: string;
}

export interface StockByWarehouse {
  warehouseId: string;
  quantity: number;
}

export interface ExtendedItem extends Item {
  stockByWarehouse?: StockByWarehouse[];
  serials?: string[];
}

export interface StockTransfer {
  id: string;
  transferNumber: string;
  fromWarehouseId: string;
  toWarehouseId: string;
  items: Array<{
    itemId: string;
    quantity: number;
    serialNumbers?: string[];
  }>;
  notes?: string;
  date: string;
  createdAt: string;
  createdBy: string;
}

export interface BundleAssembly {
  id: string;
  parentItemId: string;
  warehouseId: string;
  assemblyQuantity: number;
  type: 'assemble' | 'disassemble';
  components: Array<{
    itemId: string;
    quantityPerUnit: number;
    totalQuantity: number;
  }>;
  date: string;
  createdAt: string;
  createdBy: string;
}

// المخزن الرئيسي الافتراضي
export const MAIN_WAREHOUSE_ID = 'wh-main';

export function getDefaultWarehouses(): Warehouse[] {
  return [
    {
      id: MAIN_WAREHOUSE_ID,
      name: 'Main Warehouse',
      nameAr: 'المخزن الرئيسي',
      code: 'WH-01',
      isMain: true,
      isActive: true,
      createdAt: new Date().toISOString(),
    },
  ];
}

// ============================================================
// تحويلات المخزون وتحديث الكميات حسب المخزن
// ============================================================
export function processStockTransfer(
  state: AppState,
  transfer: Omit<StockTransfer, 'id' | 'transferNumber' | 'createdAt'>
): { updatedState: AppState; transferRecord: StockTransfer } {
  const newTransfer: StockTransfer = {
    ...transfer,
    id: generateId('trf'),
    transferNumber: `TRF-${Date.now().toString().slice(-6)}`,
    createdAt: new Date().toISOString(),
  };

  const updatedItems = state.items.map(item => {
    const transferItem = transfer.items.find(i => i.itemId === item.id);
    if (!transferItem) return item;

    const extItem = item as ExtendedItem;
    const currentWhList = extItem.stockByWarehouse || [
      { warehouseId: MAIN_WAREHOUSE_ID, quantity: item.stockQuantity },
    ];

    const fromWh = currentWhList.find(w => w.warehouseId === transfer.fromWarehouseId);
    const toWh = currentWhList.find(w => w.warehouseId === transfer.toWarehouseId);

    const fromQty = (fromWh?.quantity ?? 0) - transferItem.quantity;
    const toQty = (toWh?.quantity ?? 0) + transferItem.quantity;

    const nextWhList = currentWhList
      .filter(w => w.warehouseId !== transfer.fromWarehouseId && w.warehouseId !== transfer.toWarehouseId)
      .concat([
        { warehouseId: transfer.fromWarehouseId, quantity: Math.max(0, fromQty) },
        { warehouseId: transfer.toWarehouseId, quantity: toQty },
      ]);

    return {
      ...item,
      stockByWarehouse: nextWhList,
    };
  });

  return {
    updatedState: {
      ...state,
      items: updatedItems,
    },
    transferRecord: newTransfer,
  };
}

// ============================================================
// تجميع وتفكيك الأصناف المركبة (Assemble / Disassemble)
// ============================================================
export function processBundleAssembly(
  state: AppState,
  params: Omit<BundleAssembly, 'id' | 'createdAt'>
): { updatedState: AppState; assemblyRecord: BundleAssembly } {
  const record: BundleAssembly = {
    ...params,
    id: generateId('asm'),
    createdAt: new Date().toISOString(),
  };

  const isAssemble = params.type === 'assemble';

  const updatedItems = state.items.map(item => {
    // 1. زيادة/نقصان الصنف التجميعي الرئيسي
    if (item.id === params.parentItemId) {
      const delta = isAssemble ? params.assemblyQuantity : -params.assemblyQuantity;
      return {
        ...item,
        stockQuantity: Math.max(0, item.stockQuantity + delta),
      };
    }

    // 2. نقصان/زيادة المكونات الداخلية
    const component = params.components.find(c => c.itemId === item.id);
    if (component) {
      const delta = isAssemble ? -component.totalQuantity : component.totalQuantity;
      return {
        ...item,
        stockQuantity: Math.max(0, item.stockQuantity + delta),
      };
    }

    return item;
  });

  return {
    updatedState: {
      ...state,
      items: updatedItems,
    },
    assemblyRecord: record,
  };
}
