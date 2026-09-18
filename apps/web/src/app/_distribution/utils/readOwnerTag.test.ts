import { describe, expect, it } from 'vitest';

import readOwnerTag from './readOwnerTag';

describe('readOwnerTag', () => {
  it('takes the tag, not the whole subject', () => {
    expect(readOwnerTag('CONSIGNMENT_CULT')).toBe('CULT');
  });

  /*
    Zoho returns no subject on any invoice, so the tag is appended to the
    reference number instead — "SO-00105 CONSIGNMENT_CULT".
  */
  it('finds a tag appended to a reference number', () => {
    expect(readOwnerTag('SO-00105 CONSIGNMENT_CRU')).toBe('CRU');
  });

  it('does not let CRU swallow CRURATED', () => {
    expect(readOwnerTag('CONSIGNMENT_CRURATED')).toBe('CRURATED');
    expect(readOwnerTag('CONSIGNMENT_CRU')).toBe('CRU');
  });

  it('treats MIX as naming nobody, since it names several', () => {
    expect(readOwnerTag('CONSIGNMENT_MIX')).toBeNull();
  });

  it('returns nothing when there is no tag', () => {
    expect(readOwnerTag('August delivery')).toBeNull();
    expect(readOwnerTag(null)).toBeNull();
  });
});
