import { describe, it, expect, vi } from 'vitest';
import { executeActionPlan, executeAction } from '@/services/ai/actions';
import { getDefaultState } from '@/db';
import type { AppState } from '@/types';

describe('executeActionPlan', () => {
  function buildContext(): AppState {
    return getDefaultState();
  }

  it('executes a single NAVIGATE action', () => {
    const dispatch = vi.fn();
    const ctx = buildContext();
    const result = executeActionPlan(
      [{ type: 'NAVIGATE', data: { module: 'sales' }, message: 'go', messageAr: 'اذهب' }],
      dispatch,
      ctx,
    );
    expect(result.results).toHaveLength(1);
    expect(result.results[0].success).toBe(true);
    expect(result.navigate).toBe('sales');
    // NAVIGATE does not dispatch
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('executes ADD_ITEM and pushes it into working items context', () => {
    const dispatch = vi.fn();
    const ctx = buildContext();
    const result = executeActionPlan(
      [{ type: 'ADD_ITEM', data: { name: 'Pen', nameAr: 'قلم', salePrice: 5, purchasePrice: 3 }, message: 'add', messageAr: 'اضف' }],
      dispatch,
      ctx,
    );
    expect(result.results[0].success).toBe(true);
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch.mock.calls[0][0].type).toBe('ADD_ITEM');
    expect(dispatch.mock.calls[0][0].payload.name).toBe('Pen');
  });

  it('chains CREATE_PURCHASE after adding item, creating item if missing', () => {
    const dispatch = vi.fn();
    const ctx = buildContext();
    const result = executeActionPlan(
      [
        {
          type: 'CREATE_PURCHASE',
          data: {
            supplierName: 'مورد نقدي',
            items: [{ name: 'Phone', nameAr: 'تليفون', unit: 'piece', quantity: 50, purchasePrice: 10, salePrice: 12 }],
          },
          message: 'purchase',
          messageAr: 'شراء',
        },
      ],
      dispatch,
      ctx,
    );
    expect(result.results[0].success).toBe(true);
    // should dispatch ADD_ITEM (auto-create) then ADD_PURCHASE
    const types = dispatch.mock.calls.map(c => c[0].type);
    expect(types).toContain('ADD_ITEM');
    expect(types).toContain('ADD_PURCHASE');
  });

  it('returns failure for unknown action type', () => {
    const dispatch = vi.fn();
    const ctx = buildContext();
    const r = executeAction(
      { type: 'BOGUS' as never, data: {}, message: '', messageAr: '' },
      dispatch,
      ctx,
    );
    expect(r.success).toBe(false);
    expect(r.message).toContain('Unknown action type');
  });

  it('CREATE_SALE fails when item not found', () => {
    const dispatch = vi.fn();
    const ctx = buildContext();
    const r = executeAction(
      {
        type: 'CREATE_SALE',
        data: { items: [{ name: 'Nonexistent', quantity: 1 }] },
        message: '',
        messageAr: '',
      },
      dispatch,
      ctx,
    );
    expect(r.success).toBe(false);
    expect(r.message).toContain('not found');
  });
});
