import isCraftCultureOwner from '@/app/_wms/utils/isCraftCultureOwner';
import { client } from '@/database/client';

import getLotPayoutCosts from './getLotPayoutCosts';
import getPartnerPayoutCost from './getPartnerPayoutCost';
import paidOnReady from '../utils/paidOnReady';
import tableReady from '../utils/tableReady';
import wineKey from '../utils/wineKey';

const round2 = (value: number) => Math.round(value * 100) / 100;

interface InvoiceLineRow {
  lineId: string;
  invoiceNumber: string;
  invoiceDate: string;
  customerName: string;
  sku: string | null;
  name: string;
  quantity: number;
  rate: number;
  salesOrderId: string | null;
  salesOrderNumber: string | null;
  /** The private client order the line belongs to, and the partner who raised it */
  pcoNumber: string | null;
  pcoPartnerId: string | null;
  /** A City Drinks consignment invoice, here for owners paid on dispatch */
  consignment: boolean;
}

export interface OutrightLine {
  lineId: string;
  invoiceNumber: string;
  invoiceDate: string;
  customerName: string;
  salesOrderNumber: string | null;
  productName: string;
  lwin18: string | null;
  bottles: number;
  /** What the customer paid us per bottle */
  soldPerBottle: number;
  ownerPartnerId: string | null;
  ownerName: string | null;
  /** How the owner was found */
  ownerSource: 'picked' | 'confirmed' | 'oldest lot' | 'unknown';
  /** Two or more partners hold this wine and nobody has confirmed whose it was */
  needsConfirm: boolean;
  /** Every partner holding this wine, for the confirm buttons */
  holders: { partnerId: string; name: string }[];
  /** What we owe the owner per bottle, USD */
  costPerBottle: number | null;
  owed: number | null;
  costFrom: string | null;
  /**
   * Why the line is owed this month: an outright sale, a City Drinks
   * consignment owed on dispatch, or a private client order
   */
  basis: 'outright' | 'dispatch' | 'pco';
  /** The PCO already pays its partner for this bottle: counted, not owed again */
  paidThroughPco: string | null;
}

/** The pack from an 18-digit LWIN: 1012781-2014-06-00750 is a case of 6 */
const packOf = (lwin: string | null) => {
  const digits = (lwin ?? '').replace(/\D/g, '');

  if (digits.length !== 18) return 1;

  return Number(digits.slice(11, 13)) || 1;
};

/** The bottle size in ml from an 18-digit LWIN */
const sizeOf = (lwin: string | null) => {
  const digits = (lwin ?? '').replace(/\D/g, '');

  return digits.length === 18 ? Number(digits.slice(13)) || 750 : 750;
};

/**
 * Partner wine sold outright in a month, and whose it was
 *
 * The second of Sophie's two jobs: stock we invoiced outright to a
 * distributor (Centaurus, Super Cellar, The Bottle Store, or City Drinks
 * buying), which is not consignment but still owed to the partner whose wine
 * it was. Every non-void invoice dated in the month is read line by line,
 * whoever the customer (Sophie, 24 Nov 2026: City Drinks, TBS, Centaurus,
 * Super Cellar and private client orders alike), leaving out our own monthly
 * settlement invoices and consignment and prepaid invoices to City Drinks,
 * which are owed when City Drinks sell (the first job). The exception is an
 * owner paid on dispatch (Strasky, Alain): their bottles on a consignment
 * invoice are owed in the month it is raised. A private client order's bottles
 * are counted; where the order's own partner owned them, its partner payment
 * already pays for them, so they are not owed a second time here.
 *
 * The owner is the lot the warehouse actually picked for the sales order,
 * from its pick movements, with no tagging in Zoho. Where no pick was
 * recorded the oldest lot of the wine stands in. Either way, a wine two or
 * more partners hold is flagged until someone confirms whose it was, because
 * a guess there moves money between partners. C&C's own stock is owed to
 * nobody and left out.
 *
 * @example
 *   const sales = await buildOutrightSales('2026-10');
 *
 * @param month - YYYY-MM
 * @returns The lines, each with its owner and what is owed
 */
