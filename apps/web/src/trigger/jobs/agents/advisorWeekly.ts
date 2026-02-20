import { logger, schedules, task } from '@trigger.dev/sdk';

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

/**
 * Business — Weekly strategic intelligence agent (scheduled)
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
    logger.info('Business weekly scheduled run starting');
    return runAdvisor();
  },
});
