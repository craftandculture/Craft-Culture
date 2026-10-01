/**
 * Standing air-freight estimate per bottle, used for in-transit wine until the
 * freight invoice is allocated against the shipment. Most C&C stock flies.
 */
export const DEFAULT_AIR_FREIGHT_PER_BOTTLE = 20;

/**
 * Logistics per bottle for wine still in transit — the one rule the Pricing
 * Manager and the in-transit catalogue feed both price from
 *
 * A per-line override wins, then the freight actually allocated to the
 * shipment, then the standing air-freight estimate. Each side used to carry
 * its own copy: the Pricing Manager fell back to the $20 estimate while the
 * feed fell back to $0 (or $22.50 for C&C wine), so every unfreighted line
 * reached the trade list about $22 a bottle below the B2B price on screen —
 * Solaia 2019 showed $392.11 in the Pricing Manager and $371.05 on the list.
 *
 * @example
 *   inboundLogisticsPerBottle(null, 0); // 20 — no freight loaded yet
 *   inboundLogisticsPerBottle(null, 14.2); // 14.2 — allocated freight
 *   inboundLogisticsPerBottle(0, 14.2); // 0 — the line says no freight
 *
 * @param lineLogistics - Per-line override from the Pricing Manager, if set
 * @param allocatedFreight - Landed minus product cost on the shipment line
 * @returns Logistics cost per bottle in USD
 */
const inboundLogisticsPerBottle = (
  lineLogistics: number | null | undefined,
  allocatedFreight: number | null | undefined,
) =>
  lineLogistics ??
  (allocatedFreight && allocatedFreight > 0
    ? allocatedFreight
    : DEFAULT_AIR_FREIGHT_PER_BOTTLE);

export default inboundLogisticsPerBottle;
