import { and, asc, eq, gt, inArray, sql } from 'drizzle-orm';

import inOurWarehouse from '@/app/_wms/utils/inOurWarehouse';
import lwinPakKey from '@/app/_wms/utils/lwinPakKey';
import db from '@/database/client';
import { saleMandateLots, saleMandates, wmsStock } from '@/database/schema';

import { COMMITTING_STATUSES } from '../utils/mandateStatuses';

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
 * 2. **C&C's own stock before a member's.** We are not obliged to sell a
 *    member's wine ahead of our own, and settling a consignment is work.
 * 3. **Oldest mandate first**, so a member who has waited longest sells first.
 *
 * Allocation happens when the order is placed, not when it is paid, because
 * that is what the reservation is taken against.
 *
 * @param lwin18 - The wine being bought
 * @param cases - How many cases
 * @param buyerPartnerId - Who is buying, so their own stock is skipped
 * @returns Parcels totalling the requested cases, or fewer if there are not enough
 */
const allocateParcels = async (
  lwin18: string,
  cases: number,
  buyerPartnerId: string,
): Promise<AllocatedParcel[]> => {
  /*
    Pack-agnostic, matching the catalogue. A member buying "a case" of a wine
    the catalogue lists once may be served from a 6-pack or a 12-pack row, and
    the row carries its own caseConfig so the bottle count stays honest.
  */
  const rows = await db
    .select({
      id: wmsStock.id,
      ownerId: wmsStock.ownerId,
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
    .where(
      and(
        sql`${lwinPakKey(wmsStock.lwin18)} = ${lwinPakKey(sql`${lwin18}`)}`,
        gt(wmsStock.availableCases, 0),
        eq(wmsStock.notForSale, false),
        inOurWarehouse(),
      ),
    )
    .orderBy(asc(wmsStock.createdAt));

  const sellable = rows.filter((row) => row.ownerId !== buyerPartnerId);

  if (sellable.length === 0) return [];

  /*
    Which of these parcels belong to a live mandate, and which mandate. A
    parcel with no mandate is C&C's own supply and settles to nobody.
  */
  const lots = await db
    .select({
      lotId: saleMandateLots.id,
      stockId: saleMandateLots.stockId,
      mandateId: saleMandates.id,
      offeredAt: saleMandates.offeredAt,
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

  const ordered = [...sellable].sort((a, b) => {
    const aLot = lotByStock.get(a.id);
    const bLot = lotByStock.get(b.id);

    // C&C's own stock first: no mandate means nothing to settle.
    if (!aLot && bLot) return -1;
    if (aLot && !bLot) return 1;

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

    const take = Math.min(remaining, row.availableCases);

    if (take <= 0) continue;

    const lot = lotByStock.get(row.id);

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
