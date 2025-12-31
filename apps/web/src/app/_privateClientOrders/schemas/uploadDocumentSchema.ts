import { z } from 'zod';

const documentTypes = ['partner_invoice', 'cc_invoice', 'distributor_invoice', 'payment_proof'] as const;
const mimeTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'] as const;

/**
 * Schema for uploading a document to a private client order
 */
const uploadDocumentSchema = z.object({
  orderId: z.string().uuid(),
  documentType: z.enum(documentTypes),
  file: z.string().min(1, 'File is required'),
  filename: z.string().min(1, 'Filename is required'),
  fileType: z.enum(mimeTypes),
});

export type UploadDocumentInput = z.infer<typeof uploadDocumentSchema>;

export default uploadDocumentSchema;
