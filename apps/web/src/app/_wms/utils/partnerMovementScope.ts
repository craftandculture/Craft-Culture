import { eq, inArray, or, sql } from 'drizzle-orm';

import db from '@/database/client';
import { wmsStock, wmsStockMovements } from '@/database/schema';

/**
 * Which stock movements belong to a partner.
 *
 * Movements carry `fromOwnerId`/`toOwnerId`, but only an ownership transfer
 * ever sets them — a pick, a receipt, a bay transfer and a repack all leave
 * them null. Scoping on those columns alone shows a partner nothing but
 * ownership changes, which is the one thing they already know.
 *
 * So a movement is theirs when it concerns a wine they own and nobody else
 * does. Nearly every product on file has a single owner, so this covers
 * essentially the whole ledger. For the handful a second owner also holds,
 * only movements explicitly stamped with this partner count: two owners of one
 * wine cannot be told apart from the movement row, and showing another owner's
 * depletion as yours is worse than showing nothing.
 *
 * Defined once because two screens ask it — the stock ledger and the activity
 * log — and a second copy would drift into showing a partner someone else's
 * wine.
 *
 * @param partnerId - The wine partner
 * @returns A condition for `wms_stock_movements`, and what had to be withheld
 */
const partnerMovementScope = async (partnerId: string) => {
  const owned = await db
    .selectDistinct({ lwin18: wmsStock.lwin18 })
    .from(wmsStock)
    .where(eq(wmsStock.ownerId, partnerId));

  const ownedLwins = owned.map((row) => row.lwin18);

  if (ownedLwins.length === 0) {
    return { condition: sql`false`, sharedWineCount: 0, ownedLwins };
  }

  const shared = await db
    .select({ lwin18: wmsStock.lwin18 })
    .from(wmsStock)
    .where(inArray(wmsStock.lwin18, ownedLwins))
    .groupBy(wmsStock.lwin18)
    .having(sql`COUNT(DISTINCT ${wmsStock.ownerId}) > 1`);

  const sharedLwins = new Set(shared.map((row) => row.lwin18));
  const exclusive = ownedLwins.filter((lwin) => !sharedLwins.has(lwin));

  const clauses = [
    eq(wmsStockMovements.fromOwnerId, partnerId),
    eq(wmsStockMovements.toOwnerId, partnerId),
  ];

  if (exclusive.length > 0) {
    clauses.push(
      sql`(${wmsStockMovements.lwin18} IN ${exclusive}
           AND ${wmsStockMovements.fromOwnerId} IS NULL
           AND ${wmsStockMovements.toOwnerId} IS NULL)`,
    );
  }

  return {
    condition: or(...clauses),
    sharedWineCount: sharedLwins.size,
    ownedLwins,
  };
};

export default partnerMovementScope;
