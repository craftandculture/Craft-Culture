import { createTRPCRouter } from '@/lib/trpc/trpc';

import adminExtractInvoice from './controller/adminExtractInvoice';
import adminGenerateZohoCsv from './controller/adminGenerateZohoCsv';

/**
 * Router for Zoho Inventory import functionality
 *
 * Provides endpoints for:
 * - Extracting wine items from supplier invoices
 * - Generating Zoho-compatible CSV files for import
 */
const zohoImportRouter = createTRPCRouter({
  admin: createTRPCRouter({
    extractInvoice: adminExtractInvoice,
    generateZohoCsv: adminGenerateZohoCsv,
  }),
});

export default zohoImportRouter;
