import { TRPCError } from '@trpc/server';
import { and, eq } from 'drizzle-orm';

import db from '@/database/client';
import { sourceRfqPartners, sourceRfqs } from '@/database/schema';
import { winePartnerProcedure } from '@/lib/trpc/procedures';

import declineRfqSchema from '../schemas/declineRfqSchema';

/**
 * Decline to quote on a SOURCE RFQ
 *
 * @example
 *   await trpcClient.source.partner.decline.mutate({
 *     rfqId: "uuid-here",
 *     reason: "Products not available in our inventory"
 *   });
 */
const partnerDeclineRfq = winePartnerProcedure
  .input(declineRfqSchema)
  .mutation(async ({ input, ctx: { partnerId } }) => {
    const { rfqId, reason } = input;

    // Verify RFQ is assigned to this partner
    const [assignment] = await db
      .select({
        assignment: sourceRfqPartners,
        rfqStatus: sourceRfqs.status,
      })
      .from(sourceRfqPartners)
      .innerJoin(sourceRfqs, eq(sourceRfqPartners.rfqId, sourceRfqs.id))
      .where(
        and(
          eq(sourceRfqPartners.rfqId, rfqId),
          eq(sourceRfqPartners.partnerId, partnerId),
        ),
      );

    if (!assignment) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'RFQ not found or not assigned to your organization',
      });
    }

    // Check partner can still decline
    if (assignment.assignment.status === 'submitted') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Cannot decline after submitting quotes',
      });
    }

    if (assignment.assignment.status === 'declined') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'RFQ has already been declined',
      });
    }

    // Update partner assignment
    await db
      .update(sourceRfqPartners)
      .set({
        status: 'declined',
        declinedAt: new Date(),
        declineReason: reason,
      })
      .where(eq(sourceRfqPartners.id, assignment.assignment.id));

    return {
      success: true,
    };
  });

export default partnerDeclineRfq;
