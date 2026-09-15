import { and, asc, eq, ilike, or, sql } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import {
  partners,
  privateClientContacts,
  privateClientOrders,
} from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

/**
 * Every client, across every partner
 *
 * A client record belongs to the partner who introduced them, which is right —
 * a partner must not see another's book. An admin is in a different position:
 * they raise orders for all of them, chase verifications for all of them, and
 * had no way to see the whole thing at once.
 *
 * Order counts come with it, because the question asked of a client list is
 * almost always whether this person has bought before, and a name alone cannot
 * answer it.
 */
const adminGetAll = adminProcedure
  .input(
    z.object({
      search: z.string().optional(),
      partnerId: z.string().uuid().optional(),
      /** Only those the distributor has not yet cleared */
      unverifiedOnly: z.boolean().default(false),
      limit: z.number().min(1).max(500).default(200),
    }),
  )
  .query(async ({ input }) => {
    const { search, partnerId, unverifiedOnly, limit } = input;
    const term = search?.trim();

    const conditions = [
      term
        ? or(
            ilike(privateClientContacts.name, `%${term}%`),
            ilike(privateClientContacts.email, `%${term}%`),
            ilike(privateClientContacts.phone, `%${term}%`),
          )
        : undefined,
      partnerId ? eq(privateClientContacts.partnerId, partnerId) : undefined,
      unverifiedOnly
        ? sql`${privateClientContacts.cityDrinksVerifiedAt} IS NULL`
        : undefined,
    ].filter(Boolean);

    const rows = await db
      .select({
        id: privateClientContacts.id,
        name: privateClientContacts.name,
        email: privateClientContacts.email,
        phone: privateClientContacts.phone,
        addressLine1: privateClientContacts.addressLine1,
        city: privateClientContacts.city,
        verifiedAt: privateClientContacts.cityDrinksVerifiedAt,
        partnerId: privateClientContacts.partnerId,
        partnerName: partners.businessName,
        createdAt: privateClientContacts.createdAt,
        orders: sql<number>`(
          SELECT COUNT(*)::int FROM ${privateClientOrders}
          WHERE ${privateClientOrders.clientId} = ${privateClientContacts.id}
        )`,
      })
      .from(privateClientContacts)
      .leftJoin(partners, eq(partners.id, privateClientContacts.partnerId))
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(asc(privateClientContacts.name))
      .limit(limit);

    // Two records with the same email are the same person entered twice — the
    // shape duplication takes when a name is retyped rather than chosen.
    const byEmail = new Map<string, number>();
    for (const row of rows) {
      const key = (row.email ?? '').trim().toLowerCase();
      if (key) byEmail.set(key, (byEmail.get(key) ?? 0) + 1);
    }

    return {
      rows: rows.map((row) => ({
        ...row,
        address: [row.addressLine1, row.city].filter(Boolean).join(', '),
        duplicateEmail:
          !!row.email && (byEmail.get(row.email.trim().toLowerCase()) ?? 0) > 1,
      })),
      summary: {
        total: rows.length,
        unverified: rows.filter((row) => !row.verifiedAt).length,
        neverOrdered: rows.filter((row) => row.orders === 0).length,
        duplicateEmails: [...byEmail.values()].filter((n) => n > 1).length,
      },
    };
  });

export default adminGetAll;
