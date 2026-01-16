import { TRPCError } from '@trpc/server';

import { adminProcedure } from '@/lib/trpc/procedures';
import logger from '@/utils/logger';

import syncHillebrandDocuments from '../integrations/hillebrand/syncDocuments';

/**
 * Sync documents from Hillebrand API
 *
 * Imports all documents from Hillebrand for shipments with Hillebrand IDs.
 * Creates new records or updates existing ones based on hillebrandDocumentId.
 * Only accessible to admins.
 */
const adminSyncHillebrandDocuments = adminProcedure.mutation(async () => {
  try {
    const result = await syncHillebrandDocuments();

    return {
      success: true,
      created: result.created,
      updated: result.updated,
      errors: result.errors,
      documents: result.documents,
    };
  } catch (error) {
    logger.error('Hillebrand document sync failed', { error });

    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: error instanceof Error ? error.message : 'Failed to sync documents with Hillebrand',
    });
  }
});

export default adminSyncHillebrandDocuments;
