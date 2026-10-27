import { describe, expect, it } from 'vitest';

import isPartnerShipmentItem from './isPartnerShipmentItem';

describe('isPartnerShipmentItem', () => {
  it('gives an unmarked line to the shipment partner', () => {
    expect(isPartnerShipmentItem({ overrideOwnerId: null }, 'p1', 'p1')).toBe(true);
  });

  it('hides another owner’s line from the shipment partner', () => {
    expect(isPartnerShipmentItem({ overrideOwnerId: 'p2' }, 'p1', 'p1')).toBe(false);
  });

  it('shows a partner its own line on someone else’s shipment', () => {
    expect(isPartnerShipmentItem({ overrideOwnerId: 'p2' }, 'p1', 'p2')).toBe(true);
  });

  it('hides an unmarked line from anyone but the shipment partner', () => {
    expect(isPartnerShipmentItem({ overrideOwnerId: null }, 'p1', 'p2')).toBe(false);
  });
});
