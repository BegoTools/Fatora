import type { CompanySettings, InvoiceDesign, InvoiceType, InvoiceSectionId } from '@/types';
import type { NormalizedInvoice } from './invoiceModel';
import { InvoiceSpreadsheetPreview } from './InvoiceSpreadsheetDesigner';
import { resolveInvoiceSpreadsheetTemplate } from './invoiceSpreadsheetTemplate';

interface InvoiceDocumentProps {
  invoice: NormalizedInvoice;
  company: CompanySettings;
  design: InvoiceDesign;
  type: InvoiceType;
  isRTL: boolean;
  editable?: boolean;
  selectedSection?: InvoiceSectionId;
  onSelectSection?: (section: InvoiceSectionId) => void;
  onSectionStyleChange?: (section: InvoiceSectionId, patch: { width?: number; height?: number; backgroundColor?: string; textColor?: string }) => void;
  onSectionMove?: (from: InvoiceSectionId, to: InvoiceSectionId) => void;
}

/** Preview of the approved Excel invoice template (شكل الفواتير.xlsx). */
export function InvoiceDocument({ invoice, company, design, isRTL }: InvoiceDocumentProps) {
  // Use the spreadsheet-based design the user configured in Settings
  return <InvoiceSpreadsheetPreview sheet={resolveInvoiceSpreadsheetTemplate(design.spreadsheet)} invoice={invoice} company={company} design={design} isRTL={isRTL} />;
}
