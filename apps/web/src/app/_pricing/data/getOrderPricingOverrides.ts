import { cache } from 'react';

import db from '@/database/client';
import type { PCOPricingVariables } from '@/lib/pricing/types';

import getPartnerPricingOverrides from './getPartnerPricingOverrides';

/**
 * Get order-level pricing overrides for bespoke PCO pricing
 *
 * Returns null if no overrides exist for the order.
 */
const getOrderPricingOverrides = cache(async (orderId: string) => {
  const override = await db.query.orderPricingOverrides.findFirst({
    where: { orderId },
  });

  return override;
});

/**
 * Check if an order has bespoke pricing
 */
const hasOrderBespokePricing = cache(async (orderId: string): Promise<boolean> => {
  const override = await getOrderPricingOverrides(orderId);
  return override !== undefined && override !== null;
});

/**
 * Get PCO variables for an order, applying overrides in priority order
 *
 * Resolution order:
 * 1. Order-level override (snapshot from approval or bespoke pricing)
 * 2. Partner-level override (per-partner custom pricing within effective dates)
 * 3. Global PCO defaults (from database or hardcoded defaults)
 */
const getOrderPCOVariables = cache(
  async (
    orderId: string,
    partnerId: string | null,
    globalVariables: PCOPricingVariables,
  ): Promise<PCOPricingVariables> => {
    // 1. Check order-level override first (snapshots from approval)
    const orderOverride = await getOrderPricingOverrides(orderId);

    if (orderOverride) {
      return {
        ccMarginPercent: orderOverride.ccMarginPercent ?? globalVariables.ccMarginPercent,
        importDutyPercent: orderOverride.importDutyPercent ?? globalVariables.importDutyPercent,
        transferCostPercent: orderOverride.transferCostPercent ?? globalVariables.transferCostPercent,
        distributorMarginPercent:
          orderOverride.distributorMarginPercent ?? globalVariables.distributorMarginPercent,
        vatPercent: orderOverride.vatPercent ?? globalVariables.vatPercent,
      };
    }

    // 2. Check partner-level override (within effective date range)
    if (partnerId) {
      const partnerOverride = await getPartnerPricingOverrides(partnerId);

      if (partnerOverride) {
        return {
          ccMarginPercent: partnerOverride.ccMarginPercent ?? globalVariables.ccMarginPercent,
          importDutyPercent: partnerOverride.importDutyPercent ?? globalVariables.importDutyPercent,
          transferCostPercent: partnerOverride.transferCostPercent ?? globalVariables.transferCostPercent,
          distributorMarginPercent:
            partnerOverride.distributorMarginPercent ?? globalVariables.distributorMarginPercent,
          vatPercent: partnerOverride.vatPercent ?? globalVariables.vatPercent,
        };
      }
    }

    // 3. Fall back to global defaults
    return globalVariables;
  },
);

export { getOrderPCOVariables, getOrderPricingOverrides, hasOrderBespokePricing };

export default getOrderPricingOverrides;
