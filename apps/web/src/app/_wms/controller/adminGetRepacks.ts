import { and, asc, eq, gte, lt } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { z } from 'zod';

import db from '@/database/client';
import { partners, users, wmsLocations, wmsRepacks } from '@/database/schema';
import { staffAdminProcedure } from '@/lib/trpc/procedures';

const reversedByUser = alias(users, 'reversed_by_user');

/**
 * Every repack in a period, with whose wine it was (staff only)
 *
 * Read-only. The basis for charging partners for repack work: each row is one
 * repack, the case opened and the cases made from it. Reversed repacks are
 * returned with their reversal date so a reader can leave them out.
 *
 * @example
 *   await trpcClient.wms.admin.stock.getRepacks.query({ dateFrom, dateTo });
 */
const adminGetRepacks = staffAdminProcedure
  .input(z.object({ dateFrom: z.coerce.date(), dateTo: z.coerce.date() }))
  .query(async ({ input }) =>
    db
      .select({
        repackNumber: wmsRepacks.repackNumber,
        performedAt: wmsRepacks.performedAt,
        owner: partners.businessName,
        location: wmsLocations.locationCode,
        sourceProductName: wmsRepacks.sourceProductName,
        sourceLwin18: wmsRepacks.sourceLwin18,
        sourceCaseConfig: wmsRepacks.sourceCaseConfig,
        sourceQuantityCases: wmsRepacks.sourceQuantityCases,
        targetCaseConfig: wmsRepacks.targetCaseConfig,
        targetQuantityCases: wmsRepacks.targetQuantityCases,
        target2CaseConfig: wmsRepacks.target2CaseConfig,
        target2QuantityCases: wmsRepacks.target2QuantityCases,
        performedBy: users.name,
        notes: wmsRepacks.notes,
        reversedAt: wmsRepacks.reversedAt,
        reversedBy: reversedByUser.name,
      })
      .from(wmsRepacks)
      .innerJoin(partners, eq(partners.id, wmsRepacks.ownerId))
      .leftJoin(wmsLocations, eq(wmsLocations.id, wmsRepacks.locationId))
      .leftJoin(users, eq(users.id, wmsRepacks.performedBy))
      .leftJoin(reversedByUser, eq(reversedByUser.id, wmsRepacks.reversedBy))
      .where(and(gte(wmsRepacks.performedAt, input.dateFrom), lt(wmsRepacks.performedAt, input.dateTo)))
      .orderBy(asc(wmsRepacks.performedAt)),
  );

export default adminGetRepacks;
