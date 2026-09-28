import { eq } from 'drizzle-orm';

import createNotification from '@/app/_notifications/utils/createNotification';
import db from '@/database/client';
import { users } from '@/database/schema';
import loops from '@/lib/loops/client';
import serverConfig from '@/server.config';
import logger from '@/utils/logger';

import { PCO_NOTE_EMAIL_TEMPLATE_ID } from '../constants';
import getPartnerUsers from '../data/getPartnerUsers';

export type NoteParty = 'partner' | 'distributor' | 'admin';

interface NotifyOrderNoteParams {
  orderId: string;
  orderNumber: string;
  partnerId: string | null;
  distributorId: string | null;
  authorUserId: string;
  authorName: string;
  authorParty: NoteParty;
  /** How the author's side is named to the others, e.g. "City Drinks", "C&C" */
  authorPartyName: string;
  note: string;
  /** A C&C-only note: nobody outside C&C is told */
  internal: boolean;
}

/**
 * Tell the other parties on a PCO that a note was added
 *
 * Each side hears about the other sides' notes: in-app, and by email once the
 * Loops template exists. The author's own side is not told, nor is the author.
 * An internal note reaches C&C only. Failures are logged and never undo the
 * note, which is already saved.
 *
 * @param params - The order, the author and the note
 */
const notifyOrderNote = async (params: NotifyOrderNoteParams) => {
  const title = `New note on ${params.orderNumber} from ${params.authorPartyName}`;
  const excerpt =
    params.note.length > 120 ? `${params.note.slice(0, 117)}…` : params.note;

  const audiences: { party: NoteParty; url: string; recipients: Promise<{ id: string; email: string | null; name: string | null }[]> }[] = [];

  if (params.authorParty !== 'admin') {
    audiences.push({
      party: 'admin',
      url: `${serverConfig.appUrl}/platform/admin/private-orders/${params.orderId}`,
      recipients: db
        .select({ id: users.id, email: users.email, name: users.name })
        .from(users)
        .where(eq(users.role, 'admin')),
    });
  }
  if (!params.internal && params.authorParty !== 'partner' && params.partnerId) {
    audiences.push({
      party: 'partner',
      url: `${serverConfig.appUrl}/platform/private-orders/${params.orderId}`,
      recipients: getPartnerUsers(params.partnerId),
    });
  }
  if (!params.internal && params.authorParty !== 'distributor' && params.distributorId) {
    audiences.push({
      party: 'distributor',
      url: `${serverConfig.appUrl}/platform/distributor/orders/${params.orderId}`,
      recipients: getPartnerUsers(params.distributorId),
    });
  }

  const notified = new Set<string>([params.authorUserId]);

  for (const audience of audiences) {
    let recipients: { id: string; email: string | null; name: string | null }[] = [];
    try {
      recipients = await audience.recipients;
    } catch (error) {
      logger.error('PCO note: could not resolve recipients', {
        orderId: params.orderId,
        party: audience.party,
        error: error instanceof Error ? error.message : String(error),
      });
      continue;
    }

    for (const recipient of recipients) {
      if (notified.has(recipient.id)) continue;
      notified.add(recipient.id);

      try {
        await createNotification({
          userId: recipient.id,
          type: 'status_update',
          title,
          message: excerpt,
          entityType: 'private_client_order',
          entityId: params.orderId,
          actionUrl: audience.url,
          metadata: { orderNumber: params.orderNumber, noteBy: params.authorPartyName },
        });
      } catch (error) {
        logger.error('PCO note: in-app notification failed', {
          orderId: params.orderId,
          userId: recipient.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }

      if (!PCO_NOTE_EMAIL_TEMPLATE_ID || !recipient.email) continue;

      try {
        await loops.sendTransactionalEmail({
          transactionalId: PCO_NOTE_EMAIL_TEMPLATE_ID,
          email: recipient.email,
          dataVariables: {
            recipientName: recipient.name ?? '',
            orderNumber: params.orderNumber,
            authorParty: params.authorPartyName,
            authorName: params.authorName,
            note: params.note,
            orderUrl: audience.url,
          },
        });
      } catch (error) {
        logger.error('PCO note: email failed', {
          orderId: params.orderId,
          email: recipient.email,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  if (!PCO_NOTE_EMAIL_TEMPLATE_ID) {
    logger.info('PCO note: email skipped, no Loops template set', {
      orderId: params.orderId,
    });
  }
};

export default notifyOrderNote;
