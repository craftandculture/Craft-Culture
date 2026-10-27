import { TRPCError } from '@trpc/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

import resolveOrderPartnerId from '@/app/_partners/data/resolveOrderPartnerId';
import { orderDetailsFromClient } from '@/app/_privateClientContacts/utils/clientIdentity';
import findOrCreateClientForPartner from '@/app/_privateClientContacts/utils/findOrCreateClientForPartner';
import db from '@/database/client';
import { privateClientContacts, privateClientOrders } from '@/database/schema';
import { wmsOperatorProcedure } from '@/lib/trpc/procedures';
import logger from '@/utils/logger';

import nextPcoOrderNumber, { isUniqueViolation } from '../utils/nextPcoOrderNumber';

/** Attempts at an order number before giving up */
const MAX_ORDER_NUMBER_RETRIES = 3;

/**
 * Admin create a new private client order
 *
 * Admins can create orders, optionally on behalf of a partner.
 */
const adminCreate = wmsOperatorProcedure
  .input(
    z.object({
      partnerId: z.string().uuid({ message: 'Partner is required' }),
      clientId: z.string().uuid().optional(),
      clientName: z.string().min(1, 'Client name is required'),
      clientEmail: z.string().email().optional().or(z.literal('')),
      clientPhone: z.string().optional(),
      clientAddress: z.string().optional(),
      deliveryNotes: z.string().optional(),
      partnerNotes: z.string().optional(),
    }),
  )
  .mutation(async ({ input }) => {
    // A Private Cellar member's order is raised under C&C, not under the member
    const partnerId = await resolveOrderPartnerId(input.partnerId);

    /*
      Keep the client, exactly as the partner-side create does. An admin can
      type the details straight in too, and an order without a client record
      cannot be corrected or marked verified afterwards.
    */
    // A client picked from the member's own list belongs to them, not to C&C
    let clientId = partnerId === input.partnerId ? (input.clientId ?? null) : null;
    let clientDetails = {
      clientName: input.clientName,
      clientEmail: input.clientEmail || null,
      clientPhone: input.clientPhone || null,
      clientAddress: input.clientAddress || null,
    };

    // A saved client must belong to the partner the order is for, and then
    // its record decides who the order is for
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
          code: 'BAD_REQUEST',
          message: 'That client belongs to a different partner. Choose one of this partner’s clients.',
        });
      }

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

    // The number is taken under a lock inside the insert's transaction
    for (let attempt = 1; attempt <= MAX_ORDER_NUMBER_RETRIES; attempt += 1) {
      try {
        return await db.transaction(async (tx) => {
          const { orderNumber } = await nextPcoOrderNumber(tx);

          const [order] = await tx
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

          return order;
        });
      } catch (error) {
        if (isUniqueViolation(error) && attempt < MAX_ORDER_NUMBER_RETRIES) {
          logger.warn('Order number collision detected, retrying', { attempt });
          continue;
        }
        throw error;
      }
    }

    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to create order after multiple attempts.',
    });
  });

export default adminCreate;
