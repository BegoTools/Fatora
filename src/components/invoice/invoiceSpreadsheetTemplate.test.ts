import { describe, expect, it } from 'vitest';
import type { CompanySettings, InvoiceDesign } from '@/types';
import type { NormalizedInvoice } from './invoiceModel';
import { buildInvoicePrintHtml } from './invoicePrint';
import { createInvoiceSpreadsheetTemplate, resolveInvoiceSpreadsheetTemplate } from './invoiceSpreadsheetTemplate';

const invoice: NormalizedInvoice = {
  invoiceNumber: 'INV-00001', partyName: 'Test customer', createdBy: 'Cashier', createdAt: '2026-07-26T10:00:00.000Z',
  items: [{ itemId: 'P-1', itemName: 'Product', quantity: 2, unitPrice: 50, total: 100 }],
  subtotal: 100, discount: 0, extraCharges: [], total: 100, paid: 50, previousBalance: 25, downPayment: 50, netAmount: 75,
};
const company: CompanySettings = { name: 'Easy Store', nameAr: 'إيزي ستور', address: 'Cairo', phone: '0100', email: 'test@example.com', commercialRegistration: '', currency: 'EGP', currencySymbol: 'ج.م', fiscalYearStart: '2026-01-01', vatRate: 0.14, pricesIncludeVat: false };
const design: InvoiceDesign = { templateId: 'standard', accentColor: '#4A86E8', logo: 'data:image/png;base64,abc', showLogo: true, showManagement: true, managementName: 'Management', showSalesPerson: true, showPreviousBalance: true, customField1: { labelEn: '', labelAr: '', value: '' }, customField2: { labelEn: '', labelAr: '', value: '' }, footerTextEn: '', footerTextAr: '', thankYouEn: '', thankYouAr: '', labels: {}, spreadsheet: createInvoiceSpreadsheetTemplate() };

describe('Excel invoice template', () => {
  it('preserves the workbook header merge, item area, totals, and footer', () => {
    const sheet = createInvoiceSpreadsheetTemplate();
    expect(sheet.columnWidths).toHaveLength(5);
    expect(sheet.rowHeights).toHaveLength(33);
    expect(sheet.cells.find(cell => cell.value === '{{company.name}}')).toMatchObject({ row: 2, column: 0, columnSpan: 4, rowSpan: 3 });
    expect(sheet.cells.find(cell => cell.value === '{{company.logo}}')).toMatchObject({ row: 2, column: 4, rowSpan: 3 });
    // Individual item cells: first item row at row 12
    expect(sheet.cells.find(cell => cell.value === '{{item.0.code}}')).toMatchObject({ row: 12, column: 0 });
    expect(sheet.cells.find(cell => cell.value === '{{item.0.name}}')).toMatchObject({ row: 12, column: 1 });
    expect(sheet.cells.find(cell => cell.value === '{{item.14.total}}')).toMatchObject({ row: 26, column: 4 });
    expect(sheet.cells.find(cell => cell.value === '{{invoice.total}}')).toMatchObject({ row: 27 });
  });

  it('keeps logo and colours in the PDF print document', () => {
    const html = buildInvoicePrintHtml(invoice, company, design, 'sale', true);
    expect(html).toContain('data:image/png;base64,abc');
    expect(html).toContain('background-color:#4A86E8');
    expect(html).toContain('print-color-adjust:exact');
    expect(html).toContain('-webkit-print-color-adjust:exact');
  });

  it('upgrades the old short spreadsheet layout to the workbook layout', () => {
    const upgraded = resolveInvoiceSpreadsheetTemplate({ columnWidths: [80, 80, 80, 80, 80], rowHeights: Array(31).fill(24), cells: [] });
    expect(upgraded.rowHeights).toHaveLength(33);
    expect(upgraded.cells.find(cell => cell.value === '{{company.logo}}')?.rowSpan).toBe(3);
  });
});
