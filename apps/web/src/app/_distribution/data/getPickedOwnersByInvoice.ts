import { client } from '@/database/client';

/**
 * Whose lots the warehouse picked for each invoiced sales order, by wine
 *
 * Read from the pick movements, which record the stock row and its owner, and
 * mapped to the consignment owner that partner is. A release drawing on two
 * owners' lots needs no MIX tag: each line's owner is whoever's lot was
 * picked for it.
 *
 * @example
 *   const picked = await getPickedOwnersByInvoice();
 *
 * @returns One row per invoice, wine code and consignment owner picked from
 */
const getPickedOwnersByInvoice = async () =>
  client<{ invoiceNumber: string; lwin18: string | null; ownerId: string }[]>`
    SELECT DISTINCT so.invoice_number AS "invoiceNumber",
           COALESCE(m.lwin18, s.lwin18) AS lwin18, ow.id AS "ownerId"
    FROM wms_stock_movements m
    JOIN zoho_sales_orders so ON so.id = m.order_id
    LEFT JOIN wms_stock s ON s.id = m.stock_id
    JOIN cons_owners ow ON ow.partner_id = COALESCE(m.from_owner_id, s.owner_id)
    WHERE m.movement_type = 'pick' AND so.invoice_number IS NOT NULL
  `;

export default getPickedOwnersByInvoice;
