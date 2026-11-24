import { describe, expect, it } from 'vitest';

import classifyPartnerMovement from './classifyPartnerMovement';

const ME = '11111111-1111-1111-1111-111111111111';
const OTHER = '22222222-2222-2222-2222-222222222222';
const CC = '33333333-3333-3333-3333-333333333333';

const NO_ORDER = { isOwnDelivery: false, isPrivateClient: false, isTradeOrder: false };

const movement = (overrides: Partial<Parameters<typeof classifyPartnerMovement>[0]>) => ({
  movementType: 'pick',
  reasonCode: null,
  lwin18: '1010279-2015-06-00750',
  quantityCases: 2,
  quantityBottles: null,
  fromOwnerId: null,
  toOwnerId: null,
  ...overrides,
});

describe('classifyPartnerMovement', () => {
  it('counts a receipt in, in cases and bottles from the pack', () => {
    const event = classifyPartnerMovement(movement({ movementType: 'receive', quantityCases: 3 }), ME, NO_ORDER, false);
    expect(event).toMatchObject({ type: 'received', direction: 'in', cases: 3, bottles: 18, balanceChangeBottles: 18 });
  });

  it('calls a pick for a distributor order a sale, without naming the buyer', () => {
    const event = classifyPartnerMovement(movement({}), ME, { ...NO_ORDER, isTradeOrder: true }, false);
    expect(event).toMatchObject({ type: 'picked', direction: 'out', outcome: 'sale', channel: 'distributor', balanceChangeBottles: -12 });
    expect(event.description).not.toMatch(/City Drinks|TBS/);
  });

  it('calls a pick for a private-client order a private-client sale', () => {
    const event = classifyPartnerMovement(movement({}), ME, { ...NO_ORDER, isPrivateClient: true, isTradeOrder: false }, false);
    expect(event).toMatchObject({ outcome: 'sale', channel: 'private_client' });
  });

  it('does not call the owner’s own delivery a sale', () => {
    const event = classifyPartnerMovement(movement({}), ME, { ...NO_ORDER, isOwnDelivery: true, isTradeOrder: true }, false);
    expect(event).toMatchObject({ outcome: 'own_delivery', channel: null });
  });

  it('uses the bottle count of a split-case pick', () => {
    const event = classifyPartnerMovement(movement({ quantityCases: 0, quantityBottles: 2 }), ME, NO_ORDER, false);
    expect(event).toMatchObject({ cases: 0, bottles: 2, balanceChangeBottles: -2 });
  });

  it('a transfer to C&C is a sale to Craft & Culture; to anyone else, a transfer', () => {
    const toCc = classifyPartnerMovement(movement({ movementType: 'ownership_transfer', fromOwnerId: ME, toOwnerId: CC }), ME, NO_ORDER, true);
    expect(toCc).toMatchObject({ type: 'transferred_out', outcome: 'sale', channel: 'craft_and_culture', balanceChangeCases: -2 });

    const toOther = classifyPartnerMovement(movement({ movementType: 'ownership_transfer', fromOwnerId: ME, toOwnerId: OTHER }), ME, NO_ORDER, false);
    expect(toOther).toMatchObject({ type: 'transferred_out', outcome: 'transfer', channel: null });

    const incoming = classifyPartnerMovement(movement({ movementType: 'ownership_transfer', fromOwnerId: OTHER, toOwnerId: ME }), ME, NO_ORDER, false);
    expect(incoming).toMatchObject({ type: 'transferred_in', direction: 'in', balanceChangeCases: 2 });
  });

  it('a take-out is always a removal, settled by its reason', () => {
    const sample = classifyPartnerMovement(movement({ movementType: 'adjust', reasonCode: 'stock_out:samples', quantityCases: 1 }), ME, NO_ORDER, false);
    expect(sample).toMatchObject({ type: 'taken_out_of_stock', outcome: 'sale', channel: 'craft_and_culture', balanceChangeBottles: -6, description: 'Sold' });

    const broken = classifyPartnerMovement(movement({ movementType: 'adjust', reasonCode: 'stock_out:breakage', quantityCases: -1 }), ME, NO_ORDER, false);
    expect(broken).toMatchObject({ outcome: 'loss_reimbursed', balanceChangeBottles: -6 });

    const collected = classifyPartnerMovement(movement({ movementType: 'adjust', reasonCode: 'stock_out:collected_by_owner', quantityCases: 1 }), ME, NO_ORDER, false);
    expect(collected).toMatchObject({ outcome: 'collected' });
  });

  it('bay moves and dispatch do not change the balance', () => {
    for (const movementType of ['putaway', 'transfer', 'dispatch']) {
      const event = classifyPartnerMovement(movement({ movementType }), ME, NO_ORDER, false);
      expect(event.balanceChangeBottles).toBe(0);
      expect(event.direction).toBe('none');
    }
  });

  it('a count correction keeps its sign', () => {
    const event = classifyPartnerMovement(movement({ movementType: 'count', quantityCases: -1 }), ME, NO_ORDER, false);
    expect(event).toMatchObject({ type: 'count_correction', outcome: 'correction', balanceChangeCases: -1, direction: 'out' });
  });
});
