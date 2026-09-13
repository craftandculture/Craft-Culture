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
  /*
    Named columns, not the whole row.

    The member is shown one all-in figure by deliberate decision — an itemised
    quote invites a negotiation of costs they cannot change, and the amounts
    would publish our rates to anyone who knows what their own wine cost. A
    `select()` handed the breakdown over anyway: goods value, the rate card
    version, the service fee, the margin. The screen did not render it, which
    is not the same as it being private.
  */
  const requests = await db
    .select({
      id: cellarReleaseRequests.id,
      requestNumber: cellarReleaseRequests.requestNumber,
      status: cellarReleaseRequests.status,
      deliveryAddress: cellarReleaseRequests.deliveryAddress,
      memberNotes: cellarReleaseRequests.memberNotes,
      /* What we asked them to change — written to be read by them. */
      adminNotes: cellarReleaseRequests.adminNotes,
      /* The one figure, and the label for anything unusual inside it. */
      totalCostUsd: cellarReleaseRequests.totalCostUsd,
      additionalChargeLabel: cellarReleaseRequests.additionalChargeLabel,
      quotedAt: cellarReleaseRequests.quotedAt,
      submittedAt: cellarReleaseRequests.submittedAt,
      confirmedAt: cellarReleaseRequests.confirmedAt,
      privateClientOrderId: cellarReleaseRequests.privateClientOrderId,
      createdAt: cellarReleaseRequests.createdAt,
    })
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
    .select({
      id: cellarReleaseRequestItems.id,
      requestId: cellarReleaseRequestItems.requestId,
      stockId: cellarReleaseRequestItems.stockId,
      lotNumber: cellarReleaseRequestItems.lotNumber,
      productName: cellarReleaseRequestItems.productName,
      vintage: cellarReleaseRequestItems.vintage,
      bottleSize: cellarReleaseRequestItems.bottleSize,
      caseConfig: cellarReleaseRequestItems.caseConfig,
      bottles: cellarReleaseRequestItems.bottles,
    })
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
