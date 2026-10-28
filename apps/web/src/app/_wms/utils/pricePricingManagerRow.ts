/** The fields of a Pricing Manager product row that its prices are built from */
export interface PricingManagerRowInput {
  category?: string | null;
  importPricePerBottle?: number | null;
  costOverridePerBottle?: number | null;
  systemLogistics?: number | null;
  lineLogistics?: number | null;
  isCraftCulture?: number | null;
  transferPricePerBottle?: number | null;
  isZeroTransferOwner?: number | null;
  ownerInbondPct?: number | null;
  ownerPcPct?: number | null;
  /** In Bond margin typed on this row */
  b2bMarginPct?: number | null;
  /** PC margin typed on this row */
  pcMarginPct?: number | null;
  /** A spirit's old single "bespoke" margin, kept as its In Bond margin */
  sellMarginPct?: number | null;
  sellingPricePerBottle?: number | null;
}

/** The rates around the row: the selected owner's, or the toolbar defaults */
export interface PricingManagerRates {
  /** An owner is selected, so their rates apply to every row */
  ownerSelected: boolean;
  /** The selected owner's In Bond %, or the toolbar's */
  effInbondPct: number;
  /** The selected owner's PC %, or the toolbar's (null = none) */
  effPcPct: number | null;
  /** The toolbar In Bond % (used per row when no owner is selected) */
  inBondMarkupPct: number;
  /** The toolbar PC % (0 = none) */
  pcMarginPct: number;
  /** The selected owner's stored PC price for this wine, if any */
  ownerPcPrice?: number | null;
}

/**
 * A margin as a percentage of the selling price
 *
 * @example
 *   pricingMargin(80, 100); // 20
 */
export const pricingMargin = (cost: number | null, sell: number | null) => {
  if (!cost || !sell || cost <= 0 || sell <= 0) return null;
  return (1 - cost / sell) * 100;
};

/**
 * Every price the Pricing Manager shows for one row
 *
 * The table and the Excel export both read this, so they cannot disagree.
 * They did: the export rebuilt the prices itself and left out a margin typed
 * on the row, so Tignanello 2008 read $181.21 In Bond on screen and $150.69 in
 * the sheet.
 *
 * Landed = import + logistics + transfer + override. In Bond = landed over
 * (1 − In Bond %). PC = In Bond over (1 − PC %). A margin typed on the row
 * beats the owner's rate, which beats the toolbar. An active PC % beats a
 * stored owner price, which beats the stored selling price.
 *
 * @example
 *   const row = pricePricingManagerRow(product, rates);
 *   row.inBond; // 181.21
 */
const pricePricingManagerRow = (row: PricingManagerRowInput, rates: PricingManagerRates) => {
  const importPrice = row.importPricePerBottle ?? null;
  const costOverride = row.costOverridePerBottle ?? null;

  // Per-line logistics, else live system freight, else the C&C wine fallback
  const systemLog = row.systemLogistics ?? 0;
  const isCcWine = row.isCraftCulture === 1 && (row.category === 'Wine' || row.category == null);
  const logistics =
    row.lineLogistics != null ? row.lineLogistics : systemLog > 0 ? systemLog : isCcWine ? 22.5 : 0;
  // Cru Wine / Crurated default to $0 transfer; everyone else $2.50
  const transfer = row.transferPricePerBottle ?? (row.isZeroTransferOwner === 1 ? 0 : 2.5);

  const isSpiritOrRtd = row.category === 'Spirits' || row.category === 'RTD';
  const lineInbondPct = row.b2bMarginPct ?? (isSpiritOrRtd ? (row.sellMarginPct ?? null) : null);
  const inbondPct =
    lineInbondPct ??
    (rates.ownerSelected ? rates.effInbondPct : (row.ownerInbondPct ?? rates.inBondMarkupPct));
  const inbondDivisor = inbondPct < 100 ? 1 - inbondPct / 100 : null;
  const pcPct =
    row.pcMarginPct ??
    (rates.ownerSelected
      ? rates.effPcPct
      : (row.ownerPcPct ?? (rates.pcMarginPct > 0 ? rates.pcMarginPct : null)));
  const pcDivisor = pcPct != null && pcPct < 100 ? 1 - pcPct / 100 : null;

  const hasCost = (importPrice != null && importPrice > 0) || costOverride != null;
  const landed = hasCost ? (importPrice ?? 0) + logistics + transfer + (costOverride ?? 0) : null;
  const inBond = landed != null && inbondDivisor ? landed / inbondDivisor : null;

  const storedOwnerPrice =
    rates.ownerSelected && rates.ownerPcPrice != null && rates.ownerPcPrice > 0
      ? rates.ownerPcPrice
      : null;
  const computedPc =
    pcDivisor != null && inBond != null && inBond > 0
      ? Math.round(inBond * 100) / 100 / pcDivisor
      : null;
  const sellPrice = computedPc != null ? computedPc : (storedOwnerPrice ?? row.sellingPricePerBottle ?? null);

  return {
    logistics,
    transfer,
    landed,
    inbondPct,
    pcPct,
    inBond,
    computedPc,
    storedOwnerPrice,
    sellPrice,
    /** PC price against In Bond */
    pcMargin: pricingMargin(inBond, sellPrice),
    /** In Bond against landed cost */
    inbondMargin: pricingMargin(landed, inBond),
  };
};

export default pricePricingManagerRow;
