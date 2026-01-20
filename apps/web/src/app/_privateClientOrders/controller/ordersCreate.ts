import { TRPCError } from '@trpc/server';
import { sql } from 'drizzle-orm';

import db from '@/database/client';
import { privateClientOrders } from '@/database/schema';
import { winePartnerProcedure } from '@/lib/trpc/procedures';
import logger from '@/utils/logger';

import createOrderSchema from '../schemas/createOrderSchema';
import generateOrderNumber from '../utils/generateOrderNumber';

/** Maximum retries for order number generation in case of race conditions */
const MAX_ORDER_NUMBER_RETRIES = 3;

/**
 * Parse sequence number from order number string
 * Expected format: PCO-YYYY-NNNNN (e.g., PCO-2026-00001)
 */
const parseOrderSequence = (orderNumber: string): number => {
  const parts = orderNumber.split('-');
  if (parts.length !== 3 || parts[0] !== 'PCO') {
    logger.warn('Invalid order number format encountered', { orderNumber });
    return 0;
  }
  const sequence = parseInt(parts[2], 10);
  return isNaN(sequence) ? 0 : sequence;
};

/**
 * Create a new private client order
 *
 * Only wine partners can create orders. The order is created in 'draft' status.
 * Handles race conditions by retrying with incremented sequence on duplicate key errors.
 */
const ordersCreate = winePartnerProcedure
  .input(createOrderSchema)
  .mutation(async ({ input, ctx: { partnerId } }) => {
    // Get the next sequence number for this year
    const year = new Date().getFullYear();
    const yearStart = `PCO-${year}-`;

    const [lastOrder] = await db
      .select({ orderNumber: privateClientOrders.orderNumber })
      .from(privateClientOrders)
      .where(sql`${privateClientOrders.orderNumber} LIKE ${yearStart + '%'}`)
      .orderBy(sql`${privateClientOrders.orderNumber} DESC`)
      .limit(1);

    let nextSequence = 1;
    if (lastOrder?.orderNumber) {
      nextSequence = parseOrderSequence(lastOrder.orderNumber) + 1;
    }

    // Try to create the order, retry on duplicate key error (race condition)
    let retries = 0;
    while (retries < MAX_ORDER_NUMBER_RETRIES) {
      const orderNumber = generateOrderNumber(nextSequence);

      try {
        const [order] = await db
          .insert(privateClientOrders)
          .values({
            orderNumber,
            partnerId,
            clientId: input.clientId,
            clientName: input.clientName,
            clientEmail: input.clientEmail || null,
            clientPhone: input.clientPhone || null,
            clientAddress: input.clientAddress || null,
            deliveryNotes: input.deliveryNotes || null,
            partnerNotes: input.partnerNotes || null,
            status: 'draft',
          })
          .returning();

        return order;
      } catch (error) {
        // Check if it's a duplicate key error (race condition)
        const isDuplicateError =
          error instanceof Error &&
          (error.message.includes('duplicate key') || error.message.includes('unique constraint'));

        if (isDuplicateError && retries < MAX_ORDER_NUMBER_RETRIES - 1) {
          logger.warn('Order number collision detected, retrying with incremented sequence', {
            orderNumber,
            retries,
          });
          nextSequence++;
          retries++;
          continue;
        }

        // Re-throw if not a duplicate error or max retries reached
        logger.error('Failed to create order', { error, retries });
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
