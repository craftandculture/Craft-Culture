import { desc, eq, inArray } from 'drizzle-orm';

import db from '@/database/client';
import {
  cellarReleaseRequestItems,
  cellarReleaseRequests,
} from '@/database/schema';
import { stockOwnerProcedure } from '@/lib/trpc/procedures';

/**
 * A member's release requests, newest first
 *
 * Lines come back with them: a request without its wines is a reference
 * number, and a member checking on one wants to see what they asked for.
 *
 * @example
 *   const { requests } = await trpcClient.cellar.member.getReleases.query();
 */
const memberGetReleases = stockOwnerProcedure.query(async ({ ctx }) => {
  const requests = await db
    .select()
    .from(cellarReleaseRequests)
    .where(eq(cellarReleaseRequests.partnerId, ctx.partner.id))
    .orderBy(desc(cellarReleaseRequests.createdAt))
    .limit(50);

  if (requests.length === 0) return { requests: [] };

  /*
    Scoped to this member's own requests. Fetching every line in the table and
    filtering in memory would work and would also hand one member's cellar to
    another the first time the filter was edited.
  */
  const items = await db
    .select()
    .from(cellarReleaseRequestItems)
    .where(
      inArray(
        cellarReleaseRequestItems.requestId,
        requests.map((request) => request.id),
      ),
    )
    .orderBy(cellarReleaseRequestItems.productName);

  const byRequest = new Map<string, typeof items>();

  for (const item of items) {
    byRequest.set(item.requestId, [...(byRequest.get(item.requestId) ?? []), item]);
  }

  return {
    requests: requests.map((request) => ({
      ...request,
      items: byRequest.get(request.id) ?? [],
    })),
  };
});

export default memberGetReleases;
