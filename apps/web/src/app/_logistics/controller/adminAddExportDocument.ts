import { TRPCError } from '@trpc/server';
import { and, eq, isNull } from 'drizzle-orm';

import dubaiToday from '@/app/_teamTasks/utils/dubaiToday';
import db from '@/database/client';
import { logisticsDocuments, logisticsMovementBonds, logisticsShipmentActivityLogs } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';
import isVercelBlobUrl from '@/utils/isVercelBlobUrl';

import { addExportDocumentSchema } from '../schemas/exportJobSchemas';

const DOCUMENT_TYPE = {
  invoice: 'commercial_invoice',
  stamped: 'customs_declaration',
  awb: 'airway_bill',
  bl: 'bill_of_lading',
  other: 'other',
} as const;

const LABEL = {
  invoice: 'Invoice',
  stamped: 'Stamped bond paperwork',
  awb: 'Airway bill',
  bl: 'Bill of lading',
  other: 'Document',
} as const;

/**
 * Attach a file to an export job, once the browser has put it in Blob
 *
 * The file goes straight from the browser to Blob, so its size never meets the
 * request limit. Stamped paperwork is what redeems the bond, so uploading it
 * also marks that step done today if it was not already.
 *
 * @example
 *   await trpcClient.logistics.admin.exports.addDocument.mutate({ shipmentId, blobUrl, filename, mimeType, kind: 'invoice' });
 */
const adminAddExportDocument = adminProcedure
  .input(addExportDocumentSchema)
  .mutation(async ({ input, ctx: { user } }) => {
    if (!isVercelBlobUrl(input.blobUrl)) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Unrecognised file location' });
    }

    const [document] = await db
      .insert(logisticsDocuments)
      .values({
        shipmentId: input.shipmentId,
        documentType: DOCUMENT_TYPE[input.kind],
        fileUrl: input.blobUrl,
        fileName: input.filename,
        fileSize: input.fileSize ?? null,
        mimeType: input.mimeType,
        uploadedBy: user.id,
      })
      .returning({ id: logisticsDocuments.id });

    if (input.kind === 'stamped') {
      await db
        .update(logisticsMovementBonds)
        .set({ stampedOn: dubaiToday(), updatedAt: new Date() })
        .where(and(eq(logisticsMovementBonds.shipmentId, input.shipmentId), isNull(logisticsMovementBonds.stampedOn)));
    }

    await db.insert(logisticsShipmentActivityLogs).values({
      shipmentId: input.shipmentId,
      userId: user.id,
      action: 'document_uploaded',
      notes: `${LABEL[input.kind]} uploaded: ${input.filename}`,
      metadata: { documentId: document?.id, documentType: DOCUMENT_TYPE[input.kind] },
    });

    return { id: document?.id };
  });

export default adminAddExportDocument;
