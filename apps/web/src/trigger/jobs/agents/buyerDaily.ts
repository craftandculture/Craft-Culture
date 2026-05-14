import { logger, task } from '@trigger.dev/sdk';

import runBuyer from '@/app/_agents/lib/runBuyer';

/**
 * On-demand Purchasing task — triggered via REST API from the dashboard "Run Now" button
 */
export const buyerRunTask = task({
  id: 'buyer-run',
  async run() {
    logger.info('Purchasing agent triggered on-demand');
    return runBuyer();
  },
});
