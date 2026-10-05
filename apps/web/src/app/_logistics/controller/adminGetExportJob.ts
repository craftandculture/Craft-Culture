import { TRPCError } from '@trpc/server';
import { desc, eq } from 'drizzle-orm';
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

    const [documents, history, linkedInvoice] = await Promise.all([
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
      job.exportInvoiceId
        ? db
            .select({ id: exportInvoices.id, number: exportInvoices.number, pdfUrl: exportInvoices.pdfUrl })
            .from(exportInvoices)
            .where(eq(exportInvoices.id, job.exportInvoiceId))
            .then((r) => r[0] ?? null)
        : Promise.resolve(null),
    ]);

    return {
      today,
      shipmentId,
      shipmentNumber: shipment.shipmentNumber,
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
      awbNumber: shipment.awbNumber,
      blNumber: shipment.blNumber,
      notes: shipment.internalNotes,
      invoiceNumber: job.invoiceNumber,
      invoiceValue: job.invoiceValue,
      invoiceCurrency: job.invoiceCurrency,
      linkedInvoice,
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
