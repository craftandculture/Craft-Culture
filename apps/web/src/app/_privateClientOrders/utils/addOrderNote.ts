import { TRPCError } from '@trpc/server';

import db from '@/database/client';
import { privateClientOrderActivityLogs } from '@/database/schema';
import logger from '@/utils/logger';

import type { NoteParty } from './notifyOrderNote';
import notifyOrderNote from './notifyOrderNote';

/**
 * Add a note to a PCO's timeline and tell the other parties
 *
 * A note is an activity-log row like any other event on the order, so it sits
 * in the same timeline every party already reads. `internal_note_added` is
 * C&C-only: hidden from partner and distributor views and told to nobody
 * outside C&C.
 *
 * @param input.orderId - The order
 * @param input.note - The note text (already validated)
 * @param input.internal - C&C only
 * @param author - Who wrote it, and for which side
 * @param scope - A partner or distributor id the order must belong to
 * @returns The saved timeline entry
 */
const addOrderNote = async (
  input: { orderId: string; note: string; internal?: boolean },
  author: { userId: string; name: string; party: NoteParty; partnerId?: string },
  scope: { partnerId?: string; distributorId?: string } = {},
) => {
  const order = await db.query.privateClientOrders.findFirst({
    where: { id: input.orderId },
    columns: { id: true, orderNumber: true, partnerId: true, distributorId: true },
  });

  if (
    !order ||
    (scope.partnerId && order.partnerId !== scope.partnerId) ||
    (scope.distributorId && order.distributorId !== scope.distributorId)
  ) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Order not found' });
  }

  const internal = author.party === 'admin' && Boolean(input.internal);

  const [entry] = await db
    .insert(privateClientOrderActivityLogs)
    .values({
      orderId: order.id,
      userId: author.userId,
      partnerId: author.partnerId ?? null,
      action: internal ? 'internal_note_added' : 'note_added',
      notes: input.note,
    })
    .returning();

  // How the author's side is named to the others
  let authorPartyName = 'Craft & Culture';
  if (author.partnerId) {
    const partner = await db.query.partners.findFirst({
      where: { id: author.partnerId },
      columns: { businessName: true },
    });
    authorPartyName = partner?.businessName ?? authorPartyName;
  }

  try {
    await notifyOrderNote({
      orderId: order.id,
      orderNumber: order.orderNumber,
      partnerId: order.partnerId,
      distributorId: order.distributorId,
      authorUserId: author.userId,
      authorName: author.name,
      authorParty: author.party,
      authorPartyName,
      note: input.note,
      internal,
    });
  } catch (error) {
    logger.error('PCO note saved but notifying failed', {
      orderId: order.id,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return entry!;
};

export default addOrderNote;
