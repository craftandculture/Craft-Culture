import { TRPCError } from '@trpc/server';
import { desc, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';

import dubaiToday from '@/app/_teamTasks/utils/dubaiToday';
import db from '@/database/client';
import {
  exportInvoices,
  logisticsDocuments,
  logisticsJobs,
  logisticsMovementBonds,
  logisticsShipmentActivityLogs,
  logisticsShipments,
} from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import { bondStatus } from '../utils/bondStatus';
import { exportModeOf } from '../utils/exportStages';

/**
 * One export job: its details, documents, bond and history
 *
 * Every issued export invoice linked to the job is listed among its documents
 * even before its PDF has been filed as a document row, marked as coming from
 * the export invoice so it cannot be removed from here.
 *
 * @example
 *   await trpcClient.logistics.admin.exports.getOne.query({ shipmentId });
 */
const adminGetExportJob = adminProcedure
  .input(z.object({ shipmentId: z.string().uuid() }))
  .query(async ({ input: { shipmentId } }) => {
    const [row] = await db
      .select({ job: logisticsJobs, shipment: logisticsShipments, bond: logisticsMovementBonds })
      .from(logisticsJobs)
      .innerJoin(logisticsShipments, eq(logisticsShipments.id, logisticsJobs.shipmentId))
      .leftJoin(logisticsMovementBonds, eq(logisticsMovementBonds.shipmentId, logisticsJobs.shipmentId))
      .where(eq(logisticsJobs.shipmentId, shipmentId));

    if (!row) throw new TRPCError({ code: 'NOT_FOUND', message: 'Export job not found' });

    const { job, shipment, bond } = row;
    const today = dubaiToday();

    // The first export invoice, then any added after it, in that order
    const linkedIds = [...new Set([job.exportInvoiceId, ...job.additionalExportInvoiceIds].filter((id): id is string => !!id))];

    const [documentRows, history, linkedRows] = await Promise.all([
      db
        .select({
          id: logisticsDocuments.id,
          documentType: logisticsDocuments.documentType,
          fileName: logisticsDocuments.fileName,
          fileUrl: logisticsDocuments.fileUrl,
          uploadedAt: logisticsDocuments.uploadedAt,
        })
        .from(logisticsDocuments)
        .where(eq(logisticsDocuments.shipmentId, shipmentId))
        .orderBy(desc(logisticsDocuments.uploadedAt)),
      db
        .select({
          id: logisticsShipmentActivityLogs.id,
          notes: logisticsShipmentActivityLogs.notes,
          action: logisticsShipmentActivityLogs.action,
          createdAt: logisticsShipmentActivityLogs.createdAt,
        })
        .from(logisticsShipmentActivityLogs)
        .where(eq(logisticsShipmentActivityLogs.shipmentId, shipmentId))
        .orderBy(desc(logisticsShipmentActivityLogs.createdAt))
        .limit(30),
      linkedIds.length > 0
        ? db
            .select({
              id: exportInvoices.id,
              number: exportInvoices.number,
              status: exportInvoices.status,
              pdfUrl: exportInvoices.pdfUrl,
              issuedAt: exportInvoices.issuedAt,
            })
            .from(exportInvoices)
            .where(inArray(exportInvoices.id, linkedIds))
        : Promise.resolve([]),
    ]);

    const linkedInvoices = linkedIds.flatMap((id) => linkedRows.filter((r) => r.id === id));

    const documents = documentRows.map((d) => ({ ...d, fromExportInvoice: false }));
    for (const linked of [...linkedInvoices].reverse()) {
      if (linked.status !== 'issued' || !linked.pdfUrl || documents.some((d) => d.fileUrl === linked.pdfUrl)) continue;
      documents.unshift({
        id: `export-invoice-${linked.id}`,
        documentType: 'commercial_invoice',
        fileName: `${linked.number ?? 'Export invoice'}.pdf`,
        fileUrl: linked.pdfUrl,
        uploadedAt: linked.issuedAt ?? job.updatedAt,
        fromExportInvoice: true,
      });
    }

    return {
      today,
      shipmentId,
      shipmentNumber: shipment.shipmentNumber,
      shipmentType: shipment.type,
      jobNumber: job.jobNumber,
      stage: job.stage,
      mode: exportModeOf(shipment.transportMode, job.bondedTransfer),
      clientName: job.clientName,
      zohoCustomerId: job.zohoCustomerId,
      originCity: shipment.originCity,
      originCountry: shipment.originCountry,
      destinationCity: shipment.destinationCity,
      destinationCountry: shipment.destinationCountry,
      carrierName: shipment.carrierName,
      totalCases: shipment.totalCases ?? 0,
      totalBottles: shipment.totalBottles ?? 0,
      awbNumber: shipment.awbNumber,
      blNumber: shipment.blNumber,
      notes: shipment.internalNotes,
      invoiceNumber: job.invoiceNumber,
      invoiceValue: job.invoiceValue,
      invoiceCurrency: job.invoiceCurrency,
      additionalInvoices: job.additionalInvoices,
      linkedInvoices,
      createdAt: job.createdAt,
      documents,
      history,
      bond: bond
        ? {
            goodsValue: bond.goodsValue,
            bondAmount: bond.bondAmount,
            currency: bond.currency,
            declarationNumber: bond.declarationNumber,
            paidOn: bond.paidOn,
            arrivedOn: bond.arrivedOn,
            stampedOn: bond.stampedOn,
            claimSubmittedOn: bond.claimSubmittedOn,
            refundedOn: bond.refundedOn,
            refundAmount: bond.refundAmount,
            ...bondStatus(bond, today),
          }
        : null,
    };
  });

export default adminGetExportJob;
