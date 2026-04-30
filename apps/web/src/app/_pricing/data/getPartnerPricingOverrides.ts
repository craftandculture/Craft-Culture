import db from '@/database/client';
import type { PCOPricingVariables } from '@/lib/pricing/types';

/**
 * Get partner-level pricing overrides if they exist and are within the effective date range
 *
 * @param partnerId - The partner UUID to look up
 * @returns The partner's pricing variables or null if none exist / not in date range
 */
const getPartnerPricingOverrides = async (
  partnerId: string,
): Promise<Partial<PCOPricingVariables> | null> => {
  const override = await db.query.partnerPricingOverrides.findFirst({
    where: { partnerId },
  });

  if (!override) return null;

  // Check effective date range
  const now = new Date();

  if (override.effectiveFrom && now < override.effectiveFrom) {
    return null; // Not yet effective
  }

  if (override.effectiveUntil && now > override.effectiveUntil) {
    return null; // Expired
  }

  return {
    ...(override.ccMarginPercent != null && { ccMarginPercent: override.ccMarginPercent }),
    ...(override.importDutyPercent != null && { importDutyPercent: override.importDutyPercent }),
    ...(override.transferCostPercent != null && { transferCostPercent: override.transferCostPercent }),
    ...(override.distributorMarginPercent != null && { distributorMarginPercent: override.distributorMarginPercent }),
    ...(override.vatPercent != null && { vatPercent: override.vatPercent }),
  };
};

export default getPartnerPricingOverrides;
