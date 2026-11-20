import tableReady from '@/app/_distribution/utils/tableReady';
import { client } from '@/database/client';
import { updateInvoice } from '@/lib/zoho/invoices';
import logger from '@/utils/logger';

/**
 * Write the release's type onto the order's Zoho invoice reference
 *
 * Sophie's tag table (19 Nov 2026): reference = SO number + one tag, written
 * automatically and never typed. A consignment release from one owner's lots
 * reads `SO-00264 CONSIGNMENT_CRURATED`; a private client order carries its
 * PCO number on the invoice, not only the sales order. An outright or prepaid
 * release needs no tag. A consignment release drawing on two owners' lots gets
 * no single tag, because CONSIGNMENT_MIX names nobody: the Distribution page
 * takes each line's owner from the pick instead.
 *
 * Only ever adds to a reference that does not already carry a tag, so nothing
 * Finance typed is overwritten. Best effort: the release stands whether or not
 * Zoho accepts the change, and the outcome is recorded against the order.
 *
 * @example
 *   await tagInvoiceFromRelease(salesOrderId);
 *
 * @param salesOrderId - Our sales order, just released
 * @returns The tag written, or why none was
 */
const tagInvoiceFromRelease = async (salesOrderId: string) => {
  try {
    if (!(await tableReady('zoho_so_release_types'))) return 'No release types table';

    const [order] = await client<
      {
        salesOrderNumber: string;
        releaseType: string | null;
        invoiceId: string | null;
        invoiceReference: string | null;
        pcoNumber: string | null;
      }[]
    >`
      SELECT so.salesorder_number AS "salesOrderNumber", rt.release_type AS "releaseType",
             i.zoho_invoice_id AS "invoiceId", i.reference_number AS "invoiceReference",
             pco.order_number AS "pcoNumber"
      FROM zoho_sales_orders so
      LEFT JOIN zoho_so_release_types rt ON rt.sales_order_id = so.id
      LEFT JOIN zoho_invoices i ON i.invoice_number = so.invoice_number
      LEFT JOIN private_client_orders pco ON pco.id = so.private_client_order_id
      WHERE so.id = ${salesOrderId}
    `;

    if (!order?.invoiceId) return 'No invoice on the order yet';

    const current = order.invoiceReference ?? '';
    let tag: string | null = null;

    if (order.releaseType === 'pco') {
      if (!order.pcoNumber || current.includes(order.pcoNumber)) return 'PCO number already on the invoice';
      tag = order.pcoNumber;
    } else if (order.releaseType === 'consignment') {
      if (/CONSIGNMENT/i.test(current)) return 'Invoice already tagged';

      /* Whose lots the pick list was released against */
      const owners = await client<{ tag: string | null }[]>`
        SELECT DISTINCT ow.consignment_tag AS tag
        FROM zoho_sales_orders so
        JOIN wms_pick_list_items pli ON pli.pick_list_id = so.pick_list_id
        JOIN wms_stock s ON s.id = COALESCE(pli.picked_stock_id, pli.suggested_stock_id)
        LEFT JOIN cons_owners ow ON ow.partner_id = s.owner_id
        WHERE so.id = ${salesOrderId}
      `;

      if (owners.length !== 1 || !owners[0]?.tag) {
        await client`
          UPDATE zoho_so_release_types
          SET owner_tag = ${owners.length > 1 ? 'MIXED' : null},
              tag_written = ${owners.length > 1 ? 'Several owners: owner per line from the pick' : 'Owner has no consignment tag'}
          WHERE sales_order_id = ${salesOrderId}
        `;

        return owners.length > 1 ? 'Several owners' : 'Owner has no consignment tag';
      }

      tag = `CONSIGNMENT_${owners[0].tag}`;
    } else {
      return 'No tag for this type';
    }

    const reference = `${order.salesOrderNumber} ${tag}`.slice(0, 50);

    /*
      Off until one invoice has been checked by hand after the write: an edit
      to an issued invoice changes its last-modified time, which other syncs
      read as a reissue. The type and owner reach the Distribution page from
      the release either way.
    */
    if (process.env.ZOHO_TAG_INVOICE_AT_RELEASE !== 'on') {
      await client`
        UPDATE zoho_so_release_types
        SET owner_tag = ${tag}, tag_written = ${`Not written (switched off): ${reference}`}
        WHERE sales_order_id = ${salesOrderId}
      `;

      return `Would write ${reference}`;
    }

    await updateInvoice(order.invoiceId, { reference_number: reference });
    await client`
      UPDATE zoho_invoices SET reference_number = ${reference} WHERE zoho_invoice_id = ${order.invoiceId}
    `;
    await client`
      UPDATE zoho_so_release_types
      SET owner_tag = ${tag}, tag_written = ${reference}
      WHERE sales_order_id = ${salesOrderId}
    `;

    return reference;
  } catch (error) {
    logger.error('Could not tag the invoice from the release', {
      salesOrderId,
      error: error instanceof Error ? error.message : String(error),
    });

    return error instanceof Error ? error.message : String(error);
  }
};

export default tagInvoiceFromRelease;
