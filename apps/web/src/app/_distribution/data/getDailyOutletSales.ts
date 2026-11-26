import { client } from '@/database/client';

import buildDailySales from '../utils/buildDailySales';
import type { DailyOutletSales, PairRow } from '../utils/buildDailySales';
import {
  codeBridgeCtes,
  codeBridgeJoins,
  confirmedLinksReady,
  packAgnostic,
  resolvedSnapshotCode,
} from '../utils/codeBridge';
import wineOwnersReady from '../utils/wineOwnersReady';

const squashed = () =>
  client`UPPER(REGEXP_REPLACE(COALESCE(m.lwin18, m.product_name), '[^A-Za-z0-9]', '', 'g'))`;

/**
 * What an outlet sold, day by day, from its daily stock positions
 *
 * The outlet's feed is a position, not a sales ledger: once a day it says how
 * many bottles of each wine it holds. Two consecutive positions and what we
 * invoiced to them in between give the day's movement:
 *
 *     sold = held yesterday + delivered since − held today
 *
 * Keyed on the outlet's own product code, which is the one stable key on
 * their side, so a wine of theirs we have never coded still shows as a sale —
 * it simply carries no owner and no value until its code is linked.
 *
 * A count that rises by more than we delivered is a restock we did not
 * invoice, a pack read wrongly, or a bad match. It is reported as a restock
 * and never as a negative sale.
 *
 * Read-only: nothing is written. `adminDeriveSold` is what records sales
 * against owners for settlement; this is the daily view of the same arithmetic.
 *
 * @param outletId - The outlet to read
 * @param days - How many daily windows to return, newest first
 */
