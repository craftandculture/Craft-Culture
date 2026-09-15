import { desc, eq, inArray } from 'drizzle-orm';

import db from '@/database/client';
import {
  cellarReleaseRequestItems,
  cellarReleaseRequests,
} from '@/database/schema';
import { stockOwnerProcedure } from '@/lib/trpc/procedures';

import backfillReleaseItems from '../data/backfillReleaseItems';

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
      /*
        The quote, itemised as far as it can safely go.

        This used to be the total alone, because naming the amounts would let
        anyone who knows what their own wine cost work our rates back out of
        them. Bundling duty, VAT, transfer out of bond and the licensed
        distributor into one clearance figure keeps that true — none of those
        four can be separated from the sum — while still letting a member see
        what they are paying for and question a repack that should not be on
        there.

        goodsValueUsd is included after all. It was held back on the grounds
        that it is the divisor every percentage is taken against — but a member
        can already add it up from their own cellar, which prints the value
        recorded on import against every wine and totals it on a summary card.
        Withholding it here protected nothing and left them unable to see what
        the release is being assessed on.
      */
      totalCostUsd: cellarReleaseRequests.totalCostUsd,
      goodsValueUsd: cellarReleaseRequests.goodsValueUsd,
      clearanceCostUsd: cellarReleaseRequests.clearanceCostUsd,
      deliveryCostUsd: cellarReleaseRequests.deliveryCostUsd,
      serviceFeeUsd: cellarReleaseRequests.serviceFeeUsd,
      repackCostUsd: cellarReleaseRequests.repackCostUsd,
      repackCases: cellarReleaseRequests.repackCases,
      additionalChargeUsd: cellarReleaseRequests.additionalChargeUsd,
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
      lwin18: cellarReleaseRequestItems.lwin18,
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


  /*
    The same repair the admin view does. Without it a member saw NV and no
    format on lines a merge had stripped, while the admin quoting the same
    request saw the real vintage — two screens disagreeing about one wine.
  */
  await backfillReleaseItems(items);

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
