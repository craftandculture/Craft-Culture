import { TRPCError } from '@trpc/server';
import { and, eq, ne, or } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import {
  logisticsQuoteRequests,
  logisticsQuotes,
  logisticsShipmentActivityLogs,
  logisticsShipmentCostLines,
  logisticsShipments,
} from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';
import logger from '@/utils/logger';

import generateShipmentNumber from '../utils/generateShipmentNumber';
import resolveFxToUsd from '../utils/resolveFxToUsd';
import syncShipmentCostsFromLedger from '../utils/syncShipmentCostsFromLedger';

const transportModes = ['sea_fcl', 'sea_lcl', 'air', 'road'] as const;

const acceptQuoteSchema = z.object({
  quoteId: z.string().uuid(),
  /** Link the quote to this existing shipment */
  shipmentId: z.string().uuid().optional(),
  /** Or open a new draft shipment from the quote's route */
  createShipment: z
    .object({
      type: z.enum(['inbound', 'outbound', 're_export', 'mainland_transfer']).default('inbound'),
      transportMode: z.enum(transportModes).optional(),
      originCountry: z.string().optional(),
      originCity: z.string().optional(),
      destinationCountry: z.string().optional(),
      destinationCity: z.string().optional(),
    })
    .optional(),
  /** Record the quote's price as the shipment's freight cost */
  updateShipmentCosts: z.boolean().default(true),
});

/**
 * Accept a freight quote
 *
 * Marks the quote as accepted, then:
 * - links it to an existing shipment, or opens a new draft shipment from the
 *   quote's route, transport mode and the request it answers
 * - records the quoted price as the shipment's freight cost, as a line in the
 *   shipment's cost ledger where the shipment keeps one
 * - rejects the other pending quotes for the same request and shipment
 * - marks the request the quote answers as completed
 *
 * @example
 *   await trpcClient.logistics.admin.quotes.accept.mutate({
 *     quoteId: 'uuid',
 *     createShipment: { type: 'inbound' },
 *   });
 */
