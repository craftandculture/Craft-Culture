import { eq, sql } from 'drizzle-orm';

import db from '@/database/client';
import { settings } from '@/database/schema';
import postSlackWebhook from '@/lib/slack/postSlackWebhook';
import serverConfig from '@/server.config';

import formatOrderFeedLine from '../utils/formatOrderFeedLine';
import type { OrderFeedEvent } from '../utils/formatOrderFeedLine';

/** The environment variable holding the #private-orders incoming webhook */
export const ORDER_FEED_WEBHOOK_ENV = 'SLACK_PRIVATE_ORDERS_WEBHOOK_URL';

/** Where the feed has read up to: the last event's time, as Postgres wrote it */
const CURSOR_KEY = 'pco_slack_feed_cursor';

/** At most this many events a run, so a backlog drains over a few runs */
const PER_RUN = 60;

interface FeedRow extends Record<string, unknown> {
  at: string;
  kind: 'created' | 'activity';
  action: string | null;
  previous_status: string | null;
  new_status: string | null;
  order_id: string;
  order_number: string;
  client_name: string | null;
  partner_name: string | null;
  total_usd: number | null;
  by_name: string | null;
  scheduled_date: string | null;
  notes: string | null;
}

const rowsOf = <T>(result: unknown) =>
  (Array.isArray(result) ? result : (result as { rows: T[] }).rows) as T[];

/**
 * Post every new private order, and every step an order takes, to #private-orders
 *
 * Reads two things since the last run: orders created (drafts excepted, until
 * they are submitted) and the order activity log, which every status change
 * already writes to. Nothing in the 34 places that move an order had to
 * change, so a new step is in the feed the day it is logged. The first run
 * only remembers where it is, so the channel does not open with the year's
 * history. Lines are posted in time order, several to a message.
 *
 * @example
 *   const result = await sendOrderFeed();
 *
 * @returns How many events were posted, and whether Slack is connected
 */
const sendOrderFeed = async () => {
  const [cursorRow] = await db
    .select({ value: settings.value })
    .from(settings)
    .where(eq(settings.key, CURSOR_KEY))
    .limit(1);

  if (!cursorRow) {
    await db
      .insert(settings)
      .values({ key: CURSOR_KEY, value: new Date().toISOString() })
      .onConflictDoNothing();
    return { posted: 0, reason: 'started' as const };
  }

  if (!process.env[ORDER_FEED_WEBHOOK_ENV]) {
    return { posted: 0, reason: 'not_connected' as const };
  }

  const since = cursorRow.value;

  const rows = rowsOf<FeedRow>(
    await db.execute(sql`
      SELECT * FROM (
        SELECT o.created_at::text AS at, 'created' AS kind, NULL AS action,
               NULL AS previous_status, o.status::text AS new_status,
               o.id::text AS order_id, o.order_number, o.client_name,
               p.business_name AS partner_name, o.total_usd,
               NULL AS by_name, NULL AS scheduled_date, NULL AS notes
          FROM private_client_orders o
          LEFT JOIN partners p ON p.id = o.partner_id
         WHERE o.created_at > ${since}::timestamptz
           AND o.status::text <> 'draft'
           AND NOT EXISTS (
             SELECT 1 FROM private_client_order_activity_logs l
              WHERE l.order_id = o.id AND l.action = 'order_submitted'
           )
        UNION ALL
        SELECT l.created_at::text, 'activity', l.action,
               l.previous_status::text, l.new_status::text,
               o.id::text, o.order_number, o.client_name,
               p.business_name, o.total_usd,
               u.name, l.metadata->>'scheduledDate', l.notes
          FROM private_client_order_activity_logs l
          JOIN private_client_orders o ON o.id = l.order_id
          LEFT JOIN partners p ON p.id = o.partner_id
          LEFT JOIN users u ON u.id = l.user_id
         WHERE l.created_at > ${since}::timestamptz
      ) events
      ORDER BY at
      LIMIT ${PER_RUN}
    `),
  );

  if (!rows.length) return { posted: 0, reason: null };

  const lines = rows
    .map((row) => {
      const event: OrderFeedEvent = {
        kind: row.kind,
        action: row.kind === 'activity' && row.action === 'order_submitted' ? null : row.action,
        previousStatus: row.previous_status,
        newStatus: row.new_status,
        orderNumber: row.order_number,
        clientName: row.client_name,
        partnerName: row.partner_name,
        totalUsd: row.total_usd,
        byName: row.by_name,
        scheduledDate: row.scheduled_date,
        notes: row.notes,
        url: `${serverConfig.appUrl}/platform/admin/private-orders/${row.order_id}`,
      };
      // A partner's submission is the order's arrival, so it reads as a new order
      if (row.action === 'order_submitted') event.kind = 'created';
      return formatOrderFeedLine(event);
    })
    .filter((line): line is string => Boolean(line));

  // Slack caps a message, so long runs go out in several
  for (let i = 0; i < lines.length; i += 20) {
    await postSlackWebhook(ORDER_FEED_WEBHOOK_ENV, { text: lines.slice(i, i + 20).join('\n') });
  }

  /*
    Moved on only after Slack has taken every post, so a failure repeats the
    run rather than losing it. The timestamp is kept as Postgres printed it,
    to the microsecond, so the last event is not read twice.
  */
  await db
    .update(settings)
    .set({ value: rows[rows.length - 1]!.at, updatedAt: new Date() })
    .where(eq(settings.key, CURSOR_KEY));

  return { posted: lines.length, reason: null };
};

export default sendOrderFeed;
