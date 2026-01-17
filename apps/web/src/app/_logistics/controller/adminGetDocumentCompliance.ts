import { eq, or } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { logisticsDocuments, logisticsShipments } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

const getDocumentComplianceSchema = z.object({
  filter: z.enum(['all', 'missing', 'expiring', 'expired']).optional().default('all'),
});

/**
 * Get document compliance report
 *
 * Returns a list of shipments with their document compliance status,
 * highlighting missing required documents and expiring/expired documents.
 */
const adminGetDocumentCompliance = adminProcedure
  .input(getDocumentComplianceSchema)
  .query(async ({ input }) => {
    const { filter } = input;
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    // Required document types based on shipment type
    const requiredDocsByType: Record<string, string[]> = {
      inbound: ['bill_of_lading', 'commercial_invoice', 'packing_list', 'certificate_of_origin'],
      outbound: ['commercial_invoice', 'packing_list', 'export_permit'],
      re_export: ['commercial_invoice', 'packing_list', 'import_permit', 'export_permit'],
    };

    // Get all active shipments (not delivered or cancelled)
    const activeStatuses = [
      'draft',
      'booked',
      'picked_up',
      'in_transit',
      'arrived_port',
      'customs_clearance',
      'cleared',
      'at_warehouse',
      'dispatched',
    ];

    const shipments = await db.query.logisticsShipments.findMany({
      where: or(...activeStatuses.map((s) => eq(logisticsShipments.status, s))),
      columns: {
        id: true,
        shipmentNumber: true,
        type: true,
        status: true,
        originCountry: true,
        destinationCountry: true,
        eta: true,
      },
    });

    // Get all documents for these shipments
    const shipmentIds = shipments.map((s) => s.id);

    const documentQuery = db.query.logisticsDocuments.findMany({
      where:
        shipmentIds.length > 0
          ? or(...shipmentIds.map((id) => eq(logisticsDocuments.shipmentId, id)))
          : undefined,
      columns: {
        id: true,
        shipmentId: true,
        documentType: true,
        fileName: true,
        expiryDate: true,
        isRequired: true,
        isVerified: true,
      },
    });

    const documents = await documentQuery;

    // Build compliance report for each shipment
    const complianceReport = shipments.map((shipment) => {
      const shipmentDocs = documents.filter((d) => d.shipmentId === shipment.id);
      const requiredTypes = requiredDocsByType[shipment.type] || [];
      const presentTypes = shipmentDocs.map((d) => d.documentType);

      // Check for missing documents
      const missingDocs = requiredTypes.filter((type) => !presentTypes.includes(type));

      // Check for expiring documents (within 30 days)
      const expiringDocs = shipmentDocs.filter(
        (d) =>
          d.expiryDate &&
          d.expiryDate >= now &&
          d.expiryDate < thirtyDaysFromNow,
      );

      // Check for urgent expiring (within 7 days)
      const urgentExpiringDocs = shipmentDocs.filter(
        (d) =>
          d.expiryDate &&
          d.expiryDate >= now &&
          d.expiryDate < sevenDaysFromNow,
      );

      // Check for expired documents
      const expiredDocs = shipmentDocs.filter(
        (d) => d.expiryDate && d.expiryDate < now,
      );

      // Check for unverified required documents
      const unverifiedDocs = shipmentDocs.filter((d) => d.isRequired && !d.isVerified);

      // Calculate compliance score
      const totalRequired = requiredTypes.length;
      const totalPresent = requiredTypes.filter((type) => presentTypes.includes(type)).length;
      const complianceScore = totalRequired > 0 ? Math.round((totalPresent / totalRequired) * 100) : 100;

      // Determine overall status
      let complianceStatus: 'compliant' | 'warning' | 'critical' = 'compliant';
      if (expiredDocs.length > 0 || missingDocs.length > 2) {
        complianceStatus = 'critical';
      } else if (urgentExpiringDocs.length > 0 || missingDocs.length > 0) {
        complianceStatus = 'warning';
      }

      return {
        shipmentId: shipment.id,
        shipmentNumber: shipment.shipmentNumber,
        shipmentType: shipment.type,
        status: shipment.status,
        route: `${shipment.originCountry || 'Unknown'} → ${shipment.destinationCountry || 'Unknown'}`,
        eta: shipment.eta,
        complianceScore,
        complianceStatus,
        totalDocuments: shipmentDocs.length,
        requiredDocuments: requiredTypes.length,
        missingDocuments: missingDocs,
        expiringDocuments: expiringDocs.map((d) => ({
          id: d.id,
          type: d.documentType,
          fileName: d.fileName,
          expiryDate: d.expiryDate,
          isUrgent: d.expiryDate! < sevenDaysFromNow,
        })),
        expiredDocuments: expiredDocs.map((d) => ({
          id: d.id,
          type: d.documentType,
          fileName: d.fileName,
          expiryDate: d.expiryDate,
        })),
        unverifiedDocuments: unverifiedDocs.map((d) => ({
          id: d.id,
          type: d.documentType,
          fileName: d.fileName,
        })),
      };
    });

    // Apply filter
    let filteredReport = complianceReport;
    if (filter === 'missing') {
      filteredReport = complianceReport.filter((r) => r.missingDocuments.length > 0);
    } else if (filter === 'expiring') {
      filteredReport = complianceReport.filter((r) => r.expiringDocuments.length > 0);
    } else if (filter === 'expired') {
      filteredReport = complianceReport.filter((r) => r.expiredDocuments.length > 0);
    }

    // Sort by compliance status (critical first, then warning, then compliant)
    const statusOrder = { critical: 0, warning: 1, compliant: 2 };
    filteredReport.sort((a, b) => statusOrder[a.complianceStatus] - statusOrder[b.complianceStatus]);

    // Summary statistics
    const summary = {
      totalShipments: complianceReport.length,
      compliantCount: complianceReport.filter((r) => r.complianceStatus === 'compliant').length,
      warningCount: complianceReport.filter((r) => r.complianceStatus === 'warning').length,
      criticalCount: complianceReport.filter((r) => r.complianceStatus === 'critical').length,
      averageComplianceScore:
        complianceReport.length > 0
          ? Math.round(
              complianceReport.reduce((sum, r) => sum + r.complianceScore, 0) /
                complianceReport.length,
            )
          : 100,
      totalMissingDocs: complianceReport.reduce((sum, r) => sum + r.missingDocuments.length, 0),
      totalExpiringDocs: complianceReport.reduce((sum, r) => sum + r.expiringDocuments.length, 0),
      totalExpiredDocs: complianceReport.reduce((sum, r) => sum + r.expiredDocuments.length, 0),
    };

    return {
      summary,
      shipments: filteredReport,
    };
  });

export default adminGetDocumentCompliance;
