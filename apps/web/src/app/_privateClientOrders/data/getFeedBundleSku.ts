import { and, desc, eq, sql } from 'drizzle-orm';

import db from '@/database/client';
import { consOutlets, consSnapshots, partners } from '@/database/schema';

/**
 * What the distributor's own latest feed says this order's bundle SKU is
 *
 * Read-only: used to show where a typed SKU disagrees with the distributor's
 * system, or to offer the feed's SKU. Null when the distributor has no feed,
 * or the feed has no (or no single) bundle for this PCO.
 *
 * @param orderNumber - The PCO number, which is the bundle's product name
 * @param distributorId - The order's distributor, or null when unassigned
 * @returns The feed's SKU and reference, or null
 */
const getFeedBundleSku = async (orderNumber: string, distributorId: string | null) => {
  // Unassigned orders are looked up in the outlet whose distributor uses SKUs
  const [outlet] = await db
    .select({ id: consOutlets.id })
    .from(consOutlets)
    .innerJoin(partners, eq(consOutlets.partnerId, partners.id))
    .where(
      distributorId
        ? eq(consOutlets.partnerId, distributorId)
        : eq(partners.requiresOrderSku, true),
    )
    .limit(1);

  if (!outlet) return null;

  const [latest] = await db
    .select({ takenAt: consSnapshots.takenAt })
    .from(consSnapshots)
    .where(eq(consSnapshots.outletId, outlet.id))
    .orderBy(desc(consSnapshots.takenAt))
    .limit(1);

  if (!latest) return null;

  const rows = await db
    .selectDistinct({ sku: consSnapshots.outletCode, ref: consSnapshots.ourCode })
    .from(consSnapshots)
    .where(
      and(
        eq(consSnapshots.outletId, outlet.id),
        eq(consSnapshots.takenAt, latest.takenAt),
        eq(consSnapshots.regime, 'bought'),
        sql`UPPER(TRIM(${consSnapshots.productName})) = ${orderNumber.toUpperCase()}`,
      ),
    );

  return rows.length === 1 ? rows[0]! : null;
};

export default getFeedBundleSku;