const buildOutrightSales = async (month: string) => {
  const hasTypes = await tableReady('cons_invoice_types');
  const hasConfirms = await tableReady('cons_outright_owners');
  const hasPaidOn = await paidOnReady();

  /*
    A City Drinks consignment invoice is owed when City Drinks sell, except to
    the owners paid when it goes out to them (Strasky and Alain: Sophie, 24 Nov
    2026), whose share of it is owed in the month it is raised.
  */
  const consignmentOut = hasTypes
    ? client`m.kind = 'out' AND m.doc_ref = i.invoice_number
             AND COALESCE(m.invoice_type, 'consignment') NOT IN ('outright', 'pco')`
    : client`m.kind = 'out' AND m.doc_ref = i.invoice_number`;
  const dispatchOwner = hasPaidOn
    ? client`ow.consignment_paid_on = 'dispatch'`
    : client`false`;

  const rows = await client<InvoiceLineRow[]>`
    SELECT l.id AS "lineId", i.invoice_number AS "invoiceNumber",
           i.invoice_date::text AS "invoiceDate", i.customer_name AS "customerName",
           l.sku, l.name, l.quantity::float8 AS quantity, l.rate::float8 AS rate,
           so.id AS "salesOrderId", so.salesorder_number AS "salesOrderNumber",
           pco.order_number AS "pcoNumber", pco.partner_id AS "pcoPartnerId",
           EXISTS (SELECT 1 FROM cons_movements m WHERE ${consignmentOut}) AS consignment
    FROM zoho_invoices i
    JOIN zoho_invoice_line_items l ON l.zoho_invoice_id = i.zoho_invoice_id
    LEFT JOIN zoho_sales_orders so ON so.zoho_salesorder_id = l.zoho_salesorder_id
    LEFT JOIN private_client_orders pco ON pco.id = so.private_client_order_id
    WHERE TO_CHAR(i.invoice_date, 'YYYY-MM') = ${month}
      AND i.status NOT IN ('void', 'draft')
      AND COALESCE(l.item_type, '') NOT ILIKE '%header%'
      AND l.quantity > 0
      AND COALESCE(l.sku, '') <> ''
      AND COALESCE(i.reference_number, '') !~* '^SETTLEMENT'
      /*
        Consignment and prepaid stock at City Drinks is owed when City Drinks
        sell it (the first job), unless an owner on the invoice is paid on
        dispatch. Private client orders are in (Sophie, 24 Nov 2026: every
        customer counts).
      */
      AND (
        NOT EXISTS (SELECT 1 FROM cons_movements m WHERE ${consignmentOut})
        OR EXISTS (
          SELECT 1 FROM cons_movements m
          JOIN cons_arrangements a ON a.id = m.arrangement_id
          JOIN cons_owners ow ON ow.id = a.owner_id
          WHERE ${consignmentOut} AND ${dispatchOwner}
        )
      )
    ORDER BY i.invoice_date, i.invoice_number, l.line_order
  `;

  if (rows.length === 0) return { month, lines: [] as OutrightLine[] };

  const orderIds = [
    ...new Set(rows.map((row) => row.salesOrderId).filter((id): id is string => !!id)),
  ];

  /* What the warehouse picked for each order, and from whose lot */
  const picks = orderIds.length
    ? await client<
        { orderId: string; lwin18: string | null; ownerId: string | null; bottles: number }[]
      >`
        SELECT m.order_id AS "orderId", COALESCE(m.lwin18, s.lwin18) AS lwin18,
               COALESCE(m.from_owner_id, s.owner_id) AS "ownerId",
               SUM(COALESCE(m.quantity_bottles, m.quantity_cases * COALESCE(s.case_config, 1)))::float8 AS bottles
        FROM wms_stock_movements m
        LEFT JOIN wms_stock s ON s.id = m.stock_id
        WHERE m.movement_type = 'pick' AND m.order_id = ANY(${orderIds}::uuid[])
        GROUP BY 1, 2, 3
      `
    : [];

  const keys = [...new Set(rows.map((row) => wineKey(row.sku)).filter(Boolean))];

  /* Every partner who holds or held each wine, oldest lot first */
  const holdings = keys.length
    ? await client<
        { key: string; ownerId: string; ownerName: string; firstReceived: string | null }[]
      >`
        SELECT k.key, s.owner_id AS "ownerId", p.business_name AS "ownerName",
               MIN(s.received_at)::text AS "firstReceived"
        FROM wms_stock s
        JOIN partners p ON p.id = s.owner_id
        JOIN LATERAL (
          SELECT CASE
                   WHEN UPPER(REGEXP_REPLACE(s.lwin18, '[^A-Za-z0-9]', '', 'g')) ~ '^[0-9]{18}$'
                   THEN SUBSTR(REGEXP_REPLACE(s.lwin18, '[^0-9]', '', 'g'), 1, 11)
                        || SUBSTR(REGEXP_REPLACE(s.lwin18, '[^0-9]', '', 'g'), 14, 5)
                   ELSE UPPER(REGEXP_REPLACE(s.lwin18, '[^A-Za-z0-9]', '', 'g'))
                 END AS key
        ) k ON true
        WHERE k.key = ANY(${keys}::text[])
        GROUP BY k.key, s.owner_id, p.business_name
        ORDER BY k.key, MIN(s.received_at) NULLS LAST
      `
    : [];

  const confirmed = hasConfirms
    ? await client<{ lineId: string; ownerId: string }[]>`
        SELECT invoice_line_id AS "lineId", owner_partner_id AS "ownerId"
        FROM cons_outright_owners
        WHERE invoice_line_id = ANY(${rows.map((row) => row.lineId)}::uuid[])
      `
    : [];

  const holdersByKey = new Map<string, { partnerId: string; name: string }[]>();

  for (const row of holdings) {
    const list = holdersByKey.get(row.key) ?? [];

    list.push({ partnerId: row.ownerId, name: row.ownerName });
    holdersByKey.set(row.key, list);
  }

  const nameOf = new Map(holdings.map((row) => [row.ownerId, row.ownerName]));
  const confirmedOf = new Map(confirmed.map((row) => [row.lineId, row.ownerId]));

  /* Picked bottles still to be matched to invoice lines, per order and wine */
  const pickPool = new Map<string, { ownerId: string; bottles: number }[]>();

  for (const pick of picks) {
    if (!pick.ownerId) continue;

    const poolKey = `${pick.orderId}|${wineKey(pick.lwin18)}`;
    const pool = pickPool.get(poolKey) ?? [];

    pool.push({ ownerId: pick.ownerId, bottles: pick.bottles });
    pickPool.set(poolKey, pool);
  }

  /* A line split across two owners' lots becomes one line per owner */
  const split: (InvoiceLineRow & {
    bottles: number;
    ownerId: string | null;
    source: OutrightLine['ownerSource'];
  })[] = [];

  for (const row of rows) {
    const key = wineKey(row.sku);
    const bottles = row.quantity * packOf(row.sku);
    const confirmedOwner = confirmedOf.get(row.lineId);

    if (confirmedOwner) {
      split.push({ ...row, bottles, ownerId: confirmedOwner, source: 'confirmed' });
      continue;
    }

    const pool = row.salesOrderId ? pickPool.get(`${row.salesOrderId}|${key}`) : undefined;
    let remaining = bottles;

    for (const lot of pool ?? []) {
      if (remaining <= 0) break;
      if (lot.bottles <= 0) continue;

      const take = Math.min(lot.bottles, remaining);

      lot.bottles -= take;
      remaining -= take;
      split.push({ ...row, bottles: take, ownerId: lot.ownerId, source: 'picked' });
    }

    if (remaining > 0) {
      const oldest = holdersByKey.get(key)?.[0];

      split.push({
        ...row,
        bottles: remaining,
        ownerId: oldest?.partnerId ?? null,
        source: oldest ? 'oldest lot' : 'unknown',
      });
    }
  }

  /* What each owner is owed per bottle: the Pricing Manager on their lot */
  const hasRules = await tableReady('cons_month_closes');
  const ownerRules = await client<
    {
      partnerId: string;
      payoutRule: string | null;
      sharePct: number | null;
      recoveryPer75: number | null;
      recoveryFrom: string | null;
      paidOn: string | null;
    }[]
  >`
    SELECT partner_id AS "partnerId",
           ${hasPaidOn ? client`consignment_paid_on` : client`'sale'::text`} AS "paidOn",
           ${hasRules ? client`payout_rule` : client`'landed'::text`} AS "payoutRule",
           ${hasRules ? client`payout_share_pct::float8` : client`NULL::float8`} AS "sharePct",
           ${hasRules ? client`freight_recovery_per_75cl::float8` : client`NULL::float8`} AS "recoveryPer75",
           ${hasRules ? client`freight_recovery_from::text` : client`NULL::text`} AS "recoveryFrom"
    FROM cons_owners WHERE partner_id IS NOT NULL
  `;
  const ruleOf = new Map(ownerRules.map((row) => [row.partnerId, row]));

  const owners = [...new Set(split.map((row) => row.ownerId).filter((id): id is string => !!id))];
  const costs = new Map<string, Awaited<ReturnType<typeof getPartnerPayoutCost>>>();

  const lotCosts = new Map<string, Awaited<ReturnType<typeof getLotPayoutCosts>>>();

  for (const ownerId of owners) {
    const wineCosts = await getPartnerPayoutCost(ownerId, keys);

    costs.set(ownerId, wineCosts);
    /* Each invoice line at the cost of the lot actually picked for it */
    lotCosts.set(
      ownerId,
      await getLotPayoutCosts(
        ownerId,
        split
          .filter((row) => row.ownerId === ownerId)
          .map((row) => ({ docRef: row.invoiceNumber, docDate: row.invoiceDate })),
        wineCosts,
      ),
    );
  }

  const lines: OutrightLine[] = [];

  for (const row of split) {
    const key = wineKey(row.sku);
    const ownerName = row.ownerId ? (nameOf.get(row.ownerId) ?? null) : null;

    /* C&C's own wine is owed to nobody */
    if (isCraftCultureOwner(ownerName)) continue;

    /*
      On a City Drinks consignment invoice, only the owners paid on dispatch
      are owed now; everyone else's bottles are owed when City Drinks sell.
    */
    const rule = row.ownerId ? ruleOf.get(row.ownerId) : undefined;

    if (row.consignment && rule?.paidOn !== 'dispatch') continue;

    const holders = holdersByKey.get(key) ?? [];
    const soldPerBottle = row.rate / packOf(row.sku);
    /* The PCO's partner payment already pays the partner who raised it */
    const paidThroughPco =
      row.pcoNumber && row.ownerId && row.ownerId === row.pcoPartnerId
        ? row.pcoNumber
        : null;
    const lot = row.ownerId ? costs.get(row.ownerId)?.get(key) : undefined;

    const picked = row.ownerId
      ? lotCosts.get(row.ownerId)?.get(`${row.invoiceNumber}|${key}`)
      : undefined;

    let costPerBottle: number | null = picked?.perBottle ?? lot?.perBottle ?? null;
    let costFrom: string | null = picked?.from ?? lot?.from ?? null;

    if (rule?.payoutRule === 'invoice_share' && rule.sharePct != null) {
      const recovery =
        rule.recoveryPer75 && rule.recoveryFrom && `${month}-01` >= rule.recoveryFrom
          ? rule.recoveryPer75 * (sizeOf(row.sku) / 750)
          : 0;

      costPerBottle = Math.max(0, soldPerBottle * (rule.sharePct / 100) - recovery);
      costFrom = `${rule.sharePct}% of the invoice price${recovery ? `, less $${recovery.toFixed(2)} freight` : ''}`;
    }

    lines.push({
      lineId: row.lineId,
      invoiceNumber: row.invoiceNumber,
      invoiceDate: row.invoiceDate,
      customerName: row.customerName,
      salesOrderNumber: row.salesOrderNumber,
      productName: row.name,
      lwin18: row.sku,
      bottles: row.bottles,
      soldPerBottle: round2(soldPerBottle),
      ownerPartnerId: row.ownerId,
      ownerName,
      ownerSource: row.source,
      needsConfirm:
        row.source !== 'confirmed' &&
        (holders.length > 1 || row.source === 'unknown'),
      holders,
      costPerBottle: costPerBottle === null ? null : round2(costPerBottle),
      owed: paidThroughPco
        ? 0
        : costPerBottle === null
          ? null
          : round2(costPerBottle * row.bottles),
      costFrom: paidThroughPco ? `Paid through ${paidThroughPco}` : costFrom,
      basis: row.consignment ? 'dispatch' : row.pcoNumber ? 'pco' : 'outright',
      paidThroughPco,
    });
  }

  return { month, lines };
};

export default buildOutrightSales;
