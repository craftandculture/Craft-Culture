import { and, desc, eq, isNull } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { zohoItemChanges } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';
import { deleteItem, markItemActive, markItemInactive, updateItem } from '@/lib/zoho/items';
import logger from '@/utils/logger';

const pause = () => new Promise((r) => setTimeout(r, 400));

/**
 * Undo a batch of cleanup writes, newest first
 *
 * In reverse order: an item created is deleted, or — once an order has used
 * it — renamed "… (undone)" and made inactive, freeing its name; retired
 * items are then made active again and given their names back.
 * Rows already undone are skipped; a failed row is reported and left for a
 * second try. Up to 25 rows per call; the page repeats until none remain.
 */
const adminUndoBatch = adminProcedure
  .input(z.object({ batchId: z.string().uuid() }))
  .mutation(async ({ input, ctx }) => {
    const rows = await db
      .select()
      .from(zohoItemChanges)
      .where(and(eq(zohoItemChanges.batchId, input.batchId), isNull(zohoItemChanges.undoneAt)))
      .orderBy(desc(zohoItemChanges.createdAt))
      .limit(25);

    const failed: { itemName: string; message: string }[] = [];
    for (const row of rows) {
      try {
        if (row.action === 'inactivate') await markItemActive(row.zohoItemId);
        else if (row.action === 'create') {
          // Delete if nothing has used it yet; otherwise park it so its name is free
          try {
            await deleteItem(row.zohoItemId);
          } catch {
            await updateItem(row.zohoItemId, { name: `${row.afterName ?? row.itemName} (undone)`.slice(0, 100) });
            await markItemInactive(row.zohoItemId);
          }
        }
        else if (row.action === 'rename') await updateItem(row.zohoItemId, { name: row.beforeName ?? row.itemName, sku: row.beforeSku ?? '' });
        else await updateItem(row.zohoItemId, { name: row.itemName, sku: row.beforeSku ?? '' });
        await db.update(zohoItemChanges).set({ undoneAt: new Date(), undoneBy: ctx.user.id }).where(eq(zohoItemChanges.id, row.id));
      } catch (error) {
        logger.error('Zoho code cleanup: undo failed', { rowId: row.id, error });
        failed.push({ itemName: row.itemName, message: error instanceof Error ? error.message : 'Zoho refused' });
      }
      await pause();
    }

    const [remaining] = await db
      .select({ id: zohoItemChanges.id })
      .from(zohoItemChanges)
      .where(and(eq(zohoItemChanges.batchId, input.batchId), isNull(zohoItemChanges.undoneAt)))
      .limit(1);

    return { undone: rows.length - failed.length, failed, done: !remaining || failed.length === rows.length };
  });

export default adminUndoBatch;
