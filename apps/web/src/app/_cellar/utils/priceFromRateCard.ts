export interface ReleaseRateCard {
  version: string;
  /** Duty, assessed on the declared value at clearance */
  dutyPct: number;
  /** VAT, on the whole released value */
  vatPct: number;
  distributorMarginPct: number;
  ccMarginPct: number;
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
  vatUsd: number;
  transferUsd: number;
  deliveryUsd: number;
  /** The licensed partner's cut of a mainland delivery */
  distributorMarginUsd: number;
  /** What C&C earns for handling it */
  ccMarginUsd: number;
  /** Duty, VAT, transfer and the distributor — everything but delivery and us */
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
 * Duty and clearance are one charge, not two: what is paid at clearance is the
 * duty, assessed on the declared value. Percentages take that declared value as
 * their base, which is how the published rate card already describes a mainland
 * release — an uplift on the duty-free price, not a mark-up on the paperwork.
 *
 * VAT is charged last, on everything else. It is the tax on the released value
 * as a whole, so it has to sit on top of duty and fees rather than beside them
 * — a VAT figure taken on the goods alone would under-collect on every release.
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
  const transferUsd = round(bottles * rate.transferPerBottle);
  const deliveryUsd = round(
    (bottles > 0 ? rate.deliveryFlat : 0) + cases * rate.deliveryPerCase,
  );

  const distributorMarginUsd = round(
    goodsValueUsd * (rate.distributorMarginPct / 100),
  );
  const ccMarginUsd = round(goodsValueUsd * (rate.ccMarginPct / 100));

  const vatUsd = round(
    (goodsValueUsd +
      dutyUsd +
      transferUsd +
      deliveryUsd +
      distributorMarginUsd +
      ccMarginUsd) *
      (rate.vatPct / 100),
  );

  const clearanceTotalUsd = round(
    dutyUsd + vatUsd + transferUsd + distributorMarginUsd,
  );

  return {
    version: rate.version,
    goodsValueUsd: round(goodsValueUsd),
    dutyUsd,
    vatUsd,
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
