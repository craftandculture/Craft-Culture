import { TRPCError } from '@trpc/server';
import { and, eq, inArray, ne, sql } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import {
  pcoItemInvoicing,
  privateClientOrderActivityLogs,
  privateClientOrderItems,
  privateClientOrders,
} from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import pcoInvoicingReady from '../utils/pcoInvoicingReady';

/**
 * Record the manual invoice raised for delivered lines
 *
 * Sets the invoice number and date on each line and moves it to "Delivered –
 * Invoiced". Two guards against invoicing twice:
 * - a line already invoiced is refused, naming the invoice it is on;
 * - an invoice number already recorded on another order is refused, since a
 *   number belongs to one order.
 * A line not yet marked delivered is marked delivered and invoiced in one go.
 */
const adminRecordManualInvoice = adminProcedure
  .input(
    z.object({
      orderId: z.string().uuid(),
      itemIds: z.array(z.string().uuid()).min(1),
      invoiceNumber: z.string().trim().min(1).max(60),
      invoiceDate: z.coerce.date(),
    }),
  )
  .mutation(async ({ input, ctx: { user } }) => {
    if (!(await pcoInvoicingReady())) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: 'Manual invoicing is not set up yet — the database update has not run. Try again after the next deploy.',
      });
    }

    const invoiceNumber = input.invoiceNumber.toUpperCase();

    const [order] = await db
      .select({ id: privateClientOrders.id, partnerId: privateClientOrders.partnerId })
      .from(privateClientOrders)
      .where(eq(privateClientOrders.id, input.orderId));
    if (!order) throw new TRPCError({ code: 'NOT_FOUND', message: 'Order not found' });

    const items = await db
      .select({ id: privateClientOrderItems.id, productName: privateClientOrderItems.productName })
      .from(privateClientOrderItems)
      .where(
        and(
          eq(privateClientOrderItems.orderId, input.orderId),
          inArray(privateClientOrderItems.id, input.itemIds),
        ),
      );
    if (items.length !== input.itemIds.length) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Some of those lines are not on this order' });
    }

    const existing = await db
      .select()
      .from(pcoItemInvoicing)
      .where(inArray(pcoItemInvoicing.itemId, input.itemIds));
    const already = existing.filter((e) => e.status === 'invoiced');
    if (already.length > 0) {
      const names = already
        .map((e) => `${items.find((i) => i.id === e.itemId)?.productName ?? 'a line'} (${e.invoiceNumber})`)
        .join(', ');
      throw new TRPCError({
        code: 'CONFLICT',
        message: `Already invoiced, so not recorded again: ${names}`,
      });
    }

    const [elsewhere] = await db
      .select({ orderNumber: privateClientOrders.orderNumber })
      .from(pcoItemInvoicing)
      .innerJoin(privateClientOrders, eq(privateClientOrders.id, pcoItemInvoicing.orderId))
      .where(
        and(
          sql`UPPER(${pcoItemInvoicing.invoiceNumber}) = ${invoiceNumber}`,
          ne(pcoItemInvoicing.orderId, input.orderId),
        ),
      )
      .limit(1);
    if (elsewhere) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: `${invoiceNumber} is already recorded on ${elsewhere.orderNumber ?? 'another order'}. Check the number.`,
      });
    }

    const now = new Date();
    const pendingIds = new Set(existing.map((e) => e.itemId));

    await db.transaction(async (tx) => {
      /*
        Two people recording an invoice for the same lines at once both passed
        the "already invoiced" check above. Inside the transaction the rows are
        created if missing and then claimed only while not yet invoiced; if any
        line was invoiced meanwhile, nothing is recorded.
      */
      const newlyDelivered = items.filter((i) => !pendingIds.has(i.id));
      if (newlyDelivered.length > 0) {
        const inserted = await tx
          .insert(pcoItemInvoicing)
          .values(
            newlyDelivered.map((item) => ({
              itemId: item.id,
              orderId: input.orderId,
              deliveredBy: user.id,
            })),
          )
          .onConflictDoNothing({ target: pcoItemInvoicing.itemId })
          .returning({ itemId: pcoItemInvoicing.itemId });

        if (inserted.length > 0) {
          await tx
            .update(privateClientOrderItems)
            .set({ stockStatus: 'delivered', updatedAt: now })
            .where(inArray(privateClientOrderItems.id, inserted.map((i) => i.itemId)));
        }
      }

      const claimed = await tx
        .update(pcoItemInvoicing)
        .set({
          status: 'invoiced',
          invoiceNumber,
          invoiceDate: input.invoiceDate,
          invoicedAt: now,
          invoicedBy: user.id,
          updatedAt: now,
        })
        .where(
          and(
            inArray(pcoItemInvoicing.itemId, input.itemIds),
            ne(pcoItemInvoicing.status, 'invoiced'),
          ),
        )
        .returning({ itemId: pcoItemInvoicing.itemId });

      if (claimed.length !== new Set(input.itemIds).size) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Some of these lines were invoiced a moment ago by someone else. Refresh and check before recording again.',
        });
      }

      await tx.insert(privateClientOrderActivityLogs).values({
        orderId: input.orderId,
        userId: user.id,
        partnerId: order.partnerId,
        action: 'manual_invoice_recorded',
        notes: `Delivered – Invoiced on ${invoiceNumber} (${input.invoiceDate.toISOString().slice(0, 10)}): ${items
          .map((i) => i.productName)
          .join(', ')}`,
        metadata: { invoiceNumber, invoiceDate: input.invoiceDate.toISOString(), itemIds: input.itemIds },
      });
    });

    return { invoiced: items.length, invoiceNumber };
  });

export default adminRecordManualInvoice;
