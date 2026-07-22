import { describe, it, expect } from 'vitest';
import { parseLocally } from '@/services/ai/localParser';
import { getDefaultState } from '@/db';

describe('parseLocally', () => {
  it('returns null for unrelated queries', () => {
    const result = parseLocally('مرحبا كيف حالك', getDefaultState());
    expect(result).toBeNull();
  });

  it('parses navigation to inventory', () => {
    const result = parseLocally('اذهب الى المخازن', getDefaultState());
    expect(result).not.toBeNull();
    expect(result!.action!.type).toBe('NAVIGATE');
    expect(result!.action!.data.module).toBe('inventory');
  });

  it('parses navigation in english', () => {
    const result = parseLocally('go to settings', getDefaultState());
    expect(result).not.toBeNull();
    expect(result!.action!.type).toBe('NAVIGATE');
    expect(result!.action!.data.module).toBe('settings');
  });

  it('parses add item with sale price', () => {
    const result = parseLocally('اضف صنف كوكا كولا بسعر 10', getDefaultState());
    expect(result).not.toBeNull();
    expect(result!.action!.type).toBe('ADD_ITEM');
    expect(result!.action!.data.salePrice).toBe(10);
    expect(result!.action!.data.name).toContain('كوكا');
  });

  it('derives purchase price from sale price when not given', () => {
    const result = parseLocally('add item Pepsi price 5', getDefaultState());
    expect(result).not.toBeNull();
    expect(result!.action!.data.salePrice).toBe(5);
    // purchase = salePrice * 0.7 = 3.5
    expect(result!.action!.data.purchasePrice).toBe(3.5);
    expect(result!.action!.data.wholesalePrice).toBe(4.5);
  });

  it('parses add customer with phone', () => {
    const result = parseLocally('اضف عميل اسمه احمد تليفون 0102030', getDefaultState());
    expect(result).not.toBeNull();
    expect(result!.action!.type).toBe('ADD_CUSTOMER');
    expect(result!.action!.data.name).toBe('احمد');
    expect(result!.action!.data.phone).toBe('0102030');
  });

  it('parses add supplier', () => {
    const result = parseLocally('اضف مورد اسمه شركة الامل تليفون 0102030', getDefaultState());
    expect(result).not.toBeNull();
    expect(result!.action!.type).toBe('ADD_SUPPLIER');
    expect(result!.action!.data.name).toBe('شركة الامل');
  });

  it('parses expense transaction', () => {
    const result = parseLocally('اضف مصروف 500 كهرباء', getDefaultState());
    expect(result).not.toBeNull();
    expect(result!.action!.type).toBe('ADD_TRANSACTION');
    expect(result!.action!.data.type).toBe('expense');
    expect(result!.action!.data.amount).toBe(500);
  });

  it('parses income transaction', () => {
    const result = parseLocally('سجل ايراد 1000 مبيعات', getDefaultState());
    expect(result).not.toBeNull();
    expect(result!.action!.type).toBe('ADD_TRANSACTION');
    expect(result!.action!.data.type).toBe('income');
    expect(result!.action!.data.amount).toBe(1000);
  });

  it('parses add employee with salary', () => {
    const result = parseLocally('اضف موظف اسمه احمد براتب 3000 محاسب', getDefaultState());
    expect(result).not.toBeNull();
    expect(result!.action!.type).toBe('ADD_EMPLOYEE');
    expect(result!.action!.data.salary).toBe(3000);
    expect(result!.action!.data.jobTitle).toBe('محاسب');
  });
});
