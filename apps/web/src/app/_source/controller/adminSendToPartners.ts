import { TRPCError } from '@trpc/server';
import { eq, sql } from 'drizzle-orm';

import db from '@/database/client';
import {
  partnerContacts,
  partners,
  sourceRfqPartnerContacts,
  sourceRfqPartners,
  sourceRfqs,
} from '@/database/schema';
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
    const { rfqId, partnerIds, contactIds, responseDeadline } = input;

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

    const insertedRfqPartners = await db
      .insert(sourceRfqPartners)
      .values(rfqPartnerValues)
      .returning({ id: sourceRfqPartners.id, partnerId: sourceRfqPartners.partnerId });

    // If contact IDs were provided, store them and get contact details
    const contactsByPartner = new Map<string, { id: string; email: string; name: string }[]>();

    if (contactIds && contactIds.length > 0) {
      // Get contact details with their partner IDs
      const contacts = await db
        .select({
          id: partnerContacts.id,
          partnerId: partnerContacts.partnerId,
          email: partnerContacts.email,
          name: partnerContacts.name,
        })
        .from(partnerContacts)
        .where(sql`${partnerContacts.id} IN ${contactIds}`);

      // Group contacts by partner
      for (const contact of contacts) {
        const existing = contactsByPartner.get(contact.partnerId) || [];
        existing.push({ id: contact.id, email: contact.email, name: contact.name });
        contactsByPartner.set(contact.partnerId, existing);
      }

      // Create junction table entries
      const rfqPartnerContactValues: { rfqPartnerId: string; contactId: string; notifiedAt: Date }[] = [];

      for (const rfqPartner of insertedRfqPartners) {
        const partnerContactIds = contacts
          .filter((c) => c.partnerId === rfqPartner.partnerId)
          .map((c) => c.id);

        for (const contactId of partnerContactIds) {
          rfqPartnerContactValues.push({
            rfqPartnerId: rfqPartner.id,
            contactId,
            notifiedAt: now,
          });
        }
      }

      if (rfqPartnerContactValues.length > 0) {
        await db.insert(sourceRfqPartnerContacts).values(rfqPartnerContactValues);
      }
    }

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
    // Pass contact emails if specific contacts were selected
    void Promise.allSettled(
      partnerIds.map((partnerId) => {
        const partnerContactList = contactsByPartner.get(partnerId);
        return notifyPartnerOfRfq({
          rfqId,
          partnerId,
          contactEmails: partnerContactList?.map((c) => ({
            email: c.email,
            name: c.name,
          })),
        });
      }),
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
