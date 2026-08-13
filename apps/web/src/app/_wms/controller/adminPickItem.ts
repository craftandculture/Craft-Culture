import { TRPCError } from '@trpc/server';
import { and, eq, like, sql } from 'drizzle-orm';

import db from '@/database/client';
import {
  wmsLocations,
  wmsPickListItems,
  wmsPickLists,
  wmsStock,
  wmsStockMovements,
} from '@/database/schema';
import { wmsOperatorProcedure } from '@/lib/trpc/procedures';

import { pickItemSchema } from '../schemas/pickListSchema';
import convertReservationToPick from '../utils/convertReservationToPick';
import generateMovementNumber from '../utils/generateMovementNumber';
import lwinPackAgnosticPattern from '../utils/lwinPackAgnosticPattern';
import parseSkuPack from '../utils/parseSkuPack';
import rankStockByPack from '../utils/rankStockByPack';

/**
 * Mark a pick list item as picked and update stock
 * Records a movement and decrements available stock
 *
 * @example
 *   await trpcClient.wms.admin.picking.pickItem.mutate({
 *     pickListItemId: "uuid",
 *     pickedFromLocationId: "location-uuid",
 *     pickedQuantity: 5
 *   });
 */
const adminPickItem = wmsOperatorProcedure
  .input(pickItemSchema)
  .mutation(async ({ input, ctx }) => {
    const { pickListItemId, pickedFromLocationId, pickedQuantity, pickedBottles, notes } =
      input;

    // Get user ID from context (adminProcedure guarantees ctx.user exists)
    const userId = ctx.user.id;

    // Get pick list item
    const [pickListItem] = await db
      .select({
        id: wmsPickListItems.id,
        pickListId: wmsPickListItems.pickListId,
        lwin18: wmsPickListItems.lwin18,
        productName: wmsPickListItems.productName,
        quantityCases: wmsPickListItems.quantityCases,
        isPicked: wmsPickListItems.isPicked,
      })
      .from(wmsPickListItems)
      .where(eq(wmsPickListItems.id, pickListItemId));

    if (!pickListItem) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Pick list item not found',
      });
    }

    if (pickListItem.isPicked) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Item already picked',
      });
    }

    // Get the pick list
    const [pickList] = await db
      .select()
      .from(wmsPickLists)
      .where(eq(wmsPickLists.id, pickListItem.pickListId));

    if (!pickList) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Pick list not found',
      });
    }

    if (pickList.status === 'completed' || pickList.status === 'cancelled') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `Cannot pick from a ${pickList.status} pick list`,
      });
    }

    // Verify location exists
    const [location] = await db
      .select()
      .from(wmsLocations)
      .where(eq(wmsLocations.id, pickedFromLocationId));

    if (!location) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Location not found',
      });
    }

    const isBottlePick = pickedBottles != null;

    // Find this wine at the location. The pick line snapshots the LWIN it was
    // released against, but the shelf moves on — a 6-pack repacked into 3-packs
    // becomes `…-03-…` and the line's `…-06-…` row is left at zero. Matching the
    // exact code alone reports "insufficient stock" while the wine is in the
    // operator's hand, so every pack of the same wine and bottle size at this
    // bay is a candidate.
    const packPattern = lwinPackAgnosticPattern(pickListItem.lwin18);

    const candidates = await db
      .select()
      .from(wmsStock)
      .where(
        and(
          eq(wmsStock.locationId, pickedFromLocationId),
          packPattern
            ? like(wmsStock.lwin18, packPattern)
            : eq(wmsStock.lwin18, pickListItem.lwin18),
        ),
      );

    if (candidates.length === 0) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: `No stock found at this location for ${pickListItem.productName}`,
      });
    }

    const packOf = (row: (typeof candidates)[number]) => row.caseConfig ?? 12;

    // The pack the line was released against — a WHOLE-CASE pick must come from
    // that same pack, or "1 case" would quietly deliver a different bottle
    // count. A bottle pick has no such constraint: bottles are bottles.
    const linePack = parseSkuPack(pickListItem.lwin18)?.pack ?? 0;

    const canSatisfy = (row: (typeof candidates)[number]) => {
      if (isBottlePick) {
        const fromOpen = Math.min(pickedBottles, row.openBottles);
        const casesToCrack = Math.ceil((pickedBottles - fromOpen) / packOf(row));
        return row.availableCases >= casesToCrack;
      }
      if (linePack > 0 && packOf(row) !== linePack) return false;
      return row.availableCases >= pickedQuantity;
    };

    // Rank by pack fit, then take the first that can actually satisfy the pick:
    // for 3 bottles, a 3-pack leaves nothing open where a 6-pack leaves three.
    const ranked = rankStockByPack(
      candidates,
      isBottlePick ? pickedBottles : linePack || 1,
    );
    const stock = ranked.find(canSatisfy) ?? ranked[0];

    if (!stock) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: `No stock found at this location for ${pickListItem.productName}`,
      });
    }

    const pack = stock.caseConfig ?? 12;

    // How many sealed cases this pick removes, and what to store on the line.
    let casesRemoved: number;
    let recordedPickedQuantity: number;
    let resultMessage: string;

    if (isBottlePick) {
      // --- Split-case (bottle) pick ---
      // Draw from already-open bottles first, then crack sealed cases as needed.
      const takeFromOpen = Math.min(pickedBottles, stock.openBottles);
      const shortfallBottles = pickedBottles - takeFromOpen;
      casesRemoved = Math.ceil(shortfallBottles / pack);

      if (stock.availableCases < casesRemoved) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Insufficient stock to pick ${pickedBottles} bottle(s). Open bottles: ${stock.openBottles}, sealed cases: ${stock.availableCases}`,
        });
      }

      // New open count: existing open + bottles freed by cracking − bottles picked.
      const newOpenBottles =
        stock.openBottles + casesRemoved * pack - pickedBottles;

      await db
        .update(wmsStock)
        .set({
          quantityCases: sql`${wmsStock.quantityCases} - ${casesRemoved}`,
          availableCases: sql`${wmsStock.availableCases} - ${casesRemoved}`,
          openBottles: newOpenBottles,
          updatedAt: new Date(),
        })
        .where(eq(wmsStock.id, stock.id));

      recordedPickedQuantity = pickedBottles;
      resultMessage =
        `Picked ${pickedBottles} bottle(s) from ${location.locationCode}` +
        (casesRemoved > 0 ? `, cracked ${casesRemoved} case(s)` : '') +
        `; ${newOpenBottles} open bottle(s) remain`;
    } else {
      // --- Whole-case pick (unchanged behaviour) ---
      if (stock.availableCases < pickedQuantity) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Insufficient stock. Available: ${stock.availableCases}, requested: ${pickedQuantity}`,
        });
      }

      await convertReservationToPick({
        stockId: stock.id,
        orderId: pickList.orderId ?? '',
        quantityCases: pickedQuantity,
        db,
      });

      casesRemoved = pickedQuantity;
      recordedPickedQuantity = pickedQuantity;
      resultMessage = `Picked ${pickedQuantity} cases from ${location.locationCode}`;
    }

    // Update pick list item
    const [updatedItem] = await db
      .update(wmsPickListItems)
      .set({
        pickedFromLocationId,
        pickedQuantity: recordedPickedQuantity,
        pickedAt: new Date(),
        pickedBy: userId,
        isPicked: true,
        notes,
        updatedAt: new Date(),
      })
      .where(eq(wmsPickListItems.id, pickListItemId))
      .returning();

    // Record movement
    const movementNumber = await generateMovementNumber();
    await db.insert(wmsStockMovements).values({
      movementNumber,
      movementType: 'pick',
      // The code actually taken off the shelf, which may be a repacked pack
      // rather than the one the line was released against.
      lwin18: stock.lwin18,
      productName: pickListItem.productName,
      quantityCases: casesRemoved,
      fromLocationId: pickedFromLocationId,
      orderId: pickList.orderId,
      notes: isBottlePick
        ? `Pick list ${pickList.pickListNumber} — ${pickedBottles} bottle(s) (split-case)`
        : `Pick list ${pickList.pickListNumber}`,
      performedBy: userId,
      performedAt: new Date(),
    });

    // Update pick list status and counts
    const newPickedCount = pickList.pickedItems + 1;
    const newStatus =
      pickList.status === 'pending' ? 'in_progress' : pickList.status;

    await db
      .update(wmsPickLists)
      .set({
        pickedItems: newPickedCount,
        status: newStatus,
        startedAt: pickList.startedAt ?? new Date(),
        updatedAt: new Date(),
      })
      .where(eq(wmsPickLists.id, pickList.id));

    return {
      success: true,
      item: updatedItem,
      message: resultMessage,
    };
  });

export default adminPickItem;
