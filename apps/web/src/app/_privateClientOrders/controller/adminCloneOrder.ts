import { TRPCError } from '@trpc/server';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';

import findOrCreateClientForPartner from '@/app/_privateClientContacts/utils/findOrCreateClientForPartner';
import db from '@/database/client';
import {
  privateClientContacts,
  privateClientOrderItems,
  privateClientOrders,
} from '@/database/schema';
import { wmsOperatorProcedure } from '@/lib/trpc/procedures';
import logger from '@/utils/logger';

import generateOrderNumber from '../utils/generateOrderNumber';
import recalculateOrderTotals from '../utils/recalculateOrderTotals';

/** One batch is one month of one box; well above a club's box count */
const MAX_CLONES = 60;

const cloneClientSchema = z.object({
  /** A saved client of the order's partner; details are read from the record */
  clientId: z.string().uuid().optional(),
  name: z.string().trim().min(1, 'Client name is required'),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
});

/**
 * Copy one order, line for line, into a new draft order per client
 *
 * A subscription box is the same wines at the same prices for every member on
 * it, so the operator builds one order per box, has it checked, and clones it
 * for the rest. The lines are copied exactly — price included — which is what
 * makes checking the one worth the same as checking them all.
 *
 * Not copied: the parcel a line is pinned to (`sourceStockId`). That pin names
 * particular bottles, and copying it would promise the same bottles to every
 * clone. Stock status also starts again at pending, as on any new line.
 *
 * All clones are created in one transaction: a batch either lands whole or not
 * at all, so a failure never leaves half a month of boxes to hunt down.
 */
const adminCloneOrder = wmsOperatorProcedure
  .input(
    z.object({
      orderId: z.string().uuid(),
      clients: z.array(cloneClientSchema).min(1).max(MAX_CLONES),
    }),
  )
  .mutation(async ({ input }) => {
    const source = await db.query.privateClientOrders.findFirst({
      where: { id: input.orderId },
    });

    if (!source) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Order not found' });
    }

    if (!source.partnerId) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'This order has no partner, so its clones would have no owner',
      });
    }

    const partnerId = source.partnerId;

    const items = await db
      .select()
      .from(privateClientOrderItems)
      .where(eq(privateClientOrderItems.orderId, source.id));

    if (items.length === 0) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'This order has no lines to copy',
      });
    }

    // Saved clients: details come from the record, and must be this partner's
    const savedIds = input.clients.flatMap((c) => (c.clientId ? [c.clientId] : []));
    const saved = savedIds.length
      ? await db
          .select()
          .from(privateClientContacts)
          .where(
            and(
              inArray(privateClientContacts.id, savedIds),
              eq(privateClientContacts.partnerId, partnerId),
            ),
          )
      : [];
    const savedById = new Map(saved.map((c) => [c.id, c]));

    const missing = savedIds.filter((id) => !savedById.has(id));
    if (missing.length > 0) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Some chosen clients do not belong to this order’s partner',
      });
    }

    // Resolve every client to a record before anything is written
    const resolved: {
      clientId: string | null;
      clientName: string;
      clientEmail: string | null;
      clientPhone: string | null;
      clientAddress: string | null;
    }[] = [];
    for (const client of input.clients) {
      const record = client.clientId ? savedById.get(client.clientId) : undefined;

      if (record) {
        resolved.push({
          clientId: record.id,
          clientName: record.name,
          clientEmail: record.email || null,
          clientPhone: record.phone || null,
          clientAddress:
            [record.addressLine1, record.addressLine2, record.city]
              .filter(Boolean)
              .join(', ') || null,
        });
        continue;
      }

      const created = await findOrCreateClientForPartner(partnerId, {
        name: client.name,
        email: client.email,
        phone: client.phone,
        address: client.address,
      });

      resolved.push({
        clientId: created?.clientId ?? null,
        clientName: client.name.trim(),
        clientEmail: client.email || null,
        clientPhone: client.phone || null,
        clientAddress: client.address || null,
      });
    }

    // The same person twice in one batch is a double shipment
    const seen = new Set<string>();
    for (const client of resolved) {
      const key = client.clientId ?? client.clientName.toLowerCase();
      if (seen.has(key)) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `${client.clientName} is in this batch twice`,
        });
      }
      seen.add(key);
    }

    const year = new Date().getFullYear();
    const yearStart = `PCO-${year}-`;

    let created: { id: string; orderNumber: string; clientName: string }[];

    try {
      created = await db.transaction(async (tx) => {
        const [last] = await tx
          .select({ orderNumber: privateClientOrders.orderNumber })
          .from(privateClientOrders)
          .where(sql`${privateClientOrders.orderNumber} LIKE ${yearStart + '%'}`)
          .orderBy(sql`${privateClientOrders.orderNumber} DESC`)
          .limit(1);

        let sequence = last?.orderNumber
          ? parseInt(last.orderNumber.split('-')[2] ?? '0', 10) || 0
          : 0;

        const out = [];
        for (const client of resolved) {
          sequence += 1;

          const [order] = await tx
            .insert(privateClientOrders)
            .values({
              orderNumber: generateOrderNumber(sequence),
              partnerId,
              ...client,
              deliveryNotes: source.deliveryNotes,
              partnerNotes: source.partnerNotes,
              ccNotes: `Cloned from ${source.orderNumber}`,
              subscriptionTier: source.subscriptionTier,
              subscriptionCaseSize: source.subscriptionCaseSize,
              subscriptionVariant: source.subscriptionVariant,
              status: 'draft',
            })
            .returning({
              id: privateClientOrders.id,
              orderNumber: privateClientOrders.orderNumber,
              clientName: privateClientOrders.clientName,
            });

          await tx.insert(privateClientOrderItems).values(
            items.map((item) => ({
              orderId: order!.id,
              productId: item.productId,
              productOfferId: item.productOfferId,
              productName: item.productName,
              producer: item.producer,
              vintage: item.vintage,
              region: item.region,
              lwin: item.lwin,
              bottleSize: item.bottleSize,
              caseConfig: item.caseConfig,
              source: item.source,
              quantity: item.quantity,
              pricePerCaseUsd: item.pricePerCaseUsd,
              totalUsd: item.totalUsd,
              notes: item.notes,
            })),
          );

          out.push(order!);
        }

        return out;
      });
    } catch (error) {
      const isDuplicate =
        error instanceof Error &&
        (error.message.includes('duplicate key') ||
          error.message.includes('unique constraint'));

      logger.error('Failed to clone order', { orderId: source.id, error });

      throw new TRPCError({
        code: isDuplicate ? 'CONFLICT' : 'INTERNAL_SERVER_ERROR',
        message: isDuplicate
          ? 'Another order was created at the same moment. Nothing was saved, so try again.'
          : 'Failed to clone the order. Nothing was saved.',
      });
    }

    // Totals come from the pricing engine, exactly as for a hand-built order
    for (const order of created) {
      await recalculateOrderTotals(order.id);
    }

    return { sourceOrderNumber: source.orderNumber, orders: created };
  });

export default adminCloneOrder;
