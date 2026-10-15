import { describe, expect, it } from 'vitest';

import describeInvoicing from './describeInvoicing';

describe('describeInvoicing', () => {
  it('is nothing until a line is marked delivered', () => {
    expect(describeInvoicing({ lines: 3, pending: 0, invoiced: 0 })).toBeNull();
  });

  it('is pending while any delivered line waits for its invoice', () => {
    expect(describeInvoicing({ lines: 3, pending: 1, invoiced: 2 })).toEqual({
      state: 'pending',
      label: 'Delivered – Manual Invoice Pending',
    });
  });

  it('is invoiced once every delivered line has an invoice', () => {
    expect(describeInvoicing({ lines: 3, pending: 0, invoiced: 3 })?.label).toBe(
      'Delivered – Invoiced',
    );
  });

  it('says how much of a part delivery it covers', () => {
    expect(describeInvoicing({ lines: 5, pending: 2, invoiced: 1 })?.label).toBe(
      'Delivered – Manual Invoice Pending (3 of 5 lines)',
    );
  });
});
