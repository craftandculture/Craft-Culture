import { client } from '@/database/client';
import postSlackWebhook from '@/lib/slack/postSlackWebhook';
import logger from '@/utils/logger';

import fetchCityDrinksStock from './fetchCityDrinksStock';
import getDailyOutletSales from './getDailyOutletSales';
import writeSnapshot from './writeSnapshot';
import formatDailySalesForSlack from '../utils/formatDailySalesForSlack';

/** The #cd-sales incoming webhook */
const DAILY_SALES_WEBHOOK_ENV = 'SLACK_CD_SALES_WEBHOOK_URL';

interface OutletRow {
  id: string;
  name: string;
  apiUrl: string | null;
  apiTokenEnv: string | null;
}

/**
 * Pull each API outlet's position, then post yesterday's sales to Slack
 *
 * Pulls first, rather than trusting that the 06:30 sync ran. The sync lives on
 * Trigger.dev, whose deploys have been blocked before; the report runs on
 * Vercel, and a report that quietly repeated yesterday's figures because the
 * pull never happened would be worse than no report. Writing the same
 * position twice is harmless — a snapshot is keyed on the feed's own
 * generation time and replaced, not duplicated.
 *
 * A failed pull does not stop the post: the message is built from whatever
 * positions exist, and says when a window spans more than a day.
 *
 * @returns What was posted for each outlet, and anything that failed
 */
const sendDailySalesReport = async () => {
  const outlets = await client<OutletRow[]>`
    SELECT id, name, api_url AS "apiUrl", api_token_env AS "apiTokenEnv"
    FROM cons_outlets
    WHERE is_active AND connector = 'api'
    ORDER BY name
  `;

  const results: { outlet: string; posted: boolean; bottles: number; note?: string }[] = [];

  for (const outlet of outlets) {
    let note: string | undefined;

    try {
      const parsed = await fetchCityDrinksStock(outlet);
      await writeSnapshot(client, outlet.id, parsed);
    } catch (error) {
      note = `Pull failed: ${error instanceof Error ? error.message : String(error)}`;
      logger.error(`Daily sales: pulling ${outlet.name} failed`, { error: note });
    }

    const sales = await getDailyOutletSales(outlet.id, 1);
    const message = formatDailySalesForSlack(sales);

    await postSlackWebhook(DAILY_SALES_WEBHOOK_ENV, message);

    const day = sales.days[0];

    results.push({
      outlet: outlet.name,
      posted: true,
      bottles: day ? day.consigned.bottles + day.bought.bottles : 0,
      note,
    });
  }

  return { outlets: results };
};

export default sendDailySalesReport;
