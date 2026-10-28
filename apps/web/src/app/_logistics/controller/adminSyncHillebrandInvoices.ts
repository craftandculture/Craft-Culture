import { TRPCError } from '@trpc/server';

import { adminProcedure } from '@/lib/trpc/procedures';
import logger from '@/utils/logger';

import syncHillebrandInvoices from '../integrations/hillebrand/syncInvoices';

/**
 * Sync invoices from Hillebrand API
 *
 * Imports all invoices from Hillebrand, creating new records or updating existing ones.
 * Links invoices to their related shipments.
 * Only accessible to admins.
 */
const adminSyncHillebrandInvoices = adminProcedure.mutation(async () => {
  try {
    const result = await syncHillebrandInvoices();

    return {
      success: true,
      created: result.created,
      updated: result.updated,
      linked: result.linked,
      errors: result.errors,
      invoices: result.invoices,
    };
  } catch (error) {
    logger.error('Hillebrand invoice sync failed', { error: error instanceof Error ? error.message : String(error) });

    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      // The cause is logged; Hillebrand's raw reply is not passed to the browser
      message: 'Failed to sync invoices with Hillebrand. Please try again, or check the Hillebrand connection.',
    });
  }
});

export default adminSyncHillebrandInvoices;
