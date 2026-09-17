import { TRPCError } from '@trpc/server';
import { and, eq, ne } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { partners } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';
import { isZohoConfigured } from '@/lib/zoho/client';
import { getContact } from '@/lib/zoho/contacts';
import logger from '@/utils/logger';

/**
 * Point a partner at the Zoho customer it is billed as
 *
 * Links an existing customer; it will not create one. A contact invented to
 * satisfy a link is how a duplicate customer gets into the accounts, in a
 * system we do not control and against which everything is later reconciled.
 *
 * @example
 *   await trpcClient.partners.adminLinkZohoContact.mutate({
 *     partnerId,
 *     contactId: '460000000123456',
 *   });
 */
const zohoContactLink = adminProcedure
  .input(
    z.object({
      partnerId: z.string().uuid(),
      contactId: z.string().min(1),
    }),
  )
  .mutation(async ({ input }) => {
    if (!isZohoConfigured()) {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message: 'Zoho is not configured on this environment.',
      });
    }

    /*
      Confirmed against Zoho rather than taken on trust. A contact id that does
      not resolve is a link that fails later, at the point someone is trying to
      raise a document, which is the worst moment to discover it.
    */
    const contact = await getContact(input.contactId);

    if (!contact?.contact_id) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Zoho does not know that customer.',
      });
    }

    /*
      One Zoho customer, one partner.

      Two partners pointing at one customer puts two businesses' invoices under
      a single account — the same split we spent an hour unpicking on the
      partners table, in the direction that is harder to see.
    */
    const [clash] = await db
      .select({ id: partners.id, name: partners.businessName })
      .from(partners)
      .where(
        and(
          eq(partners.zohoContactId, input.contactId),
          ne(partners.id, input.partnerId),
        ),
      );

    if (clash) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: `${contact.contact_name} is already linked to ${clash.name}. One Zoho customer belongs to one partner.`,
      });
    }

    const [updated] = await db
      .update(partners)
      .set({
        zohoContactId: contact.contact_id,
        zohoLastSyncAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(partners.id, input.partnerId))
      .returning({
        id: partners.id,
        name: partners.businessName,
        zohoContactId: partners.zohoContactId,
      });

    if (!updated) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Partner not found' });
    }

    logger.info('[Partners] Zoho customer linked', {
      partnerId: updated.id,
      contactId: contact.contact_id,
      contactName: contact.contact_name,
    });

    return { ...updated, contactName: contact.contact_name };
  });

export default zohoContactLink;
