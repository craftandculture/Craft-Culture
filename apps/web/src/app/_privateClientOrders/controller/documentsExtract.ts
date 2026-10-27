import { tasks } from '@trigger.dev/sdk/v3';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import db from '@/database/client';
import { approvedProcedure } from '@/lib/trpc/procedures';
import { extractDocumentJob } from '@/trigger/jobs/extract-document/extractDocumentJob';

import { type PcoDocumentType, UPLOADABLE_DOCUMENT_TYPES } from '../utils/documentAccess';
import resolveOrderParty from '../utils/resolveOrderParty';

const extractDocumentSchema = z.object({
  documentId: z.string().uuid(),
});

/**
 * Trigger AI extraction for a document
 *
 * Sends the document to a background job for processing.
 * The job will extract structured data from invoices and payment proofs.
 */
const documentsExtract = approvedProcedure.input(extractDocumentSchema).mutation(async ({ input, ctx }) => {
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

  /*
    C&C staff, or a party to the order (not view-only) re-reading a kind of
    document that is theirs: a distributor never touches the partner's invoice.
  */
  const { party, canWrite } = await resolveOrderParty(user, order);

  if (
    !party ||
    !canWrite ||
    !UPLOADABLE_DOCUMENT_TYPES[party].includes(document.documentType as PcoDocumentType)
  ) {
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
