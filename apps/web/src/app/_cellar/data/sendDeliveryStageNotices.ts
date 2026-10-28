import {
  and,
  eq,
  gte,
  inArray,
  isNotNull,
  isNull,
  ne,
  or,
  sql,
} from 'drizzle-orm';

import createNotification from '@/app/_notifications/utils/createNotification';
import db from '@/database/client';
import {
  cellarReleaseRequests,
  notifications,
  privateClientOrders,
  wmsDispatchBatches,
  wmsPickLists,
  zohoSalesOrders,
} from '@/database/schema';
import serverConfig from '@/server.config';

import getPartnerUserIds from './getPartnerUserIds';
import { queueDeliveryCollected } from './queueCellarEmails';
import deliveryStage, { DELIVERY_STAGES } from '../utils/deliveryStage';

/**
 * Long enough to tell a member their delivery arrived, short enough not to
 * replay history
 */
const DELIVERED_LOOKBACK_MS = 3 * 24 * 60 * 60 * 1000;

/**
 * Tell members each time a delivery reaches a new stage
 *
 * The stages are the team's own: picked, packed, collected, out for delivery,
 * delivered. None of the places that move a delivery along — the scanner, the
 * dispatch screen, the PCO page — has to know about members; this reads where
 * each delivery stands and compares it with the last stage the member was told
 * about, which is kept on the notification itself.
 *
 * A delivery that jumps two stages between runs is told only the latest, so a
 * member never receives "being picked" after "packed".
 *
 * @example
 *   await sendDeliveryStageNotices(); // { checked: 3, notified: 1 }
 *
 * @returns How many deliveries were looked at and how many members were told
 */
const sendDeliveryStageNotices = async () => {
  const since = new Date(Date.now() - DELIVERED_LOOKBACK_MS);

  const rows = await db
    .select({
      id: cellarReleaseRequests.id,
      partnerId: cellarReleaseRequests.partnerId,
      requestNumber: cellarReleaseRequests.requestNumber,
      orderStatus: privateClientOrders.status,
      pickListStatus: wmsPickLists.status,
      salesOrderStatus: zohoSalesOrders.status,
      dispatchStatus: wmsDispatchBatches.status,
    })
    .from(cellarReleaseRequests)
    .innerJoin(
      privateClientOrders,
      eq(privateClientOrders.id, cellarReleaseRequests.privateClientOrderId),
    )
    .leftJoin(
      zohoSalesOrders,
      eq(
        zohoSalesOrders.zohoSalesOrderId,
        privateClientOrders.zohoSalesOrderId,
      ),
    )
    .leftJoin(wmsPickLists, eq(wmsPickLists.id, zohoSalesOrders.pickListId))
    .leftJoin(
      wmsDispatchBatches,
      eq(wmsDispatchBatches.id, zohoSalesOrders.dispatchBatchId),
    )
    .where(
      and(
        eq(cellarReleaseRequests.status, 'confirmed'),
        ne(privateClientOrders.status, 'cancelled'),
        or(
          isNull(privateClientOrders.deliveredAt),
          gte(privateClientOrders.deliveredAt, since),
        ),
      ),
    );

  if (rows.length === 0) return { checked: 0, notified: 0 };

  /* The furthest stage each delivery has already been announced at */
  const told = await db
    .select({
      entityId: notifications.entityId,
      stage: sql<number>`max((${notifications.metadata}->>'deliveryStage')::int)`,
    })
    .from(notifications)
    .where(
      and(
        eq(notifications.entityType, 'cellar_release_request'),
        inArray(
          notifications.entityId,
          rows.map((row) => row.id),
        ),
        isNotNull(sql`${notifications.metadata}->>'deliveryStage'`),
      ),
    )
    .groupBy(notifications.entityId);

  const toldByRequest = new Map(
    told.map((row) => [row.entityId, Number(row.stage)]),
  );

  let notified = 0;

  for (const row of rows) {
    const stage = deliveryStage(row);
    const last = toldByRequest.get(row.id) ?? -1;

    /*
      Told of a stage the delivery has not reached. A rule that read our own
      hand-over to the distributor as delivered told members their wine had
      arrived; those notices are withdrawn here, and the real stages announced
      as they come.
    */
    if (stage < last) {
      await db
        .delete(notifications)
        .where(
          and(
            eq(notifications.entityType, 'cellar_release_request'),
            eq(notifications.entityId, row.id),
            sql`(${notifications.metadata}->>'deliveryStage')::int > ${stage}`,
          ),
        );
      continue;
    }

    if (stage <= last) continue;

    const content = DELIVERY_STAGES[stage];
    if (!content) continue;

    const recipients = await getPartnerUserIds(row.partnerId);

    for (const userId of recipients) {
      await createNotification({
        userId,
        type: stage === 5 ? 'order_delivered' : 'status_update',
        title: content.title,
        message: `${content.message} (${row.requestNumber})`,
        entityType: 'cellar_release_request',
        entityId: row.id,
        actionUrl: `${serverConfig.appUrl}/platform/cellar`,
        metadata: { deliveryStage: stage },
      });
    }

    if (recipients.length > 0) notified += 1;

    /*
      The member's one delivery email: the wine has left the bonded warehouse.
      Queued at Collected, or at Out for delivery when a run skipped Collected;
      the outbox's dedupe key keeps it to one however often this runs. A
      delivery first seen as Delivered gets no email: it would arrive late.
    */
    if (stage === 3 || stage === 4) {
      await queueDeliveryCollected({ partnerId: row.partnerId, requestId: row.id, requestNumber: row.requestNumber, stage });
    }
  }

  return { checked: rows.length, notified };
};

export default sendDeliveryStageNotices;
