import { describe, expect, it } from 'vitest';

import resolveOwner from './resolveOwner';
import type { OwnerRef } from './resolveOwner';

const OWNERS: OwnerRef[] = [
  { id: 'cc', name: 'Craft & Culture', consignmentTag: 'CC', ownerAliases: null, takesUnattributed: false },
  { id: 'cru', name: 'Cru Wine', consignmentTag: 'CRU', ownerAliases: ['Cru Wine Ltd'], takesUnattributed: false },
  { id: 'cult', name: 'Cult Wines', consignmentTag: 'CULT', ownerAliases: null, takesUnattributed: false },
  { id: 'crurated', name: 'Crurated', consignmentTag: 'CRURATED', ownerAliases: null, takesUnattributed: true },
  { id: 'rare', name: 'Rare', consignmentTag: 'RARE', ownerAliases: null, takesUnattributed: false },
];

describe('resolveOwner', () => {
  it('takes the tag the document carried', () => {
    expect(resolveOwner({ tag: 'CULT', owners: OWNERS }).ownerId).toBe('cult');
  });

  /*
    CRU is the start of CRURATED. A prefix match here would file every Crurated
    invoice under Cru Wine, which is money settled with the wrong company.
  */
  it('does not let CRU swallow CRURATED', () => {
    expect(resolveOwner({ tag: 'CRU', owners: OWNERS }).ownerId).toBe('cru');
    expect(resolveOwner({ tag: 'CRURATED', owners: OWNERS }).ownerId).toBe(
      'crurated',
    );
  });

  it('matches a spelling the owner is also known by', () => {
    expect(resolveOwner({ tag: 'Cru Wine Ltd', owners: OWNERS }).ownerId).toBe(
      'cru',
    );
  });

  /*
    A mixed invoice names its owners in heading rows Zoho drops on read, so the
    document says nothing the API returns — but a wine's owner does not change
    between invoices.
  */
  it('falls back to what the wine was last time', () => {
    const result = resolveOwner({
      tag: null,
      knownOwnerId: 'rare',
      owners: OWNERS,
    });

    expect(result.ownerId).toBe('rare');
    expect(result.reason).toMatch(/from the wine/);
  });

  it('prefers the document over the wine, since tagging is deliberate', () => {
    expect(
      resolveOwner({ tag: 'CULT', knownOwnerId: 'rare', owners: OWNERS })
        .ownerId,
    ).toBe('cult');
  });

  it('sends a line nobody named to whoever takes unattributed', () => {
    const result = resolveOwner({ tag: null, owners: OWNERS });

    expect(result.ownerId).toBe('crurated');
    expect(result.reason).toMatch(/unattributed/);
  });

  it('explains an unknown tag rather than silently guessing', () => {
    const result = resolveOwner({ tag: 'CONSIGNMENT_ACME', owners: OWNERS });

    // No owner claims it, so it goes where unattributed lines go — and says so
    expect(result.ownerId).toBe('crurated');
  });

  it('returns nobody, with a reason, when nothing can claim it', () => {
    const orphaned = OWNERS.map((owner) => ({
      ...owner,
      takesUnattributed: false,
    }));
    const result = resolveOwner({ tag: null, owners: orphaned });

    expect(result.ownerId).toBeNull();
    expect(result.reason).toMatch(/nothing takes unattributed/i);
  });
});
