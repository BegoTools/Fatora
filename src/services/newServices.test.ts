import { describe, it, expect } from 'vitest';
import { getDefaultState } from '@/db';
import { postJournalEntry, buildSaleJournalLines } from './journal';
import { getSectorProfile, parseCustomSectorProfile } from './sectors';
import { parseWeightScaleBarcode } from './weightScale';
import { performCashAudit } from './cashAudit';
import { createMaintenanceReceipt, updateMaintenanceStatus, getTechnicianLedger } from './maintenance';
import { simulateEInvoicePackage, generateUUID } from './einvoice';
import { clearTransactionsOnly } from './databaseMaintenance';

describe('Journal Engine (postJournalEntry)', () => {
  it('posts a balanced journal entry successfully', () => {
    const state = getDefaultState();
    const res = postJournalEntry(state, {
      sourceType: 'sale',
      sourceId: 'inv-1',
      description: 'Test Sale Invoice',
      lines: [
        { accountId: 'acc-1', accountName: 'Cash', debit: 100, credit: 0 },
        { accountId: 'acc-2', accountName: 'Sales Revenue', debit: 0, credit: 100 },
      ],
    });

    expect(res.entry.totalDebit).toBe(100);
    expect(res.entry.totalCredit).toBe(100);
    expect(res.updatedState.journalEntries).toHaveLength(1);
  });

  it('builds sale journal lines correctly', () => {
    const lines = buildSaleJournalLines({
      customerName: 'Ahmed',
      paidCash: 100,
      remainingCredit: 50,
      subtotalNet: 135,
      taxAmount: 15,
    });
    expect(lines).toHaveLength(4);
  });
});

describe('Sectors & Configuration Engine', () => {
  it('returns builtin sector profiles', () => {
    const clothing = getSectorProfile('clothing');
    expect(clothing.showColorSize).toBe(true);
    const supermarket = getSectorProfile('supermarket');
    expect(supermarket.showWeightScaleBarcode).toBe(true);
  });

  it('parses custom JSON sector profile', () => {
    const customJson = JSON.stringify({
      id: 'custom',
      nameAr: 'قطاع مخصص',
      showColorSize: true,
    });
    const parsed = parseCustomSectorProfile(customJson);
    expect(parsed).not.toBeNull();
    expect(parsed?.nameAr).toBe('قطاع مخصص');
  });
});

describe('Weight Scale Barcode Parser', () => {
  it('parses valid weight scale barcode', () => {
    const parsed = parseWeightScaleBarcode('2100123015004');
    expect(parsed.isWeightScaleBarcode).toBe(true);
    expect(parsed.itemCode).toBe('00123');
    expect(parsed.weightOrValue).toBe(1.5);
  });

  it('ignores standard barcodes', () => {
    const parsed = parseWeightScaleBarcode('6291041500213');
    expect(parsed.isWeightScaleBarcode).toBe(false);
  });
});

describe('Cash Audit & Reconciliation', () => {
  it('detects deficit and creates adjustment journal entry', () => {
    const state = getDefaultState();
    const treasury = state.treasuryAccounts[0]; // balance 0
    const res = performCashAudit(state, {
      treasuryAccount: { ...treasury, balance: 500 },
      actualCashBalance: 400, // deficit 100
    });

    expect(res.auditRecord.status).toBe('deficit');
    expect(res.auditRecord.difference).toBe(-100);
    expect(res.updatedState.journalEntries).toHaveLength(1);
  });
});

describe('Workshops & Maintenance Module', () => {
  it('creates maintenance receipt and tracks status & technician ledger', () => {
    let state = getDefaultState();
    const created = createMaintenanceReceipt(state, {
      customerName: 'Customer A',
      customerPhone: '0100',
      deviceName: 'iPhone 13 Pro',
      reportedFault: 'Screen broken',
      expectedCost: 1000,
      depositPaid: 200,
      technicianName: 'Eng Hassan',
      technicianCommission: 150,
      expectedDeliveryDate: '2026-08-01',
    });

    state = created.updatedState;
    expect(state.maintenanceReceipts).toHaveLength(1);
    expect(created.receipt.status).toBe('received');

    state = updateMaintenanceStatus(state, created.receipt.id, 'ready');
    const ledger = getTechnicianLedger(state);
    expect(ledger[0].technicianName).toBe('Eng Hassan');
    expect(ledger[0].totalCommissions).toBe(150);
  });
});

describe('E-Invoice Structural Simulator', () => {
  it('generates valid structural e-invoice package with UUID and XML', async () => {
    const company = { name: 'My Store', nameAr: 'متجري', taxId: '123456789' } as any;
    const invoice = {
      id: 'inv-101',
      invoiceNumber: 'INV-101',
      total: 114,
      subtotal: 100,
      taxAmount: 14,
      createdAt: new Date().toISOString(),
    } as any;

    const res = await simulateEInvoicePackage(invoice, company);
    expect(generateUUID()).toBeDefined();
    expect(res.uuid).toBeDefined();
    expect(res.xmlPayload).toContain('INV-101');
    expect(res.qrCodeBase64).toBeDefined();
    expect(res.disclaimerAr).toContain('تنبيه');
  });
});

describe('Database Maintenance', () => {
  it('clears transactions while keeping master cards', () => {
    const state = getDefaultState();
    state.customers.push({ id: 'c1', name: 'Cust', balance: 500 } as any);
    state.salesInvoices.push({ id: 's1', total: 100 } as any);

    const cleaned = clearTransactionsOnly(state);
    expect(cleaned.customers).toHaveLength(1);
    expect(cleaned.customers[0].balance).toBe(0);
    expect(cleaned.salesInvoices).toHaveLength(0);
  });
});
