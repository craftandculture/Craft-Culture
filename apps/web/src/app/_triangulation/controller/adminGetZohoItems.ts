import { TRPCError } from '@trpc/server';

import { adminProcedure } from '@/lib/trpc/procedures';
import { isZohoConfigured } from '@/lib/zoho/client';
import { getAllItems } from '@/lib/zoho/items';

export interface ZohoItemState {
  itemId: string;
  name: string;
  sku: string;
  /** Punctuation stripped, for comparing a dashed code with a dashless one */
  normalizedSku: string;
  status: 'active' | 'inactive';
}

/**
 * Zoho's item master as it stands right now
 *
 * The clean-up was inferring the state of Zoho from invoice history, and that
 * cannot work: a sales order line keeps the SKU it was raised under, so an
 * item corrected today leaves every existing order still reading the old code.
 * The page went on demanding that codes be deactivated which had already been
 * dealt with, or which had never been separate items at all — only old
 * snapshots on old lines.
 *
 * That the history does not move is the right behaviour, and it is what makes
 * correcting an item safe for issued invoices. It just means the history is
 * the wrong place to read the answer from.
 *
 * So this asks Zoho. What is live, what is already inactive, and what does not
 * exist — which is the only basis on which anyone can be told to go and change
 * something.
 */
const adminGetZohoItems = adminProcedure.query(async () => {
  if (!isZohoConfigured()) {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: 'Zoho integration not configured',
    });
  }

  const items = await getAllItems();

  return items.map((item) => ({
    itemId: item.item_id,
    name: item.name,
    sku: item.sku ?? '',
    normalizedSku: (item.sku ?? '').toUpperCase().replace(/[^A-Z0-9]/g, ''),
    status: item.status,
  })) satisfies ZohoItemState[];
});

export default adminGetZohoItems;
