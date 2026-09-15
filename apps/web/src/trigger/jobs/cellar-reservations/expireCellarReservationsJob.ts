import { logger, schedules } from '@trigger.dev/sdk';
import { and, eq, inArray, lt } from 'drizzle-orm';

import createNotification from '@/app/_notifications/utils/createNotification';
import {
  cellarPurchaseItems,
  cellarPurchases,
  partnerMembers,
  partners,
  wmsStockReservations,
} from '@/database/schema';
import triggerDb from '@/trigger/triggerDb';

/**
 * Release purchases whose 48 hours ran out
 *
 * A reservation that never lapses is worse than no reservation at all. The wine
 * stays off the catalogue, `transferStockOwnership` keeps refusing to move it,
 * and nothing on any screen explains why — so an abandoned basket quietly
 * removes stock from sale for good.
 *
 * Purchases where the member has said they paid are deliberately left alone.
 * The hold exists to protect them while we check the bank, and expiring one
 * under somebody who has sent money is the worst outcome this job could produce.
 * Those surface in the admin queue instead, where a person decides.
 *
 * Hourly rather than to the minute: the window is two days, so an hour either
 * side is not worth the scheduler traffic.
 */
export const expireCellarReservationsJob = schedules.task({
  id: 'expire-cellar-reservations',
  cron: {
    pattern: '0 * * * *',
    timezone: 'Asia/Dubai',
  },
  async run() {
    const now = new Date();

    const lapsed = await triggerDb
      .select({
        id: cellarPurchases.id,
        purchaseNumber: cellarPurchases.purchaseNumber,
        buyerPartnerId: cellarPurchases.buyerPartnerId,
        totalUsd: cellarPurchases.totalUsd,
      })
      .from(cellarPurchases)
      .where(
        and(
          eq(cellarPurchases.status, 'reserved'),
          lt(cellarPurchases.reservedUntil, now),
        ),
      )
      .limit(200);

    if (lapsed.length === 0) {
      logger.info('No cellar reservations to expire');

      return { expired: 0 };
    }

    for (const purchase of lapsed) {
      const items = await triggerDb
        .select({ reservationId: cellarPurchaseItems.reservationId })
        .from(cellarPurchaseItems)
        .where(eq(cellarPurchaseItems.purchaseId, purchase.id));

      const reservationIds = items
        .map((item) => item.reservationId)
        .filter(Boolean) as string[];

      if (reservationIds.length > 0) {
        await triggerDb
          .update(wmsStockReservations)
          .set({
            status: 'released',
            releasedAt: now,
            releaseReason: `${purchase.purchaseNumber} expired unpaid`,
          })
          .where(
            and(
              inArray(wmsStockReservations.id, reservationIds),
              /* Only ones still live, so a re-run cannot rewrite history. */
              eq(wmsStockReservations.status, 'active'),
            ),
          );
      }

      await triggerDb
        .update(cellarPurchases)
        .set({ status: 'expired', updatedAt: now })
        .where(
          and(
            eq(cellarPurchases.id, purchase.id),
            /*
              Re-checked at the point of writing. A member can mark a transfer
              sent in the seconds between the read above and this update, and
              expiring that purchase would take wine off somebody who has paid.
            */
            eq(cellarPurchases.status, 'reserved'),
          ),
        );

      /*
        Told, not silently dropped. A member who sent the transfer late needs to
        know the hold went, rather than discovering it when the wine is gone.

        Everyone attached to the account, the same way a mandate notifies —
        a partner can be an owner, a membership, or both.
      */
      const [owner] = await triggerDb
        .select({ userId: partners.userId })
        .from(partners)
        .where(eq(partners.id, purchase.buyerPartnerId))
        .limit(1);

      const members = await triggerDb
        .select({ userId: partnerMembers.userId })
        .from(partnerMembers)
        .where(eq(partnerMembers.partnerId, purchase.buyerPartnerId));

      const recipients = [
        ...new Set(
          [...members.map((member) => member.userId), owner?.userId].filter(
            Boolean,
          ) as string[],
        ),
      ];

      for (const userId of recipients) {
        /* A notification that fails must not leave the hold in place. */
        await createNotification({
          userId,
          type: 'cellar_purchase_expired',
          title: `${purchase.purchaseNumber} has expired`,
          message:
            'We did not see your transfer within 48 hours, so the wine has gone back on the list. You can order it again if it is still there.',
          actionUrl: '/platform/cellar/purchases',
        }).catch((error) =>
          logger.error('Could not notify an expired cellar purchase', {
            purchaseNumber: purchase.purchaseNumber,
            error,
          }),
        );
      }

      logger.info('Expired a cellar purchase', {
        purchaseNumber: purchase.purchaseNumber,
        reservations: reservationIds.length,
      });
    }

    return { expired: lapsed.length };
  },
});

export default expireCellarReservationsJob;
