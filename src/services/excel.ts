// ============================================================
// Easy Store ERP - استيراد/تصدير Excel (Import/Export)
// ------------------------------------------------------------
// مستورد/مصدّر للأصناف/العملاء/الموردين عبر مكتبة xlsx (مثبّتة).
// الميزات:
//  - تصدير البيانات الحالية إلى ملف .xlsx مع قوالب جاهزة.
//  - استيراد من .xlsx مع تعيين أعمدة مرن (أسماء عربية/إنجليزية).
//  - معاينة قبل التطبيق (preview) + rollback عند الخطأ (atomic:
//    لا تُكتب الحالة إلا بعد نجاح كل الصفوف).
// كل العمليات محلية — لا سيرفر.
// ============================================================

import * as XLSX from 'xlsx';
import type { Item, Customer, Supplier, Category } from '@/types';
import { generateId } from '@/db';

export type ExcelEntity = 'items' | 'customers' | 'suppliers';

// ============================================================
// تعريف الأعمدة: المفتاح الداخلي + الأسماء البديلة المقبولة
// (عربية/إنجليزية) لتعيين الأعمدة تلقائيًا.
// ============================================================
interface ColumnSpec {
  key: string;
  aliases: string[];
  required?: boolean;
}

const ITEM_COLUMNS: ColumnSpec[] = [
  { key: 'barcode', aliases: ['barcode', 'الباركود', 'باركود'] },
  { key: 'name', aliases: ['name', 'الاسم', 'الاسم بالانجليزي'], required: true },
  { key: 'nameAr', aliases: ['namear', 'name_ar', 'الاسم العربي', 'الاسم بالعربي'] },
  { key: 'categoryId', aliases: ['categoryid', 'category', 'الفئة', 'التصنيف'] },
  { key: 'unit', aliases: ['unit', 'الوحدة', 'وحدة'] },
  { key: 'purchasePrice', aliases: ['purchaseprice', 'cost', 'سعر الشراء', 'التكلفة'] },
  { key: 'salePrice', aliases: ['saleprice', 'price', 'سعر البيع', 'السعر'] },
  { key: 'wholesalePrice', aliases: ['wholesaleprice', 'سعر الجملة', 'الجملة'] },
  { key: 'stockQuantity', aliases: ['stockquantity', 'stock', 'الكمية', 'المخزون'] },
  { key: 'minStockLevel', aliases: ['minstocklevel', 'min', 'حد الطلب', 'الحد الأدنى'] },
  { key: 'manufacturer', aliases: ['manufacturer', 'brand', 'المصنع', 'العلامة'] },
  { key: 'description', aliases: ['description', 'الوصف', 'ملاحظات'] },
];

const CUSTOMER_COLUMNS: ColumnSpec[] = [
  { key: 'name', aliases: ['name', 'الاسم', 'الاسم بالانجليزي'], required: true },
  { key: 'nameAr', aliases: ['namear', 'الاسم العربي'] },
  { key: 'phone', aliases: ['phone', 'mobile', 'الهاتف', 'الجوال'] },
  { key: 'email', aliases: ['email', 'البريد', 'الايميل'] },
  { key: 'address', aliases: ['address', 'العنوان'] },
  { key: 'balance', aliases: ['balance', 'الرصيد', 'الرصيد الافتتاحي'] },
  { key: 'creditLimit', aliases: ['creditlimit', 'حد الائتمان'] },
];

const SUPPLIER_COLUMNS: ColumnSpec[] = [
  { key: 'name', aliases: ['name', 'الاسم', 'الاسم بالانجليزي'], required: true },
  { key: 'nameAr', aliases: ['namear', 'الاسم العربي'] },
  { key: 'phone', aliases: ['phone', 'mobile', 'الهاتف', 'الجوال'] },
  { key: 'email', aliases: ['email', 'البريد'] },
  { key: 'address', aliases: ['address', 'العنوان'] },
  { key: 'balance', aliases: ['balance', 'الرصيد'] },
];

function columnsFor(entity: ExcelEntity): ColumnSpec[] {
  switch (entity) {
    case 'items': return ITEM_COLUMNS;
    case 'customers': return CUSTOMER_COLUMNS;
    case 'suppliers': return SUPPLIER_COLUMNS;
  }
}

// ============================================================
// مطابقة اسم عمود (غير حساس للحالة/المسافات) مع قائمة الأسماء البديلة
// ============================================================
function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/[\s_-]+/g, '');
}

