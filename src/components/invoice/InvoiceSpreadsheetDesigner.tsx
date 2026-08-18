import { useMemo, useState, type PointerEvent } from 'react';
import { AlignCenter, AlignLeft, AlignRight, Bold, Italic, Merge, RotateCcw, TableCellsMerge, Type } from 'lucide-react';
import type { CompanySettings, InvoiceDesign, InvoiceSheetCell, InvoiceSheetCellStyle, InvoiceSpreadsheetLayout } from '@/types';
import type { NormalizedInvoice } from './invoiceModel';
import { formatMoney } from './invoiceModel';
import { createInvoiceSpreadsheetTemplate } from './invoiceSpreadsheetTemplate';

const cellId = (row: number, column: number) => `${row}:${column}`;
type Selection = { startRow: number; startColumn: number; endRow: number; endColumn: number };
const normalise = (selection: Selection) => ({ startRow: Math.min(selection.startRow, selection.endRow), endRow: Math.max(selection.startRow, selection.endRow), startColumn: Math.min(selection.startColumn, selection.endColumn), endColumn: Math.max(selection.startColumn, selection.endColumn) });
const sampleValues: Record<string, string> = { '{{company.name}}': 'اسم الشركة', '{{company.logo}}': 'Logo', '{{company.phone}}': '01000000000', '{{company.email}}': 'email@example.com', '{{company.address}}': 'عنوان الشركة', '{{invoice.number}}': 'INV-00001', '{{invoice.dateTime}}': new Date().toLocaleString('ar-EG'), '{{customer.name}}': 'اسم العميل', '{{owner.name1}}': 'اسم المالك الأول', '{{owner.name2}}': 'اسم المالك الثاني', '{{seller.name}}': 'البائع', '{{management.name}}': 'الإدارة', '{{invoice.total}}': '1,250.00 ج.م', '{{customer.balance}}': '150.00 ج.م', '{{invoice.paid}}': '500.00 ج.م', '{{invoice.net}}': '900.00 ج.م', ...Object.fromEntries(Array.from({ length: 15 }, (_, i) => [[`{{item.${i}.code}}`, i < 2 ? `P-${1001 + i}` : ''], [`{{item.${i}.name}}`, i < 2 ? `صنف ${i + 1}` : ''], [`{{item.${i}.qty}}`, i < 2 ? '5' : ''], [`{{item.${i}.price}}`, i < 2 ? '50.00 ج.م' : ''], [`{{item.${i}.total}}`, i < 2 ? '250.00 ج.م' : '']]).flat()) };
const tokens = Object.keys(sampleValues);

interface DesignerProps { value?: InvoiceSpreadsheetLayout; onChange: (next: InvoiceSpreadsheetLayout) => void; }

