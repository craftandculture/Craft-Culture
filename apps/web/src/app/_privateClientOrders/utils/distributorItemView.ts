import type {
  PrivateClientOrder,
  PrivateClientOrderItem,
} from '@/database/schema';

/** The partner's own prices on a line, never sent to a distributor */
export type DistributorHiddenItemField = 'pricePerCaseUsd' | 'totalUsd';

/** A line as a distributor receives it */
export type DistributorOrderItem<T extends Partial<PrivateClientOrderItem>> =
  Omit<T, DistributorHiddenItemField> & {
    /** What the distributor pays C&C for one unit: landed duty free incl. transfer */
    distributorCostPerCaseUsd: number;
    /** What the client pays for one unit, all in */
    clientPricePerCaseUsd: number;
    /** What the client pays for the line, all in */
    clientTotalUsd: number;
    /** The order is priced as one box, so the line has no price of its own */
    inBox: boolean;
  };

/**
 * Order lines as a distributor may see them
 *
 * A line's own price is what the wine partner charges C&C. With the order's
 * landed duty free figure beside it, a distributor could work out C&C's margin,
 * so the partner price is removed here before the order leaves the server. In
 * its place each line carries its share of what the distributor pays C&C
 * (landed duty free including transfer) and of what the client pays, split
 * across the lines in proportion to their value.
 *
 * @example
 *   items: distributorItemView(items, order),
 *
 * @param items - The order's lines
 * @param order - The order's totals
 * @returns The lines without the partner's prices
 */
const distributorItemView = <
  T extends Partial<PrivateClientOrderItem> & {
    totalUsd: number;
    quantity: number;
  },
>(
  items: T[],
  order: Pick<
    Partial<PrivateClientOrder>,
    'subtotalUsd' | 'logisticsUsd' | 'totalUsd'
  >,
): DistributorOrderItem<T>[] => {
  const linesValue = items.reduce(
    (sum, item) => sum + (Number(item.totalUsd) || 0),
    0,
  );
  const distributorCost =
    (Number(order.subtotalUsd) || 0) + (Number(order.logisticsUsd) || 0);
  const clientTotal = Number(order.totalUsd) || 0;

  const round2 = (value: number) => Math.round(value * 100) / 100;

  // A subscription box carries one price for the order and none on its lines
  const inBox = linesValue === 0 && clientTotal > 0;

  return items.map((item) => {
    const {
      pricePerCaseUsd: _partnerPrice,
      totalUsd: lineValue,
      ...visible
    } = item;
    const share = linesValue > 0 ? (Number(lineValue) || 0) / linesValue : 0;
    const quantity = Number(item.quantity) || 0;
    const lineDistributorCost = distributorCost * share;
    const lineClientTotal = clientTotal * share;

    return {
      ...visible,
      distributorCostPerCaseUsd:
        quantity > 0 ? round2(lineDistributorCost / quantity) : 0,
      clientPricePerCaseUsd:
        quantity > 0 ? round2(lineClientTotal / quantity) : 0,
      clientTotalUsd: round2(lineClientTotal),
      inBox,
    } as DistributorOrderItem<T>;
  });
};

export default distributorItemView;
