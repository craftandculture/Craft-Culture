import normalizeLwin18 from '@/app/_lwin/utils/normalizeLwin18';

/**
 * Canonicalise a Zoho SKU to the dashed LWIN18 form when it encodes one — even
 * if the dashes were entered in the wrong places (e.g. `1358261-2021-0100-750`
 * → `1358261-2021-01-00750`). Non-LWIN SKUs (alphanumeric, wrong length) are
 * returned trimmed & unchanged so real dashes aren't stripped. The pick's pack
 * count and the stock match both come off this SKU, so a mis-dashed value must
 * not be stored on any path that writes Zoho line items.
 *
 * @example
 *   canonicalSku('1358261-2021-0100-750'); // '1358261-2021-01-00750'
 *   canonicalSku('GIN-001'); // 'GIN-001'
 *
 * @param sku - The SKU as Zoho returned it
 * @returns The canonical SKU, or null when given null/undefined
 */
const canonicalSku = (sku: string | null | undefined): string | null => {
  if (sku == null) return null;
  const digits = sku.replace(/-/g, '');
  return /^\d{18}$/.test(digits) ? normalizeLwin18(digits) : sku.trim();
};

export default canonicalSku;
