/**
 * Post a message to a Slack channel through an incoming webhook
 *
 * A webhook rather than a bot token: it is bound to one channel when it is
 * created in Slack, so nothing here can post anywhere else, and there is no
 * token with wider reach to leak.
 *
 * Throws when the webhook is not configured or Slack refuses the message,
 * rather than returning quietly. A scheduled report that silently stops is
 * worse than one that fails loudly, and this project has already lost ten days
 * of invoice sync to a skip that said nothing.
 *
 * @param envName - The environment variable holding the webhook URL
 * @param message - Slack message payload: `text` plus optional `blocks`
 */
const postSlackWebhook = async (
  envName: string,
  message: { text: string; blocks?: unknown[] },
) => {
  const url = process.env[envName];

  if (!url) {
    throw new Error(`${envName} is not set, so there is no Slack channel to post to`);
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(message),
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');

    throw new Error(`Slack refused the message (${response.status}): ${detail.slice(0, 200)}`);
  }
};

export default postSlackWebhook;
