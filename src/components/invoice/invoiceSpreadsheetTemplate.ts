import type { InvoiceSheetCellStyle, InvoiceSpreadsheetLayout } from '@/types';

const id = (row: number, column: number) => `${row}:${column}`;
const cell = (row: number, column: number, value: string, columnSpan = 1, rowSpan = 1, style: InvoiceSheetCellStyle = {}) => ({ id: id(row, column), row, column, value, columnSpan, rowSpan, style });

/** A cell-for-cell HTML layout of the approved workbook: شكل الفواتير.xlsx. */
export function createInvoiceSpreadsheetTemplate(): InvoiceSpreadsheetLayout {
  const border = { border: true };
  const label = { ...border, bold: true };
  const input = { ...border };
  const totalLabel = { ...border, backgroundColor: '#434343', color: '#ffffff', fontSize: 11, align: 'right' as const };
  const itemHeading = { ...border, backgroundColor: '#000000', color: '#ffffff', fontSize: 12, align: 'center' as const };

  return {
    // Workbook columns B:F.  The center gutter (D) is intentionally narrow.
    columnWidths: [116, 118, 34, 122, 122],
    // Workbook rows 1:33.  The blue title and logo are merged across rows 3:5.
    rowHeights: [12, 12, 32, 32, 32, 14, 26, 26, 26, 26, 26, 28, ...Array(15).fill(23), 27, 27, 27, 27, 14, 28],
    cells: [
      cell(2, 0, '{{company.name}}', 4, 3, { ...border, backgroundColor: '#4A86E8', color: '#ffffff', fontSize: 30, align: 'center' }),
      cell(2, 4, '{{company.logo}}', 1, 3, { ...border, bold: true, fontSize: 24, align: 'center' }),

      cell(6, 0, 'رقم هاتف الشركة', 1, 1, label), cell(6, 1, '{{company.phone}}', 1, 1, input), cell(6, 3, 'التاريخ والوقت', 1, 1, { ...label, fontSize: 10 }), cell(6, 4, '{{invoice.dateTime}}', 1, 1, input),
      cell(7, 0, 'رقم الفاتورة', 1, 1, label), cell(7, 1, '{{invoice.number}}', 1, 1, input), cell(7, 3, 'رقم الفاتورة:', 1, 1, { ...label, fontSize: 10 }), cell(7, 4, '{{invoice.number}}', 1, 1, input),
      cell(8, 0, 'اسم يحدده المالك', 1, 1, label), cell(8, 1, '{{owner.name1}}', 1, 1, input), cell(8, 3, 'البائع:', 1, 1, { ...label, fontSize: 10 }), cell(8, 4, '{{seller.name}}', 1, 1, input),
      cell(9, 0, 'اسم يحدده المالك', 1, 1, label), cell(9, 1, '{{owner.name2}}', 1, 1, input), cell(9, 3, 'الإدارة:', 1, 1, { ...label, fontSize: 10 }), cell(9, 4, '{{management.name}}', 1, 1, input),
      cell(10, 0, 'اسم العميل', 1, 1, label), cell(10, 1, '{{customer.name}}', 1, 1, input), cell(10, 3, 'العميل:', 1, 1, { ...label, fontSize: 10 }), cell(10, 4, '{{customer.name}}', 1, 1, input),

      cell(11, 0, 'كود المنتج', 1, 1, itemHeading), cell(11, 1, 'اسم المنتج', 1, 1, itemHeading), cell(11, 2, 'الكمية', 1, 1, itemHeading), cell(11, 3, 'السعر', 1, 1, itemHeading), cell(11, 4, 'الإجمالي', 1, 1, itemHeading),
      // 15 individual item rows — each row has 5 cells that get filled dynamically
      ...Array.from({ length: 15 }, (_, i) => [
        cell(12 + i, 0, `{{item.${i}.code}}`, 1, 1, input),
        cell(12 + i, 1, `{{item.${i}.name}}`, 1, 1, input),
        cell(12 + i, 2, `{{item.${i}.qty}}`, 1, 1, { ...input, align: 'center' as const }),
        cell(12 + i, 3, `{{item.${i}.price}}`, 1, 1, { ...input, align: 'center' as const }),
        cell(12 + i, 4, `{{item.${i}.total}}`, 1, 1, { ...input, align: 'center' as const }),
      ]).flat(),

      cell(27, 0, '{{invoice.total}}', 1, 1, input), cell(27, 1, 'الإجمالي Total', 2, 1, totalLabel),
      cell(28, 0, '{{customer.balance}}', 1, 1, input), cell(28, 1, 'حساب سابق', 2, 1, totalLabel),
      cell(29, 0, '{{invoice.paid}}', 1, 1, input), cell(29, 1, 'تحت الحساب', 2, 1, totalLabel),
      cell(30, 0, '{{invoice.net}}', 1, 1, input), cell(30, 1, 'الصافي Net', 2, 1, totalLabel),

      cell(32, 0, '{{company.email}}', 2, 1, { ...border, fontSize: 13, align: 'center' }), cell(32, 2, '{{company.phone}}', 1, 1, { ...border, fontSize: 13, align: 'center' }), cell(32, 3, '{{company.address}}', 2, 1, { ...border, fontSize: 13, align: 'center' }),
    ],
  };
}

/** Rejects the short-lived pre-workbook layout so saved users are upgraded automatically. */
export function resolveInvoiceSpreadsheetTemplate(sheet?: InvoiceSpreadsheetLayout): InvoiceSpreadsheetLayout {
  const hasWorkbookHeader = sheet?.cells.some(cell => cell.value === '{{company.name}}' && cell.row === 2 && cell.columnSpan === 4 && cell.rowSpan === 3);
  if (!sheet || sheet.columnWidths.length !== 5 || sheet.rowHeights.length !== 33 || !hasWorkbookHeader) {
    return createInvoiceSpreadsheetTemplate();
  }
  // Auto-upgrade: if the old merged {{items.table}} cell exists, replace with individual item cells
  const hasOldItemsTable = sheet.cells.some(cell => cell.value === '{{items.table}}');
  if (hasOldItemsTable) {
    return createInvoiceSpreadsheetTemplate();
  }
  return sheet;
}
