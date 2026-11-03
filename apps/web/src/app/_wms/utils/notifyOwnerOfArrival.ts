import { and, eq, gte, sql } from 'drizzle-orm';

import { queueWineArrived } from '@/app/_cellar/data/queueCellarEmails';
import createNotification from '@/app/_notifications/utils/createNotification';
import db from '@/database/client';
import { notifications, partnerMembers, partners } from '@/database/schema';
import serverConfig from '@/server.config';


export interface NotifyOwnerOfArrivalParams {
  /** The partner whose wine this is */
  ownerId: string;
  productName: string;
  cases: number;
  bottles: number;
  /** Where it came from, when we know */
  shipmentNumber?: string | null;
  /** The stock row booked in, so a member's arrival email is sent once */
  stockId?: string | null;
  lwin18?: string | null;
}

/**
 * Tell an owner their wine has reached the warehouse
 *
 * Wine arriving is the moment an owner most wants to hear from us and the one
 * they currently hear nothing about: the cellar simply gains a line the next
 * time they happen to look.
 *
 * Never throws. A receiving operator should not see an error, and stock should
 * not fail to book in, because a notification could not be written.
 *
 * @example
 *   await notifyOwnerOfArrival({
 *     ownerId, productName: 'Fourrier Gevrey-Chambertin', cases: 2, bottles: 12,
 *   });
 *
 * @param params - The owner, the wine, and how much of it arrived
 */
const notifyOwnerOfArrival = async ({
  ownerId,
  productName,
  cases,
  bottles,
  shipmentNumber,
  stockId,
  lwin18,
}: NotifyOwnerOfArrivalParams) => {
  try {
    const [owner] = await db
      .select({ id: partners.id, userId: partners.userId, type: partners.type })
      .from(partners)
      .where(eq(partners.id, ownerId))
      .limit(1);

    if (!owner) return;

    // Everyone admin has linked to this partner, plus the owner of the record.
    const members = await db
      .select({ userId: partnerMembers.userId })
      .from(partnerMembers)
      .where(eq(partnerMembers.partnerId, ownerId));

    const recipients = [
      ...new Set(
        [...members.map((member) => member.userId), owner.userId].filter(
          (id): id is string => Boolean(id),
        ),
      ),
    ];

    if (recipients.length === 0) return;

    const home =
      owner.type === 'private_collector'
        ? `${serverConfig.appUrl}/platform/cellar`
        : `${serverConfig.appUrl}/platform/partner/stock`;

    const quantity =
      bottles > 0
        ? `${cases} ${cases === 1 ? 'case' : 'cases'} (${bottles} ${bottles === 1 ? 'bottle' : 'bottles'})`
        : `${cases} ${cases === 1 ? 'case' : 'cases'}`;

    /*
      One notice per shipment, kept up to date as each wine is received.
      Receiving notified every wine line on its own, so a 58-line shipment
      would have put 58 notices in each login's bell.
    */
    const since = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const collector = owner.type === 'private_collector';

    for (const userId of recipients) {
      if (shipmentNumber) {
        const [existing] = await db
          .select({ id: notifications.id, metadata: notifications.metadata })
          .from(notifications)
          .where(
            and(
              eq(notifications.userId, userId),
              eq(notifications.type, 'cellar_wine_received'),
              gte(notifications.createdAt, since),
              sql`${notifications.metadata}->>'shipmentNumber' = ${shipmentNumber}`,
            ),
          )
          .limit(1);

        if (existing) {
          const before = (existing.metadata ?? {}) as { wines?: number; cases?: number; bottles?: number };
          const wines = (before.wines ?? 1) + 1;
          const totalCases = (before.cases ?? 0) + cases;
          const totalBottles = (before.bottles ?? 0) + bottles;
          await db
            .update(notifications)
            .set({
              title: collector ? 'Wine received into your cellar' : 'Stock received',
              message: `${wines} wines (${totalCases} ${totalCases === 1 ? 'case' : 'cases'}, ${totalBottles} bottles) from shipment ${shipmentNumber} ${
                collector ? 'are now in your cellar' : 'are now in stock'
              }.`,
              metadata: { ...before, wines, cases: totalCases, bottles: totalBottles, shipmentNumber, productName },
              isRead: false,
              readAt: null,
            })
            .where(eq(notifications.id, existing.id));
          continue;
        }
      }

      await createNotification({
        userId,
        type: 'cellar_wine_received',
        title: 'Wine received into bond',
        message: `${quantity} of ${productName} ${cases === 1 ? 'has' : 'have'} been received into bond${
          shipmentNumber ? ` from shipment ${shipmentNumber}` : ''
        }.`,
        entityType: 'wms_stock',
        entityId: ownerId,
        actionUrl: home,
        metadata: { productName, cases, bottles, shipmentNumber, wines: 1 },
      });
    }

    /* A Private Cellar member also gets an email, queued for the switch */
    if (owner.type === 'private_collector' && stockId) {
      await queueWineArrived({
        partnerId: ownerId,
        entityId: stockId,
        productName,
        lwin18,
        bottles,
        shipmentNumber,
      });
    }
  } catch (error) {
    console.error('Failed to notify owner of arrival', { ownerId, error });
  }
};

export default notifyOwnerOfArrival;
