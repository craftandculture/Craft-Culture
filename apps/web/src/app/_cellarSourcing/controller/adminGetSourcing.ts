import { desc, eq, inArray } from 'drizzle-orm';

import db from '@/database/client';
import {
  cellarAllocationInterests,
  cellarAllocations,
  cellarSourcingRequests,
  partners,
} from '@/database/schema';
import { staffAdminProcedure } from '@/lib/trpc/procedures';
import logger from '@/utils/logger';

/**
 * Wine requests and member allocations, for the team
 *
 * Guarded: the tables are new, and a missed migration should show an empty
 * tab, not an error.
 *
 * @example
 *   const { requests, allocations } = await trpcClient.cellarSourcing.admin.get.query();
 */
const adminGetSourcing = staffAdminProcedure.query(async () => {
  try {
    const requests = await db
      .select({
        request: cellarSourcingRequests,
        memberName: partners.businessName,
      })
      .from(cellarSourcingRequests)
      .leftJoin(partners, eq(partners.id, cellarSourcingRequests.partnerId))
      .orderBy(desc(cellarSourcingRequests.createdAt))
      .limit(200);

    const allocations = await db
      .select()
      .from(cellarAllocations)
      .orderBy(desc(cellarAllocations.createdAt))
      .limit(50);

    const interests =
      allocations.length > 0
        ? await db
            .select({
              interest: cellarAllocationInterests,
              memberName: partners.businessName,
            })
            .from(cellarAllocationInterests)
            .leftJoin(
              partners,
              eq(partners.id, cellarAllocationInterests.partnerId),
            )
            .where(
              inArray(
                cellarAllocationInterests.allocationId,
                allocations.map((allocation) => allocation.id),
              ),
            )
            .orderBy(cellarAllocationInterests.createdAt)
        : [];

    return {
      requests: requests.map((row) => ({
        ...row.request,
        memberName: row.memberName ?? 'Member',
      })),
      allocations: allocations.map((allocation) => ({
        ...allocation,
        interests: interests
          .filter((row) => row.interest.allocationId === allocation.id)
          .map((row) => ({
            ...row.interest,
            memberName: row.memberName ?? 'Member',
          })),
      })),
    };
  } catch (error) {
    logger.error('Could not read cellar sourcing for admin', { error });
    return { requests: [], allocations: [] };
  }
});

export default adminGetSourcing;
