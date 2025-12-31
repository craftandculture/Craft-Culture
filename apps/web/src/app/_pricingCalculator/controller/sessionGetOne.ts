import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { pricingItems, pricingSessions, users } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

/**
 * Get a single pricing session with all items
 *
 * @example
 *   const session = await trpcClient.pricingCalc.session.getOne.query({
 *     id: 'uuid-here',
 *   });
 */
const sessionGetOne = adminProcedure
  .input(
    z.object({
      id: z.string().uuid(),
    }),
  )
  .query(async ({ input }) => {
    const [session] = await db
      .select({
        id: pricingSessions.id,
        name: pricingSessions.name,
        status: pricingSessions.status,
        sourceType: pricingSessions.sourceType,
        sourceFileName: pricingSessions.sourceFileName,
        googleSheetId: pricingSessions.googleSheetId,
        rawData: pricingSessions.rawData,
        detectedColumns: pricingSessions.detectedColumns,
        columnMapping: pricingSessions.columnMapping,
        calculationVariables: pricingSessions.calculationVariables,
        itemCount: pricingSessions.itemCount,
        errors: pricingSessions.errors,
        warnings: pricingSessions.warnings,
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
      .where(eq(pricingSessions.id, input.id))
      .limit(1);

    if (!session) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Pricing session not found',
      });
    }

    const items = await db
      .select()
      .from(pricingItems)
      .where(eq(pricingItems.sessionId, input.id));

    return {
      ...session,
      items,
    };
  });

export default sessionGetOne;
