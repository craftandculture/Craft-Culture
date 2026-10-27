import { TRPCError } from '@trpc/server';
import { and, eq, ne, or } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import {
  logisticsQuoteRequestRecipients,
  logisticsQuoteRequests,
  logisticsQuotes,
  logisticsShipmentActivityLogs,
  logisticsShipmentCostLines,
  logisticsShipments,
} from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';
import logger from '@/utils/logger';

import generateShipmentNumber from '../utils/generateShipmentNumber';
import quoteTotalUsd from '../utils/quoteTotalUsd';
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
      type: z
        .enum(['inbound', 'outbound', 're_export', 'mainland_transfer'])
        .default('inbound'),
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
 *
 * - Files it against the request's job, or links it to an existing shipment, or
 *   (for quotes from before every request had a job) opens a new draft
 *   shipment; a draft job takes the winning quote's mode and forwarder
 * - Records the quoted price as the shipment's freight cost, as a line in the
 *   shipment's cost ledger where the shipment keeps one
 * - Rejects the other pending quotes for the same request and shipment
 * - Marks the request the quote answers as completed
 *
 * @example
 *   await trpcClient.logistics.admin.quotes.accept.mutate({
 *     quoteId: 'uuid',
 *     createShipment: { type: 'inbound' },
 *   });
 */
