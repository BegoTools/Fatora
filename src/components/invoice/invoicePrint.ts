// ============================================================
// Easy Store ERP - مولّد HTML لطباعة الفاتورة (Print Builder)
// ------------------------------------------------------------
// يبني مستند HTML مستقلًا ويطبعه في نافذة منفصلة — نسخة مطابقة
// للقالب الحديث في InvoiceDocument.tsx.
// ============================================================

import type { CompanySettings, InvoiceDesign, InvoiceType } from '@/types';
import type { NormalizedInvoice } from './invoiceModel';
import { invoiceLabel, invoiceTitle, formatMoney } from './invoiceModel';

function esc(str: string): string {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildInvoicePrintHtml(
  inv: NormalizedInvoice,
  company: CompanySettings,
  design: InvoiceDesign,
  type: InvoiceType,
  isRTL: boolean,
): string {
  const accent = design.accentColor || '#0d9488';
  const symbol = company.currencySymbol || '';
  const money = (v: number) => formatMoney(v, symbol);
  const L = (k: Parameters<typeof invoiceLabel>[2]) => esc(invoiceLabel(design, isRTL, k));

  const d = new Date(inv.createdAt);
  const dateStr = d.toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = d.toLocaleTimeString(isRTL ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit' });

  const partyLabel = type === 'purchase' ? L('supplier') : L('customer');
  const prevBalance = inv.previousBalance || 0;
  const totalDue = prevBalance + inv.total;
  const remaining = totalDue - inv.paid;

  const logoHtml = design.showLogo && design.logo
    ? `<img src="${esc(design.logo)}" alt="logo" style="max-height:64px;max-width:160px;object-fit:contain;border-radius:4px" />`
    : '';

  const metaItems: string[] = [];
  metaItems.push(`<div class="meta-item"><span class="meta-label">${partyLabel}</span><span class="meta-value">${esc(inv.partyName)}</span></div>`);
  if (design.showSalesPerson && inv.createdBy) {
    metaItems.push(`<div class="meta-item"><span class="meta-label">${L('seller')}</span><span class="meta-value">${esc(inv.createdBy)}</span></div>`);
  }
  if (design.showManagement && design.managementName) {
    metaItems.push(`<div class="meta-item"><span class="meta-label">${L('management')}</span><span class="meta-value">${esc(design.managementName)}</span></div>`);
  }
  for (const cf of [design.customField1, design.customField2]) {
    if (cf && cf.value) {
      const lbl = isRTL ? (cf.labelAr || cf.labelEn) : (cf.labelEn || cf.labelAr);
      metaItems.push(`<div class="meta-item"><span class="meta-label">${esc(lbl)}</span><span class="meta-value">${esc(cf.value)}</span></div>`);
    }
  }

  const rows = inv.items.map((it, i) => `
    <tr class="${i % 2 === 1 ? 'alt' : ''}">
      <td class="cell-idx">${i + 1}</td>
      <td class="cell-name">${esc(it.itemName)}</td>
      <td class="cell-code">${esc(it.itemId)}</td>
      <td class="cell-qty">${it.quantity}</td>
      <td class="cell-price">${money(it.unitPrice)}</td>
      <td class="cell-total">${money(it.total)}</td>
    </tr>`).join('');

  const extraRows = inv.extraCharges
    .map(c => `<div class="total-row"><span class="label">${esc(c.description)}</span><span class="value">${money(c.amount)}</span></div>`)
    .join('');

  const footerLines = [company.email, company.phone, company.address].filter(Boolean).map(esc).join('  ·  ');
  const footerCustom = isRTL ? design.footerTextAr : design.footerTextEn;
  const thankYou = isRTL ? design.thankYouAr : design.thankYouEn;

  const dir = isRTL ? 'rtl' : 'ltr';
  const align = isRTL ? 'right' : 'left';
  const alignOpp = isRTL ? 'left' : 'right';

  const style = `
    @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');

    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: 'IBM Plex Sans', 'Inter', 'Segoe UI', sans-serif;
      color: #1e293b;
      direction: ${dir};
      font-size: 13px;
      line-height: 1.5;
      background: #fff;
    }

    .invoice-wrap { padding: 0; }

    /* ── Accent Top Bar ── */
    .accent-bar { height: 6px; width: 100%; background: ${accent}; border-radius: 8px 8px 0 0; }

    .inner { padding: 32px 40px; }

    /* ── Header ── */
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 28px; }
    .header .company-name { color: ${accent}; font-size: 22px; font-weight: 700; letter-spacing: -0.02em; }
    .header .company-addr { color: #64748b; font-size: 11px; margin-top: 4px; line-height: 1.6; }
    .header .company-contact { color: #94a3b8; font-size: 11px; margin-top: 2px; }
    .logo { margin-${alignOpp}: 24px; flex-shrink: 0; }

    /* ── Title Band ── */
    .title-band { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 24px; }
    .title-band h2 { color: ${accent}; font-size: 17px; font-weight: 700; }
    .title-info { text-align: ${alignOpp}; color: #64748b; font-size: 11px; line-height: 1.8; }
    .title-info strong { color: #334155; font-weight: 600; }

    /* ── Meta Grid ── */
    .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 24px; padding: 14px 18px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; margin-bottom: 24px; }
    .meta-label { display: block; font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: #94a3b8; margin-bottom: 2px; }
    .meta-value { font-size: 13px; font-weight: 500; color: #1e293b; }

    /* ── Table ── */
    .table-wrap { border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; margin-bottom: 24px; }
    table { width: 100%; border-collapse: collapse; }
    th { background: ${accent}; color: #fff; padding: 11px 14px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; text-align: ${align}; }
    td { padding: 9px 14px; font-size: 13px; border-bottom: 1px solid #f1f5f9; }
    tr.alt { background: #f8fafc; }
    tr:last-child td { border-bottom: none; }
    .cell-idx { color: #94a3b8; text-align: ${align}; }
    .cell-name { font-weight: 500; color: #1e293b; text-align: ${align}; }
    .cell-code { font-family: 'IBM Plex Mono', monospace; font-size: 11px; color: #94a3b8; text-align: ${align}; }
    .cell-qty { color: #475569; text-align: ${align}; }
    .cell-price { font-family: 'IBM Plex Mono', monospace; color: #475569; text-align: ${align}; }
    .cell-total { font-family: 'IBM Plex Mono', monospace; font-weight: 600; color: #1e293b; text-align: ${alignOpp}; }

    /* ── Totals Card ── */
    .totals-card { max-width: 300px; margin-${alignOpp}: 0; margin-left: ${alignOpp === 'left' ? '0' : 'auto'}; margin-right: ${alignOpp === 'right' ? '0' : 'auto'}; padding: 16px 18px; background: #f8fafc; border-radius: 8px; border-${align}: 3px solid ${accent}; }
    .total-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 13px; }
    .total-row .label { color: #64748b; }
    .total-row .value { font-family: 'IBM Plex Mono', monospace; font-weight: 500; color: #334155; }
    .total-divider { border: none; border-top: 1px solid #e2e8f0; margin: 6px 0; }
    .total-divider-thick { border: none; border-top: 2px solid #e2e8f0; margin: 8px 0; }
    .grand-total-row { font-size: 15px; font-weight: 700; color: #1e293b; }
    .grand-total-row .value { color: ${accent}; }
    .remaining-row { font-size: 15px; font-weight: 700; color: #1e293b; }
    .remaining-row .value { color: #dc2626; }
    .paid-row .value { color: #059669; }
    .discount-row .value { color: #dc2626; }

    /* ── Footer ── */
    .footer { margin-top: 32px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center; font-size: 11px; }
    .footer .thanks { color: #64748b; font-weight: 500; margin-bottom: 2px; }
    .footer .custom { color: #94a3b8; margin-bottom: 2px; }
    .footer .contacts { color: #cbd5e1; }

    @page { margin: 0; }
    @media print { .inner { padding: 24px 32px; } }
  `;

  return `<!DOCTYPE html>
<html dir="${dir}" lang="${isRTL ? 'ar' : 'en'}">
<head><meta charset="utf-8" /><title>&nbsp;</title><style>${style}</style></head>
<body>
<div class="invoice-wrap">
  <div class="accent-bar"></div>
  <div class="inner">

    <div class="header">
      <div class="company">
        <div class="company-name">${esc(isRTL ? (company.nameAr || company.name) : company.name)}</div>
        ${company.address ? `<div class="company-addr">${esc(company.address)}</div>` : ''}
        <div class="company-contact">${[company.phone, company.email].filter(Boolean).map(esc).join('  ·  ')}</div>
      </div>
      ${logoHtml ? `<div class="logo">${logoHtml}</div>` : ''}
    </div>

    <div class="title-band">
      <h2>${esc(invoiceTitle(design, isRTL, type))}</h2>
      <div class="title-info">
        <div>${L('invoiceNo')} <strong>${esc(inv.invoiceNumber)}</strong></div>
        <div>${L('date')} <strong>${esc(dateStr)}</strong></div>
        <div>${L('time')} <strong>${esc(timeStr)}</strong></div>
      </div>
    </div>

    <div class="meta-grid">${metaItems.join('')}</div>

    <div class="table-wrap">
      <table>
        <thead><tr>
          <th>#</th><th>${L('product')}</th><th>${L('code')}</th><th>${L('qty')}</th><th>${L('price')}</th><th>${L('total')}</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>

    <div class="totals-card">
      <div class="total-row"><span class="label">${L('subtotal')}</span><span class="value">${money(inv.subtotal)}</span></div>
      ${inv.discount > 0 ? `<div class="total-row discount-row"><span class="label">${L('discount')}</span><span class="value">-${money(inv.discount)}</span></div>` : ''}
      ${extraRows}
      <hr class="total-divider" />
      <div class="total-row grand-total-row"><span class="label">${L('grandTotal')}</span><span class="value">${money(inv.total)}</span></div>
      ${design.showPreviousBalance ? `<div class="total-row"><span class="label">${L('previousBalance')}</span><span class="value">${money(prevBalance)}</span></div>` : ''}
      ${design.showPreviousBalance ? `<hr class="total-divider" /><div class="total-row grand-total-row"><span>${L('totalDue')}</span><span class="value">${money(totalDue)}</span></div>` : ''}
      <div class="total-row paid-row"><span class="label">${L('paid')}</span><span class="value">${money(inv.paid)}</span></div>
      <hr class="total-divider-thick" />
      <div class="total-row remaining-row"><span class="label">${L('remaining')}</span><span class="value">${money(remaining)}</span></div>
    </div>

    <div class="footer">
      ${thankYou ? `<div class="thanks">${esc(thankYou)}</div>` : ''}
      ${footerCustom ? `<div class="custom">${esc(footerCustom)}</div>` : ''}
      ${footerLines ? `<div class="contacts">${footerLines}</div>` : ''}
    </div>

  </div>
</div>
</body>
</html>`;
}

export function printInvoice(html: string): void {
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 400);
}
