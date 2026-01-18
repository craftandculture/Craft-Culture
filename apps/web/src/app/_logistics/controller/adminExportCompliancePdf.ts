import { z } from 'zod';

import { adminProcedure } from '@/lib/trpc/procedures';

import adminGetDocumentCompliance from './adminGetDocumentCompliance';

const exportComplianceSchema = z.object({
  filter: z.enum(['all', 'missing', 'expiring', 'expired']).optional().default('all'),
});

/**
 * Export document compliance report as JSON for client-side PDF generation
 *
 * Returns structured data for PDF generation on the client
 */
const adminExportCompliancePdf = adminProcedure
  .input(exportComplianceSchema)
  .mutation(async ({ input, ctx }) => {
    // Get the report data using the existing query logic
    const report = await adminGetDocumentCompliance._def.query({
      input,
      ctx,
      type: 'query',
      path: 'logistics.admin.getDocumentCompliance',
      rawInput: input,
    });

    // Format data for PDF generation
    const pdfData = {
      title: 'Document Compliance Report',
      generatedAt: new Date().toISOString(),
      filter: input.filter,
      summary: {
        totalShipments: report.summary.totalShipments,
        compliantCount: report.summary.compliantCount,
        warningCount: report.summary.warningCount,
        criticalCount: report.summary.criticalCount,
        averageComplianceScore: report.summary.averageComplianceScore,
        totalMissingDocs: report.summary.totalMissingDocs,
        totalExpiringDocs: report.summary.totalExpiringDocs,
        totalExpiredDocs: report.summary.totalExpiredDocs,
      },
      shipments: report.shipments.map((s) => ({
        shipmentNumber: s.shipmentNumber,
        shipmentType: s.shipmentType,
        status: s.status,
        route: s.route,
        eta: s.eta ? new Date(s.eta).toLocaleDateString() : null,
        complianceScore: s.complianceScore,
        complianceStatus: s.complianceStatus,
        totalDocuments: s.totalDocuments,
        requiredDocuments: s.requiredDocuments,
        missingDocuments: s.missingDocuments,
        expiringDocuments: s.expiringDocuments.map((d) => ({
          type: d.type,
          fileName: d.fileName,
          expiryDate: d.expiryDate ? new Date(d.expiryDate).toLocaleDateString() : null,
          isUrgent: d.isUrgent,
        })),
        expiredDocuments: s.expiredDocuments.map((d) => ({
          type: d.type,
          fileName: d.fileName,
          expiryDate: d.expiryDate ? new Date(d.expiryDate).toLocaleDateString() : null,
        })),
      })),
    };

    return pdfData;
  });

export default adminExportCompliancePdf;
