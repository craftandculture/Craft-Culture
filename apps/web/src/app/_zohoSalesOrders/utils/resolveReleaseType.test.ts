import { describe, expect, it } from 'vitest';

import resolveReleaseType from './resolveReleaseType';

describe('resolveReleaseType', () => {
  it('keeps a type already set', () => {
    expect(
      resolveReleaseType({ customerName: 'City Drinks', reference: null, isPco: false, stored: 'prepaid' }).type,
    ).toBe('prepaid');
  });

  it('reads a private client order as a PCO', () => {
    expect(
      resolveReleaseType({ customerName: 'City Drinks', reference: 'PCO-2026-00150', isPco: false, stored: null }).type,
    ).toBe('pco');
  });

  it('treats other customers as outright', () => {
    expect(
      resolveReleaseType({ customerName: 'The Bottle Store', reference: null, isPco: false, stored: null }).type,
    ).toBe('outright');
  });

  it('suggests consignment from a tag', () => {
    expect(
      resolveReleaseType({ customerName: 'City Drinks LLC', reference: 'CONSIGNMENT_CRURATED', isPco: false, stored: null }).type,
    ).toBe('consignment');
  });

  it('asks for an untagged City Drinks order', () => {
    const result = resolveReleaseType({ customerName: 'City Drinks LLC', reference: 'RFQ 5', isPco: false, stored: null });

    expect(result.type).toBeNull();
    expect(result.required).toBe(true);
  });
});
