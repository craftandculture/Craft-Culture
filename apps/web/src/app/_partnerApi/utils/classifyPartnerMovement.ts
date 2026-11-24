import STOCK_OUT_REASONS from '@/app/_wms/constants/stockOutReasons';

/** The event names the API publishes, one per kind of thing that happened */
export type PartnerEventType =
  | 'received'
  | 'put_away'
  | 'moved_bay'
  | 'picked'
  | 'dispatched'
  | 'repacked_in'
  | 'repacked_out'
  | 'adjusted'
  | 'taken_out_of_stock'
  | 'count_correction'
  | 'transferred_in'
  | 'transferred_out';

/** What became of bottles that left the partner's holding */
export type PartnerEventOutcome =
  | 'sale'
  | 'own_delivery'
  | 'collected'
  | 'loss_reimbursed'
  | 'transfer'
  | 'correction';

/** Who bought, by kind only — never a name */
export type PartnerSaleChannel =
  | 'distributor'
  | 'private_client'
  | 'craft_and_culture'
  | 'other';

/** A movement as the classifier needs it */
export interface ClassifiableMovement {
  movementType: string;
  reasonCode: string | null;
  lwin18: string;
  quantityCases: number;
  quantityBottles: number | null;
  fromOwnerId: string | null;
  toOwnerId: string | null;
}

/** Facts about the order a pick was for, worked out by the caller */
export interface MovementOrderFacts {
  /** The pick was for the partner's own delivery out of their stock */
  isOwnDelivery: boolean;
  /** The order was a private-client order (a PCO, or a Zoho SO raised for one) */
  isPrivateClient: boolean;
  /** The order was a Zoho sales order to a distributor or trade buyer */
  isTradeOrder: boolean;
}

/**
 * Sign of each movement type in the stock ledger, from the partner's side
 *
 * The same rule the warehouse reconciler uses (received − picked + adjust +
 * repack_in − repack_out + count), so the API's running balance and the
 * reconciler cannot disagree. Location moves and dispatch change nothing:
 * stock leaves the balance when it is picked, not again when the truck goes.
 */
const LEDGER_SIGN: Record<string, 1 | -1 | 0> = {
  receive: 1,
  pick: -1,
  adjust: 1,
  repack_in: 1,
  repack_out: -1,
  count: 1,
  putaway: 0,
  transfer: 0,
  dispatch: 0,
};

/** Bottles per case from a dashed LWIN18 (`1010279-2015-06-00750` → 6) */
const packOf = (lwin18: string) => {
  const pack = Number(lwin18.split('-')[2]);

  return Number.isFinite(pack) && pack > 0 ? pack : 1;
};

/**
 * One stock movement in the terms the partner API publishes
 *
 * Pure: everything it needs about the order and C&C's own records is passed
 * in, so the rules can be tested without a database. Counterparties never
 * appear: a sale says only which kind of buyer (distributor, private client,
 * Craft & Culture), the same rule the partner portal follows.
 *
 * @example
 *   classifyPartnerMovement(pick, 'partner-id', { isOwnDelivery: false, isPrivateClient: false, isTradeOrder: true }, false);
 *   // { type: 'picked', direction: 'out', outcome: 'sale', channel: 'distributor', ... }
 *
 * @param movement - The stock movement
 * @param partnerId - The key holder
 * @param order - Facts about the order a pick was for (ignored otherwise)
 * @param toCraftAndCulture - The transfer's receiving owner is C&C itself
 * @returns The published event fields
 */
const classifyPartnerMovement = (
  movement: ClassifiableMovement,
  partnerId: string,
  order: MovementOrderFacts,
  toCraftAndCulture: boolean,
) => {
  const pack = packOf(movement.lwin18);
  const cases = Math.abs(movement.quantityCases);
  const bottles = Math.abs(movement.quantityBottles ?? movement.quantityCases * pack);
  const rawBottles = movement.quantityBottles ?? movement.quantityCases * pack;

  let type: PartnerEventType;
  let outcome: PartnerEventOutcome | null = null;
  let channel: PartnerSaleChannel | null = null;
  let description: string;
  let balanceChangeBottles: number;
  let balanceChangeCases: number;

  if (movement.movementType === 'ownership_transfer') {
    const incoming = movement.toOwnerId === partnerId;
    const sign = incoming ? 1 : -1;
    type = incoming ? 'transferred_in' : 'transferred_out';
    balanceChangeBottles = sign * bottles;
    balanceChangeCases = sign * cases;

    if (!incoming && toCraftAndCulture) {
      outcome = 'sale';
      channel = 'craft_and_culture';
      description = 'Sold to Craft & Culture';
    } else {
      outcome = 'transfer';
      description = incoming ? 'Transferred to you' : 'Transferred to another owner';
    }
  } else if (movement.reasonCode?.startsWith('stock_out:')) {
    const key = movement.reasonCode.slice('stock_out:'.length) as keyof typeof STOCK_OUT_REASONS;
    const reason = STOCK_OUT_REASONS[key];
    type = 'taken_out_of_stock';
    // Always a removal, however the movement happened to be signed
    balanceChangeBottles = -bottles;
    balanceChangeCases = -cases;
    description = reason?.ownerSees ?? 'Taken out of stock';

    switch (reason?.settlement) {
      case 'cc_landed':
        outcome = 'sale';
        channel = 'craft_and_culture';
        break;
      case 'price':
        outcome = 'sale';
        channel = 'other';
        break;
      case 'owner_reimbursed':
        outcome = 'loss_reimbursed';
        break;
      case 'not_a_sale':
        outcome = 'collected';
        break;
      default:
        outcome = 'correction';
    }
  } else {
    const sign = LEDGER_SIGN[movement.movementType] ?? 0;
    balanceChangeBottles = sign * rawBottles;
    balanceChangeCases = sign * movement.quantityCases;

    switch (movement.movementType) {
      case 'receive':
        type = 'received';
        description = 'Received into the warehouse';
        break;
      case 'putaway':
        type = 'put_away';
        description = 'Put away';
        break;
      case 'transfer':
        type = 'moved_bay';
        description = 'Moved bay';
        break;
      case 'dispatch':
        type = 'dispatched';
        description = 'Left the warehouse';
        break;
      case 'repack_in':
        type = 'repacked_in';
        description = 'Repacked';
        break;
      case 'repack_out':
        type = 'repacked_out';
        description = 'Repacked';
        break;
      case 'count':
        type = 'count_correction';
        outcome = 'correction';
        description = 'Stock count correction';
        break;
      case 'pick':
        type = 'picked';
        if (order.isOwnDelivery) {
          outcome = 'own_delivery';
          description = 'Picked for your delivery';
        } else if (order.isPrivateClient) {
          outcome = 'sale';
          channel = 'private_client';
          description = 'Picked · sold to a private client';
        } else if (order.isTradeOrder) {
          outcome = 'sale';
          channel = 'distributor';
          description = 'Picked · sold to a distributor';
        } else {
          description = 'Picked for an order';
        }
        break;
      default:
        type = 'adjusted';
        outcome = 'correction';
        description = 'Stock corrected';
    }
  }

  const direction =
    balanceChangeBottles > 0 ? 'in' : balanceChangeBottles < 0 ? 'out' : 'none';

  return {
    type,
    direction,
    outcome,
    channel,
    description,
    cases,
    bottles,
    balanceChangeCases,
    balanceChangeBottles,
  } as const;
};

export default classifyPartnerMovement;
