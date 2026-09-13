import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { partnerIdentityDocuments, partners } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

/**
 * What identification a member has given us
 *
 * Returns what is on file, never where it is stored. The blob URL stays on
 * the server; an admin viewing a document goes through /api/cellar/identity,
 * which authenticates the request and streams the bytes itself.
 */
const adminGetMemberIdentity = adminProcedure
  .input(z.object({ partnerId: z.string().uuid() }))
  .query(async ({ input }) => {
    const [partner] = await db
      .select({
        eidNumber: partners.eidNumber,
        eidExpiry: partners.eidExpiry,
      })
      .from(partners)
      .where(eq(partners.id, input.partnerId))
      .limit(1);

    const documents = await db
      .select({
        documentType: partnerIdentityDocuments.documentType,
        fileName: partnerIdentityDocuments.fileName,
        uploadedAt: partnerIdentityDocuments.createdAt,
      })
      .from(partnerIdentityDocuments)
      .where(eq(partnerIdentityDocuments.partnerId, input.partnerId));

    return {
      eidNumber: partner?.eidNumber ?? null,
      eidExpiry: partner?.eidExpiry ?? null,
      documents,
    };
  });

export default adminGetMemberIdentity;