const adminAcceptQuote = adminProcedure.input(acceptQuoteSchema).mutation(async ({ input, ctx }) => {
  const { quoteId, shipmentId, createShipment, updateShipmentCosts } = input;

  if (shipmentId && createShipment) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Choose either an existing shipment or a new one, not both',
    });
  }

  const [quote] = await db
    .select()
    .from(logisticsQuotes)
    .where(eq(logisticsQuotes.id, quoteId))
    .limit(1);

  if (!quote) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Quote not found' });
  }

  if (quote.status !== 'pending') {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `Cannot accept quote with status "${quote.status}"`,
    });
  }

  const [request] = quote.requestId
    ? await db
        .select()
        .from(logisticsQuoteRequests)
        .where(eq(logisticsQuoteRequests.id, quote.requestId))
        .limit(1)
    : [];

  if (shipmentId) {
    const [existing] = await db
      .select({ id: logisticsShipments.id })
      .from(logisticsShipments)
      .where(eq(logisticsShipments.id, shipmentId))
      .limit(1);

    if (!existing) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Shipment not found' });
    }
  }

  const transportMode =
    createShipment?.transportMode ?? quote.transportMode ?? request?.transportMode ?? null;

  if (createShipment && !transportMode) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Choose a transport mode for the new shipment',
    });
  }

  try {
    let targetShipmentId = shipmentId || quote.shipmentId || null;
    let createdShipmentNumber: string | null = null;

    if (createShipment && transportMode) {
      const shipmentNumber = await generateShipmentNumber();
      const [shipment] = await db
        .insert(logisticsShipments)
        .values({
          shipmentNumber,
          type: createShipment.type,
          transportMode,
          status: 'draft',
          originCountry: createShipment.originCountry || quote.originCountry || request?.originCountry || null,
          originCity: createShipment.originCity || quote.originCity || request?.originCity || null,
          originWarehouse: request?.originWarehouse || null,
          destinationCountry:
            createShipment.destinationCountry || quote.destinationCountry || request?.destinationCountry || null,
          destinationCity:
            createShipment.destinationCity || quote.destinationCity || request?.destinationCity || null,
          destinationWarehouse: request?.destinationWarehouse || undefined,
          carrierName: quote.forwarderName,
          internalNotes: `Opened from accepted quote ${quote.quoteNumber}${request ? ` (request ${request.requestNumber})` : ''}`,
          createdBy: ctx.user.id,
        })
        .returning();

      if (!shipment) {
        throw new Error('Shipment insert returned no row');
      }

      await db.insert(logisticsShipmentActivityLogs).values({
        shipmentId: shipment.id,
        userId: ctx.user.id,
        action: 'created',
        newStatus: 'draft',
        notes: `Shipment ${shipmentNumber} created from accepted quote ${quote.quoteNumber}`,
      });

      targetShipmentId = shipment.id;
      createdShipmentNumber = shipmentNumber;
    }

    const now = new Date();

    const [acceptedQuote] = await db
      .update(logisticsQuotes)
      .set({
        status: 'accepted',
        shipmentId: targetShipmentId,
        acceptedAt: now,
        acceptedBy: ctx.user.id,
        updatedAt: now,
      })
      .where(eq(logisticsQuotes.id, quoteId))
      .returning();

    // Only one quote can win a request or a shipment
    const competitors = [
      targetShipmentId ? eq(logisticsQuotes.shipmentId, targetShipmentId) : undefined,
      quote.requestId ? eq(logisticsQuotes.requestId, quote.requestId) : undefined,
    ].filter((c) => c !== undefined);

    if (competitors.length > 0) {
      await db
        .update(logisticsQuotes)
        .set({
          status: 'rejected',
          rejectedAt: now,
          rejectedBy: ctx.user.id,
          rejectionReason: `Quote ${quote.quoteNumber} was accepted instead`,
          updatedAt: now,
        })
        .where(
          and(
            or(...competitors),
            eq(logisticsQuotes.status, 'pending'),
            ne(logisticsQuotes.id, quoteId),
          ),
        );
    }

    let freightCostRecorded = false;

    if (targetShipmentId && updateShipmentCosts) {
      const fx = await resolveFxToUsd(quote.currency);

      if (fx.source !== 'unresolved') {
        const ledgerLines = await db
          .select({ id: logisticsShipmentCostLines.id })
          .from(logisticsShipmentCostLines)
          .where(eq(logisticsShipmentCostLines.shipmentId, targetShipmentId))
          .limit(1);
        const amountUsd = Math.round(quote.totalPrice * fx.rate * 100) / 100;

        // A shipment that keeps a ledger gets a ledger line; one whose costs were
        // typed in directly keeps them, and only its freight figure changes
        if (ledgerLines.length > 0 || createdShipmentNumber) {
          await db.insert(logisticsShipmentCostLines).values({
            shipmentId: targetShipmentId,
            category: 'freight',
            description: `Freight per accepted quote ${quote.quoteNumber}`,
            amount: quote.totalPrice,
            currency: quote.currency.toUpperCase(),
            fxToUsd: fx.rate,
            amountUsd,
            vendor: quote.forwarderName,
            invoiceRef: quote.quoteNumber,
            sourceDocument: 'Accepted freight quote',
            createdBy: ctx.user.id,
          });
          await syncShipmentCostsFromLedger(targetShipmentId);
        } else {
          await db
            .update(logisticsShipments)
            .set({ freightCostUsd: amountUsd, updatedAt: now })
            .where(eq(logisticsShipments.id, targetShipmentId));
        }

        freightCostRecorded = true;
      }
    }

    let requestCompleted = false;

    if (request && request.status !== 'completed' && request.status !== 'cancelled') {
      await db
        .update(logisticsQuoteRequests)
        .set({
          status: 'completed',
          completedAt: now,
          completedBy: ctx.user.id,
          updatedAt: now,
        })
        .where(eq(logisticsQuoteRequests.id, request.id));
      requestCompleted = true;
    }

    logger.info('Accepted freight quote', {
      quoteId,
      shipmentId: targetShipmentId,
      createdShipment: createdShipmentNumber,
      requestId: quote.requestId,
      acceptedBy: ctx.user.id,
    });

    return {
      ...acceptedQuote,
      shipmentId: targetShipmentId,
      createdShipmentNumber,
      freightCostRecorded,
      requestCompleted,
    };
  } catch (error) {
    logger.error('Failed to accept freight quote', { error, quoteId });
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to accept quote',
    });
  }
});

export default adminAcceptQuote;
