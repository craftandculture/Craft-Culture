import { eq } from 'drizzle-orm';

import createNotification from '@/app/_notifications/utils/createNotification';
import db from '@/database/client';
import { partnerMembers, partners } from '@/database/schema';
import serverConfig from '@/server.config';

export interface NotifyOwnerOfArrivalParams {
  /** The partner whose wine this is */
  ownerId: string;
  productName: string;
  cases: number;
  bottles: number;
  /** Where it came from, when we know */
  shipmentNumber?: string | null;
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

    for (const userId of recipients) {
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
        metadata: { productName, cases, bottles, shipmentNumber },
      });
    }
  } catch (error) {
    console.error('Failed to notify owner of arrival', { ownerId, error });
  }
};

export default notifyOwnerOfArrival;
