import { client } from '@/database/client';
import tableReady from '@/app/_distribution/utils/tableReady';

import resolveReleaseType from '../utils/resolveReleaseType';

/**
 * The release type of each sales order, set or suggested, and which still
 * need one chosen
 *
 * Reads the order's own reference and its invoice's reference and subject,
 * since the consignment tag has lived on either.
 *
 * @example
 *   const types = await getReleaseTypes([salesOrderId]);
 *
 * @param salesOrderIds - Our sales order ids
 * @returns One entry per order
 */
const getReleaseTypes = async (salesOrderIds: string[]) => {
  if (salesOrderIds.length === 0) return [];

  const stored = await tableReady('zoho_so_release_types');

  const rows = await client<
    {
      id: string;
      customerName: string | null;
      reference: string | null;
      isPco: boolean;
      stored: string | null;
    }[]
  >`
    SELECT so.id, so.customer_name AS "customerName",
           CONCAT_WS(' ', so.reference_number, i.reference_number, i.subject) AS reference,
           (so.private_client_order_id IS NOT NULL) AS "isPco",
           ${stored ? client`rt.release_type` : client`NULL::text`} AS stored
    FROM zoho_sales_orders so
    LEFT JOIN zoho_invoices i ON i.invoice_number = so.invoice_number
    ${stored ? client`LEFT JOIN zoho_so_release_types rt ON rt.sales_order_id = so.id` : client``}
    WHERE so.id = ANY(${salesOrderIds}::uuid[])
  `;

  return rows.map((row) => ({
    salesOrderId: row.id,
    ...resolveReleaseType(row),
  }));
};

export default getReleaseTypes;
