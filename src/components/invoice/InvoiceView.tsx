// ============================================================
// Easy Store ERP - نافذة عرض/طباعة الفاتورة (Invoice View Modal)
// ------------------------------------------------------------
// تعرض الفاتورة بتصميم المالك القابل للتخصيص وتتيح الطباعة.
// ============================================================

import { useTranslation } from 'react-i18next';
import { Printer, X } from 'lucide-react';
import type { SaleInvoice, PurchaseInvoice, InvoiceType, Customer, Supplier } from '@/types';
import { useApp } from '@/context/AppContext';
import { InvoiceDocument } from './InvoiceDocument';
import { normalizeInvoice } from './invoiceModel';
import { buildInvoicePrintHtml, printInvoice } from './invoicePrint';

interface InvoiceViewProps {
  invoice: SaleInvoice | PurchaseInvoice;
  type: InvoiceType;
  party?: Customer | Supplier;
  onClose: () => void;
}

export function InvoiceView({ invoice, type, party, onClose }: InvoiceViewProps) {
  const { t, i18n } = useTranslation();
  const isRTL = i18n.language === 'ar';
  const { state } = useApp();
  const { company, invoiceDesign } = state.data;

  const previousBalance = computePreviousBalance();
  const normalized = normalizeInvoice(invoice, party, previousBalance);

  function computePreviousBalance(): number {
    // الأولوية للقيمة المخزّنة في الفاتورة (لقطة وقت الإنشاء)
    if ('previousBalance' in invoice && typeof invoice.previousBalance === 'number') {
      return invoice.previousBalance;
    }
    const partyId =
      'customerId' in invoice ? invoice.customerId : invoice.supplierId;
    if (!partyId) return party?.balance ?? 0;
    const list =
      type === 'purchase' ? state.data.purchaseInvoices : state.data.salesInvoices;
    const prior = list
      .filter(inv => {
        const pid = 'customerId' in inv ? inv.customerId : inv.supplierId;
        return pid === partyId && inv.id !== invoice.id;
      })
      .filter(inv => Math.max(0, inv.total - inv.paid) > 0)
      .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
    if (prior.length === 0) return 0;
    return Math.max(0, prior[0].total - prior[0].paid);
  }

  const handlePrint = () => {
    const html = buildInvoicePrintHtml(normalized, company, invoiceDesign, type, isRTL);
    printInvoice(html);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-card rounded-2xl shadow-xl w-full max-w-4xl max-h-[92vh] overflow-hidden flex flex-col">
        <div className={`px-5 py-4 border-b border-border flex items-center justify-between bg-muted/50 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <h3 className="text-lg font-semibold text-foreground">{t('invoice.view')}</h3>
          <div className={`flex items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <button onClick={handlePrint} className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90">
              <Printer size={16} /> {t('invoice.print')}
            </button>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-accent text-muted-foreground"><X size={18} /></button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4 bg-muted/30">
          <div className="mx-auto max-w-3xl shadow-sm rounded-lg overflow-hidden">
            <InvoiceDocument invoice={normalized} company={company} design={invoiceDesign} type={type} isRTL={isRTL} />
          </div>
        </div>
      </div>
    </div>
  );
}
