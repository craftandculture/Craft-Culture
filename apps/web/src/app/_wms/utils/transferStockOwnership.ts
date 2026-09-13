import { TRPCError } from '@trpc/server';
import { and, eq, sql } from 'drizzle-orm';

import {
  partners,
  wmsStock,
  wmsStockMovements,
  wmsStockReservations,
} from '@/database/schema';

import generateMovementNumber from './generateMovementNumber';

export interface TransferStockOwnershipParams {
  /** An open transaction — ownership must move atomically with its ledger row */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx: any;
  stockId: string;
  newOwnerId: string;
  quantityCases: number;
  salesArrangement?: 'consignment' | 'purchased';
  consignmentCommissionPercent?: number;
  notes?: string;
  /** 'admin_transfer' | 'pool_sale' — why the wine changed hands */
  reasonCode?: string;
  /** The pool sale this transfer belongs to, when there is one */
  orderId?: string;
  performedBy: string;
  /**
   * Move wine that is reserved against someone's order.
   *
   * Refused by default. An admin may override, but the reservation then points
   * at stock its order no longer owns, so this is a deliberate act.
   */
  allowReservedTransfer?: boolean;
}

/**
 * Move beneficial ownership of stock from one partner to another
 *
 * The wine does not move. Legal title to imported goods stays with C&C
 * throughout — what changes here is which partner holds the economic interest
 * in a parcel, which is the record the warehouse, the price lists and every
 * settlement read.
 *
 * **This is the only code that may mutate `wmsStock.ownerId`.** It was
 * previously inlined in one admin controller, which is how it came to carry
 * several defects that nothing else could see: a partial transfer that raised a
 * unique violation, a merge branch that was dead for null lots, and a full
 * transfer that silently re-owned wine already promised to somebody's order.
 *
 * Takes a transaction rather than opening one, so a caller can move ownership
 * and write the sale that caused it without either being able to land alone.
 *
 * @example
 *   await db.transaction(async (tx) =>
 *     transferStockOwnership({ tx, stockId, newOwnerId, quantityCases: 2, performedBy: user.id }),
 *   );
 *
 * @param params - What moves, to whom, and on whose authority
 * @returns The ledger row and the stock row the wine now sits in
 */
