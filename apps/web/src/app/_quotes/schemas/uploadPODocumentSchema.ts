import { z } from 'zod';

/**
 * Schema for uploading a PO document
 */
const uploadPODocumentSchema = z.object({
  file: z.string().min(1, 'File is required'),
  filename: z.string().min(1, 'Filename is required'),
  fileType: z.enum(['application/pdf', 'image/png', 'image/jpeg', 'image/jpg']),
});

export default uploadPODocumentSchema;
