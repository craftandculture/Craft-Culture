import { z } from 'zod';

import { adminProcedure } from '@/lib/trpc/procedures';
import logger from '@/utils/logger';

import zohoItemSchema from '../schemas/zohoItemSchema';
import formatZohoCsv from '../utils/formatZohoCsv';

/**
 * Input schema for CSV generation
 */
const generateCsvSchema = z.object({
  supplierName: z.string().min(1).describe('Supplier name for Preferred Vendor field'),
  items: z.array(zohoItemSchema).min(1).describe('Items to include in CSV'),
});

/**
 * Generate Zoho Inventory compatible CSV from extracted items
 *
 * Takes the processed items from extraction and generates a CSV file
 * that can be directly imported into Zoho Inventory.
 */
const adminGenerateZohoCsv = adminProcedure.input(generateCsvSchema).mutation(async ({ input }) => {
  const { supplierName, items } = input;

  logger.info('[ZohoImport] Generating CSV', {
    supplierName,
    itemCount: items.length,
  });

  // Generate CSV content
  const csvContent = formatZohoCsv(items, supplierName);

  // Convert to base64 for transmission
  const base64Content = Buffer.from(csvContent, 'utf-8').toString('base64');

  // Generate filename with timestamp
  const timestamp = new Date().toISOString().split('T')[0];
  const sanitizedSupplier = supplierName.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);
  const filename = `zoho_import_${sanitizedSupplier}_${timestamp}.csv`;

  logger.info('[ZohoImport] CSV generated', {
    filename,
    contentLength: csvContent.length,
  });

  return {
    success: true,
    data: base64Content,
    filename,
    mimeType: 'text/csv' as const,
    itemCount: items.length,
  };
});

export default adminGenerateZohoCsv;
