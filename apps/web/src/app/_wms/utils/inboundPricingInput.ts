import inboundLogisticsPerBottle from './inboundLogisticsPerBottle';
import type { PricingManagerRowInput } from './pricePricingManagerRow';

/** One in-transit line as `inboundPricingSelect` returns it */
export interface InboundPricingRaw extends PricingManagerRowInput {
  /** Landed minus product cost on the shipment line, per bottle */
  allocatedFreight?: number | null;
}

/**
 * Turn an in-transit line into the row the Pricing Manager prices
 *
 * Its logistics is a per-line override, else the freight allocated to the
 * shipment, else the standing air-freight estimate (inboundLogisticsPerBottle).
 * The Pricing Manager's in-transit rows and the in-transit price list both
 * read this.
 *
 * @example
 *   inboundPricingInput({ importPricePerBottle: 100, allocatedFreight: 0 });
 *   // { …, systemLogistics: 20 }
 *
 * @param raw - The line's selected inputs
 * @returns The row with its system logistics resolved
 */
const inboundPricingInput = <T extends InboundPricingRaw>(raw: T) => ({
  ...raw,
  systemLogistics: inboundLogisticsPerBottle(
    raw.lineLogistics,
    raw.allocatedFreight,
  ),
});

export default inboundPricingInput;
