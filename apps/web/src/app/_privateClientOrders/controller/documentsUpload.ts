import { tasks } from '@trigger.dev/sdk/v3';
import { TRPCError } from '@trpc/server';
import { put } from '@vercel/blob';

import db from '@/database/client';
import { privateClientOrderDocuments } from '@/database/schema';
import { protectedProcedure } from '@/lib/trpc/procedures';
import { extractDocumentJob } from '@/trigger/jobs/extract-document/extractDocumentJob';

import uploadDocumentSchema from '../schemas/uploadDocumentSchema';

/**
 * Upload a document to a private client order
 *
 * Stores the file in Vercel Blob and creates a database record.
 * Supports partner invoices, C&C invoices, distributor invoices, and payment proofs.
 */
const documentsUpload = protectedProcedure.input(uploadDocumentSchema).mutation(async ({ input, ctx }) => {
  const { orderId, documentType, file, filename, fileType } = input;
  const { user } = ctx;

  // Check if Blob token is configured
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    console.error('BLOB_READ_WRITE_TOKEN environment variable is not set');
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'File storage is not configured. Please contact support.',
    });
  }

  // Verify order exists and user has access
  const order = await db.query.privateClientOrders.findFirst({
    where: { id: orderId },
  });

  if (!order) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Order not found',
    });
  }

  // Check access - must be admin, the partner who created it, or assigned distributor
  const isAdmin = user.role === 'admin';

  // Get user's partner (if any)
  const userPartner = await db.query.partners.findFirst({
    where: { userId: user.id },
    columns: { id: true },
  });

  const isPartner = userPartner && order.partnerId === userPartner.id;
  const isDistributor = userPartner && order.distributorId === userPartner.id;

  if (!isAdmin && !isPartner && !isDistributor) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'You do not have access to this order',
    });
  }

  try {
    // Extract base64 data from data URL
    const base64Data = file.split(',')[1];
    if (!base64Data) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Invalid file format',
      });
    }

    // Convert base64 to buffer
    const buffer = Buffer.from(base64Data, 'base64');

    // Validate file size (max 10MB)
    const maxSizeBytes = 10 * 1024 * 1024;
    if (buffer.length > maxSizeBytes) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'File size must be less than 10MB',
      });
    }

    // Generate unique filename
    const timestamp = Date.now();
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    const blobFilename = `private-orders/${orderId}/${documentType}/${timestamp}-${sanitizedFilename}`;

    // Upload to Vercel Blob
    const blob = await put(blobFilename, buffer, {
      access: 'public',
      contentType: fileType,
    });

    // Create database record
    const documents = await db
      .insert(privateClientOrderDocuments)
      .values({
        orderId,
        documentType,
        fileUrl: blob.url,
        fileName: filename,
        fileSize: buffer.length,
        mimeType: fileType,
        uploadedBy: user.id,
        extractionStatus: 'pending',
      })
      .returning();

    const document = documents[0];
    if (!document) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to create document record',
      });
    }

    // Trigger AI extraction in background
    try {
      await tasks.trigger<typeof extractDocumentJob>('extract-document', {
        documentId: document.id,
      });
    } catch (extractionError) {
      // Log but don't fail the upload if extraction trigger fails
      console.error('Failed to trigger document extraction:', {
        documentId: document.id,
        error: extractionError instanceof Error ? extractionError.message : 'Unknown error',
      });
    }

    return document;
  } catch (error) {
    console.error('Error uploading document:', {
      error,
      userId: user.id,
      orderId,
      documentType,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
    });

    if (error instanceof TRPCError) {
      throw error;
    }

    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: `Failed to upload document: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
  }
});

export default documentsUpload;
