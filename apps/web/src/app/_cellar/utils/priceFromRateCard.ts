export interface ReleaseRateCard {
  version: string;
  dutyPct: number;
  distributorMarginPct: number;
  ccMarginPct: number;
  clearancePerCase: number;
  clearancePerBottle: number;
  transferPerBottle: number;
  deliveryFlat: number;
  deliveryPerCase: number;
}

export interface ReleaseVolume {
  bottles: number;
  cases: number;
  goodsValueUsd: number;
}

export interface ReleasePricing {
  version: string;
  goodsValueUsd: number;
  dutyUsd: number;
  clearanceUsd: number;
  transferUsd: number;
  deliveryUsd: number;
  /** The licensed partner's cut of a mainland delivery */
  distributorMarginUsd: number;
  /** What C&C earns for handling it */
  ccMarginUsd: number;
  /** Duties, clearance, transfer and the distributor — everything but us */
  clearanceTotalUsd: number;
  /** C&C's margin, quoted to the member as a service fee */
  serviceFeeUsd: number;
  totalUsd: number;
}

const round = (value: number) => Math.round(value * 100) / 100;

/**
 * Apply a rate card to a volume of wine
 *
 * Pure arithmetic, deliberately separated from the database so the rate editor
 * can show the operator what a card will actually charge before it is saved.
 * A preview that reimplemented this would eventually disagree with the quote
 * it is previewing, and the person setting the rates would be the last to know.
 *
 * Both percentages take the declared value as their base rather than the costs,
 * which is how the published rate card already describes a mainland release —
 * an uplift on the duty-free price, not a mark-up on the paperwork.
 *
 * @param rate - The card being applied
 * @param volume - Bottles, cases and what the wine is worth
 * @returns Every line of the quote, with the two margins kept apart
 */
const priceFromRateCard = (
  rate: ReleaseRateCard,
  volume: ReleaseVolume,
): ReleasePricing => {
  const { bottles, cases, goodsValueUsd } = volume;

  const dutyUsd = round(goodsValueUsd * (rate.dutyPct / 100));
  const clearanceUsd = round(
    cases * rate.clearancePerCase + bottles * rate.clearancePerBottle,
  );
  const transferUsd = round(bottles * rate.transferPerBottle);
  const deliveryUsd = round(
    (bottles > 0 ? rate.deliveryFlat : 0) + cases * rate.deliveryPerCase,
  );

  const distributorMarginUsd = round(
    goodsValueUsd * (rate.distributorMarginPct / 100),
  );
  const ccMarginUsd = round(goodsValueUsd * (rate.ccMarginPct / 100));

  const clearanceTotalUsd = round(
    dutyUsd + clearanceUsd + transferUsd + distributorMarginUsd,
  );

  return {
    version: rate.version,
    goodsValueUsd: round(goodsValueUsd),
    dutyUsd,
    clearanceUsd,
    transferUsd,
    deliveryUsd,
    distributorMarginUsd,
    ccMarginUsd,
    clearanceTotalUsd,
    serviceFeeUsd: ccMarginUsd,
    totalUsd: round(clearanceTotalUsd + deliveryUsd + ccMarginUsd),
  };
};

export default priceFromRateCard;
