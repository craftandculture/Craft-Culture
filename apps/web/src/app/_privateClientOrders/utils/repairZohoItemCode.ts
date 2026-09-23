import { searchItems, updateItem } from '@/lib/zoho/items';
import { getSalesOrder } from '@/lib/zoho/salesOrders';
import logger from '@/utils/logger';

export type ZohoItemRepair =
  | { status: 'repaired'; message: string }
  | { status: 'skipped'; message: string }
  | { status: 'failed'; message: string };

/**
 * Correct the SKU of a Zoho item a sales order raised under a placeholder
 *
 * Partner lines once carried catalogue keys ("1010000000000000000:row28")
 * rather than LWINs, and the sales order raised from them created Zoho items
 * under those keys. When C&C sets the real LWIN on the line, the item on the
 * sales order is corrected in place — the draft then carries the right code
 * with nothing deleted or raised again.
 *
 * Only the item found ON THIS sales order under the old SKU is touched, so the
 * repair cannot reach an item some other document relies on. If Zoho already
 * has an item under the real code, it is left alone and said: two items for
 * one wine is a merge to make by hand, not by guess.
 *
 * @param salesOrderId - The Zoho sales order the line was raised on
 * @param oldSku - The placeholder the item was created under
 * @param newSku - The LWIN18 of the pack the line sells
 * @returns What happened, in words fit to show
 */
const repairZohoItemCode = async (
  salesOrderId: string,
  oldSku: string,
  newSku: string,
): Promise<ZohoItemRepair> => {
  try {
    const salesOrder = await getSalesOrder(salesOrderId);
    const line = salesOrder.line_items.find((row) => row.sku === oldSku);

    if (!line?.item_id) {
      return {
        status: 'skipped',
        message: `No item on ${salesOrder.salesorder_number} carries ${oldSku}; nothing changed in Zoho.`,
      };
    }

    const taken = (await searchItems(newSku)).find((item) => item.sku === newSku);

    if (taken) {
      return {
        status: 'skipped',
        message:
          `Zoho already has ${newSku} ("${taken.name}"). ` +
          `Swap that item onto ${salesOrder.salesorder_number} in Zoho by hand.`,
      };
    }

    await updateItem(line.item_id, { sku: newSku });

    logger.info('[PCO] Repaired placeholder Zoho SKU', {
      salesOrderId,
      itemId: line.item_id,
      oldSku,
      newSku,
    });

    return {
      status: 'repaired',
      message: `Zoho item updated to ${newSku} on ${salesOrder.salesorder_number}.`,
    };
  } catch (error) {
    logger.error('[PCO] Zoho SKU repair failed', { salesOrderId, oldSku, error });

    return {
      status: 'failed',
      message: `LWIN saved, but the Zoho item could not be updated: ${
        error instanceof Error ? error.message : 'unknown error'
      }`,
    };
  }
};

export default repairZohoItemCode;
