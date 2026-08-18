import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FocusTrap } from '@/components/ui/FocusTrap';
import { useApp } from '@/context/AppContext';
import { simulateEInvoicePackage, type SimulatedEInvoicePackage } from '@/services/einvoice';
import type { SaleInvoice } from '@/types';
import { FileCode, AlertCircle, Copy, Check } from 'lucide-react';

export function SimulatedEInvoiceModal({
  isOpen,
  onClose,
  invoice,
}: {
  isOpen: boolean;
  onClose: () => void;
  invoice: SaleInvoice | null;
}) {
  const { state, showToast } = useApp();
  const { t, i18n } = useTranslation();
  const [pkg, setPkg] = useState<SimulatedEInvoicePackage | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (invoice) {
      simulateEInvoicePackage(invoice, state.data.company).then(setPkg);
    }
  }, [invoice, state.data.company]);

  if (!isOpen || !invoice || !pkg) return null;

  const handleCopyXml = () => {
    navigator.clipboard.writeText(pkg.xmlPayload);
    setCopied(true);
    showToast(t('einvoice.xmlCopiedSuccess'), 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <FocusTrap>
    <div role="dialog" aria-modal="true" className={`fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 ${i18n.language === 'ar' ? 'dir-rtl text-right' : 'dir-ltr text-left'}`}>
      <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b pb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <FileCode className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">{t('einvoice.previewTitle')}</h3>
              <p className="text-xs text-gray-500">{t('einvoice.invoiceNumber')}: {invoice.invoiceNumber}</p>
            </div>
          </div>
        </div>

        {/* Disclaimer Banner */}
        <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <span>{pkg.disclaimerAr}</span>
        </div>

        <div className="space-y-3 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="bg-gray-50 p-3 rounded-xl border space-y-1">
              <div className="font-bold text-gray-700">{t('einvoice.uuidLabel')}:</div>
              <div className="font-mono text-[11px] text-blue-600 break-all">{pkg.uuid}</div>
            </div>

            <div className="bg-gray-50 p-3 rounded-xl border space-y-1">
              <div className="font-bold text-gray-700">{t('einvoice.hashLabel')}:</div>
              <div className="font-mono text-[11px] text-gray-600 break-all">{pkg.invoiceHash}</div>
            </div>
          </div>

          <div className="bg-gray-50 p-3 rounded-xl border space-y-1">
            <div className="font-bold text-gray-700">{t('einvoice.gs1Label')}:</div>
            <div className="font-mono text-emerald-700 font-bold">{pkg.gs1CodeMapped}</div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="font-bold text-gray-700">{t('einvoice.xmlLabel')}:</span>
              <button
                onClick={handleCopyXml}
                className="text-blue-600 hover:text-blue-800 flex items-center gap-1 font-medium"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? t('einvoice.copied') : t('einvoice.copyXml')}</span>
              </button>
            </div>
            <textarea
              readOnly
              rows={8}
              value={pkg.xmlPayload}
              className="w-full font-mono text-[11px] p-3 border rounded-xl bg-gray-900 text-emerald-400 text-left dir-ltr"
            />
          </div>
        </div>

        <div className="flex justify-end pt-3 border-t">
          <button onClick={onClose} className="px-5 py-2 text-white bg-blue-600 rounded-xl text-sm font-bold">
            {t('einvoice.closePreview')}
          </button>
        </div>
      </div>
    </div>
    </FocusTrap>
  );
}
