import { TRPCError } from '@trpc/server';

import db from '@/database/client';
import {
  logisticsJobs,
  logisticsMovementBonds,
  logisticsShipmentActivityLogs,
  logisticsShipments,
} from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';
import logger from '@/utils/logger';

import { createExportJobSchema } from '../schemas/exportJobSchemas';
import { EXPORT_MODES } from '../utils/exportStages';
import generateJobNumber from '../utils/generateJobNumber';
import generateShipmentNumber from '../utils/generateShipmentNumber';

const isUniqueViolation = (error: unknown) =>
  typeof error === 'object' && error !== null && 'code' in error && (error as { code: string }).code === '23505';

/**
 * Open an export job
 *
 * Makes an outbound shipment, so the job has the documents and history every
 * shipment has, and a job beside it carrying the EXP-CNC number the team works
 * by. A bonded transfer also gets an empty movement bond, ready to fill in.
 *
 * @example
 *   await trpcClient.logistics.admin.exports.create.mutate({
 *     clientName: 'The Bottle Store', originCity: 'RAK', destinationCity: 'Dubai', mode: 'bonded',
 *   });
 */
const adminCreateExportJob = adminProcedure
  .input(createExportJobSchema)
  .mutation(async ({ input, ctx: { user } }) => {
    const mode = EXPORT_MODES.find((m) => m.key === input.mode)!;

    // Two jobs opened at the same moment would draw the same number; the
    // unique columns refuse the second, which simply draws again.
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const [shipmentNumber, jobNumber] = await Promise.all([
          generateShipmentNumber(),
          generateJobNumber('export'),
        ]);

        const created = await db.transaction(async (tx) => {
          const [shipment] = await tx
            .insert(logisticsShipments)
            .values({
              shipmentNumber,
              type: 'outbound',
              transportMode: mode.transportMode,
              status: 'draft',
              originCity: input.originCity,
              originCountry: input.originCountry ?? null,
              originWarehouse: null,
              destinationCity: input.destinationCity,
              destinationCountry: input.destinationCountry ?? null,
              destinationWarehouse: null,
              carrierName: input.carrierName ?? null,
              internalNotes: input.notes ?? null,
              createdBy: user.id,
            })
            .returning({ id: logisticsShipments.id });

          await tx.insert(logisticsJobs).values({
            shipmentId: shipment!.id,
            kind: 'export',
            jobNumber,
            stage: 'booking_received',
            bondedTransfer: mode.bonded,
            clientName: input.clientName,
            zohoCustomerId: input.zohoCustomerId ?? null,
            exportInvoiceId: input.exportInvoiceId ?? null,
            invoiceNumber: input.invoiceNumber ?? null,
            invoiceValue: input.invoiceValue ?? null,
            invoiceCurrency: input.invoiceCurrency,
            createdBy: user.id,
          });

          if (mode.bonded) {
            await tx.insert(logisticsMovementBonds).values({
              shipmentId: shipment!.id,
              currency: input.invoiceCurrency,
              goodsValue: input.invoiceValue ?? null,
              bondAmount: input.invoiceValue != null ? Math.round(input.invoiceValue * 50) / 100 : null,
            });
          }

          await tx.insert(logisticsShipmentActivityLogs).values({
            shipmentId: shipment!.id,
            userId: user.id,
            action: 'created',
            newStatus: 'draft',
            notes: `Export job ${jobNumber} opened (${shipmentNumber})`,
          });

          return { shipmentId: shipment!.id, jobNumber, shipmentNumber };
        });

        return created;
      } catch (error) {
        if (isUniqueViolation(error) && attempt < 2) continue;

        logger.error('Error creating export job', { error });
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Could not open the export job' });
      }
    }

    throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Could not open the export job' });
  });

export default adminCreateExportJob;
