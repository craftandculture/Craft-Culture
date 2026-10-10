import { and, eq, gt, inArray, like, sql } from 'drizzle-orm';

import { wmsStock, wmsStockReservations, zohoSalesOrderItems } from '@/database/schema';

import inOurWarehouse from './inOurWarehouse';
import lwinPackAgnosticPattern from './lwinPackAgnosticPattern';
import normalizeLwin18 from './normalizeLwin18';
import rankStockByPack from './rankStockByPack';
import { readOrderedPackOrNull } from './readOrderedPack';

interface HoldShort {
  orderItemId: string;
  name: string;
  /** Bottles the line needs that could not be held */
  bottlesShort: number;
}

/**
 * Hold stock for every line of a Zoho sales order that is not already held
 *
 * The one place a sales order takes stock off "available". Before this, only
 * the scheduled sync held stock, and only for a brand-new order: the Sync
 * button held nothing, a line edited in Zoho lost its hold and never got it
 * back, and a held line was held again at release. So a wine on one order
 * still looked free to the next — Talbot went on Super Cellar's and City
 * Drinks' orders that way.
 *
 * Lines are matched the way release-to-pick and the pick itself match them:
 * pack-agnostic on the LWIN (a 3-pack is sold off a 6-pack), counted in
 * bottles, and held in whole cases of the pack the bay holds — so a few
 * bottles off a case hold that case, as release does, until the pick cracks
 * it. Lines already held are left alone; running it twice changes nothing.
 *
 * @example
 *   const { held, short } = await holdStockForSalesOrder({ db, orderId, orderNumber: 'SO-00140' });
 *
 * @param params.db - Drizzle handle (app or Trigger.dev)
 * @param params.orderId - zoho_sales_orders.id
 * @param params.orderNumber - The SO number, recorded on each hold
 * @returns Cases held, and the lines that could not be fully held
 */
const holdStockForSalesOrder = async ({
  db,
  orderId,
  orderNumber,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any;
  orderId: string;
  orderNumber: string;
}) => {
  const lines: {
    id: string;
    sku: string | null;
    lwin18: string | null;
    name: string;
    description: string | null;
    quantity: number;
    unit: string | null;
  }[] = await db
    .select({
      id: zohoSalesOrderItems.id,
      sku: zohoSalesOrderItems.sku,
      lwin18: zohoSalesOrderItems.lwin18,
      name: zohoSalesOrderItems.name,
      description: zohoSalesOrderItems.description,
      quantity: zohoSalesOrderItems.quantity,
      unit: zohoSalesOrderItems.unit,
    })
    .from(zohoSalesOrderItems)
    .where(eq(zohoSalesOrderItems.salesOrderId, orderId));

  if (!lines.length) return { held: 0, short: [] as HoldShort[] };

  const alreadyHeld: { orderItemId: string }[] = await db
    .select({ orderItemId: wmsStockReservations.orderItemId })
    .from(wmsStockReservations)
    .where(
      and(
        inArray(
          wmsStockReservations.orderItemId,
          lines.map((l) => l.id),
        ),
        eq(wmsStockReservations.status, 'active'),
      ),
    );
  const heldIds = new Set(alreadyHeld.map((r) => r.orderItemId));

  let held = 0;
  const short: HoldShort[] = [];

  for (const line of lines) {
    if (heldIds.has(line.id) || !(line.quantity > 0)) continue;

    const code = normalizeLwin18(line.lwin18 ?? line.sku ?? '');
    const pattern = lwinPackAgnosticPattern(code);
    if (!pattern) continue;

    const isBottleUnit = /^bottle/i.test((line.unit ?? '').trim());
    const statedPack = readOrderedPackOrNull(line.sku, line.description);

    const candidates: {
      id: string;
      lwin18: string;
      ownerId: string | null;
      productName: string;
      caseConfig: number | null;
      availableCases: number;
    }[] = await db
      .select({
        id: wmsStock.id,
        lwin18: wmsStock.lwin18,
        ownerId: wmsStock.ownerId,
        productName: wmsStock.productName,
        caseConfig: wmsStock.caseConfig,
        availableCases: wmsStock.availableCases,
      })
      .from(wmsStock)
      .where(
        and(
          like(wmsStock.lwin18, pattern),
          gt(wmsStock.availableCases, 0),
          eq(wmsStock.notForSale, false),
          inOurWarehouse(),
        ),
      );

    const packOf = (caseConfig: number | null) =>
      caseConfig && caseConfig > 0 ? caseConfig : (statedPack ?? 1);

    /*
      Bottles the line needs. A Cases line with no stated pack means the pack
      the stock is held in (see release-to-pick), so it is settled against the
      first bay, the best pack fit.
    */
    const ranked = rankStockByPack(candidates, statedPack ?? 1);
    const firstPack = packOf(ranked[0]?.caseConfig ?? null);
    const orderedPack = isBottleUnit ? 1 : (statedPack ?? firstPack);
    let bottlesLeft = isBottleUnit ? line.quantity : line.quantity * orderedPack;

    for (const stock of ranked) {
      if (bottlesLeft <= 0) break;

      const pack = packOf(stock.caseConfig);
      const cases = Math.min(Math.ceil(bottlesLeft / pack), stock.availableCases);
      if (cases <= 0) continue;

      // Guarded, so two orders holding at once cannot take the same case
      const [updated] = await db
        .update(wmsStock)
        .set({
          reservedCases: sql`${wmsStock.reservedCases} + ${cases}`,
          availableCases: sql`${wmsStock.availableCases} - ${cases}`,
          updatedAt: new Date(),
        })
        .where(and(eq(wmsStock.id, stock.id), sql`${wmsStock.availableCases} >= ${cases}`))
        .returning({ id: wmsStock.id });

      if (!updated) continue;

      await db.insert(wmsStockReservations).values({
        stockId: stock.id,
        ownerId: stock.ownerId,
        orderType: 'zoho',
        orderId,
        orderItemId: line.id,
        orderNumber,
        lwin18: stock.lwin18,
        productName: stock.productName,
        quantityCases: cases,
        status: 'active',
      });

      held += cases;
      bottlesLeft -= cases * pack;
    }

    if (bottlesLeft > 0) {
      short.push({ orderItemId: line.id, name: line.name, bottlesShort: bottlesLeft });
    }
  }

  return { held, short };
};

export default holdStockForSalesOrder;
