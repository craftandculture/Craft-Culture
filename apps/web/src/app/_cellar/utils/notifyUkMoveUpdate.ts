import { eq } from 'drizzle-orm';

import getCellarStaffIds from '@/app/_cellar/data/getCellarStaffIds';
import getPartnerUserIds from '@/app/_cellar/data/getPartnerUserIds';
import createNotification from '@/app/_notifications/utils/createNotification';
import db from '@/database/client';
import { partners } from '@/database/schema';
import serverConfig from '@/server.config';

import { queueUkMoveQuoted, queueUkMoveSentBack, queueUkMoveShipped } from '../data/queueCellarEmails';

export type UkMoveEvent =
  | 'submitted'
  | 'withdrawn'
  | 'accepted'
  | 'quoted'
  | 'shipping'
  | 'cancelled';

export interface NotifyUkMoveUpdateParams {
  event: UkMoveEvent;
  partnerId: string;
  moveId: string;
  moveNumber: string;
  /** The all-in figure, on a quote */
  totalUsd?: number | null;
  /** Our reason, when we close a move */
  adminNotes?: string | null;
}

/**
 * Tell the right people a UK move has changed
 *
 * The member's own actions are work for the team; everything we do is news
 * for the member. Reuses the delivery notification types, since to a member a
 * move is priced and accepted the same way a delivery is.
 *
 * Never throws: a notice is not worth failing the move over.
 *
 * @param params - What happened, and to whose move
 */
const notifyUkMoveUpdate = async ({
  event,
  partnerId,
  moveId,
  moveNumber,
  totalUsd,
  adminNotes,
}: NotifyUkMoveUpdateParams) => {
  try {
    const forStaff =
      event === 'submitted' || event === 'withdrawn' || event === 'accepted';
    const recipients = forStaff
      ? await getCellarStaffIds()
      : await getPartnerUserIds(partnerId);

    if (recipients.length === 0) return;

    const [partner] = await db
      .select({ name: partners.businessName })
      .from(partners)
      .where(eq(partners.id, partnerId))
      .limit(1);

    const who = partner?.name ?? 'A member';
    const money = (value: number) =>
      `$${value.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
    const staffUrl = `${serverConfig.appUrl}/platform/admin/cellar-members?tab=uk-moves`;
    const memberUrl = `${serverConfig.appUrl}/platform/cellar`;

    const content = {
      submitted: {
        type: 'cellar_release_submitted' as const,
        title: 'UK wine to move to the UAE',
        message: `${who} has asked for wine at LCB Burton to be brought to the UAE on ${moveNumber}. It needs a quote.`,
        actionUrl: staffUrl,
      },
      withdrawn: {
        type: 'cellar_release_submitted' as const,
        title: 'UK move withdrawn',
        message: `${who} has withdrawn ${moveNumber}. Nothing needs doing.`,
        actionUrl: staffUrl,
      },
      accepted: {
        type: 'cellar_release_submitted' as const,
        title: 'UK move accepted',
        message: `${who} has accepted the quote on ${moveNumber}. Place the export order with LCB and create the shipment.`,
        actionUrl: staffUrl,
      },
      quoted: {
        type: 'cellar_release_quoted' as const,
        title: 'Bringing your wine to the UAE',
        message: `${moveNumber} comes to ${
          typeof totalUsd === 'number' ? money(totalUsd) : 'a quoted figure'
        }, all in. Nothing moves until you accept it.`,
        actionUrl: memberUrl,
      },
      shipping: {
        type: 'cellar_release_quoted' as const,
        title: 'Your wine is on its way to the UAE',
        message: `The wine on ${moveNumber} is leaving London City Bond for our UAE warehouse. It will appear in your cellar when it arrives.`,
        actionUrl: memberUrl,
      },
      cancelled: {
        type: 'cellar_release_revision' as const,
        title: 'Your request to move wine has been closed',
        message:
          adminNotes?.trim() ||
          `We have closed ${moveNumber}. Your wine remains at London City Bond.`,
        actionUrl: memberUrl,
      },
    }[event];

    for (const userId of recipients) {
      await createNotification({
        userId,
        type: content.type,
        title: content.title,
        message: content.message,
        entityType: 'cellar_uk_move',
        entityId: moveId,
        actionUrl: content.actionUrl,
        metadata: { moveNumber, totalUsd },
      });
    }

    /* The member's email, queued for the member-emails cron and its switch */
    if (event === 'quoted') await queueUkMoveQuoted({ partnerId, moveId, moveNumber });
    if (event === 'shipping') await queueUkMoveShipped({ partnerId, moveId, moveNumber });
    if (event === 'cancelled') await queueUkMoveSentBack({ partnerId, moveId, moveNumber, adminNotes });
  } catch (error) {
    console.error('Failed to notify on UK move update', {
      moveNumber,
      event,
      error,
    });
  }
};

export default notifyUkMoveUpdate;
