import { and, desc, eq, ilike, or, sql } from 'drizzle-orm';

import db from '@/database/client';
import { sourceRfqPartners, sourceRfqs, users } from '@/database/schema';
import { winePartnerProcedure } from '@/lib/trpc/procedures';

import getManyRfqsSchema from '../schemas/getManyRfqsSchema';

/**
 * Get list of SOURCE RFQs assigned to the partner
 *
 * @example
 *   await trpcClient.source.partner.getMany.query({
 *     limit: 20,
 *     cursor: 0,
 *   });
 */
const partnerGetManyRfqs = winePartnerProcedure
  .input(getManyRfqsSchema)
  .query(async ({ input, ctx: { partnerId } }) => {
    const { limit, cursor, search, status } = input;

    // Build where conditions - only RFQs assigned to this partner
    const conditions = [eq(sourceRfqPartners.partnerId, partnerId)];

    if (status) {
      conditions.push(eq(sourceRfqs.status, status));
    }

    if (search) {
      conditions.push(
        or(
          ilike(sourceRfqs.name, `%${search}%`),
          ilike(sourceRfqs.rfqNumber, `%${search}%`),
        )!,
      );
    }

    // Get total count
    const whereClause = and(...conditions);

    const [countResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(sourceRfqPartners)
      .innerJoin(sourceRfqs, eq(sourceRfqPartners.rfqId, sourceRfqs.id))
      .where(whereClause);

    const totalCount = Number(countResult?.count ?? 0);

    // Get RFQs with partner assignment info
    const rfqsList = await db
      .select({
        rfq: sourceRfqs,
        partnerAssignment: sourceRfqPartners,
        createdByUser: {
          id: users.id,
          name: users.name,
        },
      })
      .from(sourceRfqPartners)
      .innerJoin(sourceRfqs, eq(sourceRfqPartners.rfqId, sourceRfqs.id))
      .leftJoin(users, eq(sourceRfqs.createdBy, users.id))
      .where(whereClause)
      .orderBy(desc(sourceRfqs.createdAt))
      .limit(limit)
      .offset(cursor);

    // Flatten response
    const rfqsWithAssignment = rfqsList.map((row) => ({
      ...row.rfq,
      createdByUser: row.createdByUser,
      partnerStatus: row.partnerAssignment.status,
      viewedAt: row.partnerAssignment.viewedAt,
      submittedAt: row.partnerAssignment.submittedAt,
      quoteCount: row.partnerAssignment.quoteCount,
    }));

    const nextCursor = cursor + limit < totalCount ? cursor + limit : null;

    return {
      data: rfqsWithAssignment,
      meta: {
        totalCount,
        nextCursor,
        hasMore: nextCursor !== null,
      },
    };
  });

export default partnerGetManyRfqs;
