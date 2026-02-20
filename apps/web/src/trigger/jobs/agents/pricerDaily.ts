import { logger, schedules, task } from '@trigger.dev/sdk';

import runPricer from '@/app/_agents/lib/runPricer';

/**
 * On-demand Pricing task — triggered via REST API from the dashboard "Run Now" button
 */
export const pricerRunTask = task({
  id: 'pricer-run',
  async run() {
    logger.info('Pricing agent triggered on-demand');
    return runPricer();
  },
});

/**
 * Pricing — Daily pricing optimization agent (scheduled)
 *
 * Runs daily at 06:45 GST.
 */
export const pricerDailyJob = schedules.task({
  id: 'pricer-daily',
  cron: {
    pattern: '45 6 * * *',
    timezone: 'Asia/Dubai',
  },
  async run() {
    logger.info('Pricing daily scheduled run starting');
    return runPricer();
  },
});
