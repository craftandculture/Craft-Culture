import { and, eq, gt, notInArray } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { zohoItemChanges, zohoSalesOrderItems, zohoSalesOrders } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';
import { createItem, getItem, markItemInactive, searchItems, updateItem } from '@/lib/zoho/items';
import logger from '@/utils/logger';

const retireSchema = z.object({
  id: z.string(),
  kind: z.enum(['retire', 'retire_duplicate', 'retire_not_held']),
  itemId: z.string(),
  /** The SKU and name the plan saw; different ones live mean someone changed it */
  expectSku: z.string(),
  expectName: z.string(),
  toName: z.string(),
  toSku: z.string().nullable(),
  reason: z.string(),
});

const customsSchema = z.object({
  hsCode: z.string().regex(/^\d{8}$/),
  country: z.string().nullable(),
});

const setCustomsSchema = z.object({
  id: z.string(),
  kind: z.literal('set_customs'),
  itemId: z.string(),
  expectSku: z.string(),
  customs: customsSchema,
  reason: z.string(),
});

const createSchema = z.object({
  id: z.string(),
  kind: z.literal('create'),
  customs: customsSchema,
  name: z.string().min(1).max(100),
  sku: z.string().regex(/^[A-Z0-9]+-\d{4}-\d{2}-\d{5}$/),
  producer: z.string().nullable(),
  bottlesPerCase: z.number().int().positive(),
  bottleSizeMl: z.number().int().positive(),
  reason: z.string(),
});

/** Zoho allows ~100 calls a minute per organisation */
const pause = () => new Promise((r) => setTimeout(r, 400));

/**
 * Apply a slice of the clean start to Zoho
 *
 * Retire: the item is re-read live and skipped if its SKU or name changed, it
 * is already inactive, or it has landed on an open sales order. Otherwise it
 * is renamed "… (old)" — freeing its name for the new item — and made
 * inactive. Create: skipped if an active item already carries the code;
 * otherwise created from the Stock Explorer record. Every write is logged
 * under the batch so it can be undone. The page sends retirements first.
 */
