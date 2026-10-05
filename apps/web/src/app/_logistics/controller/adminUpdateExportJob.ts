import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';

import db from '@/database/client';
import {
  logisticsJobs,
  logisticsMovementBonds,
  logisticsShipmentActivityLogs,
  logisticsShipments,
} from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import { updateExportJobSchema } from '../schemas/exportJobSchemas';
import { EXPORT_MODES, EXPORT_STAGES, stageLabel } from '../utils/exportStages';

/**
 * Edit an export job, or move it to another stage
 *
 * A stage change also sets the shipment's status to the matching one, so the
 * shipments list and dashboard agree with the job. Switching a job to a bonded
 * transfer gives it a movement bond; switching away keeps the bond's record.
 *
 * @example
 *   await trpcClient.logistics.admin.exports.update.mutate({ shipmentId, stage: 'shipped' });
 */
const adminUpdateExportJob = adminProcedure
  .input(updateExportJobSchema)
  .mutation(async ({ input, ctx: { user } }) => {
    const { shipmentId } = input;

    const [current] = await db
      .select({ job: logisticsJobs, status: logisticsShipments.status })
      .from(logisticsJobs)
      .innerJoin(logisticsShipments, eq(logisticsShipments.id, logisticsJobs.shipmentId))
      .where(eq(logisticsJobs.shipmentId, shipmentId));

    if (!current) throw new TRPCError({ code: 'NOT_FOUND', message: 'Export job not found' });

    const mode = input.mode ? EXPORT_MODES.find((m) => m.key === input.mode)! : null;
    const stage = input.stage ? EXPORT_STAGES.find((s) => s.key === input.stage)! : null;
    const stageChanged = stage && stage.key !== current.job.stage;

    await db.transaction(async (tx) => {
      await tx
        .update(logisticsJobs)
        .set({
          ...(input.clientName !== undefined && { clientName: input.clientName }),
          ...(input.zohoCustomerId !== undefined && { zohoCustomerId: input.zohoCustomerId }),
          ...(input.invoiceNumber !== undefined && { invoiceNumber: input.invoiceNumber }),
          ...(input.invoiceValue !== undefined && { invoiceValue: input.invoiceValue }),
          ...(input.invoiceCurrency !== undefined && { invoiceCurrency: input.invoiceCurrency }),
          ...(input.exportInvoiceId !== undefined && { exportInvoiceId: input.exportInvoiceId }),
          ...(mode && { bondedTransfer: mode.bonded }),
          ...(stage && { stage: stage.key }),
        })
        .where(eq(logisticsJobs.shipmentId, shipmentId));

      await tx
        .update(logisticsShipments)
        .set({
          ...(input.originCity !== undefined && { originCity: input.originCity }),
          ...(input.originCountry !== undefined && { originCountry: input.originCountry }),
          ...(input.destinationCity !== undefined && { destinationCity: input.destinationCity }),
          ...(input.destinationCountry !== undefined && { destinationCountry: input.destinationCountry }),
          ...(input.carrierName !== undefined && { carrierName: input.carrierName }),
          ...(input.awbNumber !== undefined && { awbNumber: input.awbNumber }),
          ...(input.blNumber !== undefined && { blNumber: input.blNumber }),
          ...(input.notes !== undefined && { internalNotes: input.notes }),
          ...(mode && { transportMode: mode.transportMode }),
          ...(stageChanged && { status: stage.status }),
          ...(stageChanged && stage.key === 'shipped' && { atd: new Date() }),
          ...(stageChanged && stage.key === 'docs_sent' && { deliveredAt: new Date() }),
          updatedAt: new Date(),
        })
        .where(eq(logisticsShipments.id, shipmentId));

      if (mode?.bonded) {
        await tx
          .insert(logisticsMovementBonds)
          .values({
            shipmentId,
            currency: input.invoiceCurrency ?? current.job.invoiceCurrency,
          })
          .onConflictDoNothing({ target: logisticsMovementBonds.shipmentId });
      }

      if (stageChanged) {
        await tx.insert(logisticsShipmentActivityLogs).values({
          shipmentId,
          userId: user.id,
          action: 'status_changed',
          previousStatus: current.status,
          newStatus: stage.status,
          notes: `${stageLabel(current.job.stage)} → ${stage.label}`,
        });
      }
    });

    return { ok: true };
  });

export default adminUpdateExportJob;
