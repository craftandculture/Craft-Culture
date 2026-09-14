import { desc, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { saleMandateLots, saleMandates } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

/**
 * Offers across every member
 *
 * Drafts are excluded unless asked for: a member part-way through pricing
 * something has not asked us for anything, and a queue that shows unfinished
 * work trains people to ignore it.
 */
const adminGetMandates = adminProcedure
  .input(
    z
      .object({
        status: z
          .enum(['open', 'all', 'offered', 'listed', 'placed', 'sold'])
          .default('open'),
      })
      .optional(),
  )
  .query(async ({ input }) => {
    const status = input?.status ?? 'open';

    const mandates = await db
      .select()
      .from(saleMandates)
      .where(
        status === 'all'
          ? undefined
          : status === 'open'
            ? inArray(saleMandates.status, [
                'offered',
                'listed',
                'placed',
                'partially_sold',
              ])
            : eq(saleMandates.status, status),
      )
      .orderBy(desc(saleMandates.offeredAt))
      .limit(200);

    if (mandates.length === 0) return { mandates: [] };

    const lots = await db
      .select()
      .from(saleMandateLots)
      .where(
        inArray(
          saleMandateLots.mandateId,
          mandates.map((mandate) => mandate.id),
        ),
      );

    const byMandate = new Map<string, typeof lots>();

    for (const lot of lots) {
      byMandate.set(lot.mandateId, [
        ...(byMandate.get(lot.mandateId) ?? []),
        lot,
      ]);
    }

    return {
      mandates: mandates.map((mandate) => ({
        ...mandate,
        lots: byMandate.get(mandate.id) ?? [],
      })),
    };
  });

export default adminGetMandates;
