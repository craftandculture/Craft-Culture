import { and, desc, eq, gt, like, sql } from 'drizzle-orm';

import type { wmsStock as wmsStockTable } from '@/database/schema';
import { wmsStock, wmsStockReservations } from '@/database/schema';

interface ReservationItem {
  orderItemId: string;
  lwin18: string;
  productName: string;
  quantityCases: number;
}

interface ReserveStockParams {
  orderType: 'zoho' | 'pco';
  orderId: string;
  orderNumber: string;
  items: ReservationItem[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any;
}

interface ReservedResult {
  orderItemId: string;
  stockId: string;
  lwin18: string;
  productName: string;
  quantityReserved: number;
}

interface ShortResult {
  orderItemId: string;
  lwin18: string;
  productName: string;
  quantityRequested: number;
  quantityReserved: number;
  shortQuantity: number;
}

/**
 * Reserve WMS stock for a set of order items
 *
 * Matches items to wmsStock by LWIN18 (exact or prefix match),
 * creates reservation records, and decrements availableCases.
 * Handles split allocation across multiple stock records.
 *
 * @example
 *   const result = await reserveStockForOrderItems({
 *     orderType: 'zoho',
 *     orderId: 'uuid',
 *     orderNumber: 'SO-0012',
 *     items: [{ orderItemId: 'uuid', lwin18: '1010279-2015-06-00750', productName: 'Wine', quantityCases: 5 }],
 *     db,
 *   });
 */
const reserveStockForOrderItems = async ({
  orderType,
  orderId,
  orderNumber,
  items,
  db,
}: ReserveStockParams) => {
  const reserved: ReservedResult[] = [];
  const short: ShortResult[] = [];

  for (const item of items) {
    // Skip if already reserved (idempotent)
    const existingReservations = await db
      .select({ id: wmsStockReservations.id })
      .from(wmsStockReservations)
      .where(
        and(
          eq(wmsStockReservations.orderItemId, item.orderItemId),
          eq(wmsStockReservations.status, 'active'),
        ),
      );

    if (existingReservations.length > 0) {
      continue;
    }

    let remaining = item.quantityCases;
    let totalReserved = 0;

    // Strategy 1: Exact LWIN18 match
    const stockRecords: Array<typeof wmsStockTable.$inferSelect> = await db
      .select()
      .from(wmsStock)
      .where(
        and(eq(wmsStock.lwin18, item.lwin18), gt(wmsStock.availableCases, 0)),
      )
      .orderBy(desc(wmsStock.availableCases));

    // Strategy 2: Prefix match (for short LWINs like LWIN7/LWIN11)
    if (stockRecords.length === 0 && item.lwin18.length < 18) {
      const prefixMatches: Array<typeof wmsStockTable.$inferSelect> = await db
        .select()
        .from(wmsStock)
        .where(
          and(
            like(wmsStock.lwin18, `${item.lwin18}%`),
            gt(wmsStock.availableCases, 0),
          ),
        )
        .orderBy(desc(wmsStock.availableCases));

      stockRecords.push(...prefixMatches);
    }

    // Reserve across stock records until fulfilled
    for (const stock of stockRecords) {
      if (remaining <= 0) break;

      const toReserve = Math.min(remaining, stock.availableCases);

      // Atomic update with guard
      const [updated] = await db
        .update(wmsStock)
        .set({
          reservedCases: sql`${wmsStock.reservedCases} + ${toReserve}`,
          availableCases: sql`${wmsStock.availableCases} - ${toReserve}`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(wmsStock.id, stock.id),
            sql`${wmsStock.availableCases} >= ${toReserve}`,
          ),
        )
        .returning({ id: wmsStock.id });

      if (!updated) continue; // Race condition — another process reserved first

      // Create reservation record
      await db.insert(wmsStockReservations).values({
        stockId: stock.id,
        orderType,
        orderId,
        orderItemId: item.orderItemId,
        orderNumber,
        lwin18: stock.lwin18,
        productName: item.productName,
        quantityCases: toReserve,
        status: 'active',
      });

      reserved.push({
        orderItemId: item.orderItemId,
        stockId: stock.id,
        lwin18: stock.lwin18,
        productName: item.productName,
        quantityReserved: toReserve,
      });

      remaining -= toReserve;
      totalReserved += toReserve;
    }

    // Track shortages
    if (remaining > 0) {
      short.push({
        orderItemId: item.orderItemId,
        lwin18: item.lwin18,
        productName: item.productName,
        quantityRequested: item.quantityCases,
        quantityReserved: totalReserved,
        shortQuantity: remaining,
      });
    }
  }

  return { reserved, short };
};

export default reserveStockForOrderItems;
