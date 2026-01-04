import { eq } from 'drizzle-orm';
import { cache } from 'react';

import db from '@/database/client';
import { orderPricingOverrides } from '@/database/schema';
import type { PCOPricingVariables } from '@/lib/pricing/types';

/**
 * Get order-level pricing overrides for bespoke PCO pricing
 *
 * Returns null if no overrides exist for the order.
 */
const getOrderPricingOverrides = cache(async (orderId: string) => {
  const override = await db.query.orderPricingOverrides.findFirst({
    where: eq(orderPricingOverrides.orderId, orderId),
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
 * Get PCO variables for an order, applying bespoke overrides if present
 *
 * Resolution order:
 * 1. Order-level bespoke override
 * 2. Global PCO defaults (from database or hardcoded defaults)
 */
const getOrderPCOVariables = cache(
  async (orderId: string, globalVariables: PCOPricingVariables): Promise<PCOPricingVariables> => {
    const override = await getOrderPricingOverrides(orderId);

    if (!override) {
      return globalVariables;
    }

    // Apply overrides, falling back to global for unset values
    return {
      ccMarginPercent: override.ccMarginPercent ?? globalVariables.ccMarginPercent,
      importDutyPercent: override.importDutyPercent ?? globalVariables.importDutyPercent,
      transferCostPercent: override.transferCostPercent ?? globalVariables.transferCostPercent,
      distributorMarginPercent:
        override.distributorMarginPercent ?? globalVariables.distributorMarginPercent,
      vatPercent: override.vatPercent ?? globalVariables.vatPercent,
    };
  },
);

export { getOrderPCOVariables, getOrderPricingOverrides, hasOrderBespokePricing };

export default getOrderPricingOverrides;
