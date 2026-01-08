import { eq } from 'drizzle-orm';

import db from '@/database/client';
import { partnerContacts } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import { getContactsSchema } from '../schemas/contactSchemas';

/**
 * Get all contacts for a partner
 *
 * @example
 *   await trpcClient.partners.contacts.getMany.query({
 *     partnerId: "uuid-here"
 *   });
 */
const contactsGetMany = adminProcedure
  .input(getContactsSchema)
  .query(async ({ input }) => {
    const { partnerId } = input;

    const contacts = await db
      .select()
      .from(partnerContacts)
      .where(eq(partnerContacts.partnerId, partnerId))
      .orderBy(partnerContacts.isPrimary, partnerContacts.name);

    return contacts;
  });

export default contactsGetMany;
