import { and, desc, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { saleMandateLots, saleMandates } from '@/database/schema';
import { staffAdminProcedure } from '@/lib/trpc/procedures';

import isAgreedOffPortal from '../utils/isAgreedOffPortal';
import notAgreedOffPortal from '../utils/notAgreedOffPortal';

/**
 * Offers across every member
 *
 * Drafts are excluded unless asked for: a member part-way through pricing
 * something has not asked us for anything, and a queue that shows unfinished
 * work trains people to ignore it.
 *
 * Prices agreed with a member away from the portal are open offers too, so
 * their bottles are accounted for, but they are not awaiting review: they
 * carry `agreedOffPortal` and are left out of the Awaiting review filter.
 */
const adminGetMandates = staffAdminProcedure
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
            : status === 'offered'
              ? // Awaiting review is a decision list: agreed prices have nothing to decide
                and(eq(saleMandates.status, 'offered'), notAgreedOffPortal)
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
        /** Recorded from a price agreed away from the portal: not for listing */
        agreedOffPortal: isAgreedOffPortal(mandate.adminNotes),
        lots: byMandate.get(mandate.id) ?? [],
      })),
    };
  });

export default adminGetMandates;
