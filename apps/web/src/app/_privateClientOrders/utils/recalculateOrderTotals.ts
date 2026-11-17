import { eq } from 'drizzle-orm';

import { getOrderPCOVariables } from '@/app/_pricing/data/getOrderPricingOverrides';
import { getPCOVariables } from '@/app/_pricing/data/getPricingConfig';
import db from '@/database/client';
import { privateClientOrderItems, privateClientOrders } from '@/database/schema';
import { DEFAULT_EXCHANGE_RATES } from '@/lib/pricing/defaults';
import { calculatePCOAdmin } from '@/lib/pricing/pricingEngine';
import logger from '@/utils/logger';

import pcoLineBottles from './pcoLineBottles';

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
 *
 * @throws Error if pricing variables cannot be loaded
 */
const recalculateOrderTotals = async (orderId: string) => {
  try {
    // Get the order to resolve partnerId
    const order = await db.query.privateClientOrders.findFirst({
      where: { id: orderId },
      columns: { partnerId: true, totalUsd: true, orderKind: true },
    });

    // Get global PCO variables (from database or defaults)
    const globalVariables = await getPCOVariables();

    if (!globalVariables) {
      logger.error('Failed to load global PCO pricing variables', { orderId });
      throw new Error('Failed to load pricing configuration');
    }

    // Get effective variables: order override → partner override → global defaults
    const effectiveVariables = await getOrderPCOVariables(orderId, order?.partnerId ?? null, globalVariables);

    if (!effectiveVariables) {
      logger.error('Failed to load effective pricing variables for order', { orderId });
      throw new Error('Failed to load order pricing configuration');
    }

    // Get all line items for the order
    const items = await db
      .select({
        id: privateClientOrderItems.id,
        quantity: privateClientOrderItems.quantity,
        pricePerCaseUsd: privateClientOrderItems.pricePerCaseUsd,
        caseConfig: privateClientOrderItems.caseConfig,
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
    let totalGoods = 0;

    for (const item of items) {
      // Calculate for total line item value (pricePerCase * quantity)
      const lineTotal = item.pricePerCaseUsd * item.quantity;
      const bottles = pcoLineBottles(item);
      const result = calculatePCOAdmin(
        lineTotal,
        effectiveVariables,
        DEFAULT_EXCHANGE_RATES,
        false,
        bottles,
      );

      totalGoods += lineTotal;
      totalLandedDutyFree += result.landedDutyFree;
      totalDuty += result.importDutyAmount;
      totalTransfer += result.transferCostAmount;
      totalVat += result.vatAmount;
      totalFinal += result.finalPriceUsd;
      totalCases += item.quantity;
    }

    const itemCount = items.length;

    // A subscription box carries one price for the whole order and none on its
    // lines. Summing zero-priced lines would wipe that price, so keep the stored
    // money and only refresh the counts.
    const isBox =
      itemCount > 0 &&
      items.every((item) => !item.pricePerCaseUsd) &&
      (Number(order?.totalUsd) || 0) > 0;

    if (isBox) {
      await db
        .update(privateClientOrders)
        .set({ itemCount, caseCount: totalCases, updatedAt: new Date() })
        .where(eq(privateClientOrders.id, orderId));
      return;
    }

    // Round all values
    const round2 = (v: number) => Math.round(v * 100) / 100;

    /*
      The client already owns the wine (a Private Cellar member's own wine, or
      an order switched to "client owns the wine"). The lines carry the wine's
      commercial invoice price so duty, margins and VAT are built off it, but
      the client is never charged for the wine itself. So the order holds what
      is charged over it: the client total less the wine, and as the subtotal
      what the distributor pays C&C over the wine (C&C's margin and handling).
      The wine's value is the sum of the lines, read from them wherever shown.

      A legacy release order has zero-priced lines and carries the member's
      quote as its totals; with no wine value to build from, that is kept.
    */
    if (order?.orderKind === 'owner_delivery') {
      if (totalGoods <= 0) {
        await db
          .update(privateClientOrders)
          .set({ itemCount, caseCount: totalCases, updatedAt: new Date() })
          .where(eq(privateClientOrders.id, orderId));
        return;
      }

      const clientTotal = Math.max(0, totalFinal - totalGoods);

      await db
        .update(privateClientOrders)
        .set({
          itemCount,
          caseCount: totalCases,
          subtotalUsd: round2(Math.max(0, totalLandedDutyFree - totalGoods)),
          dutyUsd: round2(totalDuty),
          vatUsd: round2(totalVat),
          logisticsUsd: round2(totalTransfer),
          totalUsd: round2(clientTotal),
          totalAed: round2(clientTotal * DEFAULT_EXCHANGE_RATES.usdToAed),
          usdToAedRate: DEFAULT_EXCHANGE_RATES.usdToAed,
          updatedAt: new Date(),
        })
        .where(eq(privateClientOrders.id, orderId));
      return;
    }

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
  } catch (error) {
    logger.error('Failed to recalculate order totals', {
      orderId,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
};

export default recalculateOrderTotals;
