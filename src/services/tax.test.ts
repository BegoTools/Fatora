import { describe, it, expect } from 'vitest';
import {
  computeLineTax,
  computeInvoiceTax,
  addTax,
  extractTax,
  computeReverseCharge,
} from './tax';
import { generateTaxQr, decodeTaxQr } from './taxQr';
import type { Item } from '@/types';

describe('tax engine: computeLineTax', () => {
  it('calculates tax for tax-exclusive prices', () => {
    const res = computeLineTax({
      unitPrice: 100,
      quantity: 2,
      discount: 0,
      taxable: true,
      taxRate: 0.14,
      includesVat: false,
    });
    expect(res.taxableAmount).toBe(200);
    expect(res.taxAmount).toBe(28);
    expect(res.totalInclTax).toBe(228);
  });

  it('extracts tax for tax-inclusive prices', () => {
    const res = computeLineTax({
      unitPrice: 114,
      quantity: 1,
      discount: 0,
      taxable: true,
      taxRate: 0.14,
      includesVat: true,
    });
    expect(res.totalInclTax).toBe(114);
    expect(res.taxableAmount).toBe(100);
    expect(res.taxAmount).toBe(14);
  });

  it('handles non-taxable items', () => {
    const res = computeLineTax({
      unitPrice: 100,
      quantity: 5,
      discount: 10,
      taxable: false,
      taxRate: 0.14,
      includesVat: false,
    });
    expect(res.taxableAmount).toBe(450);
    expect(res.taxAmount).toBe(0);
    expect(res.totalInclTax).toBe(450);
  });
});

describe('tax engine: computeInvoiceTax', () => {
  it('computes invoice tax total with line items and invoice discount', () => {
    const items: Item[] = [
      {
        id: 'item-1',
        barcode: '111',
        barcodes: ['111'],
        name: 'Item 1',
        nameAr: 'صنف 1',
        categoryId: '',
        unit: 'piece',
        subUnits: [],
        purchasePrice: 50,
        salePrice: 100,
        wholesalePrice: 90,
        stockQuantity: 20,
        minStockLevel: 2,
        description: '',
        isActive: true,
        taxable: true,
        createdAt: '',
      },
    ];

    const res = computeInvoiceTax({
      lines: [{ itemId: 'item-1', quantity: 2, unitPrice: 100, discount: 0 }],
      items,
      defaultTaxRate: 0.14,
      pricesIncludeVat: false,
      invoiceDiscount: 0,
    });

    expect(res.subtotal).toBe(200);
    expect(res.taxAmount).toBe(28);
    expect(res.totalInclTax).toBe(228);
  });
});

describe('tax helpers: addTax & extractTax & Reverse Charge', () => {
  it('addTax converts net to gross', () => {
    const res = addTax(100, 0.14);
    expect(res.tax).toBe(14);
    expect(res.total).toBe(114);
  });

  it('extractTax converts gross to net', () => {
    const res = extractTax(114, 0.14);
    expect(res.net).toBe(100);
    expect(res.tax).toBe(14);
  });

  it('computeReverseCharge computes 1%', () => {
    expect(computeReverseCharge(1000)).toBe(10);
  });
});

describe('tax QR (TLV Base64)', () => {
  it('generates valid TLV QR and decodes back', () => {
    const input = {
      sellerName: 'متجر النور',
      vatNumber: '310123456',
      timestamp: '2026-07-23T12:00:00Z',
      totalInclTax: 228,
      taxAmount: 28,
    };

    const qrBase64 = generateTaxQr(input);
    expect(typeof qrBase64).toBe('string');
    expect(qrBase64.length).toBeGreaterThan(10);

    const decoded = decodeTaxQr(qrBase64);
    expect(decoded.sellerName).toBe(input.sellerName);
    expect(decoded.vatNumber).toBe(input.vatNumber);
    expect(decoded.totalInclTax).toBe(input.totalInclTax);
    expect(decoded.taxAmount).toBe(input.taxAmount);
  });
});
