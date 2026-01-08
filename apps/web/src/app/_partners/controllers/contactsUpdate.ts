import { TRPCError } from '@trpc/server';
import { and, eq } from 'drizzle-orm';

import db from '@/database/client';
import { partnerContacts } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import { updateContactSchema } from '../schemas/contactSchemas';

/**
 * Update a partner contact
 *
 * @example
 *   await trpcClient.partners.contacts.update.mutate({
 *     id: "uuid-here",
 *     name: "Jane Doe",
 *     isPrimary: true
 *   });
 */
const contactsUpdate = adminProcedure
  .input(updateContactSchema)
  .mutation(async ({ input }) => {
    const { id, ...updateData } = input;

    // Get existing contact
    const [existing] = await db
      .select()
      .from(partnerContacts)
      .where(eq(partnerContacts.id, id));

    if (!existing) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Contact not found',
      });
    }

    // If setting as primary, unset other primary contacts
    if (updateData.isPrimary) {
      await db
        .update(partnerContacts)
        .set({ isPrimary: false })
        .where(
          and(
            eq(partnerContacts.partnerId, existing.partnerId),
            eq(partnerContacts.isPrimary, true),
          ),
        );
    }

    const [updated] = await db
      .update(partnerContacts)
      .set(updateData)
      .where(eq(partnerContacts.id, id))
      .returning();

    return updated;
  });

export default contactsUpdate;
