import { describe, expect, it } from 'vitest';

import readInvoiceSubject from './readInvoiceSubject';

/*
  Every carrier the printed invoice uses is invisible to Zoho's API: `subject`
  is empty on all seventy City Drinks invoices, `custom_fields` returns nothing,
  and the heading rows Zoho's own docs allow are dropped on read.

  The reference number is the one field that arrives intact, so it is the one
  place a tag can be written and actually reach us.
*/
describe('readInvoiceSubject', () => {
  it('prefers a real subject when Zoho ever returns one', () => {
    expect(
      readInvoiceSubject({
        subject: 'CONSIGNMENT_CULT',
        reference_number: 'SO-00105 CONSIGNMENT_RARE',
      } as never),
    ).toBe('CONSIGNMENT_CULT');
  });

  it('takes a subject-ish custom field next', () => {
    expect(
      readInvoiceSubject({
        custom_fields: [{ label: 'Subject', value: 'CONSIGNMENT_CRU' }],
        reference_number: 'SO-00105 CONSIGNMENT_RARE',
      } as never),
    ).toBe('CONSIGNMENT_CRU');
  });

  it('reads a tag appended to the reference number', () => {
    expect(
      readInvoiceSubject({ reference_number: 'SO-00105 CONSIGNMENT_CULT' } as never),
    ).toBe('CONSIGNMENT_CULT');
  });

  it('takes only the tag, not the sales order with it', () => {
    const result = readInvoiceSubject({
      reference_number: 'SO-00105 CONSIGNMENT_CULT',
    } as never);

    expect(result).not.toContain('SO-00105');
  });

  it('returns null for an untagged reference, rather than the order number', () => {
    // Returning "SO-00105" would read as a subject that simply named no owner
    expect(readInvoiceSubject({ reference_number: 'SO-00105' } as never)).toBeNull();
  });

  it('returns null when the invoice carries nothing', () => {
    expect(readInvoiceSubject({} as never)).toBeNull();
  });
});
