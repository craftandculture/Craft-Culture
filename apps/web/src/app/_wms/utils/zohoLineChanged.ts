import canonicalSku from '@/app/_wms/utils/canonicalSku';

export interface StoredLine {
  quantity: number;
  rate: number;
  name: string;
  itemTotal: number;
  sku: string | null;
  description: string | null;
}

export interface ZohoLine {
  quantity: number;
  rate: number;
  name: string;
  item_total: number;
  sku?: string | null;
  description?: string | null;
}

/**
 * Whether a stored Zoho sales order line differs from Zoho's current copy, so
 * the reconcile must rewrite it (and release its hold for re-holding).
 *
 * SKU carries the pack config (…-06-… = 6-pack) which drives the pick's bottle
 * count, and description mirrors it, so both count as a change. The stored SKU
 * is compared as-is against Zoho's canonical SKU: every write canonicalises, so
 * the two only differ once, for a line stored mis-dashed or untrimmed before
 * that — which is then rewritten instead of left unmatched to its stock.
 *
 * @example
 *   zohoLineChanged(
 *     { ...line, sku: '1358261-2021-0100-750' },
 *     { ...zoho, sku: '1358261-2021-0100-750' },
 *   ); // true — stored mis-dashed
 *
 * @param local - The line as stored in zoho_sales_order_items
 * @param zoho - The same line as Zoho returns it now
 * @returns True when the stored line must be rewritten
 */
const zohoLineChanged = (local: StoredLine, zoho: ZohoLine) => {
  return (
    local.quantity !== zoho.quantity ||
    local.rate !== zoho.rate ||
    local.name !== zoho.name ||
    local.itemTotal !== zoho.item_total ||
    (local.sku ?? '') !== (canonicalSku(zoho.sku) ?? '') ||
    (local.description ?? '') !== (zoho.description ?? '')
  );
};

export default zohoLineChanged;
