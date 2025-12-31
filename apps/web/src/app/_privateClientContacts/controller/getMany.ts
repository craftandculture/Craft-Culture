import { and, count, eq, ilike, or } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { privateClientContacts } from '@/database/schema';
import { winePartnerProcedure } from '@/lib/trpc/procedures';

const getContactsSchema = z.object({
  limit: z.number().min(1).max(100).default(20),
  cursor: z.number().min(0).default(0),
  search: z.string().optional(),
});

/**
 * Get all client contacts for the current wine partner
 */
const getMany = winePartnerProcedure.input(getContactsSchema).query(async ({ input, ctx }) => {
  const { limit, cursor, search } = input;
  const { partnerId } = ctx;

  // Build filter conditions
  const conditions = [eq(privateClientContacts.partnerId, partnerId)];

  if (search) {
    conditions.push(
      or(
        ilike(privateClientContacts.name, `%${search}%`),
        ilike(privateClientContacts.email, `%${search}%`),
        ilike(privateClientContacts.phone, `%${search}%`),
      ) ?? eq(privateClientContacts.partnerId, partnerId),
    );
  }

  // Get total count
  const [countResult] = await db
    .select({ value: count() })
    .from(privateClientContacts)
    .where(and(...conditions));

  const totalCount = countResult?.value ?? 0;

  // Get paginated contacts
  const contacts = await db.query.privateClientContacts.findMany({
    where: and(...conditions),
    orderBy: (table, { desc }) => [desc(table.lastOrderAt), desc(table.createdAt)],
    limit: limit + 1,
    offset: cursor,
  });

  const hasMore = contacts.length > limit;
  const data = hasMore ? contacts.slice(0, -1) : contacts;

  return {
    data,
    meta: {
      totalCount,
      hasMore,
      nextCursor: hasMore ? cursor + limit : undefined,
    },
  };
});

export default getMany;
