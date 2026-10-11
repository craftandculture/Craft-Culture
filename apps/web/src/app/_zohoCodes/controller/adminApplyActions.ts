import { and, eq, gt, notInArray } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { zohoItemChanges, zohoSalesOrderItems, zohoSalesOrders } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';
import { getItem, markItemInactive, updateItem } from '@/lib/zoho/items';
import logger from '@/utils/logger';

const actionSchema = z.object({
  itemId: z.string(),
  kind: z.enum(['add_dashes', 'retire_duplicate', 'retire_non_lwin', 'retire_not_held']),
  /** The SKU the plan saw; a different one live means someone changed it */
  expectSku: z.string(),
  toSku: z.string().nullable(),
  reason: z.string(),
});

/** Zoho allows ~100 calls a minute per organisation */
const pause = () => new Promise((r) => setTimeout(r, 400));

/**
 * Apply a slice of the cleanup plan to Zoho
 *
 * Each item is re-read live first and skipped if it has changed since the
 * plan, become inactive, gained stock, or landed on an open sales order — the
 * plan is evidence, not permission. Every write is logged under the batch so
 * it can be undone. The page sends ten at a time, retirements before dashes,
 * so a duplicate frees its code before the kept item takes it.
 */
const adminApplyActions = adminProcedure
  .input(z.object({ batchId: z.string().uuid(), actions: z.array(actionSchema).min(1).max(10) }))
  .mutation(async ({ input, ctx }) => {
    const results: { itemId: string; ok: boolean; message: string }[] = [];

    const log = (itemId: string, itemName: string, action: string, beforeSku: string, afterSku: string, reason: string) =>
      db.insert(zohoItemChanges).values({ batchId: input.batchId, zohoItemId: itemId, itemName, action, beforeSku, afterSku, reason, createdBy: ctx.user.id });

    for (const a of input.actions) {
      try {
        const live = await getItem(a.itemId);
        await pause();
        const liveSku = (live.sku ?? '').trim();
        if (live.status !== 'active') {
          results.push({ itemId: a.itemId, ok: false, message: 'Already inactive in Zoho' });
          continue;
        }
        if (liveSku !== a.expectSku.trim()) {
          results.push({ itemId: a.itemId, ok: false, message: `SKU changed in Zoho to "${liveSku}" — refresh the plan` });
          continue;
        }

        if (a.kind === 'add_dashes') {
          if (!a.toSku) throw new Error('No SKU to set');
          await updateItem(a.itemId, { name: live.name, sku: a.toSku });
          await log(a.itemId, live.name, 'set_sku', liveSku, a.toSku, a.reason);
          await pause();
          results.push({ itemId: a.itemId, ok: true, message: `SKU now ${a.toSku}` });
          continue;
        }

        const stock = Number(live.stock_on_hand ?? 0);
        if (stock !== 0) {
          results.push({ itemId: a.itemId, ok: false, message: `Holds ${stock} in Zoho — not retired` });
          continue;
        }
        const [onOrder] = await db
          .select({ id: zohoSalesOrderItems.id })
          .from(zohoSalesOrderItems)
          .innerJoin(zohoSalesOrders, eq(zohoSalesOrders.id, zohoSalesOrderItems.salesOrderId))
          .where(
            and(
              eq(zohoSalesOrderItems.zohoItemId, a.itemId),
              gt(zohoSalesOrderItems.quantity, 0),
              notInArray(zohoSalesOrders.status, ['dispatched', 'delivered', 'cancelled']),
            ),
          )
          .limit(1);
        if (onOrder) {
          results.push({ itemId: a.itemId, ok: false, message: 'On a sales order not yet dispatched — not retired' });
          continue;
        }

        if (a.toSku) {
          await updateItem(a.itemId, { name: live.name, sku: a.toSku });
          await log(a.itemId, live.name, 'set_sku', liveSku, a.toSku, a.reason);
          await pause();
        }
        await markItemInactive(a.itemId);
        await log(a.itemId, live.name, 'inactivate', a.toSku ?? liveSku, a.toSku ?? liveSku, a.reason);
        await pause();
        results.push({ itemId: a.itemId, ok: true, message: a.toSku ? `Renamed ${a.toSku} and made inactive` : 'Made inactive' });
      } catch (error) {
        logger.error('Zoho code cleanup: write failed', { itemId: a.itemId, kind: a.kind, error });
        results.push({ itemId: a.itemId, ok: false, message: error instanceof Error ? error.message : 'Zoho refused the change' });
      }
    }

    return { results };
  });

export default adminApplyActions;
