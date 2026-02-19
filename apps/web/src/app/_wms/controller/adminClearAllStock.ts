import { sql } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import {
  consignmentSettlementItems,
  wmsCaseLabels,
  wmsCycleCountItems,
  wmsCycleCounts,
  wmsPartnerRequests,
  wmsPickListItems,
  wmsPickLists,
  wmsRepacks,
  wmsStock,
  wmsStockMovements,
  wmsStockReservations,
  zohoSalesOrderItems,
} from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

/**
 * Clear ALL WMS stock data for go-live preparation
 *
 * Safely deletes all stock records, case labels, movements, reservations,
 * cycle counts, pick lists, and repacks. Nulls out FK references from
 * non-WMS tables (Zoho order items, settlements, partner requests).
 *
 * Requires explicit `confirm: true` to prevent accidental execution.
 *
 * @example
 *   await trpcClient.wms.admin.stock.clearAll.mutate({ confirm: true });
 */
const adminClearAllStock = adminProcedure
  .input(z.object({ confirm: z.literal(true) }))
  .mutation(async () => {
    const counts = {
      stockDeleted: 0,
      caseLabelsDeleted: 0,
      movementsDeleted: 0,
      reservationsDeleted: 0,
      cycleCountItemsDeleted: 0,
      cycleCountsDeleted: 0,
      pickListItemsDeleted: 0,
      pickListsDeleted: 0,
      repacksDeleted: 0,
      zohoItemsNulled: 0,
      settlementItemsNulled: 0,
      partnerRequestsNulled: 0,
    };

    // 1. NULL out FK references from non-WMS tables
    const zohoAll = await db
      .update(zohoSalesOrderItems)
      .set({ stockId: null })
      .where(sql`${zohoSalesOrderItems.stockId} IS NOT NULL`)
      .returning({ id: zohoSalesOrderItems.id });
    counts.zohoItemsNulled = zohoAll.length;

    const settlementAll = await db
      .update(consignmentSettlementItems)
      .set({ stockId: null })
      .where(sql`${consignmentSettlementItems.stockId} IS NOT NULL`)
      .returning({ id: consignmentSettlementItems.id });
    counts.settlementItemsNulled = settlementAll.length;

    const partnerAll = await db
      .update(wmsPartnerRequests)
      .set({ stockId: null })
      .where(sql`${wmsPartnerRequests.stockId} IS NOT NULL`)
      .returning({ id: wmsPartnerRequests.id });
    counts.partnerRequestsNulled = partnerAll.length;

    // 2. Delete from dependent WMS tables (order matters for FK constraints)
    const reservations = await db
      .delete(wmsStockReservations)
      .returning({ id: wmsStockReservations.id });
    counts.reservationsDeleted = reservations.length;

    const cycleCountItems = await db
      .delete(wmsCycleCountItems)
      .returning({ id: wmsCycleCountItems.id });
    counts.cycleCountItemsDeleted = cycleCountItems.length;

    const cycleCounts = await db
      .delete(wmsCycleCounts)
      .returning({ id: wmsCycleCounts.id });
    counts.cycleCountsDeleted = cycleCounts.length;

    const pickListItems = await db
      .delete(wmsPickListItems)
      .returning({ id: wmsPickListItems.id });
    counts.pickListItemsDeleted = pickListItems.length;

    const pickLists = await db
      .delete(wmsPickLists)
      .returning({ id: wmsPickLists.id });
    counts.pickListsDeleted = pickLists.length;

    const repacks = await db
      .delete(wmsRepacks)
      .returning({ id: wmsRepacks.id });
    counts.repacksDeleted = repacks.length;

    const caseLabels = await db
      .delete(wmsCaseLabels)
      .returning({ id: wmsCaseLabels.id });
    counts.caseLabelsDeleted = caseLabels.length;

    const movements = await db
      .delete(wmsStockMovements)
      .returning({ id: wmsStockMovements.id });
    counts.movementsDeleted = movements.length;

    // 3. Delete all stock records
    const stock = await db
      .delete(wmsStock)
      .returning({ id: wmsStock.id });
    counts.stockDeleted = stock.length;

    return { success: true, counts };
  });

export default adminClearAllStock;
