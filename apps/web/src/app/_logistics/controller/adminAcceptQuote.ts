import { TRPCError } from '@trpc/server';
import { and, eq, ne } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { logisticsQuotes, logisticsShipments } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';
import logger from '@/utils/logger';

const acceptQuoteSchema = z.object({
  quoteId: z.string().uuid(),
  shipmentId: z.string().uuid().optional(),
  updateShipmentCosts: z.boolean().default(false),
});

/**
 * Accept a freight quote
 *
 * Marks the quote as accepted and optionally:
 * - Links it to a shipment
 * - Updates the shipment's cost fields from the quote
 * - Rejects other pending quotes for the same shipment
 */
const adminAcceptQuote = adminProcedure.input(acceptQuoteSchema).mutation(async ({ input, ctx }) => {
  const { quoteId, shipmentId, updateShipmentCosts } = input;

  // Get the quote
  const [quote] = await db
    .select()
    .from(logisticsQuotes)
    .where(eq(logisticsQuotes.id, quoteId))
    .limit(1);

  if (!quote) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Quote not found',
    });
  }

  if (quote.status !== 'pending') {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `Cannot accept quote with status "${quote.status}"`,
    });
  }

  const targetShipmentId = shipmentId || quote.shipmentId;

  try {
    // Update quote to accepted
    const [acceptedQuote] = await db
      .update(logisticsQuotes)
      .set({
        status: 'accepted',
        shipmentId: targetShipmentId || null,
        acceptedAt: new Date(),
        acceptedBy: ctx.user.id,
        updatedAt: new Date(),
      })
      .where(eq(logisticsQuotes.id, quoteId))
      .returning();

    // If linked to a shipment, reject other pending quotes and optionally update costs
    if (targetShipmentId) {
      // Reject other pending quotes for this shipment
      await db
        .update(logisticsQuotes)
        .set({
          status: 'rejected',
          rejectedAt: new Date(),
          rejectedBy: ctx.user.id,
          rejectionReason: 'Another quote was accepted',
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(logisticsQuotes.shipmentId, targetShipmentId),
            eq(logisticsQuotes.status, 'pending'),
            ne(logisticsQuotes.id, quoteId),
          ),
        );

      // Optionally update shipment costs from the quote
      if (updateShipmentCosts) {
        await db
          .update(logisticsShipments)
          .set({
            freightCostUsd: quote.totalPrice,
            updatedAt: new Date(),
          })
          .where(eq(logisticsShipments.id, targetShipmentId));
      }
    }

    logger.info('Accepted freight quote', {
      quoteId,
      shipmentId: targetShipmentId,
      acceptedBy: ctx.user.id,
    });

    return acceptedQuote;
  } catch (error) {
    logger.error('Failed to accept freight quote', { error, quoteId });
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to accept quote',
    });
  }
});

export default adminAcceptQuote;
