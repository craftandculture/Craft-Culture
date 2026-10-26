import { and, asc, eq, gte, inArray, lte, sql } from 'drizzle-orm';
import type { TransactionalVariables } from 'loops';

import settingsUpdateController from '@/app/_admin/controllers/settingsUpdateController';
import db from '@/database/client';
import { memberEmailOutbox, settings } from '@/database/schema';
import loops from '@/lib/loops/client';
import postSlackWebhook from '@/lib/slack/postSlackWebhook';
import logger from '@/utils/logger';

import getMemberEmailMode, { MEMBER_EMAIL_SHADOW_INBOX } from './getMemberEmailMode';
import { MEMBER_EMAIL_TEMPLATES, type MemberEmailTemplate } from '../constants/memberEmailEvents';
import { gulfDay } from '../utils/memberEmailTiming';
import mergeMemberEmails from '../utils/mergeMemberEmails';

/** Emails sent per run; the cron runs every 10 minutes */
const BATCH = 100;

/** The Loops Free plan sends 4,000 emails in any 30 days, across every email the app sends */
const LOOPS_FREE_LIMIT = 4000;
const WARN_AT = 3000;

export const MEMBER_EMAILS_WEBHOOK_ENV = 'SLACK_CELLAR_WEBHOOK_URL';
const WARNED_SETTING = 'cellar_emails.limit_warned_on';

/**
 * Post once a day to Slack when the app's member emails pass 3,000 in 30 days
 *
 * Only counts what this outbox sent; partner emails also count against the
 * Loops limit, so this is the earliest the warning can be trusted to be late.
 */
const warnNearLimit = async (now: Date) => {
  try {
    const since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const [row] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(memberEmailOutbox)
      .where(and(inArray(memberEmailOutbox.status, ['sent', 'shadowed']), gte(memberEmailOutbox.sentAt, since)));

    const count = Number(row?.count ?? 0);
    if (count < WARN_AT || !process.env[MEMBER_EMAILS_WEBHOOK_ENV]) return;

    const today = gulfDay(now);
    const [warned] = await db
      .select({ value: settings.value })
      .from(settings)
      .where(eq(settings.key, WARNED_SETTING))
      .limit(1);
    if (warned?.value === today) return;

    await postSlackWebhook(MEMBER_EMAILS_WEBHOOK_ENV, {
      text: `Member emails: ${count.toLocaleString('en-GB')} sent in the last 30 days. The Loops Free plan stops all sending at ${LOOPS_FREE_LIMIT.toLocaleString('en-GB')}, partner emails included. Consider the Growth plan.`,
    });
    await settingsUpdateController({ key: WARNED_SETTING, value: today });
  } catch (error) {
    logger.error('Member email limit check failed', { error: error instanceof Error ? error.message : String(error) });
  }
};

/**
 * Send the member emails that are due, the way the switch says
 *
 * Off: nothing is sent and due emails are marked suppressed, so turning the
 * switch on later never releases a backlog. Shadow: each goes to the team
 * inbox with "[SHADOW for <member>]" before the subject. Live: each goes to
 * the member. Mergeable updates due together go as one email.
 *
 * @returns What happened this run
 */
const sendMemberEmails = async () => {
  const mode = await getMemberEmailMode();
  const now = new Date();

  const due = await db
    .select()
    .from(memberEmailOutbox)
    .where(and(eq(memberEmailOutbox.status, 'pending'), lte(memberEmailOutbox.sendAt, now)))
    .orderBy(asc(memberEmailOutbox.sendAt), asc(memberEmailOutbox.createdAt))
    .limit(BATCH);

  if (due.length === 0) return { mode, due: 0, sent: 0, failed: 0 };

  if (mode === 'off') {
    await db
      .update(memberEmailOutbox)
      .set({ status: 'suppressed', sentMode: 'off', updatedAt: now })
      .where(inArray(memberEmailOutbox.id, due.map((row) => row.id)));
    return { mode, due: due.length, sent: 0, failed: 0 };
  }

  const templateById = new Map(due.map((row) => [row.id, row.template as MemberEmailTemplate]));
  const nameById = new Map(due.map((row) => [row.id, row.recipientName]));

  let sent = 0;
  let failed = 0;

  for (const email of mergeMemberEmails(due)) {
    const template = templateById.get(email.carrierId)!;
    const to = mode === 'live' ? email.recipientEmail : MEMBER_EMAIL_SHADOW_INBOX;

    const data = { ...email.data };
    if (mode === 'shadow') {
      const who = `${nameById.get(email.carrierId) || email.recipientEmail} <${email.recipientEmail}>`;
      // The invitation has a fixed subject, so its preview line carries the marker
      if (typeof data.subject === 'string') data.subject = `[SHADOW for ${who}] ${data.subject}`;
      else data.preheader = `[SHADOW for ${who}] ${String(data.preheader ?? '')}`;
    }

    try {
      await loops.sendTransactionalEmail({
        transactionalId: MEMBER_EMAIL_TEMPLATES[template],
        email: to,
        dataVariables: data as unknown as TransactionalVariables,
      });

      await db
        .update(memberEmailOutbox)
        .set({ status: mode === 'live' ? 'sent' : 'shadowed', sentMode: mode, sentTo: to, sentAt: new Date(), updatedAt: new Date() })
        .where(eq(memberEmailOutbox.id, email.carrierId));

      if (email.mergedIds.length) {
        await db
          .update(memberEmailOutbox)
          .set({ status: 'merged', mergedInto: email.carrierId, sentMode: mode, updatedAt: new Date() })
          .where(inArray(memberEmailOutbox.id, email.mergedIds));
      }

      sent += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logger.error('Member email failed', { id: email.carrierId, template, error: message });

      await db
        .update(memberEmailOutbox)
        .set({ status: 'failed', sentMode: mode, error: message.slice(0, 1000), updatedAt: new Date() })
        .where(inArray(memberEmailOutbox.id, [email.carrierId, ...email.mergedIds]));

      failed += 1;
    }
  }

  await warnNearLimit(now);

  return { mode, due: due.length, sent, failed };
};

export default sendMemberEmails;
