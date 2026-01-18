import { z } from 'zod';

/**
 * Schema for standalone logistics document extraction
 */
const extractDocumentSchema = z.object({
  file: z.string().describe('Base64 encoded file data URL'),
  fileType: z.enum(['application/pdf', 'image/png', 'image/jpeg', 'image/jpg']),
  documentType: z
    .enum([
      'freight_invoice',
      'packing_list',
      'bill_of_lading',
      'airway_bill',
      'commercial_invoice',
      'customs_document',
      'general',
    ])
    .optional()
    .default('general')
    .describe('Hint for what type of document is being extracted'),
});

export default extractDocumentSchema;
