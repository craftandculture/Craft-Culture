import getCatalogueRows from '@/app/_wms/data/getCatalogueRows';
import { lwinPakKeyOf } from '@/app/_wms/utils/lwinPakKey';

/**
 * One catalogue row, priced exactly as the list prices it
 *
 * A purchase must never take its price from the browser. Reading it back
 * through the same function the price list uses means the figure a member is
 * charged and the figure they were shown cannot drift apart — including the
 * mandate floor, which a second implementation would forget.
 *
 * Matched pack-agnostically, because a member buying a wine the catalogue lists
 * once may be served from a different pack of the same wine.
 *
 * @param lwin18 - The catalogue row being bought
 * @returns The row, or null if it has left the list
 */
const getCatalogueRowFor = async (lwin18: string) => {
  const key = lwinPakKeyOf(lwin18);
  const rows = await getCatalogueRows({});

  return (
    rows.find((row) => row.lwin18 === lwin18) ??
    rows.find((row) => lwinPakKeyOf(row.lwin18) === key) ??
    null
  );
};

export default getCatalogueRowFor;
