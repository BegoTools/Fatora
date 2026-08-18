// Local, print-to-PDF report rendering. The browser/Tauri print dialog lets the
// user choose a physical printer or “Save as PDF” without sending any data away.
export interface PrintableReport {
  title: string;
  subtitle?: string;
  columns: string[];
  rows: Array<Array<string | number>>;
  direction?: 'rtl' | 'ltr';
}

const escapeHtml = (value: string | number): string => String(value)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

export function printReport(report: PrintableReport): void {
  const popup = window.open('', '_blank', 'width=1000,height=760');
  if (!popup) return;

  const dir = report.direction ?? 'rtl';
  const header = report.columns.map(column => `<th>${escapeHtml(column)}</th>`).join('');
  const body = report.rows.length
    ? report.rows.map(row => `<tr>${row.map(cell => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')
    : `<tr><td colspan="${report.columns.length}">لا توجد بيانات للفترة المحددة</td></tr>`;

  popup.document.write(`<!doctype html><html dir="${dir}"><head><meta charset="utf-8" />
    <title>${escapeHtml(report.title)}</title><style>
    body { font-family: Arial, sans-serif; color: #172033; padding: 28px; }
    h1 { margin: 0 0 4px; color: #00355f; font-size: 22px; }
    p { margin: 0 0 22px; color: #64748b; font-size: 13px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th { background: #00355f; color: white; text-align: inherit; }
    th, td { padding: 9px; border: 1px solid #dbe3ee; }
    tr:nth-child(even) { background: #f8fafc; }
    @page { size: A4; margin: 14mm; }
    </style></head><body><h1>${escapeHtml(report.title)}</h1>
    ${report.subtitle ? `<p>${escapeHtml(report.subtitle)}</p>` : ''}
    <table><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table></body></html>`);
  popup.document.close();
  popup.focus();
  window.setTimeout(() => popup.print(), 300);
}
