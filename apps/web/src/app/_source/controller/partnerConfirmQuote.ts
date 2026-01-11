import { TRPCError } from '@trpc/server';
import { and, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { sourceRfqQuotes, sourceRfqs } from '@/database/schema';
import { winePartnerProcedure } from '@/lib/trpc/procedures';

const quoteConfirmationSchema = z.object({
  quoteId: z.string().uuid(),
  action: z.enum(['confirm', 'update', 'reject']),
  // If updating price
  updatedPriceUsd: z.number().positive().optional(),
  // If updating availability
  updatedAvailableQty: z.number().int().positive().optional(),
  // Reason for update or rejection
  reason: z.string().optional(),
  // Additional notes
  notes: z.string().optional(),
});

const confirmQuotesSchema = z.object({
  rfqId: z.string().uuid(),
  confirmations: z.array(quoteConfirmationSchema).min(1),
});

/**
 * Confirm, update, or reject selected quotes as a partner
 *
 * Partners use this to respond to confirmation requests for their selected quotes.
 * They can:
 * - Confirm: Quote is still valid as-is
 * - Update: Price or availability has changed (must provide new values and reason)
 * - Reject: No longer able to fulfill (must provide reason)
 *
 * @example
 *   await trpcClient.source.partner.confirmQuotes.mutate({
 *     rfqId: "uuid",
 *     confirmations: [
 *       { quoteId: "uuid1", action: "confirm" },
 *       { quoteId: "uuid2", action: "update", updatedPriceUsd: 120, reason: "Supplier price increase" },
 *       { quoteId: "uuid3", action: "reject", reason: "Out of stock" }
 *     ]
 *   });
 */
const partnerConfirmQuote = winePartnerProcedure
  .input(confirmQuotesSchema)
  .mutation(async ({ input, ctx }) => {
    const { rfqId, confirmations } = input;
    const partnerId = ctx.partnerId;

    // Verify RFQ exists and is awaiting confirmation
    const [rfq] = await db
      .select({
        id: sourceRfqs.id,
        status: sourceRfqs.status,
        rfqNumber: sourceRfqs.rfqNumber,
      })
      .from(sourceRfqs)
      .where(eq(sourceRfqs.id, rfqId));

    if (!rfq) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'RFQ not found',
      });
    }

    if (rfq.status !== 'awaiting_confirmation') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `RFQ is not awaiting confirmations. Current status: ${rfq.status}`,
      });
    }

    // Get the quotes being confirmed
    const quoteIds = confirmations.map((c) => c.quoteId);
    const quotes = await db
      .select()
      .from(sourceRfqQuotes)
      .where(
        and(
          inArray(sourceRfqQuotes.id, quoteIds),
          eq(sourceRfqQuotes.rfqId, rfqId),
          eq(sourceRfqQuotes.partnerId, partnerId),
          eq(sourceRfqQuotes.isSelected, true),
        ),
      );

    // Verify all quotes belong to this partner and are pending confirmation
    if (quotes.length !== confirmations.length) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Some quotes were not found or do not belong to your organization',
      });
    }

    const pendingQuotes = quotes.filter((q) => q.confirmationStatus === 'pending');
    if (pendingQuotes.length !== confirmations.length) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Some quotes have already been confirmed or are not pending confirmation',
      });
    }

    // Validate update actions have required fields
    for (const conf of confirmations) {
      if (conf.action === 'update') {
        if (!conf.updatedPriceUsd && !conf.updatedAvailableQty) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Update action requires at least updatedPriceUsd or updatedAvailableQty',
          });
        }
        if (!conf.reason) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Update action requires a reason',
          });
        }
      }
      if (conf.action === 'reject' && !conf.reason) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Reject action requires a reason',
        });
      }
    }

    const now = new Date();
    const results: Array<{
      quoteId: string;
      action: string;
      status: string;
    }> = [];

    // Process each confirmation
    for (const conf of confirmations) {
      const status =
        conf.action === 'confirm'
          ? 'confirmed'
          : conf.action === 'update'
            ? 'updated'
            : 'rejected';

      await db
        .update(sourceRfqQuotes)
        .set({
          confirmationStatus: status,
          confirmedAt: now,
          confirmationNotes: conf.notes,
          updatedPriceUsd: conf.updatedPriceUsd,
          updatedAvailableQty: conf.updatedAvailableQty,
          updateReason: conf.reason,
        })
        .where(eq(sourceRfqQuotes.id, conf.quoteId));

      results.push({
        quoteId: conf.quoteId,
        action: conf.action,
        status,
      });
    }

    // Check if all selected quotes for this RFQ are now confirmed
    const allSelectedQuotes = await db
      .select({
        id: sourceRfqQuotes.id,
        confirmationStatus: sourceRfqQuotes.confirmationStatus,
      })
      .from(sourceRfqQuotes)
      .where(
        and(eq(sourceRfqQuotes.rfqId, rfqId), eq(sourceRfqQuotes.isSelected, true)),
      );

    const allConfirmed = allSelectedQuotes.every(
      (q) =>
        q.confirmationStatus === 'confirmed' ||
        q.confirmationStatus === 'updated' ||
        q.confirmationStatus === 'rejected',
    );

    // If all quotes are confirmed, update RFQ status
    if (allConfirmed) {
      await db
        .update(sourceRfqs)
        .set({
          status: 'confirmed',
          allConfirmedAt: now,
        })
        .where(eq(sourceRfqs.id, rfqId));
    }

    // TODO: Notify admin of confirmation response

    return {
      success: true,
      rfqId,
      rfqNumber: rfq.rfqNumber,
      results,
      allConfirmed,
      message: allConfirmed
        ? 'All quotes have been confirmed. RFQ is ready for final quote generation.'
        : `${results.length} quote(s) confirmed. Waiting for other partners.`,
    };
  });

export default partnerConfirmQuote;
