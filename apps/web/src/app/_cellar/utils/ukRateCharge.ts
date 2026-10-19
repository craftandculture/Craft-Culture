import { LCB_RECHARGE_MARKUP } from './ukMoveTotal';

export interface UkRateCard {
  storagePerUnitMonthGbp: number;
  receivePerCaseGbp: number;
  handlingOutPerCaseGbp: number;
  exportDocsPerMoveGbp: number;
}

const round = (value: number) => Math.round(value * 100) / 100;

/** A cost from LCB, as the member pays it: cost plus our recharge */
export const toMemberPrice = (costGbp: number) => round(costGbp * (1 + LCB_RECHARGE_MARKUP));

/**
 * A month's UK storage for a member, at cost and as charged
 *
 * One calculation for the rate card's example, the Storage tab and the
 * invoice, so the three can never differ. Units are counted by the same rule
 * as the UAE (countChargeableCases): a 12 × 75cl case is one, a case of six
 * half, large formats by volume. There is no allowance: the UK is charged for
 * every unit held, and the UAE membership covers only the UAE.
 *
 * @example
 *   ukStorageCharge(106, { storagePerUnitMonthGbp: 1.2, ... });
 *   // { costGbp: 127.2, chargedGbp: 165.36 }
 *
 * @param units - Case units held at LCB
 * @param card - The UK rates in force
 * @returns The month at cost and as charged, in GBP
 */
const ukStorageCharge = (units: number, card: Pick<UkRateCard, 'storagePerUnitMonthGbp'>) => {
  const costGbp = round(Math.max(0, units) * card.storagePerUnitMonthGbp);
  return { costGbp, chargedGbp: toMemberPrice(costGbp) };
};

export default ukStorageCharge;