function buildHeaderMap(headers: string[], specs: ColumnSpec[]): Map<string, string[]> {
  const map = new Map<string, string[]>();
  const normalizedHeaders = headers.map(h => ({ raw: h, norm: normalizeHeader(h) }));
  for (const spec of specs) {
    const matches: string[] = [];
    for (const alias of spec.aliases) {
      const na = normalizeHeader(alias);
      const hit = normalizedHeaders.find(hh => hh.norm === na && !matches.includes(hh.raw));
      if (hit) matches.push(hit.raw);
    }
    if (matches.length) map.set(spec.key, matches);
  }
  return map;
}

// ============================================================
// قراءة ملف Excel إلى صفوف من الكائنات (row objects)
// ============================================================
export function readWorkbook(file: ArrayBuffer): Record<string, unknown>[] {
  const wb = XLSX.read(file, { type: 'array' });
  const firstSheet = wb.SheetNames[0];
  if (!firstSheet) return [];
  const ws = wb.Sheets[firstSheet];
  return XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });
}

// ============================================================
// بناء صفوف القالب الجاهزة (للتصدير/كقالب فارغ)
// ============================================================
export function buildTemplateRows(entity: ExcelEntity, count = 1): Record<string, unknown>[] {
  const specs = columnsFor(entity);
  const rows: Record<string, unknown>[] = [];
  for (let i = 0; i < count; i++) {
    const row: Record<string, unknown> = {};
    for (const spec of specs) {
      row[spec.aliases[0]] = '';
    }
    rows.push(row);
  }
  return rows;
}

// ============================================================
// معاينة الاستيراد: تحويل صفوف Excel إلى كائنات مقترحة (بدون حفظ)
// يُعيد قائمة الصفوف الصالحة + الأخطاء (مع رقم الصف).
// ============================================================
export interface ImportPreviewRow {
  rowIndex: number;
  data: Partial<Item | Customer | Supplier>;
  errors: string[];
}

export interface ImportPreview {
  rows: ImportPreviewRow[];
  errors: string[];
}

function asString(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v).trim();
}

