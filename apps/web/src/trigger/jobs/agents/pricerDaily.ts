import { logger, task } from '@trigger.dev/sdk';

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
