import { eq } from 'drizzle-orm';

import createNotification from '@/app/_notifications/utils/createNotification';
import isTeamMember from '@/app/_teamTasks/utils/isTeamMember';
import db from '@/database/client';
import { users } from '@/database/schema';
import logger from '@/utils/logger';

import { type ShipmentStatus, shipmentStatusLabel } from '../utils/shipmentStatuses';

/**
 * A bell notice to each C&C admin when a shipment changes status
 *
 * Ran as a Trigger.dev job until Trigger.dev was switched off on 27 Oct 2026,
 * after which nobody was told. Now part of the status change itself. The
 * person who made the change is not told about it.
 *
 * @param shipment - The shipment's id and number
 * @param status - Its new status
 * @param previousStatus - The one before
 * @param changedBy - Who changed it
 */
const notifyStaffOfShipmentStatus = async (
  shipment: { id: string; shipmentNumber: string },
  status: ShipmentStatus,
  previousStatus: ShipmentStatus,
  changedBy?: string,
) => {
  try {
    const admins = (
      await db
        .select({ id: users.id, email: users.email, name: users.name, role: users.role })
        .from(users)
        .where(eq(users.role, 'admin'))
    ).filter((user) => isTeamMember(user) && user.id !== changedBy);

    for (const admin of admins) {
      await createNotification({
        userId: admin.id,
        type: 'shipment_status_changed',
        title: `Shipment ${shipment.shipmentNumber}: ${shipmentStatusLabel(status)}`,
        message: `Moved from ${shipmentStatusLabel(previousStatus)} to ${shipmentStatusLabel(status)}.`,
        entityType: 'logistics_shipment',
        entityId: shipment.id,
        actionUrl: `/platform/admin/logistics/shipments/${shipment.id}`,
        metadata: { shipmentNumber: shipment.shipmentNumber, newStatus: status, previousStatus },
      }).catch(() => undefined);
    }
  } catch (error) {
    logger.error('Staff shipment notice failed', { shipmentId: shipment.id, error: error instanceof Error ? error.message : String(error) });
  }
};

export default notifyStaffOfShipmentStatus;