function asNumber(v: unknown): number {
  if (typeof v === 'number') return v;
  const n = parseFloat(asString(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : 0;
}

export function previewImport(
  entity: ExcelEntity,
  rows: Record<string, unknown>[],
  categories: Category[] = []
): ImportPreview {
  const specs = columnsFor(entity);
  const errors: string[] = [];

  if (rows.length === 0) {
    return { rows: [], errors: ['الملف فارغ أو لا يحتوي على بيانات'] };
  }

  // جمع كل الرؤوس الفريدة عبر جميع الصفوف (قد تختلف من صف لآخر)
  const headerSet = new Set<string>();
  for (const r of rows) {
    for (const k of Object.keys(r)) headerSet.add(k);
  }
  const headers = Array.from(headerSet);
  const headerMap = buildHeaderMap(headers, specs);

  // التحقق من الأعمدة المطلوبة
  for (const spec of specs) {
    if (spec.required && !headerMap.has(spec.key)) {
      errors.push(`العمود المطلوب مفقود: ${spec.aliases.join(' / ')}`);
    }
  }
  if (errors.length) {
    return { rows: [], errors };
  }

  // خريطة الفئات للاسم (لتحويل اسم الفئة → id)
  const categoryByName = new Map<string, Category>();
  for (const c of categories) {
    categoryByName.set(c.name.toLowerCase(), c);
    if (c.nameAr) categoryByName.set(c.nameAr.toLowerCase(), c);
  }

  const out: ImportPreviewRow[] = [];
  rows.forEach((row, idx) => {
    const rowErrors: string[] = [];
    const data: Record<string, unknown> = {};

    for (const spec of specs) {
      const headers = headerMap.get(spec.key);
      if (!headers) continue;
      // جرّب كل رؤوس مطابقة (قد تختلف من صف لآخر) وخذ أول قيمة غير فارغة
      let val: unknown = '';
      for (const hdr of headers) {
        const cellVal = row[hdr];
        if (cellVal !== undefined && cellVal !== null && asString(cellVal) !== '') {
          val = cellVal;
          break;
        }
      }
      data[spec.key] = val;
    }

    // تحقق من الحقول المطلوبة
    const nameVal = asString(data['name']);
    if (!nameVal) {
      rowErrors.push('الاسم مطلوب');
    }

    // معالجة خاصة للأصناف
    if (entity === 'items') {
      const catVal = asString(data['categoryId']);
      if (catVal) {
        const cat = categoryByName.get(catVal.toLowerCase());
        if (cat) data['categoryId'] = cat.id;
      }
      data['isActive'] = true;
      data['barcodes'] = asString(data['barcode']) ? [asString(data['barcode'])] : [];
      data['subUnits'] = [];
      data['description'] = asString(data['description']);
      data['minStockLevel'] = asNumber(data['minStockLevel']);
      if (!data['categoryId']) data['categoryId'] = '';
    }

    // معالجة خاصة للعملاء/الموردين
    if (entity === 'customers' || entity === 'suppliers') {
      data['isActive'] = true;
      if (entity === 'customers') {
        data['creditLimit'] = asNumber(data['creditLimit']);
      }
    }

    if (rowErrors.length) {
      errors.push(`الصف ${idx + 2}: ${rowErrors.join('، ')}`);
    }
    out.push({ rowIndex: idx + 2, data: data as Partial<Item | Customer | Supplier>, errors: rowErrors });
  });

  return { rows: out, errors };
}

// ============================================================
// تحويل معاينة الأصناف إلى كائنات Item كاملة جاهزة للحفظ
// ============================================================
export function buildItemsFromPreview(preview: ImportPreview): Item[] {
  const items: Item[] = [];
  for (const row of preview.rows) {
    if (row.errors.length) continue;
    const d = row.data as Partial<Item>;
    items.push({
      id: generateId('item'),
      barcode: asString(d.barcode),
      barcodes: d.barcodes || [],
      name: asString(d.name),
      nameAr: asString(d.nameAr) || asString(d.name),
      categoryId: asString(d.categoryId),
      unit: asString(d.unit) || 'piece',
      subUnits: d.subUnits || [],
      purchasePrice: asNumber(d.purchasePrice),
      salePrice: asNumber(d.salePrice),
      wholesalePrice: asNumber(d.wholesalePrice),
      stockQuantity: asNumber(d.stockQuantity),
      minStockLevel: asNumber(d.minStockLevel),
      description: asString(d.description),
      manufacturer: d.manufacturer ? asString(d.manufacturer) : undefined,
      isActive: true,
      taxable: true,
      createdAt: new Date().toISOString(),
    });
  }
  return items;
}

export function buildCustomersFromPreview(preview: ImportPreview): Customer[] {
  const customers: Customer[] = [];
  for (const row of preview.rows) {
    if (row.errors.length) continue;
    const d = row.data as Partial<Customer>;
    customers.push({
      id: generateId('cus'),
      name: asString(d.name),
      nameAr: asString(d.nameAr) || asString(d.name),
      phone: asString(d.phone),
      email: asString(d.email),
      address: asString(d.address),
      balance: asNumber(d.balance),
      creditLimit: asNumber(d.creditLimit),
      notes: '',
      isActive: true,
      createdAt: new Date().toISOString(),
    });
  }
  return customers;
}

export function buildSuppliersFromPreview(preview: ImportPreview): Supplier[] {
  const suppliers: Supplier[] = [];
  for (const row of preview.rows) {
    if (row.errors.length) continue;
    const d = row.data as Partial<Supplier>;
    suppliers.push({
      id: generateId('sup'),
      name: asString(d.name),
      nameAr: asString(d.nameAr) || asString(d.name),
      phone: asString(d.phone),
      email: asString(d.email),
      address: asString(d.address),
      balance: asNumber(d.balance),
      isActive: true,
      createdAt: new Date().toISOString(),
    });
  }
  return suppliers;
}

// ============================================================
// التصدير: تحويل كائنات إلى ملف .xlsx (ArrayBuffer)
// ============================================================
function toExportRows<T extends Record<string, unknown>>(
  entities: T[],
  specs: ColumnSpec[]
): Record<string, unknown>[] {
  return entities.map(e => {
    const row: Record<string, unknown> = {};
    for (const spec of specs) {
      row[spec.aliases[0]] = e[spec.key] ?? '';
    }
    return row;
  });
}

export function exportItemsToBuffer(items: Item[]): ArrayBuffer {
  const specs = columnsFor('items');
  const rows = toExportRows(items as unknown as Record<string, unknown>[], specs);
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Items');
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
}

export function exportCustomersToBuffer(customers: Customer[]): ArrayBuffer {
  const specs = columnsFor('customers');
  const rows = toExportRows(customers as unknown as Record<string, unknown>[], specs);
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Customers');
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
}

export function exportSuppliersToBuffer(suppliers: Supplier[]): ArrayBuffer {
  const specs = columnsFor('suppliers');
  const rows = toExportRows(suppliers as unknown as Record<string, unknown>[], specs);
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Suppliers');
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
}

// قالب فارغ للتحميل (للمستخدم يملأه ويستورده)
export function buildEmptyTemplateBuffer(entity: ExcelEntity): ArrayBuffer {
  const specs = columnsFor(entity);
  const headerRow: Record<string, unknown> = {};
  for (const spec of specs) headerRow[spec.aliases[0]] = '';
  const ws = XLSX.utils.json_to_sheet([headerRow]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, entity);
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
}
