import { del } from '@vercel/blob';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { partnerIdentityDocuments } from '@/database/schema';
import { stockOwnerProcedure } from '@/lib/trpc/procedures';
import logger from '@/utils/logger';

/**
 * Remove an identity document a member has uploaded
 *
 * Scoped to the caller's own partner, so the worst a tampered request can do
 * is delete something the caller already owns. The stored file is deleted
 * from Blob as well, since a public blob stays reachable by URL until it is.
 */
const memberDeleteIdentityDocument = stockOwnerProcedure
  .input(z.object({ documentType: z.string().max(60) }))
  .mutation(async ({ ctx, input }) => {
    const removed = await db
      .delete(partnerIdentityDocuments)
      .where(
        and(
          eq(partnerIdentityDocuments.partnerId, ctx.partner.id),
          eq(partnerIdentityDocuments.documentType, input.documentType),
        ),
      )
      .returning({ fileUrl: partnerIdentityDocuments.fileUrl });

    // Best effort: the record is gone either way
    const urls = removed.map((row) => row.fileUrl).filter(Boolean);
    if (urls.length) {
      await del(urls).catch((error: unknown) => {
        logger.error('Could not delete identity document blob', {
          error: error instanceof Error ? error.message : String(error),
        });
      });
    }

    return { deleted: true };
  });

export default memberDeleteIdentityDocument;
