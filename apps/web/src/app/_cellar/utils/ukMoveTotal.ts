/** LCB's charges are recharged to the member at cost plus this share */
export const LCB_RECHARGE_MARKUP = 0.3;

const round = (value: number) => Math.round(value * 100) / 100;

export interface UkMoveCharges {
  freightUsd: number;
  /** What LCB billed us, at cost */
  lcbChargesUsd: number;
  otherUsd: number;
}

/**
 * What a member pays for a UK move, from the charges at cost
 *
 * One calculation for the quote form's preview, the quote the member is sent
 * and the invoice job, so the three can never differ. Staff enter LCB's
 * charges as billed; the member is charged cost plus 30% on those alone.
 * Freight and anything else pass through at the figure entered.
 *
 * @example
 *   ukMoveTotal({ freightUsd: 900, lcbChargesUsd: 60, otherUsd: 0 });
 *   // { lcbChargedUsd: 78, totalUsd: 978 }
 *
 * @param charges - Freight, LCB's charges at cost and anything else
 * @returns LCB's charges as recharged, and the member's total
 */
const ukMoveTotal = ({ freightUsd, lcbChargesUsd, otherUsd }: UkMoveCharges) => {
  const lcbChargedUsd = round(lcbChargesUsd * (1 + LCB_RECHARGE_MARKUP));
  const totalUsd = round(freightUsd + lcbChargedUsd + otherUsd);

  return { lcbChargedUsd, totalUsd };
};

export default ukMoveTotal;
