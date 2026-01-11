import { TRPCError } from '@trpc/server';
import { and, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { partners, sourceRfqQuotes, sourceRfqs } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

const requestConfirmationsSchema = z.object({
  rfqId: z.string().uuid(),
});

/**
 * Request partner confirmations for selected quotes
 *
 * This sends confirmation requests to all partners with selected quotes,
 * asking them to confirm availability and pricing are still valid.
 *
 * @example
 *   await trpcClient.source.admin.requestConfirmations.mutate({
 *     rfqId: "uuid-here"
 *   });
 */
const adminRequestConfirmations = adminProcedure
  .input(requestConfirmationsSchema)
  .mutation(async ({ input, ctx }) => {
    const { rfqId } = input;
    const userId = ctx.user.id;

    // Verify RFQ exists and is in correct status
    const [existing] = await db
      .select({
        id: sourceRfqs.id,
        status: sourceRfqs.status,
        rfqNumber: sourceRfqs.rfqNumber,
      })
      .from(sourceRfqs)
      .where(eq(sourceRfqs.id, rfqId));

    if (!existing) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'RFQ not found',
      });
    }

    // Can request confirmations from 'awaiting_confirmation' status
    if (existing.status !== 'awaiting_confirmation') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `RFQ must be in 'awaiting_confirmation' status to request confirmations. Current status: ${existing.status}`,
      });
    }

    // Get all selected quotes for this RFQ
    const selectedQuotes = await db
      .select({
        id: sourceRfqQuotes.id,
        partnerId: sourceRfqQuotes.partnerId,
        confirmationStatus: sourceRfqQuotes.confirmationStatus,
      })
      .from(sourceRfqQuotes)
      .where(
        and(
          eq(sourceRfqQuotes.rfqId, rfqId),
          eq(sourceRfqQuotes.isSelected, true),
        ),
      );

    if (selectedQuotes.length === 0) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'No quotes have been selected for this RFQ',
      });
    }

    // Filter to quotes that haven't had confirmation requested yet
    const quotesNeedingRequest = selectedQuotes.filter(
      (q) => q.confirmationStatus === null,
    );

    if (quotesNeedingRequest.length === 0) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'All selected quotes have already been sent confirmation requests',
      });
    }

    const now = new Date();

    // Update all quotes to pending confirmation status
    await db
      .update(sourceRfqQuotes)
      .set({
        confirmationStatus: 'pending',
        confirmationRequestedAt: now,
      })
      .where(
        inArray(
          sourceRfqQuotes.id,
          quotesNeedingRequest.map((q) => q.id),
        ),
      );

    // Update RFQ with confirmation request tracking
    await db
      .update(sourceRfqs)
      .set({
        confirmationRequestedAt: now,
        confirmationRequestedBy: userId,
      })
      .where(eq(sourceRfqs.id, rfqId));

    // Get unique partner IDs for notification
    const uniquePartnerIds = [...new Set(quotesNeedingRequest.map((q) => q.partnerId))];

    // Get partner info for notifications
    const partnerInfo = await db
      .select({
        id: partners.id,
        businessName: partners.businessName,
      })
      .from(partners)
      .where(inArray(partners.id, uniquePartnerIds));

    // TODO: Send notification emails to partners
    // for (const partner of partnerInfo) {
    //   await notifyPartnerOfConfirmationRequest({
    //     rfqId,
    //     partnerId: partner.id,
    //     partnerName: partner.businessName,
    //   });
    // }

    return {
      success: true,
      rfqId,
      rfqNumber: existing.rfqNumber,
      confirmationRequestedAt: now,
      summary: {
        totalQuotesRequested: quotesNeedingRequest.length,
        partnersNotified: partnerInfo.length,
        partners: partnerInfo.map((p) => ({
          id: p.id,
          name: p.businessName,
        })),
      },
    };
  });

export default adminRequestConfirmations;
