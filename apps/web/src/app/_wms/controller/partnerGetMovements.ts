import { and, desc, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { users, wmsLocations, wmsStockMovements } from '@/database/schema';
import { winePartnerProcedure } from '@/lib/trpc/procedures';

import partnerMovementScope from '../utils/partnerMovementScope';

/**
 * What a partner is shown.
 *
 * Pallet handling is left out: it is how the warehouse organises itself, not
 * something that happened to the wine. Ownership transfers are left out too —
 * they are a commercial matter, not a stock movement.
 */
const PARTNER_VISIBLE_TYPES = [
  'receive',
  'putaway',
  'transfer',
  'pick',
  'repack_in',
  'repack_out',
  'adjust',
  'count',
  'dispatch',
] as const;

type PartnerVisibleType = (typeof PARTNER_VISIBLE_TYPES)[number];

/**
 * A partner's own stock movements: what arrived, moved bay, was picked or went.
 *
 * Attribution is the whole difficulty. Movements carry `fromOwnerId`/
 * `toOwnerId`, but only an ownership transfer ever sets them — a pick, a
 * receipt, a bay transfer and a repack all leave them null. Scoping on those
 * columns alone would show a partner nothing but ownership changes, which is
 * the one thing they already know about.
 *
 * So a movement is theirs when it concerns a wine they own and nobody else
 * does. 768 of 777 products on file have a single owner, so this covers
 * essentially the whole ledger. For the handful a second owner also holds, only
 * movements explicitly stamped with this partner are shown: two owners of one
 * wine cannot be told apart from the movement row, and showing another owner's
 * depletion as yours is worse than showing nothing.
 *
 * Depleted wines are included deliberately — a wine that has gone is exactly
 * the one a partner is trying to account for, and it no longer appears in their
 * stock list.
 *
 * @param input - Optional wine, type filter and page
 * @returns The partner's movements, newest first, with who and where
 */
const partnerGetMovements = winePartnerProcedure
  .input(
    z.object({
      /** Narrow to one wine, for the history under a stock row. */
      lwin18: z.string().optional(),
      movementTypes: z.array(z.enum(PARTNER_VISIBLE_TYPES)).optional(),
      limit: z.number().min(1).max(200).default(50),
      offset: z.number().min(0).default(0),
    }),
  )
  .query(async ({ input, ctx: { partner } }) => {
    const scope = await partnerMovementScope(partner.id);

    if (scope.ownedLwins.length === 0) {
      // Same shape as the answer below, so a caller has one thing to read.
      return { movements: [], hasMore: false, sharedWineCount: 0 };
    }

    const mine = scope.condition;

    const filters = and(
      mine,
      inArray(
        wmsStockMovements.movementType,
        (input.movementTypes?.length
          ? input.movementTypes
          : PARTNER_VISIBLE_TYPES) as unknown as PartnerVisibleType[],
      ),
      input.lwin18 ? eq(wmsStockMovements.lwin18, input.lwin18) : undefined,
    );

    const fromLocation = db
      .select({ id: wmsLocations.id, code: wmsLocations.locationCode })
      .from(wmsLocations)
      .as('from_location');
    const toLocation = db
      .select({ id: wmsLocations.id, code: wmsLocations.locationCode })
      .from(wmsLocations)
      .as('to_location');

    const rows = await db
      .select({
        id: wmsStockMovements.id,
        movementNumber: wmsStockMovements.movementNumber,
        movementType: wmsStockMovements.movementType,
        productName: wmsStockMovements.productName,
        lwin18: wmsStockMovements.lwin18,
        quantityCases: wmsStockMovements.quantityCases,
        quantityBottles: wmsStockMovements.quantityBottles,
        fromLocation: fromLocation.code,
        toLocation: toLocation.code,
        notes: wmsStockMovements.notes,
        reasonCode: wmsStockMovements.reasonCode,
        performedAt: wmsStockMovements.performedAt,
        performedByName: users.name,
      })
      .from(wmsStockMovements)
      .leftJoin(fromLocation, eq(wmsStockMovements.fromLocationId, fromLocation.id))
      .leftJoin(toLocation, eq(wmsStockMovements.toLocationId, toLocation.id))
      .leftJoin(users, eq(wmsStockMovements.performedBy, users.id))
      .where(filters)
      .orderBy(desc(wmsStockMovements.performedAt))
      .limit(input.limit + 1)
      .offset(input.offset);

    const hasMore = rows.length > input.limit;

    return {
      movements: hasMore ? rows.slice(0, input.limit) : rows,
      hasMore,
      /** Wines held with another owner, whose unstamped history is withheld. */
      sharedWineCount: scope.sharedWineCount,
    };
  });

export default partnerGetMovements;
