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

  it('a bottle picked from an opened case: 1 bottle sold, 0 cases, the whole case off the case code', () => {
    // Guidalberto 2020 6x75cl: one bottle for a PCO cracks a case
    const pick = classifyPartnerMovement(movement({ quantityCases: 1, quantityBottles: 1 }), ME, { ...NO_ORDER, isPrivateClient: true }, false);
    expect(pick).toMatchObject({ cases: 0, bottles: 1, balanceChangeCases: -1, balanceChangeBottles: -6 });

    // ...and the other 5 arrive on the single-bottle code: net -1 across the two
    const singles = classifyPartnerMovement(
      movement({ movementType: 'repack_in', reasonCode: 'split_case', lwin18: '1010279-2015-01-00750', quantityCases: 5, quantityBottles: 5 }),
      ME,
      NO_ORDER,
      false,
    );
    expect(singles).toMatchObject({ type: 'repacked_in', cases: 5, bottles: 5, balanceChangeBottles: 5 });
    expect(pick.balanceChangeBottles + singles.balanceChangeBottles).toBe(-1);
  });

  it('bottles taken from already-loose stock leave the case code alone', () => {
    const event = classifyPartnerMovement(movement({ quantityCases: 0, quantityBottles: 2 }), ME, NO_ORDER, false);
    expect(event).toMatchObject({ cases: 0, bottles: 2, balanceChangeBottles: 0 });
  });

  it('8 bottles from 6-packs are 1 whole case sold', () => {
    const event = classifyPartnerMovement(movement({ quantityCases: 2, quantityBottles: 8 }), ME, NO_ORDER, false);
    expect(event).toMatchObject({ cases: 1, bottles: 8, balanceChangeBottles: -12 });
  });

  it('says who placed the order', () => {
    const theirs = classifyPartnerMovement(movement({}), ME, { ...NO_ORDER, isPrivateClient: true, isPartnersOwnOrder: true }, false);
    expect(theirs.placedBy).toBe('you');

    const ours = classifyPartnerMovement(movement({}), ME, { ...NO_ORDER, isPrivateClient: true }, false);
    expect(ours.placedBy).toBe('craft_and_culture');

    const toDistributor = classifyPartnerMovement(movement({}), ME, { ...NO_ORDER, isTradeOrder: true }, false);
    expect(toDistributor.placedBy).toBe('craft_and_culture');

    const received = classifyPartnerMovement(movement({ movementType: 'receive' }), ME, NO_ORDER, false);
    expect(received.placedBy).toBeNull();
  });

  it('a return comes back in on the same channel as the sale', () => {
    const event = classifyPartnerMovement(
      movement({ movementType: 'adjust', reasonCode: 'order_return', quantityCases: 1, quantityBottles: 6 }),
      ME,
      { ...NO_ORDER, isPrivateClient: true, isPartnersOwnOrder: false },
      false,
    );
    expect(event).toMatchObject({ type: 'returned', outcome: 'returned', channel: 'private_client', placedBy: 'craft_and_culture', direction: 'in', cases: 1, bottles: 6, balanceChangeBottles: 6 });
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
