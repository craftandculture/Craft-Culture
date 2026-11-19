import { and, eq, gte, inArray } from 'drizzle-orm';

import db from '@/database/client';
import { distributorWarehouseUpdates } from '@/database/schema';
import logger from '@/utils/logger';

import deliverWarehouseEmail from './deliverWarehouseEmail';
import getWarehouseUpdateMode from './getWarehouseUpdateMode';
import getWarehouseUpdatePartners from './getWarehouseUpdatePartners';
import getWarehouseUpdateRecipients from './getWarehouseUpdateRecipients';
import { SUMMARY_LOOKBACK_DAYS } from '../constants';
import type { WarehouseUpdateData } from '../types';
import buildSummaryEmail from '../utils/buildSummaryEmail';
import gulfTime from '../utils/gulfTime';
import isSummaryTime from '../utils/isSummaryTime';
import summariseOpenOrders from '../utils/summariseOpenOrders';

/**
 * The 17:00 end-of-day summary to each distributor that wants one: every open
 * order and where it stands, and what was dispatched today
 *
 * Monday to Saturday, once a day per distributor (the row for the day is
 * claimed before sending, so overlapping runs send one). Nothing is sent on
 * a day with no open orders and nothing dispatched.
 *
 * @param now - The moment
 * @returns What happened this run
 */
const sendWarehouseSummaries = async (now: Date = new Date()) => {
  const result = { due: false, sent: 0, empty: 0, failed: 0 };
  if (!isSummaryTime(now)) return result;
  result.due = true;

  const mode = await getWarehouseUpdateMode();
  const prefs = await getWarehouseUpdatePartners();
  const today = gulfTime(now);
  const dayStart = new Date(Date.UTC(today.year, today.month, today.date, -4));
  const since = new Date(now.getTime() - SUMMARY_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  const dayText = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Dubai' }).format(now);

  for (const [partnerId, pref] of prefs) {
    if (!pref.summary) continue;

    const [claimed] = await db
      .insert(distributorWarehouseUpdates)
      .values({
        dedupeKey: `summary:${partnerId}:${today.day}`,
        partnerId,
        kind: 'summary',
        data: { orders: [] },
        sendAt: now,
        status: 'sending',
      })
      .onConflictDoNothing({ target: distributorWarehouseUpdates.dedupeKey })
      .returning({ id: distributorWarehouseUpdates.id });
    if (!claimed) continue;

    const finish = (set: Partial<typeof distributorWarehouseUpdates.$inferInsert>) =>
      db
        .update(distributorWarehouseUpdates)
        .set({ ...set, updatedAt: new Date() })
        .where(eq(distributorWarehouseUpdates.id, claimed.id));

    if (mode === 'off') {
      await finish({ status: 'suppressed', sentMode: mode });
      continue;
    }

    const events = await db
      .select({ kind: distributorWarehouseUpdates.kind, createdAt: distributorWarehouseUpdates.createdAt, data: distributorWarehouseUpdates.data })
      .from(distributorWarehouseUpdates)
      .where(
        and(
          eq(distributorWarehouseUpdates.partnerId, partnerId),
          inArray(distributorWarehouseUpdates.kind, ['received', 'picked', 'ready', 'problem']),
          gte(distributorWarehouseUpdates.createdAt, since),
        ),
      );

    const summary = summariseOpenOrders(
      events.map((event) => ({ ...event, data: event.data as unknown as WarehouseUpdateData })),
      dayStart,
    );
    if (!summary.picking.length && !summary.packed.length && !summary.dispatchedToday.length) {
      await finish({ status: 'skipped', sentMode: mode });
      result.empty += 1;
      continue;
    }

    const outcome = await deliverWarehouseEmail(
      (name) => buildSummaryEmail(summary, name, dayText),
      await getWarehouseUpdateRecipients(partnerId),
      mode === 'live' ? 'live' : 'shadow',
    );
    await finish({
      status: outcome.status,
      sentMode: mode,
      sentTo: outcome.sentTo,
      sentAt: outcome.status === 'failed' ? null : new Date(),
      error: outcome.error,
      data: { orders: [...summary.packed, ...summary.picking, ...summary.dispatchedToday] },
    });
    if (outcome.status === 'failed') {
      result.failed += 1;
      logger.error('Warehouse summary failed', { partnerId, error: outcome.error });
    } else {
      result.sent += 1;
    }
  }

  return result;
};

export default sendWarehouseSummaries;
