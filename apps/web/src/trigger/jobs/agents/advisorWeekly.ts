import { logger, schedules, task } from '@trigger.dev/sdk';

import runAdvisor from '@/app/_agents/lib/runAdvisor';

/**
 * On-demand Advisor task — triggered via REST API from the dashboard "Run Now" button
 */
export const advisorRunTask = task({
  id: 'advisor-run',
  async run() {
    logger.info('Advisor agent triggered on-demand');
    return runAdvisor();
  },
});

/**
 * The Advisor — Weekly strategic intelligence agent (scheduled)
 *
 * Runs weekly on Monday at 07:00 GST (after all other agents).
 */
export const advisorWeeklyJob = schedules.task({
  id: 'advisor-weekly',
  cron: {
    pattern: '0 7 * * 1',
    timezone: 'Asia/Dubai',
  },
  async run() {
    logger.info('Advisor weekly scheduled run starting');
    return runAdvisor();
  },
});
