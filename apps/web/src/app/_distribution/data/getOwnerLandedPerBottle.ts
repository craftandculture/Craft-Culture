import { client } from '@/database/client';

import getPricingManagerLanded from './getPricingManagerLanded';
import wineLandedReady from '../utils/wineLandedReady';

/**
 * What a wine cost one owner, landed, chosen the way their statement chooses it
 *
 * The partner statement prefers, in order: a figure set by hand for that owner,
 * the live Pricing Manager figure, then the last figure remembered for that
 * owner. A cellar sale of the same partner's wine has to owe the same amount,
 * or the statement and the debt disagree — most visibly for a wine two owners
 * hold at two costs, which only the per-owner figure can express.
 *
 * Read-only: the statement is what writes figures down, this only reads them.
 *
 * @example
 *   const landed = await getOwnerLandedPerBottle(ownerId, ['1095320201906']);
 *
 * @param ownerId - The partner whose wine sold
 * @param keys - Wine keys (wineKey) to price
 * @returns Landed cost per bottle, keyed by wine key; absent when unknown
 */
const getOwnerLandedPerBottle = async (ownerId: string, keys: string[]) => {
  const result = new Map<string, number>();

  if (keys.length === 0) return result;

  const live = await getPricingManagerLanded(keys);

  const remembered = (await wineLandedReady())
    ? await client<{ key: string; landedPerBottle: number; source: string }[]>`
        SELECT wine_key AS key, landed_per_bottle::float8 AS "landedPerBottle",
               source
        FROM cons_wine_landed
        WHERE owner_id = ${ownerId}
          AND wine_key = ANY(${keys}::text[])
      `
    : [];

  for (const key of keys) {
    const kept = remembered.find((row) => row.key === key);
    const now = live.find((row) => row.key === key);
    const chosen = kept?.source === 'by-hand' ? kept : (now ?? kept);

    if (chosen && chosen.landedPerBottle > 0) {
      result.set(key, chosen.landedPerBottle);
    }
  }

  return result;
};

export default getOwnerLandedPerBottle;
