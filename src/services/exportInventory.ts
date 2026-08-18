// ============================================================
// Easy Store ERP — تصدير الجرد إلى Excel
// Read-only: لا يعدّل أي بيانات في قاعدة البيانات
// ============================================================
import * as XLSX from 'xlsx';
import type { Item, Category } from '@/types';

export interface InventoryExportOptions {
  items: Item[];
  categories: Category[];
  currencySymbol?: string;
  isRTL?: boolean;
}

/**
 * تصدير الأصناف إلى ملف Excel (.xlsx) محلي
 * القيود: read-only — لا يعدّل البيانات الفعلية
 */
export function exportInventoryToExcel({
  items,
  categories,
  currencySymbol = '',
  isRTL = true,
}: InventoryExportOptions): void {
  const getCategoryName = (catId: string) => {
    const cat = categories.find((c) => c.id === catId);
    return isRTL ? (cat?.nameAr || cat?.name || 'بدون فئة') : (cat?.name || cat?.nameAr || 'Uncategorized');
  };

  // بناء صفوف Excel
  const rows = items.map((item, index) => ({
    '#': index + 1,
    'الكود / Code': item.barcode || item.id.split('-')[0],
    'اسم الصنف (AR) / Item Name': item.nameAr || item.name,
    'Item Name (EN)': item.name,
    'الفئة / Category': getCategoryName(item.categoryId),
    'الوحدة / Unit': item.unit,
    'الكمية / Qty': item.stockQuantity,
    'الحد الأدنى / Min Stock': item.minStockLevel,
    [`سعر الشراء / Purchase Price (${currencySymbol})`]: item.purchasePrice,
    [`سعر البيع / Sale Price (${currencySymbol})`]: item.salePrice,
    [`سعر الجملة / Wholesale Price (${currencySymbol})`]: item.wholesalePrice,
    [`قيمة المخزون / Stock Value (${currencySymbol})`]:
      +(item.purchasePrice * item.stockQuantity).toFixed(2),
    'الحالة / Status': item.isActive ? 'نشط / Active' : 'غير نشط / Inactive',
    'تاريخ الإضافة / Created At': new Date(item.createdAt).toLocaleDateString('ar-EG'),
  }));

  const ws = XLSX.utils.json_to_sheet(rows);

  // ضبط عرض الأعمدة تلقائياً
  const colWidths = Object.keys(rows[0] || {}).map((key) => ({
    wch: Math.max(key.length, 15),
  }));
  ws['!cols'] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, isRTL ? 'جرد الأصناف' : 'Inventory');

  // ملف ملخص في ورقة ثانية
  const summaryRows = [
    { 'البيان / Item': 'إجمالي الأصناف / Total Items', 'القيمة / Value': items.length },
    {
      'البيان / Item': 'إجمالي قيمة المخزون (تكلفة) / Total Stock Value (Cost)',
      'القيمة / Value': +items.reduce((s, i) => s + i.purchasePrice * i.stockQuantity, 0).toFixed(2),
    },
    {
      'البيان / Item': 'إجمالي قيمة المخزون (بيع) / Total Stock Value (Retail)',
      'القيمة / Value': +items.reduce((s, i) => s + i.salePrice * i.stockQuantity, 0).toFixed(2),
    },
    {
      'البيان / Item': 'أصناف منخفضة المخزون / Low Stock Items',
      'القيمة / Value': items.filter((i) => i.stockQuantity > 0 && i.stockQuantity <= i.minStockLevel).length,
    },
    {
      'البيان / Item': 'أصناف نفد مخزونها / Out of Stock',
      'القيمة / Value': items.filter((i) => i.stockQuantity === 0).length,
    },
  ];
  const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
  XLSX.utils.book_append_sheet(wb, wsSummary, isRTL ? 'ملخص' : 'Summary');

  const fileName = `inventory_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, fileName);
}
