import { and, eq, inArray, ne } from 'drizzle-orm';

import createNotification from '@/app/_notifications/utils/createNotification';
import db from '@/database/client';
import {
  cellarIntakes,
  logisticsShipmentActivityLogs,
  logisticsShipmentItems,
  logisticsShipments,
  partners,
} from '@/database/schema';
import serverConfig from '@/server.config';
import logger from '@/utils/logger';

import getCellarHolderIds from './getCellarHolderIds';
import { queueWineAtWarehouse } from './queueCellarEmails';

/** The activity log line that records a member was told, and stops a repeat */
const TOLD = 'member_told_at_warehouse';

/**
 * Tell each Private Cellar member with wine on a shipment that it has reached
 * the warehouse
 *
 * Members heard when their wine left and then nothing until every bottle was
 * checked in, which on a large shipment can be days after it landed. This is
 * the notice in between: one in the app and one email (sent the way the
 * Member Emails switch says), once per member per shipment.
 *
 * A member's wine is on the shipment when their transfer is linked to it, the
 * shipment is theirs, or a line on it is booked to them.
 *
 * Never throws: a status change must not fail over a notice.
 *
 * @param shipmentId - The shipment that has just reached the warehouse
 */
const notifyMembersWineAtWarehouse = async (shipmentId: string) => {
  try {
    const [shipment] = await db
      .select({
        id: logisticsShipments.id,
        type: logisticsShipments.type,
        partnerId: logisticsShipments.partnerId,
        shipmentNumber: logisticsShipments.shipmentNumber,
      })
      .from(logisticsShipments)
      .where(eq(logisticsShipments.id, shipmentId))
      .limit(1);

    if (!shipment || shipment.type !== 'inbound') return;

    const [intakes, items, told] = await Promise.all([
      db
        .select({ partnerId: cellarIntakes.partnerId })
        .from(cellarIntakes)
        .where(and(eq(cellarIntakes.shipmentId, shipmentId), ne(cellarIntakes.stage, 'closed'))),
      db
        .select({
          ownerId: logisticsShipmentItems.overrideOwnerId,
          cases: logisticsShipmentItems.cases,
          bottlesPerCase: logisticsShipmentItems.bottlesPerCase,
        })
        .from(logisticsShipmentItems)
        .where(eq(logisticsShipmentItems.shipmentId, shipmentId)),
      db
        .select({ metadata: logisticsShipmentActivityLogs.metadata })
        .from(logisticsShipmentActivityLogs)
        .where(and(eq(logisticsShipmentActivityLogs.shipmentId, shipmentId), eq(logisticsShipmentActivityLogs.action, TOLD))),
    ]);

    // Bottles on board for each owner; a line with no owner of its own is the shipment's
    const bottlesByOwner = new Map<string, number>();
    for (const item of items) {
      const owner = item.ownerId ?? shipment.partnerId;
      if (!owner) continue;
      bottlesByOwner.set(owner, (bottlesByOwner.get(owner) ?? 0) + item.cases * (item.bottlesPerCase ?? 12));
    }

    const candidates = [
      ...new Set(
        [...intakes.map((intake) => intake.partnerId), shipment.partnerId, ...bottlesByOwner.keys()].filter(
          (id): id is string => Boolean(id),
        ),
      ),
    ];
    if (candidates.length === 0) return;

    const members = await db
      .select({ id: partners.id, name: partners.businessName })
      .from(partners)
      .where(and(inArray(partners.id, candidates), eq(partners.type, 'private_collector')));

    const alreadyTold = new Set(told.map((row) => (row.metadata as { partnerId?: string } | null)?.partnerId));

    for (const member of members) {
      if (alreadyTold.has(member.id)) continue;

      const bottles = bottlesByOwner.get(member.id) ?? 0;

      for (const userId of await getCellarHolderIds(member.id)) {
        await createNotification({
          userId,
          type: 'shipment_status_changed',
          title: 'Your wine has reached our warehouse',
          message: 'It is now being checked in. We will let you know as soon as it is in your cellar.',
          entityType: 'logistics_shipment',
          entityId: shipmentId,
          actionUrl: `${serverConfig.appUrl}/platform/cellar`,
          metadata: { shipmentNumber: shipment.shipmentNumber, bottles },
        }).catch(() => undefined);
      }

      await queueWineAtWarehouse({
        partnerId: member.id,
        shipmentId,
        shipmentNumber: shipment.shipmentNumber,
        bottles,
      });

      await db.insert(logisticsShipmentActivityLogs).values({
        shipmentId,
        action: TOLD,
        notes: `${member.name} told their wine has reached the warehouse`,
        metadata: { partnerId: member.id, bottles },
      });
    }
  } catch (error) {
    logger.error('Could not tell members their wine reached the warehouse', {
      shipmentId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

export default notifyMembersWineAtWarehouse;
