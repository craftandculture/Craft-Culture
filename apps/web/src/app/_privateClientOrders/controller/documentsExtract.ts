import { tasks } from '@trigger.dev/sdk/v3';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import db from '@/database/client';
import { protectedProcedure } from '@/lib/trpc/procedures';
import { extractDocumentJob } from '@/trigger/jobs/extract-document/extractDocumentJob';

const extractDocumentSchema = z.object({
  documentId: z.string().uuid(),
});

/**
 * Trigger AI extraction for a document
 *
 * Sends the document to a background job for processing.
 * The job will extract structured data from invoices and payment proofs.
 */
const documentsExtract = protectedProcedure.input(extractDocumentSchema).mutation(async ({ input, ctx }) => {
  const { documentId } = input;
  const { user } = ctx;

  // Get the document
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

  // Check access - must be admin, partner, or distributor
  const isAdmin = user.role === 'admin';

  const userPartner = await db.query.partners.findFirst({
    where: { userId: user.id },
    columns: { id: true },
  });

  const isPartner = userPartner && order.partnerId === userPartner.id;
  const isDistributor = userPartner && order.distributorId === userPartner.id;

  if (!isAdmin && !isPartner && !isDistributor) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'You do not have access to this document',
    });
  }

  // Check if already processing
  if (document.extractionStatus === 'processing') {
    throw new TRPCError({
      code: 'CONFLICT',
      message: 'Document is already being processed',
    });
  }

  // Trigger extraction job
  const handle = await tasks.trigger<typeof extractDocumentJob>('extract-document', {
    documentId,
  });

  return {
    success: true,
    taskId: handle.id,
  };
});

export default documentsExtract;
