import { and, asc, eq, gt, inArray, sql } from 'drizzle-orm';

import isCraftCultureOwner from '@/app/_wms/utils/isCraftCultureOwner';
import lwinPakKey from '@/app/_wms/utils/lwinPakKey';
import onPriceListConditions from '@/app/_wms/utils/onPriceListConditions';
import db from '@/database/client';
import {
  cellarMemberships,
  partners,
  saleMandateLots,
  saleMandates,
  wmsStock,
  wmsStockReservations,
} from '@/database/schema';

import { COMMITTING_STATUSES } from '../utils/mandateStatuses';

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export interface AllocationRequest {
  lwin18: string;
  cases: number;
}

export interface AllocatedParcel {
  stockId: string;
  sellerPartnerId: string | null;
  mandateId: string | null;
  mandateLotId: string | null;
  cases: number;
  caseConfig: number;
  lwin18: string;
  productName: string;
  producer: string | null;
  vintage: number | null;
  bottleSize: string | null;
}

/**
 * Choose which parcels fill an order
 *
 * The catalogue shows one line per wine with the quantity summed across every
 * owner, so a buyer picks a wine and something else has to pick the parcel.
 * Getting this wrong sells the wrong person's wine.
 *
 * The order is deliberate:
 *
 * 1. **Never the buyer's own stock.** Buying wine you already own is a no-op
 *    that `transferStockOwnership` would refuse anyway, but refusing it here
 *    means the quantity a buyer sees is the quantity they can actually buy.
 * 2. **C&C's own stock, then a partner's, then a member's offer.** We are not
 *    obliged to sell anyone's wine ahead of our own, and each later step is a
 *    settlement to write.
 * 3. **Oldest mandate first**, so a member who has waited longest sells first.
 *
 * Any row on the price lists can fill an order, whoever owns it — the rule
 * Kevin set on 18 October 2026, so Available now and the trade and
 * private-client lists are one list — except a member's own wine, which only
 * ever sells through their offer. Who it settles to is decided when the
 * payment is confirmed: C&C's own owes nobody, a member's offer settles at
 * their ask, and anyone else's is owed at its landed cost.
 *
 * Allocation happens when the order is placed, not when it is paid, because
 * that is what the reservation is taken against.
 *
 * Three limits keep it from selling what is not ours to sell:
 *
 * - **Live holds.** A cellar purchase's reservation does not decrement
 *   `availableCases`, so every active `cellar_purchase` hold on a row is
 *   subtracted here. Without it two members reserve the same case.
 * - **The offer, not the row.** Listing a mandate opens the whole stock row,
 *   but only the bottles still on the lot are for sale. A member who offers 2
 *   of 10 cases sells 2.
 * - **A member's wine sells only through their offer.** A collector row with no
 *   live lot — wine they bought, or what is left after their offer sold — is
 *   theirs, not a partner's consignment, and is never allocated.
 *
 * Pass the purchase's transaction so the rows are locked until the holds are
 * written; two buyers then queue rather than both seeing the same case free.
 *
 * @param lwin18 - The wine being bought
 * @param cases - How many cases
 * @param buyerPartnerId - Who is buying, so their own stock is skipped
 * @param executor - The open transaction, so the rows are locked
 * @returns Parcels totalling the requested cases, or fewer if there are not enough
 */
