import { describe, expect, it } from 'vitest';

import getOrderStockOwner from './getOrderStockOwner';

const OWNERS = [
  { tag: 'CC', ownerId: 'cc-partner', name: 'Craft & Culture' },
  { tag: 'CRU', ownerId: 'cru-partner', name: 'Cru Wine' },
  { tag: 'CRURATED', ownerId: 'crurated-partner', name: 'Crurated' },
];

/** Stands in for the one select the lookup makes */
const fakeDb = {
  select: () => ({ from: () => ({ where: async () => OWNERS }) }),
};

describe('getOrderStockOwner', () => {
  it('reads Crurated off SO-00268, not Cru', async () => {
    const owner = await getOrderStockOwner({ db: fakeDb, referenceNumber: 'CONSIGNMENT_CRURATED' });
    expect(owner).toEqual({ ownerId: 'crurated-partner', name: 'Crurated', tag: 'CRURATED' });
  });

  it('reads Cru', async () => {
    const owner = await getOrderStockOwner({ db: fakeDb, referenceNumber: 'SO-00105 CONSIGNMENT_CRU' });
    expect(owner?.ownerId).toBe('cru-partner');
  });

  it('names nobody on a mixed order', async () => {
    expect(await getOrderStockOwner({ db: fakeDb, referenceNumber: 'CONSIGNMENT_MIX' })).toBeNull();
  });

  it('names nobody on a PCO reference or none', async () => {
    expect(await getOrderStockOwner({ db: fakeDb, referenceNumber: 'PCO-2026-00102' })).toBeNull();
    expect(await getOrderStockOwner({ db: fakeDb, referenceNumber: null })).toBeNull();
  });

  it('names nobody for a tag no owner carries', async () => {
    expect(await getOrderStockOwner({ db: fakeDb, referenceNumber: 'CONSIGNMENT_NOBODY' })).toBeNull();
  });
});
