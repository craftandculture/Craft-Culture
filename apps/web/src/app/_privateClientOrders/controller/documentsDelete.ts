import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { privateClientOrderDocuments } from '@/database/schema';
import { deleteStoredFile } from '@/lib/blob/privateFiles';
import { approvedProcedure } from '@/lib/trpc/procedures';
import logger from '@/utils/logger';

import { isDocumentDeletable } from '../utils/documentAccess';
import resolveOrderParty from '../utils/resolveOrderParty';

const deleteDocumentSchema = z.object({
  documentId: z.string().uuid(),
});

/**
 * Delete a document from a private client order
 *
 * Removes the file from Vercel Blob and deletes the database record.
 * Only the uploader or an admin can delete a document.
 */
const documentsDelete = approvedProcedure.input(deleteDocumentSchema).mutation(async ({ input, ctx }) => {
  const { documentId } = input;
  const { user } = ctx;

  // Get the document with order info
  const document = await db.query.privateClientOrderDocuments.findFirst({
    where: { id: documentId },
  });

  if (!document) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Document not found',
    });
  }

  // Get the order to check access
  const order = await db.query.privateClientOrders.findFirst({
    where: { id: document.orderId },
  });

  if (!order) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Order not found',
    });
  }

  /*
    C&C staff can remove any document. Anyone else only one they added
    themselves, while they still act for that side of the order with more
    than view-only access, and only until the order has moved on because of
    it (an invoice C&C approved against, a payment proof already accepted).
  */
  const { party, canWrite } = await resolveOrderParty(user, order);
  const isAdmin = party === 'staff';
  const isUploader = document.uploadedBy === user.id;

  if (!isAdmin && (!isUploader || !party || !canWrite)) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Only the uploader or an admin can delete this document',
    });
  }

  if (!isAdmin && !isDocumentDeletable(document.documentType, order.status)) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'The order has moved on since this document was added, so it can no longer be removed. Ask Craft & Culture if it needs replacing.',
    });
  }

  try {
    // Delete from Vercel Blob
    if (document.fileUrl) {
      await deleteStoredFile(document.fileUrl);
    }

    // Delete from database
    await db.delete(privateClientOrderDocuments).where(eq(privateClientOrderDocuments.id, documentId));

    return { success: true };
  } catch (error) {
    logger.error('Error deleting document:', {
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

export default documentsDelete;
