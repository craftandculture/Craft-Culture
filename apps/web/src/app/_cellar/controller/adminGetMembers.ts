import { and, eq, inArray, sql } from 'drizzle-orm';

import db from '@/database/client';
import {
  cellarReleaseRequests,
  logisticsShipmentItems,
  partners,
  wmsProductPricing,
  wmsStock,
  wmsStockMovements,
} from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

/** Cases included in the membership before storage is charged per case */
const INCLUDED_CASES = 20;

/**
 * Every cellar member, with what they hold and what they are waiting on
 *
 * An operations view, not a management one: the order is by who needs
 * something from us, oldest wait first, so working the screen top-down is the
 * same as working the queue. Value and allowance are here because they answer
 * the next question once you have opened a member — what is in there, and are
 * they over the twenty cases the membership includes — but they do not decide
 * the order.
 *
 * Private collectors only. A wine partner holding stock with us is on a
 * commercial arrangement, not the cellar membership, and mixing the two here
 * would put an allowance and a storage overage against a company that has
 * neither.
 *
 * A member with no stock and no requests still appears. Somebody who joined
 * and never shipped is a fact worth seeing, and a list that quietly omitted
 * them would read as a list of all members.
 */
const adminGetMembers = adminProcedure.query(async () => {
  const members = await db
    .select({
      id: partners.id,
      name: partners.businessName,
      type: partners.type,
    })
    .from(partners)
    .where(
      and(
        eq(partners.type, 'private_collector'),
        eq(partners.status, 'active'),
      ),
    );

  if (members.length === 0) return { members: [], includedCases: INCLUDED_CASES };

  const ids = members.map((member) => member.id);

  /*
    Bottles rather than cases is the honest unit here: a bay that has been
    repacked holds the same wine in a different pack, and open bottles from a
    split case belong to the member exactly as sealed ones do.
  */
  const [stockRows, requests, movements] = await Promise.all([
    /*
      Grouped by owner AND wine, with nothing joined on. Costing here would
      mean joining the pricing table, and a wine carrying two pricing rows
      would then multiply its own stock — a member's holding would grow
      because somebody edited a price. Cost is resolved separately below and
      applied per wine.
    */
    db
      .select({
        ownerId: wmsStock.ownerId,
        lwin18: wmsStock.lwin18,
        cases: sql<number>`SUM(${wmsStock.quantityCases})`,
        bottles: sql<number>`SUM(${wmsStock.quantityCases} * COALESCE(${wmsStock.caseConfig}, 12) + ${wmsStock.openBottles})`,
      })
      .from(wmsStock)
      .where(inArray(wmsStock.ownerId, ids))
      .groupBy(wmsStock.ownerId, wmsStock.lwin18),

    db
      .select({
        partnerId: cellarReleaseRequests.partnerId,
        status: cellarReleaseRequests.status,
        requestNumber: cellarReleaseRequests.requestNumber,
        submittedAt: cellarReleaseRequests.submittedAt,
      })
      .from(cellarReleaseRequests)
      .where(
        and(
          inArray(cellarReleaseRequests.partnerId, ids),
          inArray(cellarReleaseRequests.status, [
            'submitted',
            'under_review',
            'revision_requested',
          ]),
        ),
      )
      .orderBy(cellarReleaseRequests.submittedAt),

    db
      .select({
        ownerId: wmsStockMovements.toOwnerId,
        lastAt: sql<string>`MAX(${wmsStockMovements.createdAt})`,
      })
      .from(wmsStockMovements)
      .where(inArray(wmsStockMovements.toOwnerId, ids))
      .groupBy(wmsStockMovements.toOwnerId),
  ]);

  /*
    Valued the way the Pricing Manager values it — the pricing record first,
    the shipment line behind it — so a member's cellar is worth the same here
    as it is anywhere else in the platform.
  */
  const lwins = [...new Set(stockRows.map((row) => row.lwin18))];

  const costRows = lwins.length
    ? await db
        .select({
          lwin18: wmsProductPricing.lwin18,
          cost: sql<number | null>`COALESCE(
            NULLIF(MAX(${wmsProductPricing.importPricePerBottle}), 0),
            MAX(${logisticsShipmentItems.productCostPerBottle})
          )`,
        })
        .from(wmsProductPricing)
        .leftJoin(
          logisticsShipmentItems,
          eq(logisticsShipmentItems.lwin, wmsProductPricing.lwin18),
        )
        .where(inArray(wmsProductPricing.lwin18, lwins))
        .groupBy(wmsProductPricing.lwin18)
    : [];

  const costByLwin = new Map(
    costRows.map((row) => [row.lwin18, Number(row.cost ?? 0)]),
  );

  const holdings = new Map<
    string,
    { cases: number; bottles: number; wines: number; value: number }
  >();

  for (const row of stockRows) {
    const bottles = Number(row.bottles ?? 0);
    const current = holdings.get(row.ownerId) ?? {
      cases: 0,
      bottles: 0,
      wines: 0,
      value: 0,
    };

    holdings.set(row.ownerId, {
      cases: current.cases + Number(row.cases ?? 0),
      bottles: current.bottles + bottles,
      wines: current.wines + 1,
      value: current.value + bottles * (costByLwin.get(row.lwin18) ?? 0),
    });
  }

  const movementByOwner = new Map(movements.map((row) => [row.ownerId, row]));

  const rows = members.map((member) => {
    const holding = holdings.get(member.id);
    const cases = holding?.cases ?? 0;
    const mine = requests.filter((row) => row.partnerId === member.id);

    /*
      Two queues, and they are not the same job. "Waiting on us" is work; the
      rest is a member deciding, which needs chasing rather than doing.
    */
    const waitingOnUs = mine.filter((row) => row.status === 'submitted');
    const waitingOnThem = mine.filter((row) => row.status !== 'submitted');
    const oldest = waitingOnUs[0] ?? waitingOnThem[0] ?? null;

    return {
      id: member.id,
      name: member.name,
      type: member.type,
      cases,
      bottles: holding?.bottles ?? 0,
      wines: holding?.wines ?? 0,
      valueUsd: Math.round(holding?.value ?? 0),
      overageCases: Math.max(0, cases - INCLUDED_CASES),
      waitingOnUs: waitingOnUs.length,
      waitingOnThem: waitingOnThem.length,
      oldestRequestNumber: oldest?.requestNumber ?? null,
      oldestSubmittedAt: oldest?.submittedAt ?? null,
      lastMovementAt: movementByOwner.get(member.id)?.lastAt ?? null,
    };
  });

  rows.sort((a, b) => {
    if (a.waitingOnUs !== b.waitingOnUs) return b.waitingOnUs - a.waitingOnUs;
    if (a.waitingOnUs > 0 && b.waitingOnUs > 0) {
      return (
        new Date(a.oldestSubmittedAt ?? 0).getTime() -
        new Date(b.oldestSubmittedAt ?? 0).getTime()
      );
    }
    if (a.waitingOnThem !== b.waitingOnThem) {
      return b.waitingOnThem - a.waitingOnThem;
    }
    return b.bottles - a.bottles;
  });

  return { members: rows, includedCases: INCLUDED_CASES };
});

export default adminGetMembers;
