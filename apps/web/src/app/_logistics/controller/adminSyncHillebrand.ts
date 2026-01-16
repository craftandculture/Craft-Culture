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
    logger.error('Hillebrand sync failed', { error });

    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: error instanceof Error ? error.message : 'Failed to sync with Hillebrand',
    });
  }
});

export default adminSyncHillebrand;
