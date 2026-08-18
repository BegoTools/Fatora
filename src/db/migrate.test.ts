import { describe, it, expect } from 'vitest';
import { migrate, getDefaultState } from '@/db';
import type { AppState } from '@/types';

describe('migrate', () => {
  it('returns a full default state when given an empty object', () => {
    const result = migrate({});
    const def = getDefaultState();
    expect(result.company.name).toBe(def.company.name);
    expect(result.items).toEqual([]);
    expect(result.treasuryAccounts).toHaveLength(1);
    expect(result.treasuryAccounts[0].type).toBe('safe');
  });

  it('merges company fields without losing defaults', () => {
    const partial: Partial<AppState> = { company: { name: 'My Shop' } as never };
    const result = migrate(partial);
    expect(result.company.name).toBe('My Shop');
    expect(result.company.currency).toBe('EGP');
    expect(result.company.currencySymbol).toBe('ج.م');
  });

  it('merges invoiceDesign nested custom fields', () => {
    const partial: Partial<AppState> = {
      invoiceDesign: {
        accentColor: '#ff0000',
        customField1: { labelEn: 'Branch', labelAr: '', value: 'Cairo' },
      } as never,
    };
    const result = migrate(partial);
    expect(result.invoiceDesign.accentColor).toBe('#ff0000');
    expect(result.invoiceDesign.templateId).toBe('standard');
    expect(result.invoiceDesign.customField1.value).toBe('Cairo');
    // customField2 must still exist from defaults
    expect(result.invoiceDesign.customField2).toBeDefined();
    expect(result.invoiceDesign.customField2.labelEn).toBe('');
  });

  it('normalizes legacy items missing barcodes/subUnits arrays', () => {
    const partial: Partial<AppState> = {
      items: [
        { id: 'item-1', name: 'X', nameAr: 'اكس', barcode: '111' } as never,
      ],
    };
    const result = migrate(partial);
    expect(result.items[0].barcodes).toEqual([]);
    expect(result.items[0].subUnits).toEqual([]);
    expect(result.items[0].barcode).toBe('111');
  });

  it('keeps employeeAdvances as array even if missing in old state', () => {
    const partial: Partial<AppState> = { items: [] } as never;
    const result = migrate(partial);
    expect(Array.isArray(result.employeeAdvances)).toBe(true);
    expect(result.employeeAdvances).toEqual([]);
  });
});
