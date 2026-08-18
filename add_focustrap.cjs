const fs = require('fs');
const path = require('path');

const files = [
  'src/components/cashAudit/CashAuditModal.tsx',
  'src/components/database/DatabaseMaintenanceModal.tsx',
  'src/components/einvoice/SimulatedEInvoiceModal.tsx',
  'src/components/invoice/InvoiceView.tsx',
  'src/components/sectors/SectorProfileModal.tsx'
];

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  if (content.includes('FocusTrap')) return; // already added

  // Find the last import
  const lastImportIndex = content.lastIndexOf('import ');
  const insertIndex = content.indexOf('\n', lastImportIndex) + 1;
  content = content.slice(0, insertIndex) + "import { FocusTrap } from '@/components/ui/FocusTrap';\n" + content.slice(insertIndex);

  // Replace <div role="dialog"... with <FocusTrap><div role="dialog"...
  content = content.replace(/(<div[^>]*role="dialog"[^>]*>)/, '<FocusTrap>\n      $1');
  
  // Now we need to add </FocusTrap> before the last closing tag of the condition rendering the modal.
  // We can just find the matching closing div for the fixed inset-0, but since this is usually the top-level return or wrapped in a portal, it's safer to do this with regex.
  // Most of these files return the modal directly, so it's at the end, or inside a condition.
  // Actually, wait, let's just do it manually with file replace.
});
