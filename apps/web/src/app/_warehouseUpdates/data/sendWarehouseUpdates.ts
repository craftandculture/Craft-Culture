import { and, asc, eq, gt, inArray, lte, ne } from 'drizzle-orm';

import db from '@/database/client';
import { type DistributorWarehouseUpdate, distributorWarehouseUpdates } from '@/database/schema';
import logger from '@/utils/logger';

import deliverWarehouseEmail from './deliverWarehouseEmail';
import getWarehouseUpdateMode from './getWarehouseUpdateMode';
import getWarehouseUpdatePartners from './getWarehouseUpdatePartners';
import getWarehouseUpdateRecipients from './getWarehouseUpdateRecipients';
import type { WarehouseEmailData, WarehouseUpdateData } from '../types';
import buildPickedEmail from '../utils/buildPickedEmail';
import buildProblemEmail from '../utils/buildProblemEmail';
import buildReadyEmail from '../utils/buildReadyEmail';

const BATCH = 100;

/**
 * Send the warehouse updates that are due: picked & packed (grouped per
 * distributor into one email), ready for dispatch, and problem alerts
 *
 * Off: due updates are set aside and never sent later. Shadow: one copy each
 * to Kevin. Live: to the distributor's Logistics contacts (else Purchasing,
 * else the business email). A distributor switched off since is skipped. A
 * cancelled pick list that has been released again since says nothing.
 *
 * @param now - The moment
 * @returns What happened this run
 */
const sendWarehouseUpdates = async (now: Date = new Date()) => {
  const mode = await getWarehouseUpdateMode();

  // Claimed in one statement, skipping rows another run holds, so nothing goes twice
  const claimable = db
    .select({ id: distributorWarehouseUpdates.id })
    .from(distributorWarehouseUpdates)
    .where(and(eq(distributorWarehouseUpdates.status, 'pending'), lte(distributorWarehouseUpdates.sendAt, now)))
    .orderBy(asc(distributorWarehouseUpdates.sendAt))
    .limit(BATCH)
    .for('update', { skipLocked: true });

  const due = await db
    .update(distributorWarehouseUpdates)
    .set({ status: 'sending', updatedAt: now })
    .where(and(inArray(distributorWarehouseUpdates.id, claimable), eq(distributorWarehouseUpdates.status, 'pending')))
    .returning();

  const result = { mode, due: due.length, sent: 0, skipped: 0, failed: 0 };
  if (due.length === 0) return result;

  const mark = async (ids: string[], set: Partial<DistributorWarehouseUpdate>) => {
    if (ids.length) {
      await db
        .update(distributorWarehouseUpdates)
        .set({ ...set, updatedAt: new Date() })
        .where(inArray(distributorWarehouseUpdates.id, ids));
    }
  };

  const prefs = await getWarehouseUpdatePartners();
  const setAside = due.filter((row) => mode === 'off' || !prefs.has(row.partnerId));
  await mark(
    setAside.map((row) => row.id),
    { status: 'suppressed', sentMode: mode },
  );
  result.skipped += setAside.length;

  const toSend = due.filter((row) => mode !== 'off' && prefs.has(row.partnerId));

  // A cancelled pick list that has been released again since: nothing to say
  const stale: string[] = [];
  for (const row of toSend) {
    const data = row.data as unknown as WarehouseUpdateData;
    if (row.kind !== 'problem' || data.problem !== 'cancelled' || !row.orderId) continue;
    const [again] = await db
      .select({ id: distributorWarehouseUpdates.id })
      .from(distributorWarehouseUpdates)
      .where(
        and(
          eq(distributorWarehouseUpdates.orderId, row.orderId),
          inArray(distributorWarehouseUpdates.kind, ['received', 'picked', 'ready']),
          gt(distributorWarehouseUpdates.createdAt, row.createdAt),
          ne(distributorWarehouseUpdates.id, row.id),
        ),
      )
      .limit(1);
    if (again) stale.push(row.id);
  }
  await mark(stale, { status: 'skipped' });
  result.skipped += stale.length;

  // One email per unit: all of a distributor's picks together, each other update alone
  const units: { rows: typeof toSend; build: (name: string) => WarehouseEmailData }[] = [];
  const live = toSend.filter((row) => !stale.includes(row.id));
  const picksByPartner = new Map<string, typeof toSend>();
  for (const row of live) {
    if (row.kind === 'picked') picksByPartner.set(row.partnerId, [...(picksByPartner.get(row.partnerId) ?? []), row]);
  }
  for (const rows of picksByPartner.values()) {
    const picks = rows.map((row) => row.data as unknown as WarehouseUpdateData);
    units.push({ rows, build: (name) => buildPickedEmail(picks, name) });
  }
  for (const row of live.filter((r) => r.kind === 'ready' || r.kind === 'problem')) {
    const data = row.data as unknown as WarehouseUpdateData;
    units.push({
      rows: [row],
      build: (name) => (row.kind === 'ready' ? buildReadyEmail(data, name) : buildProblemEmail(data, name)),
    });
  }

  const recipientsOf = new Map<string, Awaited<ReturnType<typeof getWarehouseUpdateRecipients>>>();
  for (const unit of units) {
    const partnerId = unit.rows[0]!.partnerId;
    if (!recipientsOf.has(partnerId)) recipientsOf.set(partnerId, await getWarehouseUpdateRecipients(partnerId));

    const outcome = await deliverWarehouseEmail(unit.build, recipientsOf.get(partnerId)!, mode === 'live' ? 'live' : 'shadow');
    await mark(
      unit.rows.map((row) => row.id),
      {
        status: outcome.status,
        sentMode: mode,
        sentTo: outcome.sentTo,
        sentAt: outcome.status === 'failed' ? null : new Date(),
        error: outcome.error,
      },
    );
    if (outcome.status === 'failed') {
      result.failed += 1;
      logger.error('Warehouse update failed', { partnerId, error: outcome.error });
    } else {
      result.sent += 1;
    }
  }

  return result;
};

export default sendWarehouseUpdates;
