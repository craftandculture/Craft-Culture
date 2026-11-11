import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { logisticsDocuments } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';
import logger from '@/utils/logger';

const updateDocumentExpirySchema = z.object({
  documentId: z.string().uuid(),
  /** A calendar date (YYYY-MM-DD) from a date input, or null to clear it */
  expiryDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expiry date must be a calendar date')
    .nullable(),
});

/**
 * Set or clear the expiry date on a logistics document
 *
 * The Document Compliance Report, the dashboard's expiring-documents tile and
 * the daily expiry alert all read this date, so staff enter it here for
 * documents already on a shipment. Only the expiry date changes. The date is
 * stored as midnight UTC on the chosen day, the same as an upload stores it.
 */
const adminUpdateDocumentExpiry = adminProcedure
  .input(updateDocumentExpirySchema)
  .mutation(async ({ input, ctx }) => {
    const { documentId } = input;

    const expiryDate = input.expiryDate ? new Date(`${input.expiryDate}T00:00:00.000Z`) : null;
    if (expiryDate && Number.isNaN(expiryDate.getTime())) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid expiry date' });
    }

    const [updated] = await db
      .update(logisticsDocuments)
      .set({ expiryDate, updatedAt: new Date() })
      .where(eq(logisticsDocuments.id, documentId))
      .returning({ id: logisticsDocuments.id, expiryDate: logisticsDocuments.expiryDate });

    if (!updated) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Document not found' });
    }

    logger.info('Logistics document expiry updated', {
      documentId,
      expiryDate: updated.expiryDate?.toISOString() ?? null,
      updatedBy: ctx.user.id,
    });

    return updated;
  });

export default adminUpdateDocumentExpiry;
