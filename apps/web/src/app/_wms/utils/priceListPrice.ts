import { COMMISSION_RATES } from '@/app/_consignment/constants/commissionRates';

import pricePricingManagerRow from './pricePricingManagerRow';
import type { PricingManagerRowInput } from './pricePricingManagerRow';
import PRICE_LIST_RATES from '../constants/priceListRates';

/**
 * The per-bottle In Bond (B2B) and Private Client prices a price list carries
 * for one line
 *
 * Each holder of the line is priced exactly as the Pricing Manager prices
 * their row — the same function, the same inputs, the default rates — and the
 * line takes the highest finished price, so a list never undercuts any owner.
 * Inputs are never mixed across holders: one owner's import with another's
 * margin produced a price neither of them had.
 *
 * One line per wine is kept deliberately: splitting it per owner would list
 * the same wine twice at two prices, let a buyer infer whose parcels are
 * whose, and break the LPO matcher, which keys on lwin18 alone.
 *
 * A member's live mandate ask is a floor, not a replacement, grossed up at the
 * HIGHER of the two commission rates on both lists: the rate depends on who
 * buys, not which list they bought from, so the floor covers the worst case
 * and the member always receives their ask.
 *
 * @example
 *   priceListPrice([ownerA, ownerB], 0); // { ibPerBottle: 181.21, pcPerBottle: 0 }
 *
 * @param holders - One Pricing Manager row input per owner holding the line
 * @param mandateAsk - The highest live mandate ask per bottle, if any
 * @returns Unrounded per-bottle In Bond and Private Client prices (0 = none)
 */
const priceListPrice = (
  holders: PricingManagerRowInput[],
  mandateAsk?: number | string | null,
) => {
  let ib = 0;
  let pc = 0;

  for (const holder of holders) {
    const priced = pricePricingManagerRow(holder, PRICE_LIST_RATES);

    ib = Math.max(ib, priced.inBond ?? 0);
    pc = Math.max(pc, priced.sellPrice ?? 0);
  }

  const ask = mandateAsk ? Number(mandateAsk) : 0;
  const floor =
    ask > 0
      ? ask /
        (1 -
          Math.max(COMMISSION_RATES.trade, COMMISSION_RATES.collector) / 100)
      : 0;

  return {
    ibPerBottle: Math.max(ib, floor),
    pcPerBottle: Math.max(pc, floor),
  };
};

export default priceListPrice;