const adminApplyActions = adminProcedure
  .input(
    z.object({
      batchId: z.string().uuid(),
      actions: z.array(z.discriminatedUnion('kind', [retireSchema.extend({ kind: z.literal('retire') }), retireSchema.extend({ kind: z.literal('retire_duplicate') }), retireSchema.extend({ kind: z.literal('retire_not_held') }), createSchema, setCustomsSchema])).min(1).max(10),
    }),
  )
  .mutation(async ({ input, ctx }) => {
    const results: { id: string; ok: boolean; message: string }[] = [];

    const log = (row: Omit<typeof zohoItemChanges.$inferInsert, 'batchId' | 'createdBy'>) =>
      db.insert(zohoItemChanges).values({ ...row, batchId: input.batchId, createdBy: ctx.user.id });

    for (const a of input.actions) {
      try {
        if (a.kind === 'create') {
          const existing = (await searchItems(a.sku)).filter((i) => i.status === 'active' && (i.sku ?? '').trim().toUpperCase() === a.sku);
          await pause();
          if (existing.length) {
            results.push({ id: a.id, ok: false, message: `"${existing[0]!.name}" already carries ${a.sku}` });
            continue;
          }
          const created = await createItem({
            name: a.name,
            sku: a.sku,
            rate: 0,
            unit: 'Case',
            item_type: 'inventory',
            product_type: 'goods',
            is_taxable: true,
            description: `${a.bottlesPerCase}x${Math.round(a.bottleSizeMl / 10)}cl`,
            manufacturer: a.producer ?? undefined,
            brand: a.producer ?? undefined,
            upc: a.customs.hsCode,
            isbn: a.customs.country ?? undefined,
          });
          await log({
            zohoItemId: created.item_id,
            itemName: created.name,
            action: 'create',
            afterSku: a.sku,
            afterName: created.name,
            afterDetails: { upc: a.customs.hsCode, isbn: a.customs.country },
            reason: a.reason,
          });
          await pause();
          results.push({ id: a.id, ok: true, message: `Created ${a.sku}` });
          continue;
        }

        if (a.kind === 'set_customs') {
          const live = await getItem(a.itemId);
          await pause();
          if (live.status !== 'active' || (live.sku ?? '').trim() !== a.expectSku.trim()) {
            results.push({ id: a.id, ok: false, message: 'Changed in Zoho since the plan — read Zoho again' });
            continue;
          }
          const isbn = live.isbn?.trim() ? live.isbn : (a.customs.country ?? undefined);
          if ((live.upc ?? '').replace(/\D/g, '') === a.customs.hsCode && (live.isbn ?? '') === (isbn ?? '')) {
            results.push({ id: a.id, ok: true, message: 'Already correct' });
            continue;
          }
          await updateItem(a.itemId, { name: live.name, upc: a.customs.hsCode, isbn });
          await log({
            zohoItemId: a.itemId,
            itemName: live.name,
            action: 'set_customs',
            beforeSku: live.sku,
            afterSku: live.sku,
            beforeDetails: { upc: live.upc ?? null, isbn: live.isbn ?? null },
            afterDetails: { upc: a.customs.hsCode, isbn: isbn ?? null },
            reason: a.reason,
          });
          await pause();
          results.push({ id: a.id, ok: true, message: `HS ${a.customs.hsCode}${isbn ? ` · ${isbn}` : ' · origin still blank'}` });
          continue;
        }

        const live = await getItem(a.itemId);
        await pause();
        if (live.status !== 'active') {
          results.push({ id: a.id, ok: false, message: 'Already inactive in Zoho' });
          continue;
        }
        if ((live.sku ?? '').trim() !== a.expectSku.trim() || live.name !== a.expectName) {
          results.push({ id: a.id, ok: false, message: 'Changed in Zoho since the plan — read Zoho again' });
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
          results.push({ id: a.id, ok: false, message: 'On a sales order not yet dispatched — not retired' });
          continue;
        }

        await updateItem(a.itemId, a.toSku ? { name: a.toName, sku: a.toSku } : { name: a.toName });
        await log({ zohoItemId: a.itemId, itemName: a.toName, action: 'rename', beforeName: live.name, afterName: a.toName, beforeSku: live.sku, afterSku: a.toSku ?? live.sku, reason: a.reason });
        await pause();
        await markItemInactive(a.itemId);
        await log({ zohoItemId: a.itemId, itemName: a.toName, action: 'inactivate', beforeSku: a.toSku ?? live.sku, afterSku: a.toSku ?? live.sku, reason: a.reason });
        await pause();
        results.push({ id: a.id, ok: true, message: `Renamed "${a.toName}" and made inactive` });
      } catch (error) {
        logger.error('Zoho code cleanup: write failed', { id: a.id, kind: a.kind, error });
        results.push({ id: a.id, ok: false, message: error instanceof Error ? error.message : 'Zoho refused the change' });
      }
    }

    // Every skip and failure is kept beside the writes, so the batch can be read back
    const misses = results.filter((r) => !r.ok);
    if (misses.length) {
      const byId = new Map(input.actions.map((a) => [a.id, a]));
      await db.insert(zohoItemChanges).values(
        misses.map((r) => {
          const a = byId.get(r.id)!;
          return {
            batchId: input.batchId,
            createdBy: ctx.user.id,
            zohoItemId: a.kind === 'create' ? r.id : a.itemId,
            itemName: a.kind === 'create' ? a.name : a.kind === 'set_customs' ? a.expectSku : a.expectName,
            action: 'skipped',
            beforeSku: a.kind === 'create' ? null : a.expectSku,
            afterSku: a.kind === 'create' ? a.sku : a.kind === 'set_customs' ? a.expectSku : a.toSku,
            reason: r.message,
            undoneAt: new Date(),
          };
        }),
      );
    }

    return { results };
  });

export default adminApplyActions;
