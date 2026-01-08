import { TRPCError } from '@trpc/server';
import { and, eq } from 'drizzle-orm';

import db from '@/database/client';
import { partnerContacts, partners } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import { createContactSchema } from '../schemas/contactSchemas';

/**
 * Create a new contact for a partner
 *
 * @example
 *   await trpcClient.partners.contacts.create.mutate({
 *     partnerId: "uuid-here",
 *     name: "John Doe",
 *     email: "john@example.com",
 *     role: "Buyer",
 *     isPrimary: true
 *   });
 */
const contactsCreate = adminProcedure
  .input(createContactSchema)
  .mutation(async ({ input }) => {
    const { partnerId, name, email, role, phone, isPrimary } = input;

    // Verify partner exists
    const [partner] = await db
      .select({ id: partners.id })
      .from(partners)
      .where(eq(partners.id, partnerId));

    if (!partner) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Partner not found',
      });
    }

    // If setting as primary, unset other primary contacts
    if (isPrimary) {
      await db
        .update(partnerContacts)
        .set({ isPrimary: false })
        .where(
          and(
            eq(partnerContacts.partnerId, partnerId),
            eq(partnerContacts.isPrimary, true),
          ),
        );
    }

    const [contact] = await db
      .insert(partnerContacts)
      .values({
        partnerId,
        name,
        email,
        role,
        phone,
        isPrimary,
      })
      .returning();

    return contact;
  });

export default contactsCreate;
