import { TRPCError } from '@trpc/server';

import { adminProcedure } from '@/lib/trpc/procedures';
import { isZohoConfigured } from '@/lib/zoho/client';
import { markItemInactive, updateItem } from '@/lib/zoho/items';

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

    if (action === 'deactivate') {
      await markItemInactive(itemId);

      return { itemId, action, sku: null };
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
