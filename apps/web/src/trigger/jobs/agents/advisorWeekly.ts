import { logger, task } from '@trigger.dev/sdk';

import runAdvisor from '@/app/_agents/lib/runAdvisor';

/**
 * On-demand Business task — triggered via REST API from the dashboard "Run Now" button
 */
export const advisorRunTask = task({
  id: 'advisor-run',
  async run() {
    logger.info('Business agent triggered on-demand');
    return runAdvisor();
  },
});
