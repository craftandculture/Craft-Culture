/**
 * What a condition report costs, per case
 *
 * Stated in one place because it appears in three: the button a member
 * presses, the request that is written, and the invoice that follows.
 *
 * Matches the published rate card, which prices photography and reporting at
 * AED 100 per case. Keep the two together — a member who has seen both should
 * not have to work out which one applies to them.
 */
const CONDITION_REPORT_FEE_AED = 100;

/** Loose bottles (a pack of one) are reported, and charged, by the bottle */
export const CONDITION_REPORT_FEE_PER_BOTTLE_AED = 50;

/**
 * What a condition report on one parcel costs, and in what unit
 *
 * @example
 *   conditionReportFee({ caseConfig: 1, quantityCases: 3 }); // { unit: 'bottle', rateAed: 50, totalAed: 150 }
 *   conditionReportFee({ caseConfig: 6, quantityCases: 2 }); // { unit: 'case', rateAed: 100, totalAed: 200 }
 */
export const conditionReportFee = ({
  caseConfig,
  quantityCases,
}: {
  caseConfig: number | null | undefined;
  quantityCases: number;
}) => {
  const loose = (caseConfig ?? 1) === 1;
  const rateAed = loose ? CONDITION_REPORT_FEE_PER_BOTTLE_AED : CONDITION_REPORT_FEE_AED;
  return { unit: loose ? ('bottle' as const) : ('case' as const), rateAed, totalAed: rateAed * quantityCases };
};

export default CONDITION_REPORT_FEE_AED;