const allocateParcels = async (
  lwin18: string,
  cases: number,
  buyerPartnerId: string,
  executor: Tx | typeof db = db,
): Promise<AllocatedParcel[]> => {
  /*
    Pack-agnostic, matching the catalogue. A member buying "a case" of a wine
    the catalogue lists once may be served from a 6-pack or a 12-pack row, and
    the row carries its own caseConfig so the bottle count stays honest.
  */
  const rows = await executor
    .select({
      id: wmsStock.id,
      ownerId: wmsStock.ownerId,
      /*
        A collector is anyone filed as one or holding a membership: legacy
        members were filed as wine partners before the collector type existed.
      */
      isCollector: sql<boolean>`(${partners.type} = 'private_collector' OR EXISTS (SELECT 1 FROM ${cellarMemberships} WHERE ${cellarMemberships.partnerId} = ${wmsStock.ownerId}))`,
      ownerName: wmsStock.ownerName,
      availableCases: wmsStock.availableCases,
      caseConfig: wmsStock.caseConfig,
      lwin18: wmsStock.lwin18,
      productName: wmsStock.productName,
      producer: wmsStock.producer,
      vintage: wmsStock.vintage,
      bottleSize: wmsStock.bottleSize,
    })
    .from(wmsStock)
    .leftJoin(partners, eq(wmsStock.ownerId, partners.id))
    .where(
      and(
        sql`${lwinPakKey(wmsStock.lwin18)} = ${lwinPakKey(sql`${lwin18}`)}`,
        /* Exactly the rows the price lists count, so what is listed can be filled */
        ...onPriceListConditions(),
      ),
    )
    .orderBy(asc(wmsStock.createdAt))
    .for('update', { of: wmsStock });

  const sellable = rows.filter((row) => row.ownerId !== buyerPartnerId);

  if (sellable.length === 0) return [];

  /*
    Which of these parcels belong to a live mandate, and which mandate. A
    parcel with no mandate is C&C's own supply and settles to nobody.
  */
  const lots = await executor
    .select({
      lotId: saleMandateLots.id,
      stockId: saleMandateLots.stockId,
      mandateId: saleMandates.id,
      offeredAt: saleMandates.offeredAt,
      bottlesRemaining: saleMandateLots.bottlesRemaining,
    })
    .from(saleMandateLots)
    .innerJoin(saleMandates, eq(saleMandateLots.mandateId, saleMandates.id))
    .where(
      and(
        inArray(
          saleMandateLots.stockId,
          sellable.map((row) => row.id),
        ),
        inArray(saleMandates.status, [...COMMITTING_STATUSES]),
        gt(saleMandateLots.bottlesRemaining, 0),
      ),
    );

  const lotByStock = new Map(lots.map((lot) => [lot.stockId, lot]));

  const holds = await executor
    .select({
      stockId: wmsStockReservations.stockId,
      cases: sql<number>`sum(${wmsStockReservations.quantityCases})::int`,
    })
    .from(wmsStockReservations)
    .where(
      and(
        inArray(
          wmsStockReservations.stockId,
          sellable.map((row) => row.id),
        ),
        eq(wmsStockReservations.orderType, 'cellar_purchase'),
        eq(wmsStockReservations.status, 'active'),
      ),
    )
    .groupBy(wmsStockReservations.stockId);

  const heldByStock = new Map(
    holds.map((hold) => [hold.stockId, Number(hold.cases) || 0]),
  );

  /*
    C&C's own stock first, because it settles to nobody. Then a partner's
    consignment, settled at its landed cost. Members' offers last, oldest first.
  */
  const rank = (row: (typeof sellable)[number]) =>
    lotByStock.has(row.id) ? 2 : isCraftCultureOwner(row.ownerName) ? 0 : 1;

  const ordered = [...sellable].sort((a, b) => {
    const aLot = lotByStock.get(a.id);
    const bLot = lotByStock.get(b.id);

    if (rank(a) !== rank(b)) return rank(a) - rank(b);

    if (aLot && bLot) {
      const aTime = aLot.offeredAt?.getTime() ?? 0;
      const bTime = bLot.offeredAt?.getTime() ?? 0;

      if (aTime !== bTime) return aTime - bTime;
    }

    return 0;
  });

  const allocation: AllocatedParcel[] = [];
  let remaining = cases;

  for (const row of ordered) {
    if (remaining <= 0) break;

    const lot = lotByStock.get(row.id);

    /*
      A member's wine sells only through an offer. Their row can still read as
      for sale once an offer has sold through, and selling the remainder as if
      it were a partner's consignment would sell wine they never offered.
    */
    if (!lot && row.isCollector) continue;

    const held = heldByStock.get(row.id) ?? 0;
    const free = row.availableCases - held;
    const offered = lot
      ? Math.floor(lot.bottlesRemaining / Math.max(row.caseConfig ?? 1, 1)) -
        held
      : free;

    const take = Math.min(remaining, free, offered);

    if (take <= 0) continue;

    allocation.push({
      stockId: row.id,
      sellerPartnerId: row.ownerId,
      mandateId: lot?.mandateId ?? null,
      mandateLotId: lot?.lotId ?? null,
      cases: take,
      caseConfig: row.caseConfig ?? 1,
      lwin18: row.lwin18,
      productName: row.productName,
      producer: row.producer,
      vintage: row.vintage,
      bottleSize: row.bottleSize,
    });

    remaining -= take;
  }

  return allocation;
};

export default allocateParcels;
