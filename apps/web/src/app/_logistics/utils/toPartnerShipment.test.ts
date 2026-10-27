import { describe, expect, it } from 'vitest';

import toPartnerShipment from './toPartnerShipment';
import toPartnerShipmentItem from './toPartnerShipmentItem';

const PRIVATE = /cost|landed|margin|price|fx|internal|freight|insurance|handling|gov|declared|hillebrand|clientcontact|createdby/i;

describe('partner shipment allowlist', () => {
  it('never sends a cost, price, margin or internal field on the shipment', () => {
    const shipment = Object.fromEntries(
      ['id', 'totalLandedCostUsd', 'freightCostUsd', 'clientPriceUsd', 'quotedMarginUsd', 'internalNotes', 'partnerNotes'].map((k) => [k, 1]),
    ) as unknown as Parameters<typeof toPartnerShipment>[0];
    const keys = Object.keys(toPartnerShipment(shipment, []));
    expect(keys.filter((k) => PRIVATE.test(k))).toEqual([]);
  });

  it('never sends a cost, price, margin or note field on a line', () => {
    const item = Object.fromEntries(
      ['id', 'landedCostPerBottle', 'marginPercent', 'targetSellingPrice', 'productCostPerBottle', 'notes'].map((k) => [k, 1]),
    ) as unknown as Parameters<typeof toPartnerShipmentItem>[0];
    const keys = Object.keys(toPartnerShipmentItem(item));
    expect(keys.filter((k) => PRIVATE.test(k) || k === 'notes')).toEqual([]);
  });

  it('totals only the partner’s own lines', () => {
    const shipment = { id: 's1' } as unknown as Parameters<typeof toPartnerShipment>[0];
    const out = toPartnerShipment(shipment, [
      { cases: 2, totalBottles: 12, grossWeightKg: 30 },
      { cases: 1, totalBottles: 6, grossWeightKg: null },
    ]);
    expect([out.totalCases, out.totalBottles, out.totalWeightKg]).toEqual([3, 18, 30]);
  });
});
