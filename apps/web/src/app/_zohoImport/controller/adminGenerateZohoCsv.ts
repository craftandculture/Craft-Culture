import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import hsCodeOptions from '@/app/_exportInvoices/hsCodeOptions';
import { adminProcedure } from '@/lib/trpc/procedures';
import logger from '@/utils/logger';

import zohoItemSchema from '../schemas/zohoItemSchema';
import buildZohoSku from '../utils/buildZohoSku';
import formatZohoCsv from '../utils/formatZohoCsv';

const ALLOWED_HS_CODES = new Set<string>(hsCodeOptions.map((o) => o.code));

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
 *
 * Each SKU is rebuilt here from the line's LWIN7, vintage, pack and size, in
 * the dashed LWIN18 form, so an edited line never keeps a stale code. A line
 * with no LWIN7 (neither a Liv-ex match nor a C&C internal code), or with an
 * HS code that is not on C&C's list, stops the file with the lines named,
 * rather than creating a placeholder item in Zoho.
 */
const adminGenerateZohoCsv = adminProcedure.input(generateCsvSchema).mutation(async ({ input }) => {
  const { supplierName } = input;

  const items = input.items.map((item) => ({
    ...item,
    sku: buildZohoSku(item) ?? '',
    hsCode: item.hsCode.replace(/[\s.]/g, ''),
  }));
  const noCode = items.filter((i) => !i.sku).map((i) => i.productName);
  const badHs = items.filter((i) => !ALLOWED_HS_CODES.has(i.hsCode)).map((i) => `${i.productName} (${i.hsCode || 'none'})`);

  if (noCode.length) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `These lines have no LWIN. Enter the Liv-ex LWIN7 or a C&C internal code (9000001 upwards) first: ${noCode.join('; ')}`,
    });
  }
  if (badHs.length) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: `These HS codes are not on C&C's list (${[...ALLOWED_HS_CODES].join(', ')}): ${badHs.join('; ')}`,
    });
  }

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
