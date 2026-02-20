import { logger, schedules, task } from '@trigger.dev/sdk';

import runBuyer from '@/app/_agents/lib/runBuyer';

/**
 * On-demand Buyer task — triggered via REST API from the dashboard "Run Now" button
 */
export const buyerRunTask = task({
  id: 'buyer-run',
  async run() {
    logger.info('Buyer agent triggered on-demand');
    return runBuyer();
  },
});

/**
 * The Buyer — Daily purchasing intelligence agent (scheduled)
 *
 * Runs daily at 06:30 GST.
 */
export const buyerDailyJob = schedules.task({
  id: 'buyer-daily',
  cron: {
    pattern: '30 6 * * *',
    timezone: 'Asia/Dubai',
  },
  async run() {
    logger.info('Buyer daily scheduled run starting');
    return runBuyer();
  },
});