const adminAcceptQuote = adminProcedure
  .input(acceptQuoteSchema)
  .mutation(async ({ input, ctx }) => {
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

    if (quote.validUntil && quote.validUntil.getTime() < Date.now()) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Quote ${quote.quoteNumber} expired on ${quote.validUntil.toISOString().slice(0, 10)}; ask the forwarder to confirm or reissue it`,
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
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Shipment not found',
        });
      }
    }

    const transportMode =
      createShipment?.transportMode ??
      quote.transportMode ??
      request?.transportMode ??
      null;

    if (createShipment && !transportMode) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Choose a transport mode for the new shipment',
      });
    }

    try {
      // The rate is looked up before the transaction, which should not wait on a network call
      const fx = updateShipmentCosts ? await resolveFxToUsd(quote.currency) : null;

      // Accepting is all or nothing: the shipment, the quotes, the costs and the request together
      return await db.transaction(async (tx) => {
        let targetShipmentId =
          shipmentId || quote.shipmentId || request?.shipmentId || null;
        let createdShipmentNumber: string | null = null;

        if (createShipment && transportMode) {
          const shipmentNumber = await generateShipmentNumber();
          const [shipment] = await tx
            .insert(logisticsShipments)
            .values({
              shipmentNumber,
              type: createShipment.type,
              transportMode,
              status: 'draft',
              originCountry:
                createShipment.originCountry ||
                quote.originCountry ||
                request?.originCountry ||
                null,
              originCity:
                createShipment.originCity ||
                quote.originCity ||
                request?.originCity ||
                null,
              originWarehouse: request?.originWarehouse || null,
              destinationCountry:
                createShipment.destinationCountry ||
                quote.destinationCountry ||
                request?.destinationCountry ||
                null,
              destinationCity:
                createShipment.destinationCity ||
                quote.destinationCity ||
                request?.destinationCity ||
                null,
              destinationWarehouse: request?.destinationWarehouse || undefined,
              carrierName: quote.forwarderName,
              internalNotes: `Opened from accepted quote ${quote.quoteNumber}${request ? ` (request ${request.requestNumber})` : ''}`,
              createdBy: ctx.user.id,
            })
            .returning();

          if (!shipment) {
            throw new Error('Shipment insert returned no row');
          }

          await tx.insert(logisticsShipmentActivityLogs).values({
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

        // The job was opened as a draft before the mode and forwarder were known; the winning quote sets them
        if (targetShipmentId && !createdShipmentNumber) {
          await tx
            .update(logisticsShipments)
            .set({
              ...(quote.transportMode && { transportMode: quote.transportMode }),
              carrierName: quote.forwarderName,
              updatedAt: now,
            })
            .where(
              and(
                eq(logisticsShipments.id, targetShipmentId),
                eq(logisticsShipments.status, 'draft'),
              ),
            );
        }

        const [acceptedQuote] = await tx
          .update(logisticsQuotes)
          .set({
            status: 'accepted',
            shipmentId: targetShipmentId,
            acceptedAt: now,
            acceptedBy: ctx.user.id,
            updatedAt: now,
          })
          // Still pending at the moment of writing: two people accepting at once cannot both win
          .where(and(eq(logisticsQuotes.id, quoteId), eq(logisticsQuotes.status, 'pending')))
          .returning();

        if (!acceptedQuote) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'This quote was accepted, rejected or changed meanwhile. Reload to see it.',
          });
        }

        // Only one quote can win a request or a shipment
        const competitors = [
          targetShipmentId
            ? eq(logisticsQuotes.shipmentId, targetShipmentId)
            : undefined,
          quote.requestId
            ? eq(logisticsQuotes.requestId, quote.requestId)
            : undefined,
        ].filter((c) => c !== undefined);

        if (competitors.length > 0) {
          await tx
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
          if (fx && fx.source !== 'unresolved') {
            const ledgerLines = await tx
              .select({ id: logisticsShipmentCostLines.id })
              .from(logisticsShipmentCostLines)
              .where(eq(logisticsShipmentCostLines.shipmentId, targetShipmentId))
              .limit(1);
            const amountUsd = Math.round(quote.totalPrice * fx.rate * 100) / 100;

            // A shipment that keeps a ledger gets a ledger line; one whose costs were
            // typed in directly keeps them, and only its freight figure changes
            // A job opened by its request is new, so it keeps a ledger from the start
            const openedByRequest =
              !!request &&
              request.sourceType !== 'shipment' &&
              request.shipmentId === targetShipmentId;

            if (
              ledgerLines.length > 0 ||
              createdShipmentNumber ||
              openedByRequest
            ) {
              await tx.insert(logisticsShipmentCostLines).values({
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
              await syncShipmentCostsFromLedger(targetShipmentId, tx);
            } else {
              await tx
                .update(logisticsShipments)
                .set({ freightCostUsd: amountUsd, updatedAt: now })
                .where(eq(logisticsShipments.id, targetShipmentId));
            }

            freightCostRecorded = true;
          }
        }

        // What the client was quoted rides with the shipment, so its margin is known later
        let clientPriceRecorded = false;

        if (targetShipmentId && request?.clientPriceUsd != null) {
          const costUsd =
            quoteTotalUsd(quote) ??
            (quote.fxToUsd ? quote.totalPrice * quote.fxToUsd : null);

          await tx
            .update(logisticsShipments)
            .set({
              clientPriceUsd: request.clientPriceUsd,
              quotedMarginUsd:
                costUsd == null
                  ? null
                  : Math.round((request.clientPriceUsd - costUsd) * 100) / 100,
              updatedAt: now,
            })
            .where(eq(logisticsShipments.id, targetShipmentId));
          clientPriceRecorded = true;
        }

        // Every other forwarder asked has lost this one
        if (quote.requestId) {
          await tx
            .update(logisticsQuoteRequestRecipients)
            .set({ outcome: 'declined', updatedAt: now })
            .where(
              and(
                eq(logisticsQuoteRequestRecipients.requestId, quote.requestId),
                quote.forwarderId
                  ? ne(
                      logisticsQuoteRequestRecipients.forwarderId,
                      quote.forwarderId,
                    )
                  : undefined,
              ),
            );
        }

        let requestCompleted = false;

        if (
          request &&
          request.status !== 'completed' &&
          request.status !== 'cancelled'
        ) {
          await tx
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
          clientPriceRecorded,
          requestCompleted,
        };
      });
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      logger.error('Failed to accept freight quote', {
        error: error instanceof Error ? error.message : String(error),
        quoteId,
      });
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to accept quote',
      });
    }
  });

export default adminAcceptQuote;