export function InvoiceSpreadsheetDesigner({ value, onChange }: DesignerProps) {
  const sheet = value || createInvoiceSpreadsheetTemplate();
  const [selection, setSelection] = useState<Selection>({ startRow: 2, startColumn: 0, endRow: 2, endColumn: 0 });
  const [editing, setEditing] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [resizing, setResizing] = useState<{ axis: 'row' | 'column'; index: number; start: number; initial: number } | null>(null);
  const active = normalise(selection);
  const selectedCell = sheet.cells.find(cell => cell.row === active.startRow && cell.column === active.startColumn);
  const selectedIds = sheet.cells.filter(cell => cell.row >= active.startRow && cell.row <= active.endRow && cell.column >= active.startColumn && cell.column <= active.endColumn).map(cell => cell.id);
  const occupied = useMemo(() => new Set(sheet.cells.flatMap(cell => Array.from({ length: cell.rowSpan || 1 }, (_, rowOffset) => Array.from({ length: cell.columnSpan || 1 }, (_, columnOffset) => cellId(cell.row + rowOffset, cell.column + columnOffset))).flat())), [sheet.cells]);
  const style = selectedCell?.style || {};
  const letters = ['B', 'C', 'D', 'E', 'F'].slice(0, sheet.columnWidths.length);
  const gridColumns = sheet.columnWidths.map(width => `${width}px`).join(' ');
  const gridRows = sheet.rowHeights.map(height => `${height}px`).join(' ');

  const commit = (transform: (current: InvoiceSpreadsheetLayout) => InvoiceSpreadsheetLayout) => onChange(transform(sheet));
  const select = (row: number, column: number, extend: boolean) => setSelection(previous => extend ? { ...previous, endRow: row, endColumn: column } : { startRow: row, startColumn: column, endRow: row, endColumn: column });
  const upsert = (row: number, column: number, patch: Partial<InvoiceSheetCell>) => commit(current => {
    const id = cellId(row, column);
    const exists = current.cells.some(cell => cell.id === id);
    return { ...current, cells: exists ? current.cells.map(cell => cell.id === id ? { ...cell, ...patch } : cell) : [...current.cells, { id, row, column, value: '', ...patch }] };
  });
  const updateStyles = (patch: Partial<InvoiceSheetCellStyle>) => commit(current => ({ ...current, cells: current.cells.map(cell => selectedIds.includes(cell.id) ? { ...cell, style: { ...cell.style, ...patch } } : cell) }));
  const merge = () => {
    if (active.startRow === active.endRow && active.startColumn === active.endColumn) return;
    commit(current => {
      const origin = current.cells.find(cell => cell.row === active.startRow && cell.column === active.startColumn);
      const cells = current.cells.filter(cell => !(cell.row >= active.startRow && cell.row <= active.endRow && cell.column >= active.startColumn && cell.column <= active.endColumn));
      return { ...current, cells: [...cells, { ...(origin || { id: cellId(active.startRow, active.startColumn), row: active.startRow, column: active.startColumn, value: '' }), rowSpan: active.endRow - active.startRow + 1, columnSpan: active.endColumn - active.startColumn + 1 }] };
    });
  };
  const resize = (event: PointerEvent<HTMLDivElement>) => {
    if (!resizing) return;
    const movement = (resizing.axis === 'column' ? event.clientX : event.clientY) - resizing.start;
    commit(current => {
      const key = resizing.axis === 'column' ? 'columnWidths' : 'rowHeights';
      const values = [...current[key]];
      values[resizing.index] = Math.max(resizing.axis === 'column' ? 48 : 16, resizing.initial + movement);
      return { ...current, [key]: values };
    });
  };

  return <div dir="rtl" className="overflow-hidden rounded-xl border border-slate-300 bg-slate-100 shadow-sm">
    <div className="flex flex-wrap items-center gap-1 border-b border-slate-300 bg-white p-2 text-slate-700">
      <button type="button" title="عريض" onClick={() => updateStyles({ bold: !style.bold })} className={`rounded p-2 ${style.bold ? 'bg-blue-100 text-blue-700' : 'hover:bg-slate-100'}`}><Bold size={16} /></button>
      <button type="button" title="مائل" onClick={() => updateStyles({ italic: !style.italic })} className={`rounded p-2 ${style.italic ? 'bg-blue-100 text-blue-700' : 'hover:bg-slate-100'}`}><Italic size={16} /></button>
      <label title="حجم الخط" className="flex items-center gap-1 rounded px-1 text-xs"><Type size={15} /><input type="number" min="8" max="64" value={style.fontSize || 13} onChange={event => updateStyles({ fontSize: Number(event.target.value) })} className="w-12 rounded border px-1 py-1" /></label>
      <label className="text-xs">لون النص <input aria-label="لون النص" type="color" value={style.color || '#111827'} onChange={event => updateStyles({ color: event.target.value })} /></label>
      <label className="text-xs">لون الخلية <input aria-label="لون الخلية" type="color" value={style.backgroundColor || '#ffffff'} onChange={event => updateStyles({ backgroundColor: event.target.value })} /></label>
      <button type="button" title="محاذاة يمين" onClick={() => updateStyles({ align: 'right' })} className="rounded p-2 hover:bg-slate-100"><AlignRight size={16} /></button><button type="button" title="توسيط" onClick={() => updateStyles({ align: 'center' })} className="rounded p-2 hover:bg-slate-100"><AlignCenter size={16} /></button><button type="button" title="محاذاة يسار" onClick={() => updateStyles({ align: 'left' })} className="rounded p-2 hover:bg-slate-100"><AlignLeft size={16} /></button>
      <button type="button" onClick={merge} className="inline-flex items-center gap-1 rounded px-2 py-2 text-xs hover:bg-slate-100"><Merge size={16} /> دمج</button>
      <button type="button" onClick={() => updateStyles({ border: !style.border })} className="inline-flex items-center gap-1 rounded px-2 py-2 text-xs hover:bg-slate-100"><TableCellsMerge size={16} /> حدود</button>
      <button type="button" onClick={() => onChange(createInvoiceSpreadsheetTemplate())} className="mr-auto inline-flex items-center gap-1 rounded px-2 py-2 text-xs text-red-600 hover:bg-red-50"><RotateCcw size={15} /> استعادة قالب Excel</button>
    </div>
    <div className="flex items-center gap-2 border-b border-slate-300 bg-white p-2 text-xs"><span className="shrink-0 text-slate-500">الخلية:</span><input value={selectedCell?.value || ''} onChange={event => upsert(active.startRow, active.startColumn, { value: event.target.value })} className="min-w-0 flex-1 rounded border border-slate-300 px-2 py-1.5 font-mono text-[11px]" placeholder="اكتب نصًا أو أضف حقل بيانات" /></div>
    <div className="flex flex-wrap gap-1 border-b border-slate-300 bg-white p-2"><span className="px-1 py-1 text-[11px] text-slate-500">حقول البيانات:</span>{tokens.map(token => <button key={token} type="button" onClick={() => upsert(active.startRow, active.startColumn, { value: token })} className="rounded bg-slate-100 px-2 py-1 text-[10px] hover:bg-blue-100 hover:text-blue-700">{token}</button>)}</div>
    <div className="max-h-[72vh] overflow-auto p-3" onPointerMove={resize} onPointerUp={() => { setResizing(null); setDragging(false); }} onPointerLeave={() => setDragging(false)}>
      <div className="min-w-max select-none">
        <div className="grid" style={{ gridTemplateColumns: `38px ${gridColumns}` }}><div className="h-7 border border-slate-300 bg-slate-200" />{letters.map((letter, column) => <div key={letter} className="relative h-7 border border-slate-300 bg-slate-200 text-center text-xs font-semibold leading-7">{letter}<span onPointerDown={event => { event.preventDefault(); setResizing({ axis: 'column', index: column, start: event.clientX, initial: sheet.columnWidths[column] }); }} className="absolute left-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-500" /></div>)}</div>
        <div className="grid" style={{ gridTemplateColumns: `38px ${gridColumns}`, gridTemplateRows: gridRows }}>{sheet.rowHeights.map((_, row) => <div key={row} className="contents"><div className="relative flex items-center justify-center border border-slate-300 bg-slate-200 text-xs text-slate-600">{row + 1}<span onPointerDown={event => { event.preventDefault(); setResizing({ axis: 'row', index: row, start: event.clientY, initial: sheet.rowHeights[row] }); }} className="absolute bottom-0 h-1 w-full cursor-row-resize hover:bg-blue-500" /></div>{sheet.columnWidths.map((_, column) => {
          const current = sheet.cells.find(cell => cell.row === row && cell.column === column);
          if (!current && occupied.has(cellId(row, column))) return null;
          const cellStyle = current?.style || {};
          const selected = row >= active.startRow && row <= active.endRow && column >= active.startColumn && column <= active.endColumn;
          return <div key={cellId(row, column)} onPointerDown={event => { setDragging(true); select(row, column, event.shiftKey); }} onPointerEnter={() => dragging && select(row, column, true)} onDoubleClick={() => { upsert(row, column, {}); setEditing(cellId(row, column)); }} style={{ gridRow: `${row + 1} / span ${current?.rowSpan || 1}`, gridColumn: `${column + 2} / span ${current?.columnSpan || 1}`, fontWeight: cellStyle.bold ? 700 : undefined, fontStyle: cellStyle.italic ? 'italic' : undefined, fontSize: cellStyle.fontSize, color: cellStyle.color, backgroundColor: cellStyle.backgroundColor || '#fff', textAlign: cellStyle.align, border: cellStyle.border ? '1px solid #64748b' : '1px solid #cbd5e1', outline: selected ? '2px solid #2563eb' : undefined, outlineOffset: -2, zIndex: selected ? 2 : 1 }} className="min-w-0 overflow-hidden px-1.5 py-1 whitespace-pre-wrap">
            {editing === cellId(row, column) ? <input autoFocus value={current?.value || ''} onChange={event => upsert(row, column, { value: event.target.value })} onBlur={() => setEditing(null)} onKeyDown={event => event.key === 'Enter' && setEditing(null)} className="h-full w-full bg-transparent outline-none" /> : current?.value === '{{items.table}}' ? <div className="grid h-full min-h-20 place-items-center bg-slate-50 text-center text-xs text-slate-500">جدول الأصناف يتكرر تلقائيًا</div> : <span>{sampleValues[current?.value || ''] || current?.value}</span>}
          </div>;
        })}</div>)}</div>
      </div>
    </div>
    <p className="border-t border-slate-300 bg-white px-3 py-2 text-[11px] text-slate-500">انقر لتحديد خلية، اكتب في شريط الخلية أو انقر مرتين للكتابة داخلها، واسحب حدود رؤوس الصفوف والأعمدة لتعديل المقاس.</p>
  </div>;
}

