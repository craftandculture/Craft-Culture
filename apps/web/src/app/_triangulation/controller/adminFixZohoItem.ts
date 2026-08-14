import { TRPCError } from '@trpc/server';

import { adminProcedure } from '@/lib/trpc/procedures';
import { isZohoConfigured } from '@/lib/zoho/client';
import {
  createItem,
  markItemActive,
  markItemInactive,
  updateItem,
} from '@/lib/zoho/items';

import { fixZohoItemSchema } from '../schemas/triangulationSchemas';

/**
 * Write a corrected SKU to a Zoho item, or retire one
 *
 * Doing this by hand meant typing an eighteen-character code into Zoho for
 * every wine, then coming back here to find out which field was still wrong.
 * Every round of that took minutes and any one of four fields could be the
 * culprit — and the vintage and the pack look alike enough at a glance that
 * correcting one and leaving the other is the natural mistake, made silently.
 *
 * The right code is already known here. Typing it again by hand adds nothing
 * but the chance of a new typo.
 *
 * Only the SKU is touched on a rename: the item keeps its name, price, tax and
 * accounts, and issued invoices keep the code they were raised under, which is
 * what makes this safe to do in bulk.
 *
 * Creating one is the other half. A wine invoiced in two formats needs an item
 * for each, and telling someone to go and make it by hand is the same dead end
 * as telling them to retype a code. The price is left at zero deliberately: it
 * belongs to whoever quotes the wine, and a number invented here would end up
 * on a quote.
 */
const adminFixZohoItem = adminProcedure
  .input(fixZohoItemSchema)
  .mutation(async ({ input }) => {
    if (!isZohoConfigured()) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: 'Zoho integration not configured',
      });
    }

    const { itemId, action } = input;

    if (action === 'create') {
      if (!input.sku || !input.name) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'A SKU and a name are required to create an item',
        });
      }

      // Rate is required by Zoho and is not ours to guess — the price belongs
      // to whoever quotes it, and a number invented here would be quoted.
      // Zero is visibly unset, which is the honest placeholder.
      const created = await createItem({
        name: input.name,
        sku: input.sku,
        rate: 0,
        unit: input.pack ? 'Case' : undefined,
        item_type: 'inventory',
        product_type: 'goods',
      });

      return { itemId: created.item_id, action, sku: created.sku };
    }

    if (!itemId) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'An item is required',
      });
    }

    if (action === 'deactivate') {
      await markItemInactive(itemId);

      return { itemId, action, sku: null };
    }

    // A wine's format can have been retired and then sold again. Renaming an
    // inactive item leaves it inactive, so it would go on reading as missing.
    if (action === 'activate') {
      await markItemActive(itemId);

      return { itemId, action, sku: input.sku ?? null };
    }

    if (!input.sku) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'A SKU is required to rename an item',
      });
    }

    const item = await updateItem(itemId, { sku: input.sku });

    return { itemId, action, sku: item.sku };
  });

export default adminFixZohoItem;
