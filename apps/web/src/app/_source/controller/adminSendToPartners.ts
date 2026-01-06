import { TRPCError } from '@trpc/server';
import { eq, sql } from 'drizzle-orm';

import db from '@/database/client';
import { partners, sourceRfqPartners, sourceRfqs } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';
import logger from '@/utils/logger';

import sendToPartnersSchema from '../schemas/sendToPartnersSchema';
import notifyPartnerOfRfq from '../utils/notifyPartnerOfRfq';

/**
 * Send SOURCE RFQ to selected wine partners
 *
 * @example
 *   await trpcClient.source.admin.sendToPartners.mutate({
 *     rfqId: "uuid-here",
 *     partnerIds: ["partner-uuid-1", "partner-uuid-2"],
 *     responseDeadline: new Date("2026-02-01")
 *   });
 */
const adminSendToPartners = adminProcedure
  .input(sendToPartnersSchema)
  .mutation(async ({ input, ctx: { user } }) => {
    const { rfqId, partnerIds, responseDeadline } = input;

    // Verify RFQ exists and is ready to send
    const [rfq] = await db
      .select()
      .from(sourceRfqs)
      .where(eq(sourceRfqs.id, rfqId));

    if (!rfq) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'RFQ not found',
      });
    }

    const sendableStatuses = ['draft', 'parsing', 'ready_to_send'];
    if (!sendableStatuses.includes(rfq.status)) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'RFQ has already been sent',
      });
    }

    if (rfq.itemCount === 0) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Cannot send RFQ with no items',
      });
    }

    // Verify all partners exist and are wine partners
    const validPartners = await db
      .select({ id: partners.id })
      .from(partners)
      .where(
        sql`${partners.id} IN ${partnerIds} AND ${partners.type} = 'wine_partner' AND ${partners.status} = 'active'`,
      );

    if (validPartners.length !== partnerIds.length) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Some partners are invalid or not active wine partners',
      });
    }

    // Create RFQ partner assignments
    const now = new Date();
    const rfqPartnerValues = partnerIds.map((partnerId) => ({
      rfqId,
      partnerId,
      status: 'pending' as const,
      notifiedAt: now,
    }));

    await db.insert(sourceRfqPartners).values(rfqPartnerValues);

    // Update RFQ status and metadata
    await db
      .update(sourceRfqs)
      .set({
        status: 'sent',
        partnerCount: partnerIds.length,
        responseDeadline: responseDeadline || rfq.responseDeadline,
        sentAt: now,
        sentBy: user.id,
      })
      .where(eq(sourceRfqs.id, rfqId));

    // Send notifications to all partners (non-blocking)
    void Promise.allSettled(
      partnerIds.map((partnerId) =>
        notifyPartnerOfRfq({ rfqId, partnerId }),
      ),
    ).then((results) => {
      const failed = results.filter((r) => r.status === 'rejected');
      if (failed.length > 0) {
        logger.error('Some partner notifications failed', { failedCount: failed.length });
      }
    });

    return {
      success: true,
      partnerCount: partnerIds.length,
    };
  });

export default adminSendToPartners;
