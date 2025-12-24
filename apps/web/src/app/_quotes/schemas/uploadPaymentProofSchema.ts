import { z } from 'zod';

/**
 * Schema for uploading a payment proof screenshot
 */
const uploadPaymentProofSchema = z.object({
  file: z.string().min(1, 'File is required'),
  filename: z.string().min(1, 'Filename is required'),
  fileType: z.enum(['image/png', 'image/jpeg', 'image/jpg', 'application/pdf']),
});

export default uploadPaymentProofSchema;
