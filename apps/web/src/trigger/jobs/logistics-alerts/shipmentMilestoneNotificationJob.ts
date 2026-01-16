import { logger, task } from '@trigger.dev/sdk';
import { eq } from 'drizzle-orm';

import createNotification from '@/app/_notifications/utils/createNotification';
import { logisticsShipments, partners, users } from '@/database/schema';
import loops from '@/lib/loops/client';
import serverConfig from '@/server.config';
import triggerDb from '@/trigger/triggerDb';

type ShipmentStatus =
  | 'draft'
  | 'booked'
  | 'picked_up'
  | 'in_transit'
  | 'arrived_port'
  | 'customs_clearance'
  | 'cleared'
  | 'at_warehouse'
  | 'dispatched'
  | 'delivered'
  | 'cancelled';

const statusLabels: Record<ShipmentStatus, string> = {
  draft: 'Draft',
  booked: 'Booked',
  picked_up: 'Picked Up',
  in_transit: 'In Transit',
  arrived_port: 'Arrived at Port',
  customs_clearance: 'Customs Clearance',
  cleared: 'Customs Cleared',
  at_warehouse: 'At Warehouse',
  dispatched: 'Dispatched',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

const milestoneMessages: Record<ShipmentStatus, string> = {
  draft: 'Shipment draft created',
  booked: 'Shipment has been booked with carrier',
  picked_up: 'Shipment has been picked up from origin',
  in_transit: 'Shipment is now in transit',
  arrived_port: 'Shipment has arrived at destination port',
  customs_clearance: 'Shipment is undergoing customs clearance',
  cleared: 'Shipment has cleared customs',
  at_warehouse: 'Shipment has arrived at RAK Port warehouse',
  dispatched: 'Shipment has been dispatched for final delivery',
  delivered: 'Shipment has been delivered',
  cancelled: 'Shipment has been cancelled',
};

interface ShipmentMilestonePayload {
  shipmentId: string;
  newStatus: ShipmentStatus;
  previousStatus?: ShipmentStatus;
  triggeredBy?: string;
}

/**
 * Shipment Milestone Notification Job
 *
 * Triggered when a shipment status changes.
 * Sends notifications to:
 * - Admin users (all milestone updates)
 * - Partner users (their shipments only)
 * - Client contacts (relevant updates only)
 */
export const shipmentMilestoneNotificationJob = task({
  id: 'shipment-milestone-notification',
  retry: {
    maxAttempts: 3,
    factor: 2,
    minTimeoutInMs: 1000,
    maxTimeoutInMs: 30000,
  },
  async run(payload: ShipmentMilestonePayload) {
    const { shipmentId, newStatus, previousStatus, triggeredBy } = payload;

    logger.info('Processing shipment milestone notification', {
      shipmentId,
      newStatus,
      previousStatus,
    });

    // Get shipment details
    const shipment = await triggerDb.query.logisticsShipments.findFirst({
      where: eq(logisticsShipments.id, shipmentId),
    });

    if (!shipment) {
      logger.error('Shipment not found', { shipmentId });
      return;
    }

    const statusLabel = statusLabels[newStatus];
    const milestoneMessage = milestoneMessages[newStatus];
    const shipmentUrl = `${serverConfig.appUrl}/platform/admin/logistics/shipments/${shipmentId}`;

    // 1. Notify admin users
    const adminUsers = await triggerDb
      .select({ id: users.id, email: users.email, name: users.name })
      .from(users)
      .where(eq(users.role, 'admin'));

    for (const admin of adminUsers) {
      // Skip if this admin triggered the change
      if (triggeredBy && triggeredBy === admin.id) continue;

      await createNotification({
        userId: admin.id,
        type: 'shipment_status_changed',
        title: `Shipment ${shipment.shipmentNumber} - ${statusLabel}`,
        message: milestoneMessage,
        entityType: 'logistics_shipment',
        entityId: shipmentId,
        actionUrl: shipmentUrl,
        metadata: {
          shipmentNumber: shipment.shipmentNumber,
          newStatus,
          previousStatus,
          origin: shipment.originCity || shipment.originCountry,
          destination: shipment.destinationCity || shipment.destinationWarehouse,
        },
      });
    }

    // 2. Notify partner if shipment is associated with one
    if (shipment.partnerId) {
      const partner = await triggerDb.query.partners.findFirst({
        where: eq(partners.id, shipment.partnerId),
      });

      if (partner?.userId) {
        const partnerUrl = `${serverConfig.appUrl}/platform/partner/logistics/shipments/${shipmentId}`;

        await createNotification({
          userId: partner.userId,
          type: 'shipment_status_changed',
          title: `Shipment ${shipment.shipmentNumber} - ${statusLabel}`,
          message: milestoneMessage,
          entityType: 'logistics_shipment',
          entityId: shipmentId,
          actionUrl: partnerUrl,
          metadata: {
            shipmentNumber: shipment.shipmentNumber,
            newStatus,
            previousStatus,
          },
        });

        // Send email for key milestones
        const emailMilestones: ShipmentStatus[] = [
          'picked_up',
          'in_transit',
          'arrived_port',
          'cleared',
          'delivered',
        ];

        if (partner.businessEmail && emailMilestones.includes(newStatus)) {
          try {
            await loops.sendTransactionalEmail({
              transactionalId: 'logistics-shipment-milestone',
              email: partner.businessEmail,
              dataVariables: {
                partnerName: partner.businessName,
                shipmentNumber: shipment.shipmentNumber,
                statusLabel,
                milestoneMessage,
                origin: shipment.originCity || shipment.originCountry || 'Origin',
                destination:
                  shipment.destinationCity || shipment.destinationWarehouse || 'RAK Port',
                trackingUrl: partnerUrl,
              },
            });
          } catch (error) {
            logger.error('Failed to send milestone email to partner', { error, partnerId: partner.id });
          }
        }
      }
    }

    logger.info('Shipment milestone notifications sent', {
      shipmentId,
      newStatus,
      adminNotifications: adminUsers.length,
      partnerNotified: !!shipment.partnerId,
    });

    return {
      success: true,
      shipmentId,
      newStatus,
      notificationsSent: adminUsers.length + (shipment.partnerId ? 1 : 0),
    };
  },
});
