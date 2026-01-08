import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';

import db from '@/database/client';
import { partnerContacts } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import { deleteContactSchema } from '../schemas/contactSchemas';

/**
 * Delete a partner contact
 *
 * @example
 *   await trpcClient.partners.contacts.delete.mutate({
 *     id: "uuid-here"
 *   });
 */
const contactsDelete = adminProcedure
  .input(deleteContactSchema)
  .mutation(async ({ input }) => {
    const { id } = input;

    // Verify contact exists
    const [existing] = await db
      .select({ id: partnerContacts.id })
      .from(partnerContacts)
      .where(eq(partnerContacts.id, id));

    if (!existing) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Contact not found',
      });
    }

    await db.delete(partnerContacts).where(eq(partnerContacts.id, id));

    return { success: true };
  });

export default contactsDelete;
