import { TRPCError } from '@trpc/server';
import { put } from '@vercel/blob';
import { fileTypeFromBuffer } from 'file-type';

import db from '@/database/client';
import { logisticsDocuments } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';
import logger from '@/utils/logger';

import uploadDocumentSchema from '../schemas/uploadDocumentSchema';

const ALLOWED_DOCUMENT_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
];

/**
 * Upload a document to a logistics shipment
 *
 * Stores the file in Vercel Blob and creates a database record.
 * Supports BOL, AWB, invoices, permits, certificates, and more.
 */
const adminUploadDocument = adminProcedure.input(uploadDocumentSchema).mutation(async ({ input, ctx }) => {
  const { shipmentId, documentType, documentNumber, issueDate, expiryDate, file, filename } = input;
  const { user } = ctx;

  // Check if Blob token is configured
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    logger.error('BLOB_READ_WRITE_TOKEN environment variable is not set');
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'File storage is not configured. Please contact support.',
    });
  }

  // Verify shipment exists
  const shipment = await db.query.logisticsShipments.findFirst({
    where: { id: shipmentId },
  });

  if (!shipment) {
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'Shipment not found',
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

    // Validate actual file content type
    const detectedType = await fileTypeFromBuffer(buffer);
    if (!detectedType || !ALLOWED_DOCUMENT_TYPES.includes(detectedType.mime)) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Invalid file type. Allowed: PDF, JPEG, PNG, GIF, WebP',
      });
    }

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
    const blobFilename = `logistics/${shipmentId}/${documentType}/${timestamp}-${sanitizedFilename}`;

    // Upload to Vercel Blob using detected content type
    const blob = await put(blobFilename, buffer, {
      access: 'public',
      contentType: detectedType.mime,
    });

    // Create database record
    const documents = await db
      .insert(logisticsDocuments)
      .values({
        shipmentId,
        documentType,
        documentNumber,
        issueDate,
        expiryDate,
        fileUrl: blob.url,
        fileName: filename,
        fileSize: buffer.length,
        mimeType: detectedType.mime,
        uploadedBy: user.id,
      })
      .returning();

    const document = documents[0];
    if (!document) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to create document record',
      });
    }

    return document;
  } catch (error) {
    if (error instanceof TRPCError) {
      throw error;
    }

    logger.error('Error uploading logistics document:', {
      error,
      shipmentId,
      documentType,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
    });

    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to upload document. Please try again.',
    });
  }
});

export default adminUploadDocument;
