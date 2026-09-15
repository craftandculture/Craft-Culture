export interface ReleaseRateCard {
  version: string;
  /** Duty, assessed on the declared value at clearance */
  dutyPct: number;
  /** VAT, on the whole released value */
  vatPct: number;
  distributorMarginPct: number;
  ccMarginPct: number;
  transferPerBottle: number;
  /** Charged once per sealed case that has to be opened */
  repackPerCase: number;
  deliveryFlat: number;
  deliveryPerCase: number;
}

export interface ReleaseVolume {
  bottles: number;
  cases: number;
  /**
   * Sealed cases that have to be broken to make up this quantity.
   *
   * One per line taking a part case, not one per bottle: opening a twelve to
   * take seven is the same work as opening it to take one.
   */
  repackCases: number;
  goodsValueUsd: number;
}

export interface ReleasePricing {
  version: string;
  goodsValueUsd: number;
  dutyUsd: number;
  vatUsd: number;
  transferUsd: number;
  deliveryUsd: number;
  /** Breaking sealed cases to make up a part quantity */
  repackUsd: number;
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
  const { bottles, cases, repackCases, goodsValueUsd } = volume;

  const dutyUsd = round(goodsValueUsd * (rate.dutyPct / 100));
  const transferUsd = round(bottles * rate.transferPerBottle);
  const deliveryUsd = round(
    (bottles > 0 ? rate.deliveryFlat : 0) + cases * rate.deliveryPerCase,
  );

  /*
    Breaking a case is real work — open, count, relabel, restack both halves —
    and the remainder is worth less broken than it was sealed. It was tracked in
    wms_repacks and charged nowhere.
  */
  const repackUsd = round(repackCases * rate.repackPerCase);

  const distributorMarginUsd = round(
    goodsValueUsd * (rate.distributorMarginPct / 100),
  );
  const ccMarginUsd = round(goodsValueUsd * (rate.ccMarginPct / 100));

  const vatUsd = round(
    (goodsValueUsd +
      dutyUsd +
      transferUsd +
      deliveryUsd +
      repackUsd +
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
    repackUsd,
    distributorMarginUsd,
    ccMarginUsd,
    clearanceTotalUsd,
    serviceFeeUsd: ccMarginUsd,
    totalUsd: round(clearanceTotalUsd + deliveryUsd + repackUsd + ccMarginUsd),
  };
};

export default priceFromRateCard;
