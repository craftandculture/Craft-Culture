import { TRPCError } from '@trpc/server';
import { del } from '@vercel/blob';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { privateClientOrderDocuments } from '@/database/schema';
import { protectedProcedure } from '@/lib/trpc/procedures';

const deleteDocumentSchema = z.object({
  documentId: z.string().uuid(),
});

/**
 * Delete a document from a private client order
 *
 * Removes the file from Vercel Blob and deletes the database record.
 * Only the uploader or an admin can delete a document.
 */
const documentsDelete = protectedProcedure.input(deleteDocumentSchema).mutation(async ({ input, ctx }) => {
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

  // Check access - must be admin or the person who uploaded
  const isAdmin = user.role === 'admin';
  const isUploader = document.uploadedBy === user.id;

  if (!isAdmin && !isUploader) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Only the uploader or an admin can delete this document',
    });
  }

  try {
    // Delete from Vercel Blob
    if (document.fileUrl) {
      await del(document.fileUrl);
    }

    // Delete from database
    await db.delete(privateClientOrderDocuments).where(eq(privateClientOrderDocuments.id, documentId));

    return { success: true };
  } catch (error) {
    console.error('Error deleting document:', {
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
