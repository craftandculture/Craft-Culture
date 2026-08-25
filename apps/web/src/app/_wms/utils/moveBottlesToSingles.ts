import { and, eq, isNull, sql } from 'drizzle-orm';

import { wmsStock, wmsStockMovements } from '@/database/schema';

import generateMovementNumber from './generateMovementNumber';

interface MoveBottlesParams {
  /** The stock row the case was cracked from. */
  sourceStockId: string;
  /** Bottles left over once the pick was taken. */
  bottles: number;
  /** Who cracked the case — the movement needs an author. */
  performedBy: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any;
}

/**
 * Turn the remainder of a cracked case into real single-bottle stock.
 *
 * Cracking a 6-pack to fill a one-bottle order used to leave the other five in
 * an `open_bottles` counter on the case row. Nothing else in the WMS reads that
 * counter: stock is modelled in CASES, so those five bottles had no case count,
 * disappeared from the stock explorer, could not be matched to an order line,
 * counted as zero in every bottle total, and could not be reserved. The wine was
 * on the shelf and invisible to the system.
 *
 * Singles are instead recorded the way the warehouse already records them — a
 * stock row whose pack is 1 (`…-01-…`, `caseConfig` 1), the same shape as the
 * single-bottle rows that arrive from a repack. Every case-based query, view,
 * reservation and pick then works on them unchanged.
 *
 * The row is created at the same bay, owner and lot as the case it came from,
 * so nothing about ownership or traceability moves.
 *
 * @example
 *   await moveBottlesToSingles({ sourceStockId, bottles: 5, db: tx });
 *   // 5 x `1104695-2015-01-00750` at the same bay; case row keeps 0 open bottles
 *
 * @param sourceStockId - The stock row the case was cracked from
 * @param bottles - How many loose bottles remain
 * @param db - Drizzle handle (use the surrounding transaction)
 * @returns The id of the single-bottle stock row, or null when there was
 *   nothing to move or the source LWIN can't carry a pack segment
 */
const moveBottlesToSingles = async ({
  sourceStockId,
  bottles,
  performedBy,
  db,
}: MoveBottlesParams) => {
  if (bottles <= 0) return null;

  const [source] = await db
    .select()
    .from(wmsStock)
    .where(eq(wmsStock.id, sourceStockId));

  if (!source) return null;

  const parts = String(source.lwin18).split('-');
  if (parts.length !== 4) return null;

  const singlesLwin18 = `${parts[0]}-${parts[1]}-01-${parts[3]}`;

  // Already singles — the bottles belong where they are.
  if (singlesLwin18 === source.lwin18) return null;

  const singlesName = `${String(source.productName).replace(/ \(\d+x\)$/, '')} (1x)`;

  const [existing] = await db
    .select({ id: wmsStock.id })
    .from(wmsStock)
    .where(
      and(
        eq(wmsStock.locationId, source.locationId),
        eq(wmsStock.lwin18, singlesLwin18),
        eq(wmsStock.ownerId, source.ownerId),
        source.lotNumber === null
          ? isNull(wmsStock.lotNumber)
          : eq(wmsStock.lotNumber, source.lotNumber),
      ),
    );

  // The ledger has to see these bottles arrive. Without a movement they are an
  // "orphan" stock record — and the reconciliation's auto-fix DELETES those.
  const recordArrival = async () => {
    await db.insert(wmsStockMovements).values({
      movementNumber: await generateMovementNumber(),
      movementType: 'repack_in' as const,
      lwin18: singlesLwin18,
      productName: singlesName,
      quantityCases: bottles,
      quantityBottles: bottles,
      toLocationId: source.locationId,
      lotNumber: source.lotNumber,
      shipmentId: source.shipmentId,
      notes: `Loose bottles from a cracked ${source.caseConfig ?? '?'}-pack of ${source.lwin18}`,
      reasonCode: 'split_case',
      performedBy,
      performedAt: new Date(),
    });
  };

  if (existing) {
    await db
      .update(wmsStock)
      .set({
        quantityCases: sql`${wmsStock.quantityCases} + ${bottles}`,
        availableCases: sql`${wmsStock.availableCases} + ${bottles}`,
        updatedAt: new Date(),
      })
      .where(eq(wmsStock.id, existing.id));
    await recordArrival();
    return existing.id;
  }

  const [created] = await db
    .insert(wmsStock)
    .values({
      locationId: source.locationId,
      ownerId: source.ownerId,
      ownerName: source.ownerName,
      lwin18: singlesLwin18,
      productName: singlesName,
      producer: source.producer,
      vintage: source.vintage,
      bottleSize: source.bottleSize,
      caseConfig: 1,
      quantityCases: bottles,
      reservedCases: 0,
      availableCases: bottles,
      openBottles: 0,
      lotNumber: source.lotNumber,
      receivedAt: source.receivedAt,
      shipmentId: source.shipmentId,
      salesArrangement: source.salesArrangement,
      // Repacking wine does not make it ours to sell.
      notForSale: source.notForSale,
      consignmentCommissionPercent: source.consignmentCommissionPercent,
      category: source.category,
      expiryDate: source.expiryDate,
      isPerishable: source.isPerishable,
      reExportBoeNumber: source.reExportBoeNumber,
    })
    .returning({ id: wmsStock.id });

  await recordArrival();

  return created?.id ?? null;
};

export default moveBottlesToSingles;
