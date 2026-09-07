import { describe, expect, it } from 'vitest';

import readConsignmentSubject from './readConsignmentSubject';

describe('readConsignmentSubject', () => {
  it('reads each owner tag', () => {
    expect(readConsignmentSubject('CONSIGNMENT_CC', null).ownerName).toBe('C&C');
    expect(readConsignmentSubject('CONSIGNMENT_RARE', null).ownerName).toBe(
      'Rare',
    );
  });

  /*
    INV-000296, the first real consignment invoice this was tested against.
    CULT was missing from the tag map — the brief listed four owners and the
    invoices carry five.
  */
  it('reads INV-000296 as Cult on consignment terms', () => {
    const result = readConsignmentSubject('CONSIGNMENT_CULT', 'Consignment');

    expect(result.isConsignment).toBe(true);
    expect(result.ownerName).toBe('Cult');
    expect(result.isMixed).toBe(false);
  });

  it('does not let CRU swallow CRURATED', () => {
    const crurated = readConsignmentSubject('CONSIGNMENT_CRURATED', null);
    const cru = readConsignmentSubject('CONSIGNMENT_CRU', null);

    expect(crurated.ownerName).toBe('Crurated');
    expect(cru.ownerName).toBe('Cru');
  });

  it('marks a mixed invoice for per-line attribution', () => {
    const result = readConsignmentSubject('CONSIGNMENT_MIX', null);

    expect(result.isConsignment).toBe(true);
    expect(result.isMixed).toBe(true);
    expect(result.ownerName).toBeNull();
  });

  it('keeps an unrecognised tag rather than dropping the invoice', () => {
    const result = readConsignmentSubject('CONSIGNMENT_ACME', null);

    expect(result.isConsignment).toBe(true);
    expect(result.isMixed).toBe(true);
  });

  it('accepts payment terms when the subject was not tagged', () => {
    expect(readConsignmentSubject('August delivery', '90 days').isConsignment)
      .toBe(true);
    expect(readConsignmentSubject(null, 'Consignment').isConsignment).toBe(true);
  });

  it('rejects an ordinary sale', () => {
    const result = readConsignmentSubject('August order', 'Net 30');

    expect(result.isConsignment).toBe(false);
    expect(result.reason).toContain('not a consignment tag');
  });

  it('reads a tag that is not alone on the line', () => {
    expect(
      readConsignmentSubject('AUG 2026 - CONSIGNMENT_CRURATED', null).ownerName,
    ).toBe('Crurated');
  });
});
