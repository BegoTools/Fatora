import type { CompanySettings, InvoiceDesign, InvoiceType } from '@/types';
import type { NormalizedInvoice } from './invoiceModel';
import { formatMoney } from './invoiceModel';
import { resolveInvoiceSpreadsheetTemplate } from './invoiceSpreadsheetTemplate';

const escapeHtml = (value: string | number) => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Builds the print document from the exact same saved sheet as the on-screen preview. */
export function buildInvoicePrintHtml(invoice: NormalizedInvoice, company: CompanySettings, design: InvoiceDesign, _type: InvoiceType, isRTL: boolean): string {
  const sheet = resolveInvoiceSpreadsheetTemplate(design.spreadsheet);
  const currency = company.currencySymbol || '';
  const money = (amount: number) => formatMoney(amount, currency);
  const values: Record<string, string> = {
    '{{company.name}}': isRTL ? company.nameAr || company.name : company.name,
    '{{company.phone}}': company.phone || '—', '{{company.email}}': company.email || '—', '{{company.address}}': company.address || '—',
    '{{invoice.number}}': invoice.invoiceNumber, '{{invoice.dateTime}}': new Date(invoice.createdAt).toLocaleString(isRTL ? 'ar-EG' : 'en-US'),
    '{{customer.name}}': invoice.partyName || '—', '{{owner.name1}}': invoice.ownerName1 || '—', '{{owner.name2}}': invoice.ownerName2 || '—',
    '{{seller.name}}': invoice.createdBy || '—', '{{management.name}}': design.managementName || '—',
    '{{invoice.total}}': money(invoice.total), '{{customer.balance}}': money(invoice.previousBalance || 0), '{{invoice.paid}}': money(invoice.downPayment || 0),
    '{{invoice.net}}': money(invoice.netAmount ?? invoice.total + (invoice.previousBalance || 0) - (invoice.downPayment || 0)),
  };

  // Build dynamic item cell values
  for (let i = 0; i < 15; i++) {
    const item = invoice.items[i];
    values[`{{item.${i}.code}}`] = item ? item.itemId : '';
    values[`{{item.${i}.name}}`] = item ? item.itemName : '';
    values[`{{item.${i}.qty}}`] = item ? String(item.quantity) : '';
    values[`{{item.${i}.price}}`] = item ? money(item.unitPrice) : '';
    values[`{{item.${i}.total}}`] = item ? money(item.total) : '';
  }

  const cells = sheet.cells.map(cell => {
    const style = cell.style || {};
    const value = cell.value === '{{company.logo}}'
      ? (design.showLogo && design.logo ? `<img class="company-logo" src="${escapeHtml(design.logo)}" alt="Logo">` : 'Logo')
      : escapeHtml(values[cell.value] !== undefined ? values[cell.value] : cell.value);
    return `<div class="cell" style="grid-row:${cell.row + 1}/span ${cell.rowSpan || 1};grid-column:${cell.column + 1}/span ${cell.columnSpan || 1};font-weight:${style.bold ? 700 : 400};font-style:${style.italic ? 'italic' : 'normal'};font-size:${style.fontSize || 13}px;color:${style.color || '#000000'};background-color:${style.backgroundColor || '#ffffff'};text-align:${style.align || 'right'};border:${style.border ? '1px solid #000000' : '0'}">${value}</div>`;
  }).join('');
  return `<!doctype html><html dir="${isRTL ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><title>${escapeHtml(invoice.invoiceNumber)}</title><style>
    *{box-sizing:border-box;-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}html,body{margin:0;background:#fff;font-family:Arial,Tahoma,sans-serif}.sheet{display:grid;grid-template-columns:${sheet.columnWidths.map(width => `${width}px`).join(' ')};grid-template-rows:${sheet.rowHeights.map(height => `${height}px`).join(' ')};padding:18px;align-content:start}.cell{overflow:hidden;padding:4px;white-space:pre-wrap}.company-logo{display:block;width:100%;height:100%;object-fit:contain}@page{size:A4;margin:8mm}@media print{.sheet{padding:0}.cell{break-inside:avoid}}
  </style></head><body><main class="sheet">${cells}</main></body></html>`;
}

export function printInvoice(html: string): void {
  const popup = window.open('', '_blank');
  if (!popup) return;
  popup.document.write(html);
  popup.document.close();
  popup.focus();
  window.setTimeout(() => popup.print(), 500);
}
