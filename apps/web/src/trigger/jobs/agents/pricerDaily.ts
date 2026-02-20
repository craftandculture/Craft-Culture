import { logger, schedules, task } from '@trigger.dev/sdk';

import runPricer from '@/app/_agents/lib/runPricer';

/**
 * On-demand Pricer task — triggered via REST API from the dashboard "Run Now" button
 */
export const pricerRunTask = task({
  id: 'pricer-run',
  async run() {
    logger.info('Pricer agent triggered on-demand');
    return runPricer();
  },
});

/**
 * The Pricer — Daily pricing optimization agent (scheduled)
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
    logger.info('Pricer daily scheduled run starting');
    return runPricer();
  },
});
