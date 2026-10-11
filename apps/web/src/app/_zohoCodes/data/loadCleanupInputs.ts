import { and, eq, gt, gte, inArray, isNotNull, ne, notInArray, sql } from 'drizzle-orm';

import INBOUND_SHIPMENT_STATUSES from '@/app/_wms/utils/inboundShipmentStatuses';
import { lwinPakKeyOf } from '@/app/_wms/utils/lwinPakKey';
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
import { getInvoice, listInvoices } from '@/lib/zoho/invoices';
import type { ZohoItem } from '@/lib/zoho/items';
import { getSalesOrder, listSalesOrders } from '@/lib/zoho/salesOrders';

import loadCustomsDetails from './loadCustomsDetails';
import parseZohoSku from '../utils/parseZohoSku';
import type { CleanupContext, CleanupItem, StockExplorerLine } from '../utils/planSkuCleanup';

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
 * Items on draft sales orders and draft invoices, read live
 *
 * Drafts are never synced, and an inactive item on a draft stops it being
 * sent or converted, so they are read from Zoho one by one.
 */
const fetchDraftItemIds = async () => {
  const ids = new Set<string>();
  const [sos, invs] = await Promise.all([
    listSalesOrders({ status: 'draft', perPage: 200 }),
    listInvoices({ status: 'draft', perPage: 200 }),
  ]);
  const loaders = [
    ...(sos.salesOrders ?? []).map((s) => () => getSalesOrder(s.salesorder_id)),
    ...(invs.invoices ?? []).map((i) => () => getInvoice(i.invoice_id)),
  ];
  // One at a time: Zoho rate-limits bursts
  for (const load of loaders) {
    const doc = await load();
    for (const line of doc.line_items ?? []) if (line.item_id) ids.add(line.item_id);
  }
  return ids;
};

/**
 * What the cleanup plan reads: Zoho's items and the evidence against them
 *
 * Stock Explorer is the WMS stock table (lines with cases), keyed by exact
 * LWIN-18 — the code each Zoho item should carry — and by wine-vintage-size
 * for "held in any pack", since a 3-pack is sold off 6-pack stock. Inbound
 * shipments count as held. Open documents are undispatched synced sales
 * orders plus every draft read live. Zoho's stock count is not read: Stock
 * Explorer is the stock record.
 *
 * @returns Items for the planner and its context
 */
const loadCleanupInputs = async () => {
  const [zohoItems, stock, inbound, openLines, draftItemIds, recentLines] = await Promise.all([
    fetchAllZohoItems(),
    db
      .select({
        lwin18: wmsStock.lwin18,
        productName: sql<string>`max(${wmsStock.productName})`,
        producer: sql<string | null>`max(${wmsStock.producer})`,
        vintage: sql<number | null>`max(${wmsStock.vintage})`,
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
    fetchDraftItemIds(),
    db
      .selectDistinct({ zohoItemId: zohoSalesOrderItems.zohoItemId })
      .from(zohoSalesOrderItems)
      .innerJoin(zohoSalesOrders, eq(zohoSalesOrders.id, zohoSalesOrderItems.salesOrderId))
      .where(
        and(
          gte(zohoSalesOrders.orderDate, new Date(Date.now() - 90 * 86_400_000)),
          ne(zohoSalesOrders.status, 'cancelled'),
          isNotNull(zohoSalesOrderItems.zohoItemId),
        ),
      ),
  ]);

  const stockExplorer = new Map<string, StockExplorerLine>();
  for (const s of stock) {
    const lwin18 = normalizeLwin18(s.lwin18);
    // Only codes in the dashed Stock Explorer shape can become Zoho SKUs
    if (parseZohoSku(lwin18).form !== 'dashed') continue;
    stockExplorer.set(lwin18, { lwin18, productName: s.productName, producer: s.producer, vintage: s.vintage });
  }
  const heldKeys = new Set(stock.map((s) => lwinPakKeyOf(normalizeLwin18(s.lwin18))));
  for (const row of inbound) if (row.lwin) heldKeys.add(lwinPakKeyOf(normalizeLwin18(row.lwin)));

  const items: CleanupItem[] = zohoItems.map((i) => ({
    itemId: i.item_id,
    name: i.name,
    sku: i.sku ?? '',
    status: i.status,
    productType: i.product_type ?? null,
    createdTime: i.created_time ?? '',
    upc: i.upc ?? null,
    isbn: i.isbn ?? null,
  }));

  const customs = await loadCustomsDetails([
    ...stockExplorer.keys(),
    ...items.filter((i) => i.status === 'active' && parseZohoSku(i.sku).form === 'dashed').map((i) => i.sku.trim().toUpperCase()),
  ]);

  const ctx: CleanupContext = {
    customs,
    stockExplorer,
    heldKeys,
    openItemIds: new Set([...openLines.map((l) => l.zohoItemId!).filter(Boolean), ...draftItemIds]),
    recentlySoldItemIds: new Set(recentLines.map((l) => l.zohoItemId!).filter(Boolean)),
    newSince: new Date(Date.now() - 30 * 86_400_000).toISOString(),
  };

  return { items, ctx };
};

export default loadCleanupInputs;
