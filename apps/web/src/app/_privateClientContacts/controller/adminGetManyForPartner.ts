import { and, asc, eq, ilike, or } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { privateClientContacts } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

/**
 * A partner's client contacts, for an admin raising an order on their behalf
 *
 * `getMany` reads the partner from the session, which is right for a partner
 * looking at their own clients and useless to an admin, who belongs to no
 * partner. So the client bank existed and the admin order form could not reach
 * it: every order was typed from scratch, which is how the same client ends up
 * in the system three times under three spellings and none of them verified.
 *
 * The partner comes from the form's own Select Partner, so an admin only ever
 * sees the clients of the partner they are acting for.
 */
const adminGetManyForPartner = adminProcedure
  .input(
    z.object({
      partnerId: z.string().uuid(),
      search: z.string().optional(),
      limit: z.number().min(1).max(50).default(20),
    }),
  )
  .query(async ({ input }) => {
    const { partnerId, search, limit } = input;
    const term = search?.trim();

    const rows = await db
      .select({
        id: privateClientContacts.id,
        name: privateClientContacts.name,
        email: privateClientContacts.email,
        phone: privateClientContacts.phone,
        addressLine1: privateClientContacts.addressLine1,
        addressLine2: privateClientContacts.addressLine2,
        city: privateClientContacts.city,
        // The distributor's own check. An order for an unverified client
        // stops at verification, so it is worth seeing before choosing.
        verifiedAt: privateClientContacts.cityDrinksVerifiedAt,
      })
      .from(privateClientContacts)
      .where(
        term
          ? and(
              eq(privateClientContacts.partnerId, partnerId),
              or(
                ilike(privateClientContacts.name, `%${term}%`),
                ilike(privateClientContacts.email, `%${term}%`),
                ilike(privateClientContacts.phone, `%${term}%`),
              ),
            )
          : eq(privateClientContacts.partnerId, partnerId),
      )
      .orderBy(asc(privateClientContacts.name))
      .limit(limit);

    return rows.map((row) => ({
      ...row,
      // One line for the form to drop straight into Delivery Address.
      address: [row.addressLine1, row.addressLine2, row.city]
        .filter(Boolean)
        .join(', '),
    }));
  });

export default adminGetManyForPartner;
