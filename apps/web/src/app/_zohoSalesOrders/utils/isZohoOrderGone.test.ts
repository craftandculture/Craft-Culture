import { describe, expect, it } from 'vitest';

import isZohoOrderGone from './isZohoOrderGone';

describe('isZohoOrderGone', () => {
  it('treats a 404 or a does-not-exist answer as deleted', () => {
    expect(isZohoOrderGone(new Error('Zoho API error: 404 - {}'))).toBe(true);
    expect(
      isZohoOrderGone(
        new Error('Zoho API error: 400 - {"code":1002,"message":"Sales Order does not exist."}'),
      ),
    ).toBe(true);
  });

  it('does not treat an outage as deleted', () => {
    expect(isZohoOrderGone(new Error('Zoho API request timed out: /salesorders/1'))).toBe(false);
    expect(isZohoOrderGone(new Error('Zoho API error: 500 - Internal error'))).toBe(false);
    expect(
      isZohoOrderGone(
        new Error('Zoho API request timed out: /salesorders/3456789000001002404'),
      ),
    ).toBe(false);
    expect(isZohoOrderGone(new Error('Failed to refresh Zoho token: 401 - invalid'))).toBe(false);
  });
});
