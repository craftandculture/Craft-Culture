import { and, desc, gte, inArray, sql } from 'drizzle-orm';

import db from '@/database/client';
import { memberEmailOutbox } from '@/database/schema';
import { staffAdminProcedure } from '@/lib/trpc/procedures';

import getMemberEmailMode, { MEMBER_EMAIL_SHADOW_INBOX } from '../data/getMemberEmailMode';

/**
 * The member email switch and the outbox: what is waiting, and what went where
 *
 * Shows the latest 200 emails with the member each was meant for, so in
 * shadow mode the team can read every email a member would have received and
 * check it against what actually happened.
 */
const adminGetMemberEmails = staffAdminProcedure.query(async () => {
  const mode = await getMemberEmailMode();

  const rows = await db
    .select({
      id: memberEmailOutbox.id,
      kind: memberEmailOutbox.kind,
      recipientName: memberEmailOutbox.recipientName,
      recipientEmail: memberEmailOutbox.recipientEmail,
      subject: sql<string | null>`${memberEmailOutbox.data}->>'subject'`,
      reference: sql<string | null>`${memberEmailOutbox.data}->>'reference'`,
      sendAt: memberEmailOutbox.sendAt,
      status: memberEmailOutbox.status,
      sentMode: memberEmailOutbox.sentMode,
      sentTo: memberEmailOutbox.sentTo,
      sentAt: memberEmailOutbox.sentAt,
      error: memberEmailOutbox.error,
    })
    .from(memberEmailOutbox)
    .orderBy(desc(memberEmailOutbox.createdAt))
    .limit(200);

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [sent] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(memberEmailOutbox)
    .where(and(inArray(memberEmailOutbox.status, ['sent', 'shadowed']), gte(memberEmailOutbox.sentAt, since)));

  return {
    mode,
    shadowInbox: MEMBER_EMAIL_SHADOW_INBOX,
    sentLast30Days: Number(sent?.count ?? 0),
    rows,
  };
});

export default adminGetMemberEmails;
