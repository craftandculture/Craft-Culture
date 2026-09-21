import { TRPCError } from '@trpc/server';
import { and, eq, gt, ilike, like, ne, sql } from 'drizzle-orm';

import db from '@/database/client';
import {
  wmsLocations,
  wmsPickListItems,
  wmsPickLists,
  wmsStock,
  wmsStockMovements,
  wmsStockReservations,
} from '@/database/schema';
import { wmsOperatorProcedure } from '@/lib/trpc/procedures';

import { pickItemSchema } from '../schemas/pickListSchema';
import convertReservationToPick from '../utils/convertReservationToPick';
import generateMovementNumber from '../utils/generateMovementNumber';
import lwinPackAgnosticPattern from '../utils/lwinPackAgnosticPattern';
import moveBottlesToSingles from '../utils/moveBottlesToSingles';
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

    let candidates = await db
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

    // Last resort: the product name AT THIS BAY. Lines released before their
    // wine had a usable code carry an empty or drifted LWIN, and no code can
    // ever match — the operator is standing at the right bay being told the
    // stock doesn't exist. Only trusted when every significant word matches and
    // the hits are all the same wine, so a lookalike cuvée is never picked.
    if (candidates.length === 0) {
      const terms = pickListItem.productName
        .replace(/_/g, ' ')
        .replace(
          /\(\s*(?:single bottle|single|\d+\s*(?:x|pack|packs|bottles?|btl))\s*\)/gi,
          ' ',
        )
        .split(/[\s,\-]+/)
        .filter((term) => term.length > 2 && !/^(19|20)\d{2}$/.test(term))
        .slice(0, 8);

      if (terms.length > 0) {
        /*
    Match the producer and the product name together.

    A Zoho line names the wine the way a customer reads it — "Compass Box
    CRIMSON CASKS Blended Malt Scottish Whiskey" — while the shelf holds the
    producer in its own column and the name as "CRIMSON CASKS Blended Malt
    Scottish Whiskey". Requiring every word against product_name alone meant
    "Compass" and "Box" could never match, so an operator standing at the right
    bay with the bottle in hand was told there was no stock. Every producer-
    prefixed line failed this way.
  */
        const byName = await db
          .select()
          .from(wmsStock)
          .where(
            and(
              eq(wmsStock.locationId, pickedFromLocationId),
              ...terms.map((term) =>
                ilike(
                  sql`coalesce(${wmsStock.producer}, '') || ' ' || ${wmsStock.productName}`,
                  `%${term.replace(/[^\x20-\x7E]/g, '%')}%`,
                ),
              ),
            ),
          );

        const distinctWines = new Set(
          byName.map((row) => row.lwin18.split('-')[0]).filter(Boolean),
        );
        if (distinctWines.size === 1) candidates = byName;
      }
    }

    if (candidates.length === 0) {
      // Say what the system DOES know. "No stock found here" leaves an operator
      // holding a bottle with nowhere to go; "it's at C-02-00" or "the system
      // thinks there are none of these anywhere" tells them what to do next.
      // Deliberately informational — nothing below is ever picked from.
      const elsewhere = packPattern
        ? await db
            .select({
              productName: wmsStock.productName,
              quantityCases: wmsStock.quantityCases,
              locationCode: wmsLocations.locationCode,
            })
            .from(wmsStock)
            .leftJoin(wmsLocations, eq(wmsLocations.id, wmsStock.locationId))
            .where(like(wmsStock.lwin18, packPattern))
        : [];

      const withStock = elsewhere.filter((row) => row.quantityCases > 0);

      if (withStock.length > 0) {
        const where = withStock
          .map((row) => `${row.locationCode ?? '—'} (${row.quantityCases} cs)`)
          .join(', ');
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `${pickListItem.productName} is not at ${location.locationCode}. The system holds it at ${where}.`,
        });
      }

      if (elsewhere.length > 0) {
        const last = elsewhere[0];
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: `The system shows 0 cases of ${last?.productName ?? pickListItem.productName} anywhere (last held at ${last?.locationCode ?? 'an unknown bay'}). The count needs correcting before this line can be picked.`,
        });
      }

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
        /*
          Physical cases, for the same reason the whole-case branch below uses
          them: availableCases excludes cases reserved for THIS order, so a
          bottle line whose stock was set aside at approval could satisfy
          nothing. Every row failed, selection fell through to the empty
          singles row left by an earlier crack, and the picker was told the
          shelf held 0 cases and 0 loose bottles while a full case sat in the
          bay. The reservation is converted below, not stepped around.
        */
        return row.quantityCases >= casesToCrack;
      }
      if (linePack > 0 && packOf(row) !== linePack) return false;
      // Physical cases, not unreserved ones — see the whole-case branch below.
      return row.quantityCases >= pickedQuantity;
    };

    // Rank by pack fit, then take the first that can actually satisfy the pick.
    // On a bottle pick, prefer a pack the request divides into exactly: 9
    // bottles off 3-packs cracks three whole cases, off 6-packs it cracks two
    // and strands 3 loose bottles on the shelf.
    const ranked = rankStockByPack(
      candidates,
      isBottlePick ? pickedBottles : linePack || 1,
    );
    const usable = ranked.filter(canSatisfy);
    const cleanest = isBottlePick
      ? usable.find(
          (row) =>
            row.openBottles >= pickedBottles || pickedBottles % packOf(row) === 0,
        )
      : undefined;
    const stock = cleanest ?? usable[0] ?? ranked[0];

    if (!stock) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: `No stock found at this location for ${pickListItem.productName}`,
      });
    }

    /*
      Nothing here can cover the pick, so say what IS here.

      Falling through to the best-ranked row meant reporting that row's counts,
      and the best-ranked row for a bottle pick is often an emptied singles row
      — hence "0 case(s), 0 loose bottle(s)" told to a picker looking straight
      at a full case of the same wine. Add up every row for this wine in the
      bay instead.
    */
    if (usable.length === 0) {
      const onShelf = ranked.reduce(
        (sum, row) => sum + row.quantityCases * packOf(row) + row.openBottles,
        0,
      );
      const needed = isBottlePick ? pickedBottles : pickedQuantity * (linePack || 1);

      /*
        Where the rest of it is, if the system knows.

        Short at this bay is only half an answer — the picker is standing in
        the aisle and the next question is always "so where do I walk". Same
        pack-agnostic net used when nothing matched here at all, minus this
        bay, because a split leaves the same wine spread across several.
      */
      const otherBays = packPattern
        ? await db
            .select({
              bottles: sql<number>`(${wmsStock.quantityCases} * COALESCE(${wmsStock.caseConfig}, 12)) + ${wmsStock.openBottles}`,
              locationCode: wmsLocations.locationCode,
            })
            .from(wmsStock)
            .leftJoin(wmsLocations, eq(wmsLocations.id, wmsStock.locationId))
            .where(
              and(
                like(wmsStock.lwin18, packPattern),
                ne(wmsStock.locationId, pickedFromLocationId),
                gt(wmsStock.quantityCases, 0),
              ),
            )
        : [];

      const alsoAt = otherBays
        .filter((row) => row.bottles > 0)
        .map((row) => `${row.locationCode ?? '—'} (${row.bottles} btl)`)
        .join(', ');

      throw new TRPCError({
        code: 'BAD_REQUEST',
        message:
          `Not enough at ${location.locationCode} for ${pickListItem.productName}. ` +
          `Need ${needed} bottle(s); the system holds ${onShelf} here across ${ranked.length} row(s).` +
          (alsoAt
            ? ` Also held at ${alsoAt}.`
            : ' The system holds none of it anywhere else — the count needs correcting.'),
      });
    }

    const pack = stock.caseConfig ?? 12;

    // How many sealed cases this pick removes, and what to store on the line.
    let casesRemoved: number;
    let recordedPickedQuantity: number;
    let resultMessage: string;
    /*
      The single-bottle row left behind when a case is cracked.

      Surfaced because the bottles it represents are PHYSICALLY still in the
      case they came out of, wearing that case's label. The system now says
      1x75cl and the box on the shelf says 3x75cl, and the next person to read
      it believes the box. So the screen has to be able to offer a new label,
      which it cannot do without knowing the row was made.
    */
    let remainderStockId: string | null = null;

    // Cases held for THIS order are pickable; cases held for another order
    // are not. convertReservationToPick caps the unreserved portion at
    // availableCases, so without this check the line would be marked picked
    // and a movement recorded while the stock was never decremented.
    const [heldForThisOrder] = await db
      .select({
        cases: sql<number>`COALESCE(SUM(${wmsStockReservations.quantityCases}), 0)::int`,
        ownerId: sql<string | null>`MAX(${wmsStockReservations.ownerId}::text)`,
      })
      .from(wmsStockReservations)
      .where(
        and(
          eq(wmsStockReservations.stockId, stock.id),
          eq(wmsStockReservations.orderId, pickList.orderId ?? ''),
          eq(wmsStockReservations.status, 'active'),
        ),
      );

    /*
      The wine was set aside when it belonged to someone else.

      A reservation binds to a stock row, and ownership of that row can move
      underneath it. Picking anyway would ship this owner's wine against an
      order reserved from another's, and settle the proceeds to the wrong
      partner. Older reservations carry no owner, so those are let through
      rather than blocking a warehouse that has done nothing wrong.
    */
    if (
      heldForThisOrder?.ownerId &&
      heldForThisOrder.ownerId !== stock.ownerId
    ) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: `This stock has changed owner since it was reserved. It is now held for ${stock.ownerName}. Re-reserve the order before picking it.`,
      });
    }

    if (isBottlePick) {
      // --- Split-case (bottle) pick ---
      // Draw from already-open bottles first, then crack sealed cases as needed.
      const takeFromOpen = Math.min(pickedBottles, stock.openBottles);
      const shortfallBottles = pickedBottles - takeFromOpen;
      casesRemoved = Math.ceil(shortfallBottles / pack);

      if (stock.quantityCases < casesRemoved) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Not enough at ${location.locationCode} to pick ${pickedBottles} bottle(s). On the shelf: ${stock.quantityCases} case(s), ${stock.openBottles} loose bottle(s).`,
        });
      }

      // Same rule as a whole-case pick: this order's own hold is pickable,
      // another order's is not.
      const pickableCases = stock.availableCases + (heldForThisOrder?.cases ?? 0);

      if (pickableCases < casesRemoved) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `${stock.quantityCases} case(s) are at ${location.locationCode} but reserved for another order. Free them there, or pick from a different bay.`,
        });
      }

      // Bottles left over once this pick is taken. They become REAL single
      // bottle stock rather than an open_bottles counter nothing else reads —
      // see moveBottlesToSingles for why that counter made stock invisible.
      const leftover = stock.openBottles + casesRemoved * pack - pickedBottles;

      /*
        Cracking a reserved case goes through the same conversion a whole-case
        pick uses.

        Decrementing availableCases by hand here double-counted every reserved
        case: availableCases had already been reduced when the order was
        approved, so subtracting again drove it negative, and reservedCases was
        left pointing at a case that had physically gone. That is the residue
        behind bays reading as held with nothing holding them.
      */
      if (casesRemoved > 0) {
        await convertReservationToPick({
          stockId: stock.id,
          orderId: pickList.orderId ?? '',
          quantityCases: casesRemoved,
          db,
        });
      }

      await db
        .update(wmsStock)
        .set({
          // Whatever this row was carrying loose has been moved into singles.
          openBottles: 0,
          updatedAt: new Date(),
        })
        .where(eq(wmsStock.id, stock.id));

      const singlesId =
        pack > 1
          ? await moveBottlesToSingles({
              sourceStockId: stock.id,
              bottles: leftover,
              performedBy: userId,
              db,
            })
          : null;

      remainderStockId = singlesId;

      // A pick straight off a singles row leaves nothing over to move.
      if (!singlesId && leftover > 0 && pack === 1) {
        await db
          .update(wmsStock)
          .set({
            quantityCases: sql`${wmsStock.quantityCases} + ${leftover}`,
            availableCases: sql`${wmsStock.availableCases} + ${leftover}`,
            updatedAt: new Date(),
          })
          .where(eq(wmsStock.id, stock.id));
      }

      recordedPickedQuantity = pickedBottles;
      resultMessage =
        `Picked ${pickedBottles} bottle(s) from ${location.locationCode}` +
        (casesRemoved > 0 ? `, cracked ${casesRemoved} case(s)` : '') +
        (singlesId ? `; ${leftover} single bottle(s) back on the shelf` : '');
    } else {
      // --- Whole-case pick ---
      // Gate on what is PHYSICALLY in the bay. availableCases excludes reserved
      // cases — including the ones reserved for THIS order when it was
      // approved — so checking it meant an operator could never pick the stock
      // that had been set aside for the order they were picking. The
      // reservation is converted below rather than blocking the pick.
      if (stock.quantityCases < pickedQuantity) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Insufficient stock at ${location.locationCode}. On the shelf: ${stock.quantityCases} case(s), requested: ${pickedQuantity}.`,
        });
      }

      const pickable = stock.availableCases + (heldForThisOrder?.cases ?? 0);
      if (pickable < pickedQuantity) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `${stock.quantityCases} case(s) are at ${location.locationCode} but reserved for another order. Free them there, or pick from a different bay.`,
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
      // What physically left the shelf. A split-case pick removes 0 whole
      // cases, so cases alone reads as nothing having moved.
      quantityBottles: isBottlePick ? pickedBottles : casesRemoved * pack,
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

    /*
      What the picker now has to relabel.

      Read back rather than assembled from what we just wrote, so the label
      carries the row as it actually stands — the singles row is merged into an
      existing one where the bay already held singles, and its count is then
      the total on the shelf, not the bottles from this case alone.
    */
    const [remainder] = remainderStockId
      ? await db
          .select({
            stockId: wmsStock.id,
            lwin18: wmsStock.lwin18,
            productName: wmsStock.productName,
            bottles: wmsStock.quantityCases,
            locationCode: wmsLocations.locationCode,
          })
          .from(wmsStock)
          .leftJoin(wmsLocations, eq(wmsStock.locationId, wmsLocations.id))
          .where(eq(wmsStock.id, remainderStockId))
      : [];

    return {
      success: true,
      item: updatedItem,
      message: resultMessage,
      /*
        Null on an ordinary pick. Present when a case was cracked, and then the
        shelf is carrying a box whose printed pack is now wrong.
      */
      remainder: remainder ?? null,
    };
  });

export default adminPickItem;