const getDailyOutletSales = async (
  outletId: string,
  days: number,
): Promise<DailyOutletSales> => {
  const hasLinks = await confirmedLinksReady();
  const hasOwners = await wineOwnersReady();

  const [outlet] = await client<{ name: string; zohoCustomerMatch: string | null }[]>`
    SELECT name, zoho_customer_match AS "zohoCustomerMatch"
    FROM cons_outlets WHERE id = ${outletId}
  `;

  /* Squashed as the invoice sync squashes it, so both find the same customer */
  const customer = (outlet?.zohoCustomerMatch ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');

  const rows = await client<PairRow[]>`
    WITH times AS (
      SELECT taken_at, LAG(taken_at) OVER (ORDER BY taken_at) AS prev
      FROM (
        SELECT DISTINCT taken_at FROM cons_snapshots
        WHERE outlet_id = ${outletId}
        ORDER BY taken_at DESC
        LIMIT ${days + 1}
      ) recent
    ),
    ${codeBridgeCtes(outletId, hasLinks)},
    pos AS (
      SELECT s.taken_at,
             UPPER(REGEXP_REPLACE(s.outlet_code, '[^A-Za-z0-9]', '', 'g')) AS outlet_code,
             ${packAgnostic(() => resolvedSnapshotCode())} AS code,
             MIN(${resolvedSnapshotCode()}) AS lwin,
             MIN(s.product_name) AS product_name,
             MIN(s.regime) AS regime,
             SUM(s.bottles_on_hand)::float8 AS held,
             MAX(s.sold_last_30d)::float8 AS sold_last_30d
      FROM cons_snapshots s
      ${codeBridgeJoins()}
      WHERE s.outlet_id = ${outletId}
        AND s.taken_at IN (SELECT taken_at FROM times)
      GROUP BY 1, 2, 3
    ),
    pairs AS (
      SELECT DISTINCT t.taken_at AS closed_at, t.prev AS opened_at, p.outlet_code
      FROM times t
      JOIN pos p ON p.taken_at IN (t.taken_at, t.prev)
      WHERE t.prev IS NOT NULL
    ),
    outs AS (
      SELECT ${packAgnostic(squashed)} AS code,
             m.doc_date, m.bottles, m.unit_price, m.source_qty, m.currency,
             m.doc_ref, a.owner_id
      FROM cons_movements m
      JOIN cons_arrangements a ON a.id = m.arrangement_id
      WHERE a.outlet_id = ${outletId} AND m.kind = 'out'
    ),
    /* Whose wine it is: the owner on the latest invoice line */
    invoiced_owner AS (
      SELECT DISTINCT ON (o.code) o.code, ow.name AS owner_name
      FROM outs o
      JOIN cons_owners ow ON ow.id = o.owner_id
      ORDER BY o.code, o.doc_date DESC NULLS LAST
    ),
    /*
      Said by hand, and the last word. Read here as well as at invoice time,
      because a wine that reached them on an unattributed invoice — or on none
      we can read — has no invoice line for the override to correct, and would
      otherwise never get an owner at all.
    */
    stated_owner AS (
      ${
        hasOwners
          ? client`
              SELECT DISTINCT ON (code) code, owner_name
              FROM (
                SELECT ${packAgnostic(
                  () => client`UPPER(REGEXP_REPLACE(w.lwin18, '[^A-Za-z0-9]', '', 'g'))`,
                )} AS code, ow.name AS owner_name
                FROM cons_wine_owners w
                JOIN cons_owners ow ON ow.id = w.owner_id
                WHERE w.outlet_id = ${outletId}
              ) stated
              ORDER BY code
            `
          : client`SELECT NULL::text AS code, NULL::text AS owner_name WHERE false`
      }
    ),
    owner_of AS (
      SELECT COALESCE(s.code, i.code) AS code, COALESCE(s.owner_name, i.owner_name) AS owner_name
      FROM stated_owner s
      FULL JOIN invoiced_owner i ON i.code = s.code
    ),
    /*
      What we sold them outright, from our Zoho sales orders to this customer.
      Consignment movements only cover consigned wine, so without this a wine
      they bought has no price of ours at all.

      The rate is for the item sold, so a case rate is divided by the pack.
      The pack is read from the item's name first ("… (6x75cl)"), because
      every item made since the October code clean-up states it there, and
      from the SKU's pack digits after that. Items from before the clean-up
      could carry a single-bottle SKU while priced as a case: Opus One 2018
      came out at USD 2,212 a bottle on 22 Nov 2026 that way. A unit of
      "bottle" means the rate is already per bottle. A pack outside 1-24 is
      corrupt data and gives no price rather than a wrong one.
    */
    outright_lines AS (
      SELECT ${packAgnostic(
               () => client`UPPER(REGEXP_REPLACE(i.sku, '[^A-Za-z0-9]', '', 'g'))`,
             )} AS code,
             so.order_date AS doc_date,
             so.salesorder_number AS doc_ref,
             i.rate,
             LOWER(COALESCE(i.unit, '')) AS unit,
             NULLIF(SUBSTRING(COALESCE(i.name, '') || ' ' || COALESCE(i.description, '')
                              FROM '([0-9]{1,2})[[:space:]]*[xX×][[:space:]]*[0-9]'), '')::int AS name_pack,
             (CASE
               WHEN REGEXP_REPLACE(i.sku, '[^0-9]', '', 'g') ~ '^[0-9]{18}$'
                 THEN SUBSTR(REGEXP_REPLACE(i.sku, '[^0-9]', '', 'g'), 12, 2)::int
             END) AS sku_pack,
             so.currency_code AS currency
      FROM zoho_sales_order_items i
      JOIN zoho_sales_orders so ON so.id = i.sales_order_id
      WHERE ${customer} <> ''
        AND UPPER(REGEXP_REPLACE(so.customer_name, '[^A-Za-z0-9]', '', 'g')) LIKE '%' || ${customer} || '%'
        AND so.zoho_status <> 'void'
        AND NULLIF(TRIM(i.sku), '') IS NOT NULL
        AND i.rate > 0
    ),
    outright AS (
      SELECT code, doc_date, doc_ref, currency,
             (CASE
               WHEN unit LIKE 'bottle%' THEN rate
               WHEN COALESCE(name_pack, sku_pack) BETWEEN 1 AND 24
                 THEN rate / COALESCE(name_pack, sku_pack)
             END)::float8 AS bottle_price
      FROM outright_lines
    ),
    /* Every price we have charged them for each wine, per bottle, either route */
    price_obs AS (
      SELECT ROW_NUMBER() OVER () AS id, code, doc_date, doc_ref, bottle_price, currency
      FROM (
        SELECT o.code, o.doc_date, o.doc_ref,
               (o.unit_price * o.source_qty / NULLIF(o.bottles, 0))::float8 AS bottle_price,
               o.currency
        FROM outs o
        WHERE o.unit_price IS NOT NULL AND o.bottles > 0
        UNION ALL
        SELECT code, doc_date, doc_ref, bottle_price, currency FROM outright
        WHERE bottle_price IS NOT NULL
      ) prices
      WHERE bottle_price > 0
    ),
    /*
      What it is worth: our latest invoice price per bottle — unless that
      price is three times or more out of line with what we charged for the
      same wine on the other lines. That is a case price read as a bottle
      price (or the reverse), not a real change of price, and the next most
      recent sensible line is used instead. Compared within one currency, as
      AED is itself 3.67 times USD. With only two lines that disagree, each
      is out of line with the other; the lower is taken, because a case
      price read as a bottle price is the mistake that actually happens and
      an understated day is the safer error. A wine invoiced once has
      nothing to compare against and keeps its one price.
    */
    price_of AS (
      SELECT DISTINCT ON (p.code) p.code, p.bottle_price, p.currency, p.doc_ref
      FROM price_obs p
      LEFT JOIN LATERAL (
        SELECT PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY q.bottle_price) AS median
        FROM price_obs q
        WHERE q.code = p.code AND q.id <> p.id
          AND q.currency IS NOT DISTINCT FROM p.currency
      ) others ON true
      ORDER BY p.code,
               (CASE
                 WHEN others.median IS NULL THEN 0
                 WHEN p.bottle_price >= others.median * 3 THEN 2
                 WHEN p.bottle_price <= others.median / 3 THEN 1
                 ELSE 0
               END) ASC,
               p.doc_date DESC NULLS LAST
    )
    SELECT p.closed_at AS "closedAt", p.opened_at AS "openedAt",
           TO_CHAR((p.opened_at AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Dubai', 'YYYY-MM-DD')
             AS "salesDate",
           (EXTRACT(EPOCH FROM (p.closed_at - p.opened_at)) / 3600)::float8 AS "spanHours",
           p.outlet_code AS "outletCode",
           COALESCE(c.product_name, o.product_name) AS "productName",
           COALESCE(c.regime, o.regime) AS regime,
           COALESCE(c.code, o.code) AS code,
           COALESCE(c.lwin, o.lwin) AS lwin,
           COALESCE(o.held, ls.held, 0) AS "heldFrom",
           COALESCE(c.held, 0) AS "heldTo",
           (c.outlet_code IS NOT NULL) AS "inCloseCount",
           TO_CHAR(ls.taken_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS "resumedFrom",
           c.sold_last_30d AS "soldLast30d",
           COALESCE(o.sold_last_30d, ls.sold_last_30d) AS "soldLast30dFrom",
           COALESCE(d.bottles, 0) AS delivered,
           pr.bottle_price AS "bottlePrice",
           pr.currency,
           pr.doc_ref AS "priceRef",
           ow.owner_name AS "ownerName"
    FROM pairs p
    LEFT JOIN pos o ON o.taken_at = p.opened_at AND o.outlet_code = p.outlet_code
    LEFT JOIN pos c ON c.taken_at = p.closed_at AND c.outlet_code = p.outlet_code
    /*
      A wine back on the feed after days off it opens from its last count, not
      from nothing. Between 13 and 16 Nov 2026 City Drinks' feed left out about
      240 Crurated and other wines; read from zero, the day they came back was
      one large restock and every bottle sold while they were missing was lost.
      Three weeks at most, so a wine delisted for months and listed again is
      not read as one window.
    */
    LEFT JOIN LATERAL (
      SELECT s.taken_at,
             SUM(s.bottles_on_hand)::float8 AS held,
             MAX(s.sold_last_30d)::float8 AS sold_last_30d
      FROM cons_snapshots s
      WHERE o.outlet_code IS NULL
        AND c.outlet_code IS NOT NULL
        AND s.outlet_id = ${outletId}
        AND s.taken_at < p.opened_at
        AND s.taken_at >= p.opened_at - INTERVAL '21 days'
        AND UPPER(REGEXP_REPLACE(s.outlet_code, '[^A-Za-z0-9]', '', 'g')) = p.outlet_code
      GROUP BY s.taken_at
      ORDER BY s.taken_at DESC
      LIMIT 1
    ) ls ON true
    LEFT JOIN LATERAL (
      SELECT SUM(x.bottles)::float8 AS bottles
      FROM outs x
      WHERE x.code = COALESCE(c.code, o.code)
        AND x.doc_date > COALESCE(ls.taken_at, p.opened_at)::date
        AND x.doc_date <= p.closed_at::date
    ) d ON true
    LEFT JOIN price_of pr ON pr.code = COALESCE(c.code, o.code)
    LEFT JOIN owner_of ow ON ow.code = COALESCE(c.code, o.code)
    ORDER BY p.closed_at DESC
  `;

  return {
    outletId,
    outletName: outlet?.name ?? 'Outlet',
    ...buildDailySales(rows),
  };
};

export default getDailyOutletSales;
