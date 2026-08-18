// ============================================================
// Easy Store ERP - محاكي التوافق البنيوي للفوترة والإيصال الإلكتروني
// (ZATCA Phase-2 & Egyptian EGS/GS1 E-Invoicing Structural Simulator - Section 6.2 / 6.3)
// ------------------------------------------------------------
// - توليد كود UUID v4 وصيغة HASH SHA-256 للمستند.
// - محاكاة ملف XML المعتمد ضريبيًا لـ ZATCA المرحلة الثانية.
// - محاكاة التكويد الموحد GS1 / EGS للإيصال الإلكتروني المصري.
// - ملحوظة قانونية: العمليات محلية 100% للتوافق البنيوي وبدون أي إرسال خارجي.
// ============================================================

import type { SaleInvoice, CompanySettings } from '@/types';
import { generateTaxQr } from './taxQr';

export interface SimulatedEInvoicePackage {
  uuid: string;
  invoiceHash: string;
  xmlPayload: string;
  qrCodeBase64: string;
  gs1CodeMapped: string;
  disclaimerAr: string;
  generatedAt: string;
}

export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export async function computeSHA256(input: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const enc = new TextEncoder().encode(input);
    const buf = await crypto.subtle.digest('SHA-256', enc);
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
  }
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(64, '0');
}

/**
 * دالة محاكاة الفاتورة/الإيصال الإلكتروني الشكلي
 */
export async function simulateEInvoicePackage(
  invoice: SaleInvoice,
  company: CompanySettings
): Promise<SimulatedEInvoicePackage> {
  const uuid = generateUUID();
  const rawData = `${invoice.id}|${invoice.total}|${company.taxId || 'TAX-000'}|${invoice.createdAt}`;
  const invoiceHash = await computeSHA256(rawData);

  const qrCodeBase64 = generateTaxQr({
    sellerName: company.nameAr || company.name || 'Easy Store',
    vatNumber: company.taxId || '300000000000003',
    timestamp: invoice.createdAt,
    totalInclTax: invoice.total,
    taxAmount: invoice.taxAmount || 0,
  });

  const gs1CodeMapped = `EG-${company.taxId || '10000'}-${invoice.id.substring(0, 8)}`;

  const xmlPayload = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2">
  <cbc:UBLVersionID>2.1</cbc:UBLVersionID>
  <cbc:CustomizationID>ZATCA-2.0 / ETA-EGS-1.0</cbc:CustomizationID>
  <cbc:ID>${invoice.invoiceNumber}</cbc:ID>
  <cbc:UUID>${uuid}</cbc:UUID>
  <cbc:IssueDate>${invoice.createdAt.split('T')[0]}</cbc:IssueDate>
  <cbc:IssueTime>${(invoice.createdAt.split('T')[1] || '00:00:00').substring(0, 8)}</cbc:IssueTime>
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyTaxScheme>
        <cbc:CompanyID>${company.taxId || '300000000000003'}</cbc:CompanyID>
      </cac:PartyTaxScheme>
    </cac:Party>
  </cac:AccountingSupplierParty>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="${company.currency || 'EGP'}">${invoice.subtotal}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="${company.currency || 'EGP'}">${invoice.taxableAmount || invoice.subtotal}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="${company.currency || 'EGP'}">${invoice.total}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="${company.currency || 'EGP'}">${invoice.total}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
</Invoice>`;

  const disclaimerAr =
    'تنبيه: هذه الوظيفة تُجهّز الملفات بصيغة متوافقة شكليًا مع معايير الفوترة الإلكترونية، ولا ترسلها فعليًا لأي جهة حكومية — الإرسال الفعلي يتطلب تكاملاً واعتمادًا رسميًا خارج نطاق هذا التطبيق المحلي.';

  return {
    uuid,
    invoiceHash,
    xmlPayload,
    qrCodeBase64,
    gs1CodeMapped,
    disclaimerAr,
    generatedAt: new Date().toISOString(),
  };
}
