import { and, desc, eq, gt, gte, inArray, isNotNull, isNull, ne, notInArray, sql } from 'drizzle-orm';

import INBOUND_SHIPMENT_STATUSES from '@/app/_wms/utils/inboundShipmentStatuses';
import { lwinPakKeyOf } from '@/app/_wms/utils/lwinPakKey';
import normalizeLwin18 from '@/app/_wms/utils/normalizeLwin18';
import db from '@/database/client';
import {
  logisticsShipmentItems,
  logisticsShipments,
  wmsStock,
  zohoItemChanges,
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
 * Draft documents already read, by id, with the edit time they were read at
 *
 * Kept for the life of the server instance, so opening the plan again only
 * re-reads drafts edited since; an unchanged draft costs no Zoho call.
 */
const draftCache = new Map<string, { modified: string; number: string; itemIds: string[] }>();

/** Gap between Zoho detail calls, keeping well under its ~100 calls a minute */
const ZOHO_CALL_GAP_MS = 650;

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Items on draft sales orders and draft invoices, read live
 *
 * Drafts are never synced, and an inactive item on a draft stops it being
 * sent or converted, so they are read from Zoho. Each draft is read once and
 * re-read only when Zoho reports it edited since, and the reads are spaced out
 * so a long list of drafts does not trip Zoho's rate limit.
 */
const fetchDraftItemIds = async () => {
  const ids = new Map<string, string[]>();
  const [sos, invs] = await Promise.all([
    listSalesOrders({ status: 'draft', perPage: 200 }),
    listInvoices({ status: 'draft', perPage: 200 }),
  ]);
  const drafts = [
    ...(sos.salesOrders ?? []).map((s) => ({
      id: `so:${s.salesorder_id}`,
      modified: s.last_modified_time ?? '',
      load: () => getSalesOrder(s.salesorder_id),
    })),
    ...(invs.invoices ?? []).map((i) => ({
      id: `inv:${i.invoice_id}`,
      modified: i.last_modified_time ?? '',
      load: () => getInvoice(i.invoice_id),
    })),
  ];

  let calls = 0;
  for (const draft of drafts) {
    let read = draftCache.get(draft.id);
    if (!read || !draft.modified || read.modified !== draft.modified) {
      if (calls > 0) await pause(ZOHO_CALL_GAP_MS);
      calls += 1;
      const doc = await draft.load();
      read = {
        modified: draft.modified,
        number: `${'salesorder_number' in doc ? doc.salesorder_number : doc.invoice_number} (draft)`,
        itemIds: (doc.line_items ?? []).map((line) => line.item_id).filter((id): id is string => Boolean(id)),
      };
      if (draft.modified) draftCache.set(draft.id, read);
    }
    for (const itemId of read.itemIds) ids.set(itemId, [...(ids.get(itemId) ?? []), read.number]);
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
      .selectDistinct({ zohoItemId: zohoSalesOrderItems.zohoItemId, number: zohoSalesOrders.salesOrderNumber, status: zohoSalesOrders.status })
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
    // Only codes in the exact dashed Stock Explorer shape can become Zoho SKUs;
    // a malformed one ("rentW4301023-…") is fixed in Stock Explorer, not copied
    if (!/^[A-Z0-9]+-\d{4}-\d{2}-\d{5}$/.test(lwin18)) continue;
    stockExplorer.set(lwin18, { lwin18, productName: s.productName, producer: s.producer, vintage: s.vintage });
  }
  const heldKeys = new Set(stock.map((s) => lwinPakKeyOf(normalizeLwin18(s.lwin18))));
  for (const row of inbound) if (row.lwin) heldKeys.add(lwinPakKeyOf(normalizeLwin18(row.lwin)));

  // Zoho's item list leaves out UPC and ISBN, so what this tool already wrote
  // is read back from its own log rather than offered again
  const written = await db
    .selectDistinctOn([zohoItemChanges.zohoItemId], { zohoItemId: zohoItemChanges.zohoItemId, details: zohoItemChanges.afterDetails })
    .from(zohoItemChanges)
    .where(and(inArray(zohoItemChanges.action, ['create', 'set_customs']), isNull(zohoItemChanges.undoneAt), isNotNull(zohoItemChanges.afterDetails)))
    .orderBy(zohoItemChanges.zohoItemId, desc(zohoItemChanges.createdAt));
  const writtenDetails = new Map(written.map((w) => [w.zohoItemId, w.details]));

  const items: CleanupItem[] = zohoItems.map((i) => ({
    itemId: i.item_id,
    name: i.name,
    sku: i.sku ?? '',
    status: i.status,
    productType: i.product_type ?? null,
    createdTime: i.created_time ?? '',
    upc: i.upc ?? writtenDetails.get(i.item_id)?.upc ?? null,
    isbn: i.isbn ?? writtenDetails.get(i.item_id)?.isbn ?? null,
  }));

  const everHeld = await db.selectDistinct({ lwin18: wmsStock.lwin18 }).from(wmsStock);
  const everHeldKeys = new Set(everHeld.map((r) => lwinPakKeyOf(normalizeLwin18(r.lwin18.trim().toUpperCase()))));

  const customs = await loadCustomsDetails([
    ...stockExplorer.keys(),
    ...items.filter((i) => i.status === 'active' && parseZohoSku(i.sku).form === 'dashed').map((i) => i.sku.trim().toUpperCase()),
  ]);

  const ctx: CleanupContext = {
    customs,
    everHeldKeys,
    stockExplorer,
    heldKeys,
    openItemIds: new Set([...openLines.map((l) => l.zohoItemId!).filter(Boolean), ...draftItemIds.keys()]),
    openDocuments: (() => {
      const docs = new Map(draftItemIds);
      for (const l of openLines) {
        if (l.zohoItemId) docs.set(l.zohoItemId, [...(docs.get(l.zohoItemId) ?? []), `${l.number} (${l.status})`]);
      }
      return docs;
    })(),
    recentlySoldItemIds: new Set(recentLines.map((l) => l.zohoItemId!).filter(Boolean)),
    newSince: new Date(Date.now() - 30 * 86_400_000).toISOString(),
  };

  return { items, ctx };
};

export default loadCleanupInputs;
