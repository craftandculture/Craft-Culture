import { client } from '@/database/client';
import postSlackWebhook from '@/lib/slack/postSlackWebhook';

import getOutletReorderList from './getOutletReorderList';
import formatReorderForSlack from '../utils/formatReorderForSlack';

/** The C&C-only reorder channel's incoming webhook */
export const REORDER_WEBHOOK_ENV = 'SLACK_CD_REORDER_WEBHOOK_URL';

/**
 * Post each API outlet's low and out-of-stock wines to the reorder channel
 *
 * Runs after the daily sales report, which has already pulled the outlet's
 * stock that morning, so this reads the fresh snapshot rather than pulling
 * again.
 *
 * @returns Per outlet, how many wines were flagged
 */
const sendReorderReport = async () => {
  const outlets = await client<{ id: string; name: string }[]>`
    SELECT id, name FROM cons_outlets
    WHERE is_active AND connector = 'api'
    ORDER BY name
  `;

  const results: { outlet: string; outOfStock: number; low: number }[] = [];

  for (const outlet of outlets) {
    const { takenAt, lines } = await getOutletReorderList(outlet.id);
    await postSlackWebhook(REORDER_WEBHOOK_ENV, formatReorderForSlack(outlet.name, takenAt, lines));
    results.push({
      outlet: outlet.name,
      outOfStock: lines.filter((l) => l.status === 'oos').length,
      low: lines.filter((l) => l.status === 'low').length,
    });
  }

  return { outlets: results };
};

export default sendReorderReport;
