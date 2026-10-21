import { describe, expect, it } from 'vitest';

import parseForwarderSheet from './parseForwarderSheet';

describe('parseForwarderSheet', () => {
  it('reads columns by their names, in any order', () => {
    const { rows } = parseForwarderSheet([
      ['Our forwarders'],
      ['Email', 'Company', 'Contact', 'Phone', 'Services', 'Countries'],
      ['Anna@Hillebrand.com', 'Hillebrand', 'Anna Smith', '+44 1234', 'Air, Sea', 'UK, France'],
    ]);

    expect(rows).toEqual([
      {
        name: 'Hillebrand',
        contactName: 'Anna Smith',
        email: 'anna@hillebrand.com',
        phone: '+44 1234',
        role: null,
        modes: ['air', 'sea_fcl', 'sea_lcl'],
        originCountries: ['United Kingdom', 'France'],
        notes: null,
      },
    ]);
  });

  it('carries the company down to contacts left blank under it', () => {
    const { rows } = parseForwarderSheet([
      ['Forwarder', 'Email'],
      ['Albatrans', 'quotes@albatrans.co.uk'],
      ['', 'ops@albatrans.co.uk'],
    ]);

    expect(rows.map((r) => [r.name, r.email])).toEqual([
      ['Albatrans', 'quotes@albatrans.co.uk'],
      ['Albatrans', 'ops@albatrans.co.uk'],
    ]);
  });

  it('finds nothing without a company column', () => expect(parseForwarderSheet([['Email'], ['a@b.com']]).rows).toEqual([]));
});
