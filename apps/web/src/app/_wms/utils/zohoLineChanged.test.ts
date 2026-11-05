import { describe, expect, it } from 'vitest';

import zohoLineChanged from './zohoLineChanged';

const stored = {
  quantity: 2,
  rate: 100,
  name: 'Château Example 2021',
  itemTotal: 200,
  sku: '1358261-2021-01-00750',
  description: null,
};

const zoho = {
  quantity: 2,
  rate: 100,
  name: 'Château Example 2021',
  item_total: 200,
  sku: '1358261-2021-01-00750',
  description: null,
};

describe('zohoLineChanged', () => {
  it('leaves an identical canonical line alone', () => {
    expect(zohoLineChanged(stored, zoho)).toBe(false);
  });

  it('leaves a line alone when Zoho still has the SKU mis-dashed but ours is canonical', () => {
    expect(
      zohoLineChanged(stored, { ...zoho, sku: '1358261-2021-0100-750' }),
    ).toBe(false);
  });

  it('rewrites a line stored with a mis-dashed SKU', () => {
    expect(
      zohoLineChanged(
        { ...stored, sku: '1358261-2021-0100-750' },
        { ...zoho, sku: '1358261-2021-0100-750' },
      ),
    ).toBe(true);
  });

  it('rewrites a non-LWIN SKU stored untrimmed, once', () => {
    const untrimmed = { ...stored, sku: ' GIN-001 ' };
    expect(zohoLineChanged(untrimmed, { ...zoho, sku: ' GIN-001 ' })).toBe(
      true,
    );
    expect(
      zohoLineChanged({ ...stored, sku: 'GIN-001' }, { ...zoho, sku: ' GIN-001 ' }),
    ).toBe(false);
  });

  it('treats a missing SKU on both sides as unchanged', () => {
    expect(
      zohoLineChanged({ ...stored, sku: null }, { ...zoho, sku: null }),
    ).toBe(false);
    expect(
      zohoLineChanged({ ...stored, sku: null }, { ...zoho, sku: undefined }),
    ).toBe(false);
  });

  it('rewrites a pack change that keeps the same total', () => {
    expect(
      zohoLineChanged(stored, { ...zoho, sku: '1358261-2021-06-00750' }),
    ).toBe(true);
  });

  it('rewrites a quantity change', () => {
    expect(zohoLineChanged(stored, { ...zoho, quantity: 3 })).toBe(true);
  });
});
