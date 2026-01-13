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
 * Add additional partners to an already-sent SOURCE RFQ
 *
 * @example
 *   await trpcClient.source.admin.addPartners.mutate({
 *     rfqId: "uuid-here",
 *     partnerIds: ["partner-uuid-1", "partner-uuid-2"]
 *   });
 */
const adminAddPartners = adminProcedure
  .input(sendToPartnersSchema)
  .mutation(async ({ input }) => {
    const { rfqId, partnerIds, contactIds } = input;

    // Verify RFQ exists and is in a valid status for adding partners
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

    const allowedStatuses = ['sent', 'collecting', 'comparing', 'selecting'];
    if (!allowedStatuses.includes(rfq.status)) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Cannot add partners to RFQ with status '${rfq.status}'`,
      });
    }

    // Get existing partners for this RFQ
    const existingRfqPartners = await db
      .select({ partnerId: sourceRfqPartners.partnerId })
      .from(sourceRfqPartners)
      .where(eq(sourceRfqPartners.rfqId, rfqId));

    const existingPartnerIds = new Set(existingRfqPartners.map((p) => p.partnerId));

    // Filter out partners that are already assigned
    const newPartnerIds = partnerIds.filter((id) => !existingPartnerIds.has(id));

    if (newPartnerIds.length === 0) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'All selected partners are already assigned to this RFQ',
      });
    }

    // Verify all new partners exist and are wine partners
    const validPartners = await db
      .select({ id: partners.id })
      .from(partners)
      .where(
        sql`${partners.id} IN ${newPartnerIds} AND ${partners.type} = 'wine_partner' AND ${partners.status} = 'active'`,
      );

    if (validPartners.length !== newPartnerIds.length) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Some partners are invalid or not active wine partners',
      });
    }

    // Create RFQ partner assignments for new partners only
    const now = new Date();
    const rfqPartnerValues = newPartnerIds.map((partnerId) => ({
      rfqId,
      partnerId,
      status: 'pending' as const,
      notifiedAt: now,
    }));

    const insertedRfqPartners = await db
      .insert(sourceRfqPartners)
      .values(rfqPartnerValues)
      .returning({ id: sourceRfqPartners.id, partnerId: sourceRfqPartners.partnerId });

    // If contact IDs were provided, filter to only those belonging to new partners
    const contactsByPartner = new Map<string, { id: string; email: string; name: string }[]>();

    if (contactIds && contactIds.length > 0) {
      // Get contact details with their partner IDs (only for new partners)
      const contacts = await db
        .select({
          id: partnerContacts.id,
          partnerId: partnerContacts.partnerId,
          email: partnerContacts.email,
          name: partnerContacts.name,
        })
        .from(partnerContacts)
        .where(sql`${partnerContacts.id} IN ${contactIds} AND ${partnerContacts.partnerId} IN ${newPartnerIds}`);

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

    // Update partner count on the RFQ
    const newPartnerCount = (rfq.partnerCount || 0) + newPartnerIds.length;
    await db
      .update(sourceRfqs)
      .set({ partnerCount: newPartnerCount })
      .where(eq(sourceRfqs.id, rfqId));

    // Send notifications to new partners only (non-blocking)
    void Promise.allSettled(
      newPartnerIds.map((partnerId) => {
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
      addedCount: newPartnerIds.length,
      totalPartnerCount: newPartnerCount,
    };
  });

export default adminAddPartners;
