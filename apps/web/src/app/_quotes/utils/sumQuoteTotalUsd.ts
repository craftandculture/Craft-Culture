interface PricedLine {
  lineItemTotalUsd?: number;
}

/**
 * Total a confirmed quote: catalogue lines plus fulfilled out-of-catalogue
 * items
 *
 * Every recalculation must go through here — summing only `lineItems` silently
 * drops the out-of-catalogue wines C&C added at review.
 *
 * @example
 *   sumQuoteTotalUsd({
 *     lineItems: [{ lineItemTotalUsd: 100 }],
 *     fulfilledOocItems: [{ lineItemTotalUsd: 50 }],
 *   }); // 150
 */
const sumQuoteTotalUsd = (quoteData: {
  lineItems?: PricedLine[];
  fulfilledOocItems?: PricedLine[];
}) => {
  const sum = (items: PricedLine[] | undefined) =>
    (items ?? []).reduce(
      (total, item) => total + (item.lineItemTotalUsd ?? 0),
      0,
    );

  return (
    Math.round(
      (sum(quoteData.lineItems) + sum(quoteData.fulfilledOocItems)) * 100,
    ) / 100
  );
};

export default sumQuoteTotalUsd;
