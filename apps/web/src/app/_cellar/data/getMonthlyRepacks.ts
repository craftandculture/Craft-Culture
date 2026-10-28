import { and, eq, gte, inArray, lt, or } from 'drizzle-orm';

import db from '@/database/client';
import {
  cellarReleaseRequests,
  partners,
  privateClientOrders,
  wmsStockMovements,
} from '@/database/schema';

import getOwnerDeliveryOwners from './getOwnerDeliveryOwners';
import { looseBottlesOf, repackCharge } from '../utils/repackPackages';

/** Take-outs a member asks for; anything we take out for a sale or a loss is ours to pack */
const MEMBER_REQUESTED_TAKE_OUTS = ['stock_out:collected_by_owner', 'stock_out:partner_samples'];

const dubaiDay = (at: Date) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dubai' }).format(at);

/**
 * The repacks to bill each member for one month
 *
 * A repack is a package built for the member's own request: one of their
 * deliveries, or bottles they collected. Bottles leaving in their original
 * sealed case need none; the rest go out in packages of up to six. Sales of
 * their wine to other buyers, samples and losses are never billed to them.
 *
 * A delivery is recognised the way statements recognise it
 * (getOwnerDeliveryOwners), whether the pick was made against the PCO or the
 * Zoho order quoting it. Take-outs are grouped by day, since bottles collected
 * together leave in the same packages.
 *
 * @example
 *   const { members } = await getMonthlyRepacks('2026-10');
 *
 * @param month - Dubai month, YYYY-MM
 * @returns Per member: the deliveries and collections, packages and AED, and totals
 */
const getMonthlyRepacks = async (month: string) => {
  const [year, mon] = month.split('-').map(Number) as [number, number];
  const from = new Date(`${month}-01T00:00:00+04:00`);
  const next = mon === 12 ? `${year + 1}-01` : `${year}-${String(mon + 1).padStart(2, '0')}`;
  const to = new Date(`${next}-01T00:00:00+04:00`);

  const collectors = await db
    .select({ id: partners.id, name: partners.businessName })
    .from(partners)
    .where(eq(partners.type, 'private_collector'));
  if (collectors.length === 0) return { month, members: [] };
  const nameOf = new Map(collectors.map((row) => [row.id, row.name]));

  const movements = await db
    .select({
      id: wmsStockMovements.id,
      movementType: wmsStockMovements.movementType,
      reasonCode: wmsStockMovements.reasonCode,
      lwin18: wmsStockMovements.lwin18,
      quantityCases: wmsStockMovements.quantityCases,
      quantityBottles: wmsStockMovements.quantityBottles,
      fromOwnerId: wmsStockMovements.fromOwnerId,
      orderId: wmsStockMovements.orderId,
      performedAt: wmsStockMovements.performedAt,
    })
    .from(wmsStockMovements)
    .where(
      and(
        inArray(wmsStockMovements.fromOwnerId, [...nameOf.keys()]),
        gte(wmsStockMovements.performedAt, from),
        lt(wmsStockMovements.performedAt, to),
        or(
          eq(wmsStockMovements.movementType, 'pick'),
          inArray(wmsStockMovements.reasonCode, MEMBER_REQUESTED_TAKE_OUTS),
        ),
      ),
    );

  const deliveries = await getOwnerDeliveryOwners(movements.map((row) => row.orderId));

  // The release each delivery came from, for the line staff copy onto the invoice
  const pcoNumbers = [...new Set([...deliveries.values()].map((row) => row.pcoNumber))];
  const releases = pcoNumbers.length
    ? await db
        .select({
          pcoNumber: privateClientOrders.orderNumber,
          requestNumber: cellarReleaseRequests.requestNumber,
          repackCostUsd: cellarReleaseRequests.repackCostUsd,
        })
        .from(cellarReleaseRequests)
        .innerJoin(privateClientOrders, eq(privateClientOrders.id, cellarReleaseRequests.privateClientOrderId))
        .where(inArray(privateClientOrders.orderNumber, pcoNumbers))
    : [];
  const releaseOf = new Map(releases.map((row) => [row.pcoNumber, row.requestNumber]));
  /*
    Deliveries quoted before repacks moved to the monthly bill carry the repack
    on the release quote, and the member has paid it there. Billing them again
    here would charge twice.
  */
  const repackOnQuote = new Set(
    releases.filter((row) => (row.repackCostUsd ?? 0) > 0).map((row) => row.pcoNumber),
  );

  const groups = new Map<
    string,
    { ownerId: string; kind: 'delivery' | 'collection'; reference: string; at: Date; looseBottles: number }
  >();

  for (const row of movements) {
    if (!row.fromOwnerId) continue;
    let key: string;
    let kind: 'delivery' | 'collection';
    let reference: string;

    if (row.movementType === 'pick') {
      const delivery = row.orderId ? deliveries.get(row.orderId) : undefined;
      // Only the member's own delivery is theirs to pay for
      if (!delivery || delivery.ownerId !== row.fromOwnerId) continue;
      if (repackOnQuote.has(delivery.pcoNumber)) continue;
      key = `${row.fromOwnerId}|${delivery.pcoNumber}`;
      kind = 'delivery';
      const release = releaseOf.get(delivery.pcoNumber);
      reference = release ? `${release} · ${delivery.pcoNumber}` : delivery.pcoNumber;
    } else {
      const day = dubaiDay(row.performedAt);
      key = `${row.fromOwnerId}|collected|${day}`;
      kind = 'collection';
      reference = `Collected ${day}`;
    }

    const group = groups.get(key) ?? { ownerId: row.fromOwnerId, kind, reference, at: row.performedAt, looseBottles: 0 };
    group.looseBottles += looseBottlesOf(row);
    if (row.performedAt < group.at) group.at = row.performedAt;
    groups.set(key, group);
  }

  const byOwner = new Map<string, { reference: string; kind: string; at: Date; looseBottles: number; packages: number; aed: number }[]>();
  for (const group of groups.values()) {
    const { packages, aed } = repackCharge(group.looseBottles);
    if (packages === 0) continue;
    const lines = byOwner.get(group.ownerId) ?? [];
    lines.push({ reference: group.reference, kind: group.kind, at: group.at, looseBottles: group.looseBottles, packages, aed });
    byOwner.set(group.ownerId, lines);
  }

  return {
    month,
    members: [...byOwner.entries()]
      .map(([ownerId, lines]) => ({
        ownerId,
        name: nameOf.get(ownerId) ?? 'Unknown member',
        lines: lines.sort((a, b) => a.at.getTime() - b.at.getTime()),
        packages: lines.reduce((sum, line) => sum + line.packages, 0),
        aed: lines.reduce((sum, line) => sum + line.aed, 0),
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
};

export default getMonthlyRepacks;
