// ============================================================
// Easy Store ERP - معاينة الفاتورة (Invoice Document Preview)
// ------------------------------------------------------------
// قالب فاتورة حديث نظيف — يُستخدم في نافذة العرض والمعاينة الحية.
// ============================================================

import type { CompanySettings, InvoiceDesign, InvoiceType } from '@/types';
import type { NormalizedInvoice } from './invoiceModel';
import { invoiceLabel, invoiceTitle, formatMoney } from './invoiceModel';

interface InvoiceDocumentProps {
  invoice: NormalizedInvoice;
  company: CompanySettings;
  design: InvoiceDesign;
  type: InvoiceType;
  isRTL: boolean;
}

export function InvoiceDocument({ invoice, company, design, type, isRTL }: InvoiceDocumentProps) {
  const accent = design.accentColor || '#0d9488';
  const symbol = company.currencySymbol || '';
  const money = (v: number) => formatMoney(v, symbol);
  const L = (k: Parameters<typeof invoiceLabel>[2]) => invoiceLabel(design, isRTL, k);

  const d = new Date(invoice.createdAt);
  const dateStr = d.toLocaleDateString(isRTL ? 'ar-EG' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = d.toLocaleTimeString(isRTL ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit' });

  const partyLabel = type === 'purchase' ? L('supplier') : L('customer');
  const prevBalance = invoice.previousBalance || 0;
  const totalDue = prevBalance + invoice.total;
  const remaining = totalDue - invoice.paid;

  const metaItems: { label: string; value: string }[] = [
    { label: partyLabel, value: invoice.partyName },
  ];
  if (design.showSalesPerson && invoice.createdBy) metaItems.push({ label: L('seller'), value: invoice.createdBy });
  if (design.showManagement && design.managementName) metaItems.push({ label: L('management'), value: design.managementName });
  for (const cf of [design.customField1, design.customField2]) {
    if (cf && cf.value) {
      metaItems.push({ label: isRTL ? (cf.labelAr || cf.labelEn) : (cf.labelEn || cf.labelAr), value: cf.value });
    }
  }

  const footerLines = [company.email, company.phone, company.address].filter(Boolean).join('  |  ');
  const footerCustom = isRTL ? design.footerTextAr : design.footerTextEn;
  const thankYou = isRTL ? design.thankYouAr : design.thankYouEn;

  return (
    <div dir={isRTL ? 'rtl' : 'ltr'} className="bg-white text-slate-800 text-sm" style={{ fontFamily: "'IBM Plex Sans', 'Inter', sans-serif" }}>
      {/* ── Accent Top Bar ── */}
      <div className="h-1.5 w-full rounded-t-lg" style={{ background: accent }} />

      <div className="p-6 sm:p-8">
        {/* ── Header ── */}
        <div className={`flex items-start justify-between mb-6 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <div className="flex-1">
            <h1 className="text-[22px] font-bold tracking-tight" style={{ color: accent }}>
              {isRTL ? (company.nameAr || company.name) : company.name}
            </h1>
            {company.address && (
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">{company.address}</p>
            )}
            <p className="text-xs text-slate-400 mt-0.5">
              {[company.phone, company.email].filter(Boolean).join('  ·  ')}
            </p>
          </div>
          {design.showLogo && design.logo && (
            <div className={`${isRTL ? 'mr-0 ml-6' : 'ml-6'}`}>
              <img src={design.logo} alt="logo" className="object-contain rounded-md" style={{ maxHeight: 64, maxWidth: 160 }} />
            </div>
          )}
        </div>

        {/* ── Title Band ── */}
        <div className={`flex items-end justify-between mb-6 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <h2 className="text-lg font-bold" style={{ color: accent }}>
            {invoiceTitle(design, isRTL, type)}
          </h2>
          <div className={`text-[11px] text-slate-500 leading-relaxed ${isRTL ? 'text-left' : 'text-right'}`}>
            <div>{L('invoiceNo')} <span className="font-semibold text-slate-700 font-mono">{invoice.invoiceNumber}</span></div>
            <div>{L('date')} <span className="font-semibold text-slate-700">{dateStr}</span></div>
            <div>{L('time')} <span className="font-semibold text-slate-700">{timeStr}</span></div>
          </div>
        </div>

        {/* ── Meta Grid ── */}
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 p-4 rounded-lg mb-6" style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
          {metaItems.map((m, i) => (
            <div key={i}>
              <span className="text-[10px] uppercase tracking-widest text-slate-400 block mb-0.5">{m.label}</span>
              <span className="text-[13px] font-medium text-slate-800">{m.value || '—'}</span>
            </div>
          ))}
        </div>

        {/* ── Items Table ── */}
        <div className="rounded-lg overflow-hidden mb-6" style={{ border: '1px solid #e2e8f0' }}>
          <table className="w-full">
            <thead>
              <tr style={{ background: accent }} className="text-white">
                <th className={`px-4 py-3 text-[11px] font-semibold uppercase tracking-wider ${isRTL ? 'text-right' : 'text-left'}`}>#</th>
                <th className={`px-4 py-3 text-[11px] font-semibold uppercase tracking-wider ${isRTL ? 'text-right' : 'text-left'}`}>{L('product')}</th>
                <th className={`px-4 py-3 text-[11px] font-semibold uppercase tracking-wider ${isRTL ? 'text-right' : 'text-left'}`}>{L('code')}</th>
                <th className={`px-4 py-3 text-[11px] font-semibold uppercase tracking-wider ${isRTL ? 'text-right' : 'text-left'}`}>{L('qty')}</th>
                <th className={`px-4 py-3 text-[11px] font-semibold uppercase tracking-wider ${isRTL ? 'text-right' : 'text-left'}`}>{L('price')}</th>
                <th className={`px-4 py-3 text-[11px] font-semibold uppercase tracking-wider ${isRTL ? 'text-left' : 'text-right'}`}>{L('total')}</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((it, i) => (
                <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}>
                  <td className={`px-4 py-2.5 text-xs text-slate-400 ${isRTL ? 'text-right' : 'text-left'}`}>{i + 1}</td>
                  <td className={`px-4 py-2.5 text-[13px] font-medium text-slate-800 ${isRTL ? 'text-right' : 'text-left'}`}>{it.itemName}</td>
                  <td className={`px-4 py-2.5 text-[11px] text-slate-400 font-mono ${isRTL ? 'text-right' : 'text-left'}`}>{it.itemId}</td>
                  <td className={`px-4 py-2.5 text-[13px] text-slate-600 ${isRTL ? 'text-right' : 'text-left'}`}>{it.quantity}</td>
                  <td className={`px-4 py-2.5 text-[13px] font-mono text-slate-600 ${isRTL ? 'text-right' : 'text-left'}`}>{money(it.unitPrice)}</td>
                  <td className={`px-4 py-2.5 text-[13px] font-mono font-semibold text-slate-800 ${isRTL ? 'text-left' : 'text-right'}`}>{money(it.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── Totals Card ── */}
        <div className={`max-w-xs ${isRTL ? 'mr-auto' : 'ml-auto'}`}>
          <div className="rounded-lg p-4" style={{ background: '#f8fafc', borderLeft: isRTL ? 'none' : `3px solid ${accent}`, borderRight: isRTL ? `3px solid ${accent}` : 'none' }}>
            <div className="space-y-1.5">
              <div className="flex justify-between text-[13px]">
                <span className="text-slate-500">{L('subtotal')}</span>
                <span className="font-mono text-slate-700">{money(invoice.subtotal)}</span>
              </div>
              {invoice.discount > 0 && (
                <div className="flex justify-between text-[13px]">
                  <span className="text-slate-500">{L('discount')}</span>
                  <span className="font-mono text-red-500">-{money(invoice.discount)}</span>
                </div>
              )}
              {invoice.extraCharges.map((c, i) => (
                <div key={i} className="flex justify-between text-[13px]">
                  <span className="text-slate-500">{c.description}</span>
                  <span className="font-mono text-slate-700">{money(c.amount)}</span>
                </div>
              ))}
              <div className="flex justify-between text-[13px] font-semibold pt-2 mt-1" style={{ borderTop: '1px solid #e2e8f0' }}>
                <span className="text-slate-700">{L('grandTotal')}</span>
                <span className="font-mono text-slate-800">{money(invoice.total)}</span>
              </div>
              {design.showPreviousBalance && (
                <div className="flex justify-between text-[13px]">
                  <span className="text-slate-500">{L('previousBalance')}</span>
                  <span className="font-mono text-slate-700">{money(prevBalance)}</span>
                </div>
              )}
              {design.showPreviousBalance && (
                <div className="flex justify-between text-base font-bold pt-1">
                  <span className="text-slate-800">{L('totalDue')}</span>
                  <span className="font-mono" style={{ color: accent }}>{money(totalDue)}</span>
                </div>
              )}
              <div className="flex justify-between text-[13px]">
                <span className="text-slate-500">{L('paid')}</span>
                <span className="font-mono text-emerald-600">{money(invoice.paid)}</span>
              </div>
              <div className="flex justify-between text-base font-bold pt-2 mt-1" style={{ borderTop: '2px solid #e2e8f0' }}>
                <span className="text-slate-800">{L('remaining')}</span>
                <span className="font-mono text-red-600">{money(remaining)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        {(thankYou || footerCustom || footerLines) && (
          <div className="mt-8 pt-5 text-center text-[11px] text-slate-400 space-y-1" style={{ borderTop: '1px solid #e2e8f0' }}>
            {thankYou && <p className="font-medium text-slate-500">{thankYou}</p>}
            {footerCustom && <p>{footerCustom}</p>}
            {footerLines && <p className="text-slate-300">{footerLines}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