export function InvoiceSpreadsheetPreview({ sheet, invoice, company, design, isRTL }: { sheet: InvoiceSpreadsheetLayout; invoice: NormalizedInvoice; company: CompanySettings; design: InvoiceDesign; isRTL: boolean }) {
  const currency = company.currencySymbol || '';
  const values: Record<string, string> = { '{{company.name}}': isRTL ? company.nameAr || company.name : company.name, '{{company.phone}}': company.phone || '—', '{{company.email}}': company.email || '—', '{{company.address}}': company.address || '—', '{{invoice.number}}': invoice.invoiceNumber, '{{invoice.dateTime}}': new Date(invoice.createdAt).toLocaleString(isRTL ? 'ar-EG' : 'en-US'), '{{customer.name}}': invoice.partyName || '—', '{{owner.name1}}': invoice.ownerName1 || '—', '{{owner.name2}}': invoice.ownerName2 || '—', '{{seller.name}}': invoice.createdBy || '—', '{{management.name}}': design.managementName || '—', '{{invoice.total}}': formatMoney(invoice.total, currency), '{{customer.balance}}': formatMoney(invoice.previousBalance || 0, currency), '{{invoice.paid}}': formatMoney(invoice.downPayment || 0, currency), '{{invoice.net}}': formatMoney(invoice.netAmount ?? invoice.total + (invoice.previousBalance || 0) - (invoice.downPayment || 0), currency) };

  // Build dynamic item cell values: {{item.0.code}}, {{item.0.name}}, etc.
  for (let i = 0; i < 15; i++) {
    const item = invoice.items[i];
    values[`{{item.${i}.code}}`] = item ? item.itemId : '';
    values[`{{item.${i}.name}}`] = item ? item.itemName : '';
    values[`{{item.${i}.qty}}`] = item ? String(item.quantity) : '';
    values[`{{item.${i}.price}}`] = item ? formatMoney(item.unitPrice, currency) : '';
    values[`{{item.${i}.total}}`] = item ? formatMoney(item.total, currency) : '';
  }

  const columns = sheet.columnWidths.map(width => `${width}px`).join(' ');
  const rows = sheet.rowHeights.map(height => `${height}px`).join(' ');
  return <div dir={isRTL ? 'rtl' : 'ltr'} className="invoice-sheet bg-white p-5 text-black" style={{ fontFamily: 'Arial, Tahoma, sans-serif', overflowX: 'auto' }}><div className="grid min-w-max" style={{ gridTemplateColumns: columns, gridTemplateRows: rows }}>{sheet.cells.map(cell => {
    const style = cell.style || {};
    const boxStyle = { gridRow: `${cell.row + 1} / span ${cell.rowSpan || 1}`, gridColumn: `${cell.column + 1} / span ${cell.columnSpan || 1}`, fontWeight: style.bold ? 700 : undefined, fontStyle: style.italic ? 'italic' : undefined, fontSize: style.fontSize, color: style.color, backgroundColor: style.backgroundColor || '#fff', textAlign: style.align, border: style.border ? '1px solid #000' : undefined };
    const content = cell.value === '{{company.logo}}' ? (design.showLogo && design.logo ? <img src={design.logo} alt="Logo" className="h-full w-full object-contain" /> : <span>Logo</span>) : (values[cell.value] !== undefined ? values[cell.value] : cell.value);
    return <div key={cell.id} style={boxStyle} className="overflow-hidden px-2 py-1 whitespace-pre-wrap">{content}</div>;
  })}</div></div>;
}
