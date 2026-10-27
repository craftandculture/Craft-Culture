import { sql } from 'drizzle-orm';

import { PCO_NUMBER_PATTERN } from '@/app/_zohoSalesOrders/data/linkSalesOrdersToPcos';
import db from '@/database/client';

/** Which broken link a row is, so each can go to the person who mends it */
export type DeliveryLinkExceptionKind =
  | 'no_order'
  | 'no_sales_order'
  | 'unknown_pco_reference'
  | 'wrong_owner_pick'
  | 'bills_wine';

/**
 * Member deliveries whose paperwork does not join up
 *
 * A cellar release runs Release → PCO → Zoho sales order → pick → delivered.
 * When the team raises a step by hand, a missing or mistyped link used to go
 * unnoticed until a statement read the member's own delivery as a sale. Each
 * row here is one broken link, oldest first, for the operator queue:
 *
 * - accepted for more than a day with no order raised;
 * - an order raised two days ago with no Zoho sales order linked;
 * - a Zoho order quoting a PCO number that does not exist;
 * - a delivery picked from someone else's bottles;
 * - a delivery order billing the wine, which the member already owns.
 *
 * @example
 *   const rows = await getDeliveryLinkExceptions();
 *
 * @returns Attention rows: id, title, detail, since
 */
const getDeliveryLinkExceptions = async () => {
  const rows = await db.execute<{
    id: string;
    kind: DeliveryLinkExceptionKind;
    title: string;
    detail: string;
    since: Date | string | null;
  }>(sql`
    -- Accepted, but no order raised
    SELECT r.id::text, 'no_order' AS kind, p.business_name || ' · ' || r.request_number AS title,
           'Accepted with no order raised: Confirm for member, or raise the PCO' AS detail,
           r.confirmed_at AS since
    FROM cellar_release_requests r
    JOIN partners p ON p.id = r.partner_id
    WHERE r.status = 'confirmed'
      AND r.private_client_order_id IS NULL
      AND r.confirmed_at < now() - interval '1 day'

    UNION ALL

    -- An order raised, but no Zoho sales order behind it
    SELECT r.id::text, 'no_sales_order', p.business_name || ' · ' || r.request_number,
           pco.order_number || ' has no Zoho sales order linked: Link to sales order',
           pco.created_at
    FROM cellar_release_requests r
    JOIN partners p ON p.id = r.partner_id
    JOIN private_client_orders pco ON pco.id = r.private_client_order_id
    WHERE pco.status NOT IN ('delivered', 'cancelled')
      AND pco.zoho_salesorder_id IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM zoho_sales_orders so WHERE so.private_client_order_id = pco.id
      )
      AND pco.created_at < now() - interval '2 days'

    UNION ALL

    -- A Zoho order quoting a PCO number nothing has
    SELECT so.id::text, 'unknown_pco_reference', so.salesorder_number || ' · ' || so.customer_name,
           'Reference "' || so.reference_number || '" matches no PCO: correct it in Zoho, or Link to sales order',
           so.created_at
    FROM zoho_sales_orders so
    WHERE so.private_client_order_id IS NULL
      AND so.reference_number ~* ${PCO_NUMBER_PATTERN}
      AND NOT EXISTS (
        SELECT 1 FROM private_client_orders pco
        WHERE pco.order_number = upper(substring(so.reference_number from ${PCO_NUMBER_PATTERN}))
      )

    UNION ALL

    -- A delivery picked from another owner's bottles
    SELECT r.id::text, 'wrong_owner_pick', p.business_name || ' · ' || r.request_number,
           sum(abs(coalesce(m.quantity_bottles, m.quantity_cases)))::int
             || ' bottle(s) picked from ' || string_agg(DISTINCT o.business_name, ', ')
             || ' for this delivery: check the pick',
           min(m.performed_at)
    FROM cellar_release_requests r
    JOIN partners p ON p.id = r.partner_id
    JOIN private_client_orders pco ON pco.id = r.private_client_order_id
    JOIN wms_stock_movements m
      ON m.movement_type = 'pick'
     AND (m.order_id = pco.id
          OR m.order_id IN (SELECT so.id FROM zoho_sales_orders so WHERE so.private_client_order_id = pco.id))
    JOIN partners o ON o.id = m.from_owner_id
    WHERE m.from_owner_id <> r.partner_id
    GROUP BY r.id, p.business_name, r.request_number

    UNION ALL

    -- A delivery order charging for wine the member already owns
    SELECT r.id::text, 'bills_wine', p.business_name || ' · ' || r.request_number,
           pco.order_number || ' bills $' || round(sum(i.total_usd)::numeric, 2)
             || ' for the wine: a delivery bills duty, VAT and fees only',
           pco.created_at
    FROM cellar_release_requests r
    JOIN partners p ON p.id = r.partner_id
    JOIN private_client_orders pco ON pco.id = r.private_client_order_id
    JOIN private_client_order_items i ON i.order_id = pco.id
    WHERE pco.status <> 'cancelled'
    GROUP BY r.id, p.business_name, r.request_number, pco.order_number, pco.created_at
    HAVING sum(i.total_usd) > 0
  `);

  const list = Array.isArray(rows) ? rows : (rows as { rows: typeof rows }).rows;

  return [...list]
    .map((row) => ({
      id: row.id,
      kind: row.kind,
      title: row.title,
      detail: row.detail,
      since: row.since ? new Date(row.since) : null,
    }))
    .sort((a, b) => (a.since?.getTime() ?? 0) - (b.since?.getTime() ?? 0));
};

export default getDeliveryLinkExceptions;
