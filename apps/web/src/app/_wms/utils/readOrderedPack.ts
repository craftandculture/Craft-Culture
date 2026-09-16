import parseSkuPack from './parseSkuPack';

/**
 * How many bottles are in one "case" of an order line
 *
 * The SKU first, the description second. The SKU is the pack being sold and is
 * a code someone maintains; the description is free text on the Zoho item and
 * drifts — "1x75cl" sat on a twelve-can case of NICE and on six-packs of rum,
 * which made a 120-can order read as ten bottles.
 *
 * It is read here, once, because it was read in five places and only two of
 * them consulted the SKU. Correcting a code in Zoho therefore fixed the
 * matching and left the quantities alone: the pick screen would find the right
 * bay and release a twelfth of the wine, with both figures on the same screen
 * and nothing to say which was right.
 *
 * @example
 *   readOrderedPack('NICECANMAL-0000-12-00180', '1x75cl'); // 12
 *   readOrderedPack(null, '6x75cl'); // 6
 *
 * @param sku - The line's SKU, LWIN-shaped or a supplier code
 * @param description - The line's pack text, e.g. "6x75cl"
 * @returns Bottles per ordered case; 1 when neither says
 */
/**
 * The ordered pack when it is actually stated, or null when nothing says.
 *
 * The distinction matters where quantities are decided. Defaulting an unknown
 * pack to 1 reads a Cases line as singles: CASA LOTOS came through as
 * SOT-CAS-750-BTL-UAE-BLC with no pack in the SKU and none in the description,
 * so 20 cases were released as 20 bottles and the pick cracked four 6-packs
 * instead of pulling twenty. Callers that decide how much to move must know
 * the difference between "one bottle" and "nobody said".
 *
 * @param sku - The line's SKU, LWIN-shaped or a supplier code
 * @param description - The line's pack text, e.g. "6x75cl"
 * @returns Bottles per ordered case, or null when neither states it
 */
export const readOrderedPackOrNull = (
  sku: string | null | undefined,
  description: string | null | undefined,
) => {
  const skuPack = parseSkuPack(sku ?? null)?.pack ?? 0;

  if (skuPack > 0) return skuPack;

  const match = /^(\d+)\s*[x×]/i.exec((description ?? '').trim());
  const descPack = match && Number(match[1]) > 0 ? Number(match[1]) : 0;

  return descPack > 0 ? descPack : null;
};

const readOrderedPack = (
  sku: string | null | undefined,
  description: string | null | undefined,
) => readOrderedPackOrNull(sku, description) ?? 1;

export default readOrderedPack;
