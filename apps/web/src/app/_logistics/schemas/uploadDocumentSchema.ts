import { z } from 'zod';

const documentTypes = [
  'bill_of_lading',
  'airway_bill',
  'commercial_invoice',
  'packing_list',
  'certificate_of_origin',
  'customs_declaration',
  'import_permit',
  'export_permit',
  'delivery_note',
  'health_certificate',
  'insurance_certificate',
  'proof_of_delivery',
  'other',
] as const;

const mimeTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'] as const;

/**
 * Schema for uploading a document to a logistics shipment
 *
 * Supports two upload modes:
 * - `file`: base64 data URL (for small files < 4MB)
 * - `blobUrl`: Vercel Blob URL from client upload (for any file size)
 */
const uploadDocumentSchema = z.object({
  shipmentId: z.string().uuid(),
  documentType: z.enum(documentTypes),
  documentNumber: z.string().optional(),
  issueDate: z.coerce.date().optional(),
  expiryDate: z.coerce.date().optional(),
  file: z.string().optional(),
  blobUrl: z.string().url().optional(),
  filename: z.string().min(1, 'Filename is required'),
  fileType: z.enum(mimeTypes),
  fileSize: z.number().int().min(0).optional(),
}).refine(
  (data) => data.file || data.blobUrl,
  { message: 'Either file or blobUrl must be provided' },
);

export type UploadDocumentInput = z.infer<typeof uploadDocumentSchema>;

export default uploadDocumentSchema;
