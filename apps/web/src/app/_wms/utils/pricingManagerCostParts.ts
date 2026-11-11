import lotInvoiceCost from './lotInvoiceCost';

/**
 * The import and system logistics a landed Pricing Manager row is priced from
 *
 * Import is the paid goods cost, ex-freight: the stock's own invoice line where
 * it has one, else a typed import price, else the stand-in shipment line.
 * System logistics is that line's freight (landed less goods).
 *
 * The rows and the KPI tiles both go through this, so they start from the
 * same cost.
 *
 * @example
 *   pricingManagerCostParts({ importPricePerBottle: 700, lotOwnLine: true, lotProductCost: 1213, lotLandedCost: 1240 });
 *   // { importPricePerBottle: 1213, systemLogistics: 27, importFromInvoice: true }
 */
const pricingManagerCostParts = (row: {
  importPricePerBottle: number | null;
  lotProductCost: number | null;
  lotLandedCost: number | null;
  lotOwnLine: boolean | null;
}) => {
  const manualImport =
    row.importPricePerBottle != null && row.importPricePerBottle > 0
      ? row.importPricePerBottle
      : null;
  /*
    The invoice wins where the stock has its own line on it; a typed import
    price only fills in where there is none (old stock, repacks). Typed
    prices live on the shared per-wine row, so letting them win hid every
    owner's invoice behind one hand-entered figure.
  */
  const invoiceCost = lotInvoiceCost({
    ownLine: row.lotOwnLine,
    productCost: row.lotProductCost,
  });
  const systemLogistics =
    row.lotLandedCost != null && row.lotProductCost != null
      ? Math.max(0, Math.round((row.lotLandedCost - row.lotProductCost) * 100) / 100)
      : 0;

  return {
    importPricePerBottle: invoiceCost ?? manualImport ?? row.lotProductCost ?? null,
    systemLogistics,
    /** The import comes from the stock's own supplier invoice, so typing one has no effect */
    importFromInvoice: invoiceCost != null,
  };
};

export default pricingManagerCostParts;
