import { and, eq, isNotNull, sql } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { logisticsShipmentItems } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import priceShipmentInUsd from '../utils/priceShipmentInUsd';

/**
 * Rebuild each line's per-bottle cost from the total the document stated
 *
 * A shipment imported before the price fix holds a per-case figure in the
 * per-bottle column: Wilkinson's Price/Case of GBP 3,960 became the cost of one
 * Opus One rather than of twelve. The line totals were captured correctly
 * though, so the shipment can be repaired in place rather than cleared and
 * re-imported, which would cost every mapping and correction made since.
 *
 * The total divided by the line's bottles is the one reading a document cannot
 * be ambiguous about. Lines with no stated total are left alone and counted,
 * since inventing a figure for them would hide the ones still needing a look.
 *
 * Re-prices in USD afterwards at the shipment's own rate, because a corrected
 * source amount that nobody converts is still the wrong number on screen.
 */
const adminRepriceFromTotals = adminProcedure
  .input(
    z.object({
      shipmentId: z.string().uuid(),
      /** The rate agreed with the supplier, if there is one */
      agreedRate: z.number().positive().optional(),
    }),
  )
  .mutation(async ({ input }) => {
    const [totals] = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(logisticsShipmentItems)
      .where(eq(logisticsShipmentItems.shipmentId, input.shipmentId));

    const items = await db
      .select({
        id: logisticsShipmentItems.id,
        sourceTotal: logisticsShipmentItems.sourceTotal,
        sourceUnitPrice: logisticsShipmentItems.sourceUnitPrice,
        totalBottles: logisticsShipmentItems.totalBottles,
        cases: logisticsShipmentItems.cases,
        bottlesPerCase: logisticsShipmentItems.bottlesPerCase,
      })
      .from(logisticsShipmentItems)
      .where(
        and(
          eq(logisticsShipmentItems.shipmentId, input.shipmentId),
          isNotNull(logisticsShipmentItems.sourceTotal),
        ),
      );

    let corrected = 0;
    let unchanged = 0;

    for (const item of items) {
      const bottles =
        item.totalBottles ?? item.cases * (item.bottlesPerCase ?? 0);

      if (!item.sourceTotal || !bottles) {
        unchanged += 1;
        continue;
      }

      const perBottle = item.sourceTotal / bottles;

      // Rounded before comparing: a line already right to the penny should not
      // be reported as corrected because of floating point.
      if (
        item.sourceUnitPrice != null &&
        Math.abs(item.sourceUnitPrice - perBottle) < 0.005
      ) {
        unchanged += 1;
        continue;
      }

      corrected += 1;

      await db
        .update(logisticsShipmentItems)
        .set({ sourceUnitPrice: perBottle, updatedAt: new Date() })
        .where(eq(logisticsShipmentItems.id, item.id));
    }

    const priced = await priceShipmentInUsd(input.shipmentId, {
      agreedRate: input.agreedRate,
    });

    return {
      corrected,
      unchanged,
      /** Lines with no stated total, which this cannot repair */
      withoutTotal: Math.max((totals?.count ?? 0) - items.length, 0),
      rate: priced.rate,
      currency: priced.currency,
    };
  });

export default adminRepriceFromTotals;
