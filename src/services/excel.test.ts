import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import {
  previewImport,
  buildItemsFromPreview,
  buildCustomersFromPreview,
  buildSuppliersFromPreview,
  exportItemsToBuffer,
  exportCustomersToBuffer,
  readWorkbook,
  buildEmptyTemplateBuffer,
  type ExcelEntity,
} from './excel';
import type { Item, Customer, Category } from '@/types';

// ============================================================
// مساعد: بناء ArrayBuffer من صفوف للاختبار
// ============================================================
function rowsToBuffer(rows: Record<string, unknown>[]): ArrayBuffer {
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
}

const categories: Category[] = [
  { id: 'cat-1', name: 'Electronics', nameAr: 'إلكترونيات', parentId: null, color: '', createdAt: '' },
];

describe('excel: items import/export', () => {
  it('imports items with arabic headers and resolves category by name', () => {
    const rows = [
      { 'الاسم': 'Mouse', 'الاسم العربي': 'ماوس', 'الباركود': '501234567890', 'الفئة': 'إلكترونيات', 'سعر البيع': 150, 'الكمية': 10 },
      { 'الاسم': 'Keyboard', 'الباركود': '501234567891', 'سعر البيع': 250, 'الكمية': 5 },
    ];
    const buf = rowsToBuffer(rows);
    const parsed = readWorkbook(buf);
    const preview = previewImport('items', parsed, categories);

    expect(preview.errors).toHaveLength(0);
    expect(preview.rows).toHaveLength(2);

    const items = buildItemsFromPreview(preview);
    expect(items).toHaveLength(2);
    expect(items[0].name).toBe('Mouse');
    expect(items[0].nameAr).toBe('ماوس');
    expect(items[0].categoryId).toBe('cat-1');
    expect(items[0].salePrice).toBe(150);
    expect(items[0].barcodes).toEqual(['501234567890']);
    expect(items[1].nameAr).toBe('Keyboard');
  });

  it('reports missing required column', () => {
    const rows = [{ 'الباركود': '123', 'سعر البيع': 50 }];
    const buf = rowsToBuffer(rows);
    const parsed = readWorkbook(buf);
    const preview = previewImport('items', parsed);
    expect(preview.errors.length).toBeGreaterThan(0);
    expect(preview.errors[0]).toContain('مفقود');
  });

  it('exports items to a valid xlsx buffer and re-imports', () => {
    const items: Item[] = [
      {
        id: 'item-1', barcode: 'AAA', barcodes: ['AAA'], name: 'Pen', nameAr: 'قلم',
        categoryId: '', unit: 'piece', subUnits: [], purchasePrice: 1, salePrice: 3,
        wholesalePrice: 2, stockQuantity: 100, minStockLevel: 5, description: '',
        isActive: true, createdAt: new Date().toISOString(), taxable: true,
      },
    ];
    const buf = exportItemsToBuffer(items);
    expect(buf.byteLength).toBeGreaterThan(0);
    const parsed = readWorkbook(buf);
    expect(parsed).toHaveLength(1);
    expect(String(parsed[0]['name'])).toBe('Pen');
  });

  it('empty template buffer is parseable', () => {
    const buf = buildEmptyTemplateBuffer('items');
    const parsed = readWorkbook(buf);
    expect(parsed.length).toBeGreaterThanOrEqual(1);
  });
});

describe('excel: customers/suppliers', () => {
  it('imports customers with mixed headers', () => {
    const rows = [
      { name: 'Ahmed', phone: '0100', balance: 500, creditLimit: 1000 },
      { name: 'Sara', 'الرصيد': '250' },
    ];
    const buf = rowsToBuffer(rows);
    const parsed = readWorkbook(buf);
    const preview = previewImport('customers', parsed);
    expect(preview.errors).toHaveLength(0);
    const customers = buildCustomersFromPreview(preview);
    expect(customers).toHaveLength(2);
    expect(customers[0].balance).toBe(500);
    expect(customers[0].creditLimit).toBe(1000);
    expect(customers[1].balance).toBe(250);
  });

  it('exports and re-imports customers', () => {
    const customers: Customer[] = [
      {
        id: 'cus-1', name: 'Ahmed', nameAr: 'أحمد', phone: '0100', email: '', address: '',
        balance: 500, creditLimit: 1000, notes: '', isActive: true, createdAt: '',
      },
    ];
    const buf = exportCustomersToBuffer(customers);
    const parsed = readWorkbook(buf);
    const preview = previewImport('customers', parsed);
    const out = buildCustomersFromPreview(preview);
    expect(out[0].name).toBe('Ahmed');
    expect(out[0].balance).toBe(500);
  });

  it('imports suppliers', () => {
    const rows = [{ name: 'Supplier Co', phone: '020', balance: 1000 }];
    const buf = rowsToBuffer(rows);
    const parsed = readWorkbook(buf);
    const preview = previewImport('suppliers', parsed);
    expect(preview.errors).toHaveLength(0);
    const suppliers = buildSuppliersFromPreview(preview);
    expect(suppliers[0].name).toBe('Supplier Co');
    expect(suppliers[0].balance).toBe(1000);
  });
});

describe('excel: empty input', () => {
  it('reports empty file error', () => {
    const preview = previewImport('items' as ExcelEntity, []);
    expect(preview.rows).toHaveLength(0);
    expect(preview.errors.length).toBeGreaterThan(0);
  });
});
