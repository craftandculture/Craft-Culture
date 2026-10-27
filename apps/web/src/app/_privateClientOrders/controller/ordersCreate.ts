import { TRPCError } from '@trpc/server';
import { and, eq } from 'drizzle-orm';

import { orderDetailsFromClient } from '@/app/_privateClientContacts/utils/clientIdentity';
import findOrCreateClientForPartner from '@/app/_privateClientContacts/utils/findOrCreateClientForPartner';
import db from '@/database/client';
import { privateClientContacts, privateClientOrders } from '@/database/schema';
import { winePartnerProcedure } from '@/lib/trpc/procedures';
import logger from '@/utils/logger';


import createOrderSchema from '../schemas/createOrderSchema';
import nextPcoOrderNumber, { isUniqueViolation } from '../utils/nextPcoOrderNumber';
import partnerOrderView from '../utils/partnerOrderView';

/** Maximum retries for order number generation in case of race conditions */
const MAX_ORDER_NUMBER_RETRIES = 3;

/**
 * Create a new private client order
 *
 * Only wine partners can create orders. The order is created in 'draft' status.
 * Handles race conditions by retrying with incremented sequence on duplicate key errors.
 */
const ordersCreate = winePartnerProcedure
  .input(createOrderSchema)
  .mutation(async ({ input, ctx: { partnerId } }) => {
    /*
      Keep the client.

      The form lets the details be typed straight in instead of picking a saved
      client, and nothing used to keep them — so the same person was retyped
      every order, and the order had no record to correct, mark verified, or
      count as a relationship. Over half the orders on file arrived this way,
      and two of them are stuck awaiting verification against a record that was
      never created.

      An existing client of this partner with the same name is reused, so this
      does not quietly multiply records for a regular.
    */
    let clientId = input.clientId ?? null;
    let clientDetails = {
      clientName: input.clientName,
      clientEmail: input.clientEmail || null,
      clientPhone: input.clientPhone || null,
      clientAddress: input.clientAddress || null,
    };

    // A saved client must be one of this partner's own; another partner's
    // client id is treated as not found rather than linked to this order.
    if (clientId) {
      const [ownClient] = await db
        .select()
        .from(privateClientContacts)
        .where(
          and(
            eq(privateClientContacts.id, clientId),
            eq(privateClientContacts.partnerId, partnerId),
          ),
        )
        .limit(1);

      if (!ownClient) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Client not found',
        });
      }

      // The saved client decides who the order is for, not what was typed
      // beside it (a verified client's name with someone else's number)
      clientDetails = orderDetailsFromClient(ownClient, {
        email: input.clientEmail,
        phone: input.clientPhone,
        address: input.clientAddress,
      });
    }

    if (!clientId && input.clientName?.trim()) {
      const resolved = await findOrCreateClientForPartner(partnerId, {
        name: input.clientName,
        email: input.clientEmail,
        phone: input.clientPhone,
        address: input.clientAddress,
      });
      clientId = resolved?.clientId ?? null;
    }

    /*
      The number is taken under a lock inside the insert's transaction, so two
      orders created together cannot both read the same last number. A retry
      covers an order numbered elsewhere without the lock in between.
    */
    for (let attempt = 1; attempt <= MAX_ORDER_NUMBER_RETRIES; attempt += 1) {
      try {
        const order = await db.transaction(async (tx) => {
          const { orderNumber } = await nextPcoOrderNumber(tx);

          const [inserted] = await tx
            .insert(privateClientOrders)
            .values({
              orderNumber,
              partnerId,
              clientId,
              ...clientDetails,
              deliveryNotes: input.deliveryNotes || null,
              partnerNotes: input.partnerNotes || null,
              status: 'draft',
            })
            .returning();

          return inserted;
        });

        return order ? partnerOrderView(order) : order;
      } catch (error) {
        if (isUniqueViolation(error) && attempt < MAX_ORDER_NUMBER_RETRIES) {
          logger.warn('Order number collision detected, retrying', { attempt });
          continue;
        }

        logger.error('Failed to create order', {
          error: error instanceof Error ? error.message : String(error),
          attempt,
        });
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create order. Please try again.',
        });
      }
    }

    // Should never reach here, but TypeScript needs it
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to create order after multiple attempts.',
    });
  });

export default ordersCreate;
