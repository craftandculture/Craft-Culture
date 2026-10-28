import { and, eq, gte, inArray, ne } from 'drizzle-orm';

import db from '@/database/client';
import { memberEmailOutbox, users } from '@/database/schema';
import logger from '@/utils/logger';

import getCellarHolderIds from './getCellarHolderIds';
import {
  MEMBER_EMAIL_DAILY_CAP,
  MEMBER_EMAIL_EVENTS,
  type MemberEmailKind,
} from '../constants/memberEmailEvents';
import { gulfDay, nextMergeSlot, nextMorning, outsideQuietHours } from '../utils/memberEmailTiming';

interface QueueMemberEmailParams {
  kind: MemberEmailKind;
  /** The cellar; its holders receive the email, delegates do not */
  partnerId: string;
  /** What the email is about: a delivery, a move, a shipment line */
  entityId: string;
  /** The Loops data variables, apart from the member's name */
  data: Record<string, unknown>;
  /** When the event happened */
  at?: Date;
}

/**
 * Queue a member email, to be sent by the member-emails cron when it is due
 *
 * Applies the rules tested in emailPolicy.mjs: one email per member, event
 * and entity (a second call is ignored); mergeable updates wait for the next
 * 12:00 or 17:00 slot so a day's events combine; nothing is due between 21:00
 * and 08:00 Gulf time; and updates beyond two a day wait for the next morning,
 * while anything asking the member to act is never held. Nothing is sent
 * here, and the switch decides later where it goes.
 *
 * Never throws: the event itself has already happened and must stand.
 *
 * @param params - The event, the cellar and the email's variables
 * @returns How many emails were queued
 */
const queueMemberEmail = async ({ kind, partnerId, entityId, data, at = new Date() }: QueueMemberEmailParams) => {
  try {
    const rule = MEMBER_EMAIL_EVENTS[kind];

    const holderIds = await getCellarHolderIds(partnerId);
    if (holderIds.length === 0) return 0;

    const recipients = await db
      .select({ id: users.id, name: users.name, email: users.email })
      .from(users)
      .where(inArray(users.id, holderIds));

    let queued = 0;

    for (const recipient of recipients) {
      if (!recipient.email) continue;

      let sendAt = 'merge' in rule && rule.merge ? nextMergeSlot(at) : outsideQuietHours(at);

      if (!rule.action) {
        // Updates already due for this member, by Gulf day, against the cap
        const due = await db
          .select({ sendAt: memberEmailOutbox.sendAt, kind: memberEmailOutbox.kind })
          .from(memberEmailOutbox)
          .where(
            and(
              eq(memberEmailOutbox.recipientUserId, recipient.id),
              eq(memberEmailOutbox.isAction, false),
              ne(memberEmailOutbox.status, 'merged'),
              ne(memberEmailOutbox.status, 'suppressed'),
              // Only days this email could land on matter
              gte(memberEmailOutbox.sendAt, new Date(at.getTime() - 24 * 60 * 60 * 1000)),
            ),
          );

        const perDay = new Map<string, number>();
        for (const row of due) perDay.set(gulfDay(row.sendAt), (perDay.get(gulfDay(row.sendAt)) ?? 0) + 1);

        // A mergeable update joining one already due that slot does not add to the count
        const joinsTwin = 'merge' in rule && rule.merge && due.some((row) => row.kind === kind && row.sendAt.getTime() === sendAt.getTime());

        while (!joinsTwin && (perDay.get(gulfDay(sendAt)) ?? 0) >= MEMBER_EMAIL_DAILY_CAP) {
          sendAt = nextMorning(sendAt);
        }
      }

      const inserted = await db
        .insert(memberEmailOutbox)
        .values({
          dedupeKey: `${recipient.id}:${kind}:${entityId}`,
          kind,
          entityId,
          partnerId,
          recipientUserId: recipient.id,
          recipientEmail: recipient.email,
          recipientName: recipient.name ?? '',
          template: rule.template,
          data: { ...data, name: recipient.name ?? '' },
          isAction: rule.action,
          isMergeable: 'merge' in rule && !!rule.merge,
          sendAt,
        })
        .onConflictDoNothing({ target: memberEmailOutbox.dedupeKey })
        .returning({ id: memberEmailOutbox.id });

      queued += inserted.length;
    }

    return queued;
  } catch (error) {
    logger.error('Failed to queue a member email', {
      kind,
      partnerId,
      entityId,
      error: error instanceof Error ? error.message : String(error),
    });
    return 0;
  }
};

export default queueMemberEmail;
