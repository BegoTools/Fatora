import { describe, it, expect } from 'vitest';
import { recalcCustomerBalances } from '@/context/AppContext';
import { getDefaultState } from '@/db';
import type { AppState, Customer, SaleInvoice, ReturnInvoice, ExchangeInvoice, CustomerAdjustment } from '@/types';

function makeCustomer(id: string, balance = 0): Customer {
  return {
    id,
    name: id,
    nameAr: id,
    phone: '',
    email: '',
    address: '',
    creditLimit: 0,
    balance,
    isActive: true,
    createdAt: '2024-01-01T00:00:00.000Z',
  };
}

describe('recalcCustomerBalances', () => {
  it('zeros balances when no documents exist', () => {
    const data: AppState = {
      ...getDefaultState(),
      customers: [makeCustomer('c1', 999)],
    };
    const result = recalcCustomerBalances(data);
    expect(result.customers[0].balance).toBe(0);
  });

  it('adds unpaid sale remainder to customer balance', () => {
    const sale: SaleInvoice = {
      id: 'sale-1',
      invoiceNumber: '1',
      customerId: 'c1',
      customerName: 'c1',
      items: [],
      subtotal: 100,
      discount: 0,
      total: 100,
      paid: 30,
      remaining: 70,
      paymentMethod: 'cash',
      paymentStatus: 'partial',
      notes: '',
      extraCharges: [],
      createdAt: '2024-01-01T00:00:00.000Z',
      createdBy: 'test',
    };
    const data: AppState = {
      ...getDefaultState(),
      customers: [makeCustomer('c1')],
      salesInvoices: [sale],
    };
    const result = recalcCustomerBalances(data);
    expect(result.customers[0].balance).toBe(70);
  });

  it('reduces balance by returned refund minus return total', () => {
    const sale: SaleInvoice = {
      id: 'sale-1', invoiceNumber: '1', customerId: 'c1', customerName: 'c1',
      items: [], subtotal: 100, discount: 0, total: 100, paid: 100, remaining: 0,
      paymentMethod: 'cash', paymentStatus: 'paid', notes: '', extraCharges: [],
      createdAt: '2024-01-01T00:00:00.000Z', createdBy: 'test',
    };
    const ret: ReturnInvoice = {
      id: 'ret-1', returnNumber: 'R1', originalInvoiceId: 'sale-1', originalInvoiceNumber: '1',
      customerId: 'c1', customerName: 'c1', items: [], total: 40, refund: 40,
      notes: '', createdAt: '2024-01-02T00:00:00.000Z', createdBy: 'test',
    };
    const data: AppState = {
      ...getDefaultState(),
      customers: [makeCustomer('c1')],
      salesInvoices: [sale],
      returns: [ret],
    };
    const result = recalcCustomerBalances(data);
    // balance = (100-100) + (40-40) = 0
    expect(result.customers[0].balance).toBe(0);
  });

  it('applies exchange price difference', () => {
    const ex: ExchangeInvoice = {
      id: 'ex-1', exchangeNumber: 'E1', originalInvoiceId: null, originalInvoiceNumber: '',
      customerId: 'c1', customerName: 'c1', returnedItems: [], newItems: [],
      returnedTotal: 50, newTotal: 80, priceDifference: 30, paid: 10,
      notes: '', createdAt: '2024-01-03T00:00:00.000Z', createdBy: 'test',
    };
    const data: AppState = {
      ...getDefaultState(),
      customers: [makeCustomer('c1')],
      exchanges: [ex],
    };
    const result = recalcCustomerBalances(data);
    // balance = (priceDifference) - paid = 30 - 10 = 20
    expect(result.customers[0].balance).toBe(20);
  });

  it('applies manual customer adjustments', () => {
    const adj: CustomerAdjustment = {
      id: 'adj-1', customerId: 'c1', amount: 15.5, reason: 'fix',
      createdAt: '2024-01-04T00:00:00.000Z', createdBy: 'test',
    };
    const data: AppState = {
      ...getDefaultState(),
      customers: [makeCustomer('c1')],
      customerAdjustments: [adj],
    };
    const result = recalcCustomerBalances(data);
    expect(result.customers[0].balance).toBe(15.5);
  });

  it('rounds balances to two decimals', () => {
    const sale: SaleInvoice = {
      id: 'sale-1', invoiceNumber: '1', customerId: 'c1', customerName: 'c1',
      items: [], subtotal: 100, discount: 0, total: 100.005, paid: 0, remaining: 100.005,
      paymentMethod: 'cash', paymentStatus: 'unpaid', notes: '', extraCharges: [],
      createdAt: '2024-01-01T00:00:00.000Z', createdBy: 'test',
    };
    const data: AppState = {
      ...getDefaultState(),
      customers: [makeCustomer('c1')],
      salesInvoices: [sale],
    };
    const result = recalcCustomerBalances(data);
    // Math.round(100.005 * 100)/100 = 100.01 (JS Math.round rounds 10000.5 -> 10001)
    expect(result.customers[0].balance).toBe(100.01);
  });
});
