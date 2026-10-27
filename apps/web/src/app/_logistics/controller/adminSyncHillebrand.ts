import { TRPCError } from '@trpc/server';

import { adminProcedure } from '@/lib/trpc/procedures';
import logger from '@/utils/logger';

import syncHillebrandShipments from '../integrations/hillebrand/syncShipments';

/**
 * Sync shipments from Hillebrand API
 *
 * Imports all shipments from Hillebrand, creating new records or updating existing ones.
 * Only accessible to admins.
 */
const adminSyncHillebrand = adminProcedure.mutation(async () => {
  try {
    const result = await syncHillebrandShipments();

    return {
      success: true,
      created: result.created,
      updated: result.updated,
      errors: result.errors,
      shipments: result.shipments,
    };
  } catch (error) {
    logger.error('Hillebrand sync failed', { error: error instanceof Error ? error.message : String(error) });

    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      // The cause is logged; Hillebrand's raw reply is not passed to the browser
      message: 'Failed to sync with Hillebrand. Please try again, or check the Hillebrand connection.',
    });
  }
});

export default adminSyncHillebrand;
