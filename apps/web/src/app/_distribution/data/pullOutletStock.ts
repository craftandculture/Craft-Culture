import linkBundleSkusFromFeed from '@/app/_privateClientOrders/utils/linkBundleSkusFromFeed';
import { client } from '@/database/client';
import logger from '@/utils/logger';

import fetchCityDrinksStock from './fetchCityDrinksStock';
import writeSnapshot from './writeSnapshot';

interface OutletRow {
  id: string;
  name: string;
  connector: string;
  apiUrl: string | null;
  apiTokenEnv: string | null;
}

/**
 * Pull API-connected outlets' stock positions and link PCO bundle SKUs
 *
 * One definition for the Pull their stock button and the daily 06:30 Dubai
 * pull, which moved from Trigger.dev to a Vercel cron in October 2026. One
 * outlet failing never costs the others their pull: each result says whether
 * it worked and why not.
 *
 * @example
 *   const { results } = await pullOutletStock();
 *
 * @param options.outletId - One outlet; omit for every API-connected outlet
 * @returns Each outlet's result, and whether any outlet is connected at all
 */
const pullOutletStock = async ({ outletId }: { outletId?: string } = {}) => {
  const outlets = await client<OutletRow[]>`
    SELECT id, name, connector,
           api_url AS "apiUrl", api_token_env AS "apiTokenEnv"
    FROM cons_outlets
    WHERE is_active
      AND connector = 'api'
      ${outletId ? client`AND id = ${outletId}` : client``}
    ORDER BY name
  `;

  if (outlets.length === 0) {
    return { results: [], notConnected: true as const };
  }

  const results = [];

  for (const outlet of outlets) {
    /*
      One outlet failing must not cost the others their pull. The failure is
      returned rather than thrown so the caller sees which outlet, and why,
      beside the ones that worked.
    */
    try {
      const parsed = await fetchCityDrinksStock(outlet);
      const written = await writeSnapshot(client, outlet.id, parsed);

      // PCO bundles in the feed give their orders a distributor SKU; a
      // failure here is logged, since the snapshot itself is already saved
      let pcoSkusLinked = 0;
      try {
        const bundles = await linkBundleSkusFromFeed(client, {
          outletId: outlet.id,
          rows: parsed.rows,
        });
        pcoSkusLinked = bundles.linked;
      } catch (error) {
        logger.error('Linking PCO bundle SKUs failed', {
          outlet: outlet.name,
          error: error instanceof Error ? error.message : String(error),
        });
      }

      results.push({ outlet: outlet.name, ok: true as const, ...written, pcoSkusLinked });
    } catch (error) {
      results.push({
        outlet: outlet.name,
        ok: false as const,
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { results, notConnected: false as const };
};

export default pullOutletStock;
