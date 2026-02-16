import { z } from 'zod';

/**
 * Schema for invoice extraction input
 */
const extractInvoiceSchema = z.object({
  file: z.string().describe('Base64 encoded file content'),
  fileType: z
    .enum([
      'application/pdf',
      'image/png',
      'image/jpeg',
      'image/jpg',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ])
    .describe('MIME type of the file'),
  supplierName: z.string().min(1).describe('Supplier/vendor name for the Zoho import'),
});

export default extractInvoiceSchema;
