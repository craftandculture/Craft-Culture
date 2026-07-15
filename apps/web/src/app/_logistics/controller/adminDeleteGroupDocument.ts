import { eq } from 'drizzle-orm';

import db from '@/database/client';
import { logisticsGroupDocuments } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import { deleteGroupDocumentSchema } from '../schemas/shipmentGroupSchemas';

/**
 * Delete a group document (removes the DB record; the blob is left in storage).
 */
const adminDeleteGroupDocument = adminProcedure
  .input(deleteGroupDocumentSchema)
  .mutation(async ({ input }) => {
    await db.delete(logisticsGroupDocuments).where(eq(logisticsGroupDocuments.id, input.id));
    return { id: input.id };
  });

export default adminDeleteGroupDocument;
