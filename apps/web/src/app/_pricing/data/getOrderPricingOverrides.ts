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
    /*
      Field by field: a figure the order override leaves empty takes the
      partner's rate before the global one. It used to fall straight to the
      global rate, so a partner with its own rate lost it on any order that
      had an override for some other figure.
    */
    const orderOverride = await getOrderPricingOverrides(orderId);
    const partnerOverride = partnerId ? await getPartnerPricingOverrides(partnerId) : null;

    if (orderOverride || partnerOverride) {
      const pick = (field: keyof PCOPricingVariables) =>
        orderOverride?.[field] ?? partnerOverride?.[field] ?? globalVariables[field];

      return {
        ccMarginPercent: pick('ccMarginPercent'),
        importDutyPercent: pick('importDutyPercent'),
        transferCostPercent: pick('transferCostPercent'),
        distributorMarginPercent: pick('distributorMarginPercent'),
        vatPercent: pick('vatPercent'),
      };
    }

    // 3. Fall back to global defaults
    return globalVariables;
  },
);

export { getOrderPCOVariables, getOrderPricingOverrides, hasOrderBespokePricing };

export default getOrderPricingOverrides;
