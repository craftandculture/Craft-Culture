import { logger, schedules } from '@trigger.dev/sdk';
import { and, eq, isNotNull, lt } from 'drizzle-orm';

import createNotification from '@/app/_notifications/utils/createNotification';
import { logisticsDocuments, logisticsShipments, users } from '@/database/schema';
import loops from '@/lib/loops/client';
import serverConfig from '@/server.config';
import triggerDb from '@/trigger/triggerDb';

const documentTypeLabels: Record<string, string> = {
  bill_of_lading: 'Bill of Lading',
  airway_bill: 'Airway Bill',
  commercial_invoice: 'Commercial Invoice',
  packing_list: 'Packing List',
  certificate_of_origin: 'Certificate of Origin',
  customs_declaration: 'Customs Declaration',
  import_permit: 'Import Permit',
  export_permit: 'Export Permit',
  delivery_note: 'Delivery Note',
  health_certificate: 'Health Certificate',
  insurance_certificate: 'Insurance Certificate',
  proof_of_delivery: 'Proof of Delivery',
  other: 'Other Document',
};

/**
 * Document Expiry Alert Job
 *
 * Runs daily at 8am Dubai time to check for documents expiring soon.
 * Sends alerts for documents expiring within:
 * - 30 days (warning)
 * - 7 days (urgent)
 * - Already expired (critical)
 */
export const documentExpiryAlertJob = schedules.task({
  id: 'logistics-document-expiry-alert',
  cron: {
    pattern: '0 8 * * *', // Daily at 8am
    timezone: 'Asia/Dubai',
  },
  async run() {
    logger.info('Starting document expiry alert check');

    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    // Get admin users who should receive alerts
    const adminUsers = await triggerDb
      .select({ id: users.id, email: users.email, name: users.name })
      .from(users)
      .where(eq(users.role, 'admin'));

    if (adminUsers.length === 0) {
      logger.warn('No admin users found for document expiry alerts');
      return;
    }

    // Find documents expiring within 30 days
    const expiringDocuments = await triggerDb
      .select({
        id: logisticsDocuments.id,
        documentType: logisticsDocuments.documentType,
        fileName: logisticsDocuments.fileName,
        expiryDate: logisticsDocuments.expiryDate,
        shipmentId: logisticsDocuments.shipmentId,
        shipmentNumber: logisticsShipments.shipmentNumber,
      })
      .from(logisticsDocuments)
      .innerJoin(logisticsShipments, eq(logisticsDocuments.shipmentId, logisticsShipments.id))
      .where(
        and(
          isNotNull(logisticsDocuments.expiryDate),
          lt(logisticsDocuments.expiryDate, thirtyDaysFromNow),
        ),
      );

    if (expiringDocuments.length === 0) {
      logger.info('No expiring documents found');
      return;
    }

    // Categorize by urgency
    const expired: typeof expiringDocuments = [];
    const urgent: typeof expiringDocuments = []; // Within 7 days
    const warning: typeof expiringDocuments = []; // Within 30 days

    for (const doc of expiringDocuments) {
      if (!doc.expiryDate) continue;

      if (doc.expiryDate < now) {
        expired.push(doc);
      } else if (doc.expiryDate < sevenDaysFromNow) {
        urgent.push(doc);
      } else {
        warning.push(doc);
      }
    }

    logger.info('Document expiry summary', {
      expired: expired.length,
      urgent: urgent.length,
      warning: warning.length,
    });

    // Send notifications to admins
    for (const admin of adminUsers) {
      // Critical: Expired documents
      for (const doc of expired) {
        const docTypeLabel = documentTypeLabels[doc.documentType] || doc.documentType;

        await createNotification({
          userId: admin.id,
          type: 'document_expired',
          title: 'Document Expired',
          message: `${docTypeLabel} for shipment ${doc.shipmentNumber} has expired`,
          entityType: 'logistics_document',
          entityId: doc.id,
          actionUrl: `${serverConfig.appUrl}/platform/admin/logistics/shipments/${doc.shipmentId}`,
          metadata: {
            documentType: doc.documentType,
            shipmentNumber: doc.shipmentNumber,
            expiryDate: doc.expiryDate?.toISOString(),
            severity: 'critical',
          },
        });
      }

      // Urgent: Expiring within 7 days
      for (const doc of urgent) {
        const docTypeLabel = documentTypeLabels[doc.documentType] || doc.documentType;
        const daysUntilExpiry = Math.ceil(
          (doc.expiryDate!.getTime() - now.getTime()) / (24 * 60 * 60 * 1000),
        );

        await createNotification({
          userId: admin.id,
          type: 'document_expiring_soon',
          title: 'Document Expiring Soon',
          message: `${docTypeLabel} for shipment ${doc.shipmentNumber} expires in ${daysUntilExpiry} days`,
          entityType: 'logistics_document',
          entityId: doc.id,
          actionUrl: `${serverConfig.appUrl}/platform/admin/logistics/shipments/${doc.shipmentId}`,
          metadata: {
            documentType: doc.documentType,
            shipmentNumber: doc.shipmentNumber,
            expiryDate: doc.expiryDate?.toISOString(),
            daysUntilExpiry,
            severity: 'urgent',
          },
        });
      }
    }

    // Send summary email to first admin if there are expired or urgent documents
    if ((expired.length > 0 || urgent.length > 0) && adminUsers[0]?.email) {
      try {
        await loops.sendTransactionalEmail({
          transactionalId: 'logistics-document-expiry-summary',
          email: adminUsers[0].email,
          dataVariables: {
            adminName: adminUsers[0].name || 'Admin',
            expiredCount: String(expired.length),
            urgentCount: String(urgent.length),
            warningCount: String(warning.length),
            dashboardUrl: `${serverConfig.appUrl}/platform/admin/logistics`,
          },
        });
      } catch (error) {
        logger.error('Failed to send document expiry summary email', { error });
      }
    }

    logger.info('Document expiry alerts sent', {
      notificationsSent: (expired.length + urgent.length) * adminUsers.length,
    });

    return {
      expired: expired.length,
      urgent: urgent.length,
      warning: warning.length,
    };
  },
});
