import { desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { pricingSessions, users } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

/**
 * Get all pricing sessions with pagination
 *
 * @example
 *   const { sessions, total } = await trpcClient.pricingCalc.session.getMany.query({
 *     limit: 20,
 *     offset: 0,
 *   });
 */
const sessionGetMany = adminProcedure
  .input(
    z.object({
      limit: z.number().min(1).max(100).default(20),
      offset: z.number().min(0).default(0),
    }),
  )
  .query(async ({ input }) => {
    const { limit, offset } = input;

    const sessions = await db
      .select({
        id: pricingSessions.id,
        name: pricingSessions.name,
        status: pricingSessions.status,
        sourceType: pricingSessions.sourceType,
        sourceFileName: pricingSessions.sourceFileName,
        itemCount: pricingSessions.itemCount,
        createdAt: pricingSessions.createdAt,
        updatedAt: pricingSessions.updatedAt,
        createdBy: {
          id: users.id,
          name: users.name,
          email: users.email,
        },
      })
      .from(pricingSessions)
      .leftJoin(users, eq(pricingSessions.createdBy, users.id))
      .orderBy(desc(pricingSessions.createdAt))
      .limit(limit)
      .offset(offset);

    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(pricingSessions);

    return {
      sessions,
      total: countResult?.count ?? 0,
    };
  });

export default sessionGetMany;
