import { describe, expect, it } from 'vitest';

import missingProfileItems from './missingProfileItems';

describe('missingProfileItems', () => {
  it('lists everything for an empty profile, ID first', () => {
    expect(missingProfileItems({ documentTypes: [] })).toEqual([
      'Emirates ID',
      'Mobile',
      'Delivery address',
    ]);
  });

  it('needs the number AND both sides for the ID to count', () => {
    expect(
      missingProfileItems({
        eidNumber: '784-1990-1234567-1',
        phone: '+971500000000',
        deliveryAddress: 'Villa 1',
        documentTypes: ['emirates_id_front'],
      }),
    ).toEqual(['Emirates ID']);
  });

  it('is empty when complete', () => {
    expect(
      missingProfileItems({
        eidNumber: '784-1990-1234567-1',
        phone: '+971500000000',
        deliveryAddress: 'Villa 1',
        documentTypes: ['emirates_id_front', 'emirates_id_back'],
      }),
    ).toEqual([]);
  });
});
