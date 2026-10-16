import getCellarStaffIds from '@/app/_cellar/data/getCellarStaffIds';
import getPartnerUserIds from '@/app/_cellar/data/getPartnerUserIds';
import createNotification from '@/app/_notifications/utils/createNotification';
import serverConfig from '@/server.config';

export type PurchaseEvent =
  | 'reserved'
  | 'payment_claimed'
  | 'member_cancelled'
  | 'completed'
  | 'cancelled_by_us';

export interface NotifyPurchaseUpdateParams {
  event: PurchaseEvent;
  purchaseId: string;
  purchaseNumber: string;
  buyerPartnerId: string;
  buyerName: string;
  totalUsd?: number | null;
  /** Why we cancelled, when we did */
  reason?: string | null;
}

/**
 * Tell the right people a cellar purchase has moved
 *
 * Without this every step waits for someone to look: the team does not know
 * a member has reserved or paid, and the member does not know their wine has
 * arrived in their cellar. The member's side is the wine, never the money —
 * the purchase total goes to the team only.
 *
 * Never throws. A purchase should not fail, and an admin should not see an
 * error, because a notification could not be written.
 *
 * @param params - What happened, and to whose purchase
 */
const notifyPurchaseUpdate = async ({
  event,
  purchaseId,
  purchaseNumber,
  buyerPartnerId,
  buyerName,
  totalUsd,
  reason,
}: NotifyPurchaseUpdateParams) => {
  try {
    const forTeam =
      event === 'reserved' ||
      event === 'payment_claimed' ||
      event === 'member_cancelled';

    const recipients = forTeam
      ? await getCellarStaffIds()
      : await getPartnerUserIds(buyerPartnerId);

    if (recipients.length === 0) return;

    const total =
      typeof totalUsd === 'number'
        ? ` ($${totalUsd.toLocaleString('en-US', { maximumFractionDigits: 0 })})`
        : '';

    const adminUrl = `${serverConfig.appUrl}/platform/admin/cellar-purchases`;
    const memberUrl = `${serverConfig.appUrl}/platform/cellar/purchases`;

    const content = {
      reserved: {
        title: 'Wine reserved in a private cellar',
        message: `${buyerName} has reserved ${purchaseNumber}${total}. It is held for 48 hours while they pay.`,
        actionUrl: adminUrl,
      },
      payment_claimed: {
        title: 'A member says they have paid',
        message: `${buyerName} has marked ${purchaseNumber}${total} as paid. Check the bank and confirm the payment.`,
        actionUrl: adminUrl,
      },
      member_cancelled: {
        title: 'A member cancelled a purchase',
        message: `${buyerName} has cancelled ${purchaseNumber}. The wine is back on the list.`,
        actionUrl: adminUrl,
      },
      completed: {
        title: 'Your wine is in your cellar',
        message: `We have received your payment for ${purchaseNumber}, and the wine is now held in your private cellar.`,
        actionUrl: `${serverConfig.appUrl}/platform/cellar`,
      },
      cancelled_by_us: {
        title: `${purchaseNumber} has been cancelled`,
        message:
          reason?.trim() ||
          'We have cancelled this purchase and the wine is no longer reserved for you. Please contact us if you have any questions.',
        actionUrl: memberUrl,
      },
    }[event];

    for (const userId of recipients) {
      await createNotification({
        userId,
        type: 'cellar_purchase_update',
        title: content.title,
        message: content.message,
        entityType: 'cellar_purchase',
        entityId: purchaseId,
        actionUrl: content.actionUrl,
        metadata: { purchaseNumber, event },
      });
    }
  } catch (error) {
    console.error('Failed to notify on purchase update', {
      purchaseNumber,
      event,
      error,
    });
  }
};

export default notifyPurchaseUpdate;
