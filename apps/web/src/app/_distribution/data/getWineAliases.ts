import { client } from '@/database/client';

import tableReady from '../utils/tableReady';

export interface WineAlias {
  lwin18: string;
  name: string | null;
}

/**
 * The codes merged into another wine at an outlet
 *
 * Keyed by the folded code's wine key (`wineKey`), so a code is recognised in
 * any pack and with or without its dashes.
 *
 * @example
 *   const aliases = await getWineAliases(outletId);
 *   aliases.get(wineKey('W28500124')); // { lwin18: '3051757-2019-06-00750', … }
 *
 * @param outletId - The outlet
 * @returns Folded code key → the wine it is
 */
const getWineAliases = async (outletId: string) => {
  const aliases = new Map<string, WineAlias>();

  if (!(await tableReady('cons_wine_aliases'))) return aliases;

  const rows = await client<{ fromKey: string; lwin18: string; name: string | null }[]>`
    SELECT from_key AS "fromKey", to_lwin18 AS lwin18, to_name AS name
    FROM cons_wine_aliases WHERE outlet_id = ${outletId}
  `;

  for (const row of rows) aliases.set(row.fromKey, { lwin18: row.lwin18, name: row.name });

  return aliases;
};

export default getWineAliases;
