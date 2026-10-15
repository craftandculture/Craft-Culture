import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { pcoItemInvoicing, privateClientOrderItems } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import describeInvoicing from '../utils/describeInvoicing';
import pcoInvoicingReady from '../utils/pcoInvoicingReady';

/**
 * Each line's manual-invoicing state on one order, and the order's label
 *
 * Returns `ready: false` until the table exists, so the order page can stay
 * quiet on a deploy whose migration has not run yet.
 */
const adminGetOrderInvoicing = adminProcedure
  .input(z.object({ orderId: z.string().uuid() }))
  .query(async ({ input }) => {
    const items = await db
      .select({
        id: privateClientOrderItems.id,
        productName: privateClientOrderItems.productName,
        vintage: privateClientOrderItems.vintage,
        quantity: privateClientOrderItems.quantity,
        caseConfig: privateClientOrderItems.caseConfig,
        bottleSize: privateClientOrderItems.bottleSize,
      })
      .from(privateClientOrderItems)
      .where(eq(privateClientOrderItems.orderId, input.orderId));

    if (!(await pcoInvoicingReady())) {
      return { ready: false as const, items: items.map((item) => ({ ...item, invoicing: null })), label: null };
    }

    const records = await db
      .select()
      .from(pcoItemInvoicing)
      .where(eq(pcoItemInvoicing.orderId, input.orderId));
    const byItem = new Map(records.map((r) => [r.itemId, r]));

    return {
      ready: true as const,
      items: items.map((item) => ({ ...item, invoicing: byItem.get(item.id) ?? null })),
      label: describeInvoicing({
        lines: items.length,
        pending: records.filter((r) => r.status === 'pending').length,
        invoiced: records.filter((r) => r.status === 'invoiced').length,
      }),
    };
  });

export default adminGetOrderInvoicing;
