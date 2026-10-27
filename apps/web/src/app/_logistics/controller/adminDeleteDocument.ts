import { TRPCError } from '@trpc/server';
import { del } from '@vercel/blob';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { logisticsDocuments } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';
import isVercelBlobUrl from '@/utils/isVercelBlobUrl';
import logger from '@/utils/logger';

const deleteDocumentSchema = z.object({
  documentId: z.string().uuid(),
});

/**
 * Delete a document from a logistics shipment
 *
 * Deletes the database record, then removes the file from our Blob store.
 * A document synced from Hillebrand points at Hillebrand's own download link,
 * which is not ours to delete, so only the record goes (the next Hillebrand
 * sync brings it back if Hillebrand still lists it). A file that cannot be
 * removed from Blob does not stop the record being deleted.
 */
const adminDeleteDocument = adminProcedure.input(deleteDocumentSchema).mutation(async ({ input, ctx }) => {
  const { documentId } = input;
  const { user } = ctx;

  // Get the document
  const document = await db.query.logisticsDocuments.findFirst({
    where: { id: documentId },
  });

  if (!document) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Document not found',
    });
  }

  // Get the shipment to verify it exists
  const shipment = await db.query.logisticsShipments.findFirst({
    where: { id: document.shipmentId },
  });

  if (!shipment) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Shipment not found',
    });
  }

  try {
    await db.delete(logisticsDocuments).where(eq(logisticsDocuments.id, documentId));

    // Only files in our own store; never a Hillebrand link or someone else's file
    if (document.fileUrl && isVercelBlobUrl(document.fileUrl)) {
      await del(document.fileUrl).catch((error: unknown) => {
        logger.error('Document record deleted but its file could not be removed', {
          documentId,
          error: error instanceof Error ? error.message : String(error),
        });
      });
    }

    logger.info('Logistics document deleted', {
      documentId,
      shipmentId: document.shipmentId,
      deletedBy: user.id,
    });

    return { success: true };
  } catch (error) {
    logger.error('Error deleting logistics document:', {
      documentId,
      userId: user.id,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
    });

    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to delete the document. Please try again.',
    });
  }
});

export default adminDeleteDocument;
