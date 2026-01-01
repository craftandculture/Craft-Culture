import { type SQL, and, count, desc, eq, ilike, or } from 'drizzle-orm';
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

  // Build WHERE clause - use SQL builder for search functionality
  const buildWhereClause = (): SQL | undefined => {
    const baseCondition = eq(privateClientContacts.partnerId, partnerId);

    if (!search) {
      return baseCondition;
    }

    const searchCondition = or(
      ilike(privateClientContacts.name, `%${search}%`),
      ilike(privateClientContacts.email, `%${search}%`),
      ilike(privateClientContacts.phone, `%${search}%`),
    );

    return searchCondition ? and(baseCondition, searchCondition) : baseCondition;
  };

  const whereClause = buildWhereClause();

  // Get total count
  const [countResult] = await db
    .select({ value: count() })
    .from(privateClientContacts)
    .where(whereClause);

  const totalCount = countResult?.value ?? 0;

  // Get paginated contacts using select for complex WHERE
  const contacts = await db
    .select()
    .from(privateClientContacts)
    .where(whereClause)
    .orderBy(desc(privateClientContacts.lastOrderAt), desc(privateClientContacts.createdAt))
    .limit(limit + 1)
    .offset(cursor);

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
