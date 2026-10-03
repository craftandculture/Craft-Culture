import postSlackWebhook from '@/lib/slack/postSlackWebhook';
import logger from '@/utils/logger';

/** The environment variable holding the #tasks incoming webhook */
export const TASKS_WEBHOOK_ENV = 'SLACK_TASKS_WEBHOOK_URL';

/**
 * Post a message to #tasks without ever blocking the action behind it
 *
 * Ticking, closing or adding a job must succeed even if Slack is down or the
 * webhook is not yet set up. Failures are logged and reported back, so the
 * screen can say the post did not go, rather than swallowing it.
 *
 * @example
 *   const { posted } = await postTasksSlack('Closed: *Wynn*');
 *
 * @param text - Slack mrkdwn text
 * @returns Whether the post was delivered
 */
const postTasksSlack = async (text: string) => {
  if (!process.env[TASKS_WEBHOOK_ENV]) {
    return { posted: false, reason: 'not_connected' as const };
  }

  try {
    await postSlackWebhook(TASKS_WEBHOOK_ENV, { text });
    return { posted: true, reason: null };
  } catch (error) {
    logger.error('Team Tasks: Slack post failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return { posted: false, reason: 'error' as const };
  }
};

export default postTasksSlack;
