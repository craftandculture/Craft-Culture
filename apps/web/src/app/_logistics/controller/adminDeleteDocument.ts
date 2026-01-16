import { TRPCError } from '@trpc/server';
import { del } from '@vercel/blob';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { logisticsDocuments } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';
import logger from '@/utils/logger';

const deleteDocumentSchema = z.object({
  documentId: z.string().uuid(),
});

/**
 * Delete a document from a logistics shipment
 *
 * Removes the file from Vercel Blob and deletes the database record.
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
    // Delete from Vercel Blob
    if (document.fileUrl) {
      await del(document.fileUrl);
    }

    // Delete from database
    await db.delete(logisticsDocuments).where(eq(logisticsDocuments.id, documentId));

    logger.info('Logistics document deleted', {
      documentId,
      shipmentId: document.shipmentId,
      deletedBy: user.id,
    });

    return { success: true };
  } catch (error) {
    logger.error('Error deleting logistics document:', {
      error,
      documentId,
      userId: user.id,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
    });

    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: `Failed to delete document: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
  }
});

export default adminDeleteDocument;
