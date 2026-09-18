/**
 * Outlet Stock Sync
 *
 * Pulls each API-connected outlet's stock position into `cons_snapshots`.
 *
 * Daily, not monthly. The City Drinks feed is a live snapshot with no date
 * parameter and no history — one endpoint, one moment — so a boundary missed
 * is a month that can only ever be recovered from an upload. Running every day
 * means a failed run costs a day of precision rather than a month's figure.
 *
 * Two month-boundaries are also what make Sold derivable: opening position,
 * plus what we delivered, less closing position. Until there are two, Sold
 * comes from the distributor's report.
 */

import { logger, schedules } from '@trigger.dev/sdk';

import fetchCityDrinksStock from '@/app/_distribution/data/fetchCityDrinksStock';
import writeSnapshot from '@/app/_distribution/data/writeSnapshot';
import { triggerClient } from '@/trigger/triggerDb';

interface OutletRow {
  id: string;
  name: string;
  apiUrl: string | null;
  apiTokenEnv: string | null;
}

export const outletStockSyncJob = schedules.task({
  id: 'outlet-stock-sync',
  cron: {
    // City Drinks regenerate at 02:00 UTC; this reads it before anyone does
    pattern: '30 6 * * *',
    timezone: 'Asia/Dubai',
  },
  async run() {
    const outlets = await triggerClient<OutletRow[]>`
      SELECT id, name, api_url AS "apiUrl", api_token_env AS "apiTokenEnv"
      FROM cons_outlets
      WHERE is_active AND connector = 'api'
      ORDER BY name
    `;

    if (outlets.length === 0) {
      logger.warn('No API-connected outlet to pull');

      return { outlets: 0 };
    }

    const pulled: Record<string, unknown>[] = [];
    const failures: string[] = [];

    for (const outlet of outlets) {
      /*
        One outlet failing must not cost the others their snapshot — a missed
        pull is a lost month boundary, and there is no way to fetch it back.
      */
      try {
        const parsed = await fetchCityDrinksStock(outlet);
        const written = await writeSnapshot(triggerClient, outlet.id, parsed);

        logger.info(`Pulled ${outlet.name}`, written);
        pulled.push({ outlet: outlet.name, ...written });
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);

        failures.push(`${outlet.name}: ${reason}`);
        logger.error(`Failed to pull ${outlet.name}`, { error });
      }
    }

    /*
      Fail the run when nothing was captured, so Trigger.dev surfaces it. The
      Zoho invoice sync once carried a silent skip and froze for ten days while
      every screen went on showing its last good figures — a feed that cannot
      run has to say so rather than return quietly.
    */
    if (pulled.length === 0) {
      throw new Error(`No outlet position captured. ${failures.join(' · ')}`);
    }

    return { outlets: outlets.length, pulled, failures };
  },
});