const transferStockOwnership = async ({
  tx,
  stockId,
  newOwnerId,
  quantityCases,
  salesArrangement,
  consignmentCommissionPercent,
  notes,
  reasonCode = 'admin_transfer',
  orderId,
  performedBy,
  allowReservedTransfer = false,
}: TransferStockOwnershipParams) => {
  const [sourceStock] = await tx
    .select()
    .from(wmsStock)
    .where(eq(wmsStock.id, stockId))
    .limit(1);

  if (!sourceStock) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Stock record not found',
    });
  }

  /*
    Transferring wine to the partner who already owns it writes a meaningless
    ledger row and, on the partial branch, duplicates the stock outright. Only
    the transfer page's UI checked for this; the stock explorer did not.
  */
  if (sourceStock.ownerId === newOwnerId) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'That partner already owns this stock.',
    });
  }

  if (sourceStock.availableCases < quantityCases) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `Insufficient available stock. Available: ${sourceStock.availableCases}, requested: ${quantityCases}`,
    });
  }

  const [newOwner] = await tx
    .select()
    .from(partners)
    .where(eq(partners.id, newOwnerId))
    .limit(1);

  if (!newOwner) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'New owner partner not found',
    });
  }

  /*
    A reservation binds an order to a stock row, not to an owner. Re-owning a
    row underneath a live reservation does not break the order — it quietly
    ships somebody else's wine and settles to the wrong partner.
  */
  const activeReservations = await tx
    .select({ orderNumber: wmsStockReservations.orderNumber })
    .from(wmsStockReservations)
    .where(
      and(
        eq(wmsStockReservations.stockId, stockId),
        eq(wmsStockReservations.status, 'active'),
      ),
    );

  if (activeReservations.length > 0 && !allowReservedTransfer) {
    const orders = [
      ...new Set(
        activeReservations
          .map((row: { orderNumber: string | null }) => row.orderNumber)
          .filter(Boolean),
      ),
    ].join(', ');

    throw new TRPCError({
      code: 'CONFLICT',
      message: `This stock is reserved against ${orders || 'an open order'}. Release the reservation before transferring it.`,
    });
  }

  const movementNumber = await generateMovementNumber();

  /*
    A row carrying reserved cases cannot take the full-transfer branch even when
    the case counts match, because that branch re-owns the row in place and the
    reservation would travel with it.
  */
  const isFullTransfer =
    sourceStock.quantityCases === quantityCases &&
    sourceStock.reservedCases === 0;

  let destinationStockId = stockId;

  if (isFullTransfer) {
    await tx
      .update(wmsStock)
      .set({
        ownerId: newOwnerId,
        ownerName: newOwner.businessName,
        salesArrangement: salesArrangement ?? sourceStock.salesArrangement,
        consignmentCommissionPercent:
          consignmentCommissionPercent ??
          sourceStock.consignmentCommissionPercent,
        updatedAt: new Date(),
      })
      .where(eq(wmsStock.id, stockId));
  } else {
    await tx
      .update(wmsStock)
      .set({
        quantityCases: sql`${wmsStock.quantityCases} - ${quantityCases}`,
        availableCases: sql`${wmsStock.availableCases} - ${quantityCases}`,
        updatedAt: new Date(),
      })
      .where(eq(wmsStock.id, stockId));

    /*
      Keyed the way receiving keys it — wine, place, owner. The previous lookup
      also compared lot numbers with `=`, which is NULL-unsafe, so for the great
      majority of stock (which carries no lot) the merge branch could never
      match and every partial transfer tried to insert. A differing lot is
      recorded on the movement rather than expressed as a second stock row.
    */
    const [existingStock] = await tx
      .select()
      .from(wmsStock)
      .where(
        and(
          eq(wmsStock.locationId, sourceStock.locationId),
          eq(wmsStock.lwin18, sourceStock.lwin18),
          eq(wmsStock.ownerId, newOwnerId),
        ),
      )
      .limit(1);

    if (existingStock) {
      await tx
        .update(wmsStock)
        .set({
          quantityCases: sql`${wmsStock.quantityCases} + ${quantityCases}`,
          availableCases: sql`${wmsStock.availableCases} + ${quantityCases}`,
          updatedAt: new Date(),
        })
        .where(eq(wmsStock.id, existingStock.id));

      destinationStockId = existingStock.id;
    } else {
      const [created] = await tx
        .insert(wmsStock)
        .values({
          locationId: sourceStock.locationId,
          ownerId: newOwnerId,
          ownerName: newOwner.businessName,
          lwin18: sourceStock.lwin18,
          supplierSku: sourceStock.supplierSku,
          productName: sourceStock.productName,
          producer: sourceStock.producer,
          vintage: sourceStock.vintage,
          bottleSize: sourceStock.bottleSize,
          caseConfig: sourceStock.caseConfig,
          quantityCases,
          reservedCases: 0,
          availableCases: quantityCases,
          /*
            Deliberately not carried. Open bottles belong to a specific case
            somebody physically cracked, and that case stays on the source row.
            Copying the count here would invent bottles that do not exist.
          */
          openBottles: 0,
          lotNumber: sourceStock.lotNumber,
          receivedAt: sourceStock.receivedAt,
          shipmentId: sourceStock.shipmentId,
          /* The customs trail of the goods is unaffected by who owns them. */
          reExportBoeNumber: sourceStock.reExportBoeNumber,
          salesArrangement: salesArrangement ?? sourceStock.salesArrangement,
          /*
            Carried, not cleared. Changing who owns wine is the moment it might
            genuinely become ours to sell, but that has to be said out loud —
            inferring it here would quietly list a client's cellar the first
            time it moved between owners.
          */
          notForSale: sourceStock.notForSale,
          consignmentCommissionPercent:
            consignmentCommissionPercent ??
            sourceStock.consignmentCommissionPercent,
          notes: sourceStock.notes,
          photos: sourceStock.photos,
          category: sourceStock.category,
          expiryDate: sourceStock.expiryDate,
          isPerishable: sourceStock.isPerishable,
        })
        .returning({ id: wmsStock.id });

      destinationStockId = created?.id ?? stockId;
    }
  }

  const [movement] = await tx
    .insert(wmsStockMovements)
    .values({
      movementNumber,
      movementType: 'ownership_transfer',
      lwin18: sourceStock.lwin18,
      supplierSku: sourceStock.supplierSku,
      productName: sourceStock.productName,
      quantityCases,
      quantityBottles: quantityCases * (sourceStock.caseConfig ?? 1),
      fromLocationId: sourceStock.locationId,
      /* The wine does not move. Only the name against it changes. */
      toLocationId: sourceStock.locationId,
      fromOwnerId: sourceStock.ownerId,
      toOwnerId: newOwnerId,
      lotNumber: sourceStock.lotNumber,
      shipmentId: sourceStock.shipmentId,
      orderId,
      reasonCode,
      notes,
      performedBy,
      performedAt: new Date(),
    })
    .returning();

  return {
    movement,
    movementId: movement?.id as string | undefined,
    destinationStockId,
    sourceStock,
    newOwner,
  };
};

export default transferStockOwnership;
