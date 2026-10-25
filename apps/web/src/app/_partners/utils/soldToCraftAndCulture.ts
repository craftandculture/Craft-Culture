import { sql } from 'drizzle-orm';

import { wmsStockMovements } from '@/database/schema';

/**
 * A movement that handed an owner's bottles to Craft & Culture itself
 *
 * When C&C buys an owner's wine, ownership moves to C&C before it is sold on
 * (Ihab Toma's Montille Monthélie, 20 Oct 2026). To the owner that is a sale
 * to C&C at their price, not a transfer, so statements, the timeline and the
 * agreed-price count all read it with this one test.
 *
 * @example
 *   db.select().from(wmsStockMovements).where(and(eq(wmsStockMovements.fromOwnerId, id), soldToCraftAndCulture));
 */
const soldToCraftAndCulture = sql`(
  ${wmsStockMovements.movementType} = 'ownership_transfer'
  AND ${wmsStockMovements.toOwnerId} IS DISTINCT FROM ${wmsStockMovements.fromOwnerId}
  AND ${wmsStockMovements.toOwnerId} IN (
    SELECT id FROM partners WHERE business_name ILIKE 'craft%culture%'
  )
)`;

export default soldToCraftAndCulture;
