import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';

import advanceShipmentIntakes from '@/app/_onboarding/data/advanceShipmentIntakes';
import db from '@/database/client';
import { logisticsShipmentActivityLogs, logisticsShipments } from '@/database/schema';

import notifyPartnerOfShipment, { milestoneForStatus } from './notifyPartnerOfShipment';
import notifyStaffOfShipmentStatus from './notifyStaffOfShipmentStatus';
import { inboundStatusMessage } from '../notifications/logisticsSlackMessages';
import queueLogisticsSlack from '../notifications/queueLogisticsSlack';
import type { ShipmentStatus } from '../utils/shipmentStatuses';

/**
 * Move a shipment to a status, with everything that follows from it
 *
 * The status change itself, the arrival and delivery dates it stamps, the
 * activity log line, members' transfers riding on the shipment, the staff and
 * wine partner notices, and the #logistics post on departure or arrival. Shared by the status
 * dropdown and the quick update, so neither can skip a step the other takes.
 *
 * @param input - The shipment, its new status, a note, who made the change and,
 *   when the team gives it, the day it departed
 * @returns The updated shipment
 */
const setShipmentStatus = async ({
  id,
  status,
  notes,
  userId,
  departedAt,
}: {
  id: string;
  status: ShipmentStatus;
  notes?: string;
  userId: string;
  departedAt?: Date;
}) => {
  const [existing] = await db.select().from(logisticsShipments).where(eq(logisticsShipments.id, id));

  if (!existing) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Shipment not found' });
  }

  const previousStatus = existing.status;

  // Update timestamp based on status
  const timestampUpdates: Record<string, Date> = {};
  const now = new Date();

  if (status === 'delivered') {
    timestampUpdates.deliveredAt = now;
  }

  // The departure members see on their tracker: the day the team gives, or
  // the moment it is marked In transit; never overwrites one already recorded
  if (!existing.atd && (departedAt || status === 'in_transit')) {
    timestampUpdates.atd = departedAt ?? now;
  }

  if (status === 'at_warehouse' && !existing.ata) {
    timestampUpdates.ata = now;
  }

  // A status change is news: it restarts the "no news" clock
  const [shipment] = await db
    .update(logisticsShipments)
    .set({ status, lastUpdateAt: now, ...timestampUpdates })
    .where(eq(logisticsShipments.id, id))
    .returning();

  if (!shipment) {
    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Failed to update shipment status' });
  }

  await db.insert(logisticsShipmentActivityLogs).values({
    shipmentId: id,
    userId,
    action: 'status_changed',
    previousStatus,
    newStatus: status,
    notes,
  });

  // Members whose transfer rides on this shipment follow it
  await advanceShipmentIntakes(id);

  if (status !== previousStatus) {
    await notifyStaffOfShipmentStatus(shipment, status, previousStatus, userId);

    // The wine partner hears when it departs, arrives and is in stock (Order Emails switch)
    const milestone = milestoneForStatus(status);
    if (milestone) await notifyPartnerOfShipment(id, milestone);
  }

  // Tell #logistics when an inbound shipment departs or lands; never blocks the update
  if (
    shipment.type === 'inbound' &&
    status !== previousStatus &&
    (status === 'in_transit' || status === 'at_warehouse' || status === 'delivered')
  ) {
    queueLogisticsSlack(inboundStatusMessage(shipment, status));
  }

  return shipment;
};

export default setShipmentStatus;
