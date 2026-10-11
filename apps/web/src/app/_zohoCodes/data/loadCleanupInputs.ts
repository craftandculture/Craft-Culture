import { and, eq, gt, inArray, isNotNull, notInArray, sql } from 'drizzle-orm';

import INBOUND_SHIPMENT_STATUSES from '@/app/_wms/utils/inboundShipmentStatuses';
import lwinPakKey, { lwinPakKeyOf } from '@/app/_wms/utils/lwinPakKey';
import normalizeLwin18 from '@/app/_wms/utils/normalizeLwin18';
import db from '@/database/client';
import {
  logisticsShipmentItems,
  logisticsShipments,
  wmsStock,
  zohoSalesOrderItems,
  zohoSalesOrders,
} from '@/database/schema';
import { zohoFetch } from '@/lib/zoho/client';
import type { ZohoItem } from '@/lib/zoho/items';

import type { CleanupContext, CleanupItem } from '../utils/planSkuCleanup';

/** Orders past these have left the building; their items can retire */
const CLOSED = ['dispatched', 'delivered', 'cancelled'] as const;

/**
 * Every Zoho item, active and inactive
 *
 * Inactive items are read too: one may already hold the dashed code an
 * active item needs.
 */
const fetchAllZohoItems = async () => {
  const items: ZohoItem[] = [];
  for (let page = 1; page <= 50; page++) {
    const res = await zohoFetch<{ items: ZohoItem[]; page_context: { has_more_page: boolean } }>(
      `/items?page=${page}&per_page=200&filter_by=Status.All`,
    );
    items.push(...res.items);
    if (!res.page_context.has_more_page) break;
  }
  return items;
};

/**
 * What the cleanup plan reads: Zoho's items and the evidence against them
 *
 * Stock Explorer is the WMS stock table (lines with cases), keyed by exact
 * LWIN-18 for display and by wine-vintage-size for "held in any pack", since
 * a 3-pack item is sold off 6-pack stock. Inbound shipments count as held.
 *
 * @returns Items for the planner and its context
 */
const loadCleanupInputs = async () => {
  const [zohoItems, stock, inbound, openLines] = await Promise.all([
    fetchAllZohoItems(),
    db
      .select({
        lwin18: wmsStock.lwin18,
        name: sql<string>`max(${wmsStock.productName})`,
        cases: sql<number>`sum(${wmsStock.quantityCases})::int`,
        key: sql<string>`${lwinPakKey(wmsStock.lwin18)}`,
      })
      .from(wmsStock)
      .where(sql`${wmsStock.quantityCases} > 0 OR ${wmsStock.openBottles} > 0`)
      .groupBy(wmsStock.lwin18),
    db
      .selectDistinct({ lwin: logisticsShipmentItems.lwin })
      .from(logisticsShipmentItems)
      .innerJoin(logisticsShipments, eq(logisticsShipments.id, logisticsShipmentItems.shipmentId))
      .where(and(inArray(logisticsShipments.status, [...INBOUND_SHIPMENT_STATUSES]), isNotNull(logisticsShipmentItems.lwin))),
    db
      .selectDistinct({ zohoItemId: zohoSalesOrderItems.zohoItemId })
      .from(zohoSalesOrderItems)
      .innerJoin(zohoSalesOrders, eq(zohoSalesOrders.id, zohoSalesOrderItems.salesOrderId))
      .where(and(notInArray(zohoSalesOrders.status, [...CLOSED]), isNotNull(zohoSalesOrderItems.zohoItemId), gt(zohoSalesOrderItems.quantity, 0))),
  ]);

  const stockExplorer = new Map(stock.map((s) => [normalizeLwin18(s.lwin18), { name: s.name, cases: s.cases }]));
  const heldKeys = new Set(stock.map((s) => lwinPakKeyOf(normalizeLwin18(s.lwin18))));
  for (const row of inbound) if (row.lwin) heldKeys.add(lwinPakKeyOf(normalizeLwin18(row.lwin)));

  const items: CleanupItem[] = zohoItems.map((i) => ({
    itemId: i.item_id,
    name: i.name,
    sku: i.sku ?? '',
    status: i.status,
    stockOnHand: Number(i.stock_on_hand ?? 0),
    productType: i.product_type ?? null,
    createdTime: i.created_time ?? '',
  }));

  const ctx: CleanupContext = {
    stockExplorer,
    heldKeys,
    openOrderItemIds: new Set(openLines.map((l) => l.zohoItemId!).filter(Boolean)),
    newSince: new Date(Date.now() - 30 * 86_400_000).toISOString(),
  };

  return { items, ctx };
};

export default loadCleanupInputs;
