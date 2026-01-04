import { eq } from 'drizzle-orm';

import { getOrderPCOVariables } from '@/app/_pricing/data/getOrderPricingOverrides';
import { getPCOVariables } from '@/app/_pricing/data/getPricingConfig';
import db from '@/database/client';
import { privateClientOrderItems, privateClientOrders } from '@/database/schema';
import { DEFAULT_EXCHANGE_RATES } from '@/lib/pricing/defaults';
import { calculatePCOAdmin } from '@/lib/pricing/pricingEngine';

/**
 * Recalculate order totals using the PCO pricing engine
 *
 * Uses the new standardized pricing engine with:
 * - Global PCO pricing variables from database
 * - Order-level bespoke overrides (if configured during approval)
 *
 * Pricing formula (per line item):
 * 1. Landed Duty Free = Supplier Price ÷ (1 - C&C Margin%)
 * 2. Import Duty = LDF × Duty%
 * 3. Transfer Cost = LDF × Transfer%
 * 4. Duty Paid Landed = LDF + Duty + Transfer
 * 5. After Distributor = DPL ÷ (1 - Distributor Margin%)
 * 6. VAT = After Distributor × VAT%
 * 7. Final = After Distributor + VAT
 */
const recalculateOrderTotals = async (orderId: string) => {
  // Get global PCO variables (from database or defaults)
  const globalVariables = await getPCOVariables();

  // Get effective variables for this order (applies bespoke overrides if set)
  const effectiveVariables = await getOrderPCOVariables(orderId, globalVariables);

  // Get all line items for the order
  const items = await db
    .select({
      id: privateClientOrderItems.id,
      quantity: privateClientOrderItems.quantity,
      pricePerCaseUsd: privateClientOrderItems.pricePerCaseUsd,
    })
    .from(privateClientOrderItems)
    .where(eq(privateClientOrderItems.orderId, orderId));

  // Calculate pricing for each line item and aggregate
  let totalLandedDutyFree = 0;
  let totalDuty = 0;
  let totalTransfer = 0;
  let totalVat = 0;
  let totalFinal = 0;
  let totalCases = 0;

  for (const item of items) {
    // Calculate for total line item value (pricePerCase * quantity)
    const lineTotal = item.pricePerCaseUsd * item.quantity;
    const result = calculatePCOAdmin(lineTotal, effectiveVariables, DEFAULT_EXCHANGE_RATES);

    totalLandedDutyFree += result.landedDutyFree;
    totalDuty += result.importDutyAmount;
    totalTransfer += result.transferCostAmount;
    totalVat += result.vatAmount;
    totalFinal += result.finalPriceUsd;
    totalCases += item.quantity;
  }

  const itemCount = items.length;

  // Round all values
  const round2 = (v: number) => Math.round(v * 100) / 100;

  // Update the order
  // Note: "subtotalUsd" stores Landed Duty Free (after C&C margin)
  // "logisticsUsd" stores transfer cost (not actual shipping logistics)
  await db
    .update(privateClientOrders)
    .set({
      itemCount,
      caseCount: totalCases,
      subtotalUsd: round2(totalLandedDutyFree),
      dutyUsd: round2(totalDuty),
      vatUsd: round2(totalVat),
      logisticsUsd: round2(totalTransfer),
      totalUsd: round2(totalFinal),
      totalAed: round2(totalFinal * DEFAULT_EXCHANGE_RATES.usdToAed),
      usdToAedRate: DEFAULT_EXCHANGE_RATES.usdToAed,
      updatedAt: new Date(),
    })
    .where(eq(privateClientOrders.id, orderId));
};

export default recalculateOrderTotals;
