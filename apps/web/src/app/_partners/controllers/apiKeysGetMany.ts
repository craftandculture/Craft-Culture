import { desc, eq } from 'drizzle-orm';
import z from 'zod';

import db from '@/database/client';
import { partnerApiKeys } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

/**
 * Get all API keys for a partner
 *
 * Admin-only endpoint. Returns key prefixes only (not full keys).
 */
const apiKeysGetMany = adminProcedure
  .input(z.object({ partnerId: z.string().uuid() }))
  .query(async ({ input }) => {
    const { partnerId } = input;

    const apiKeys = await db
      .select({
        id: partnerApiKeys.id,
        name: partnerApiKeys.name,
        keyPrefix: partnerApiKeys.keyPrefix,
        permissions: partnerApiKeys.permissions,
        lastUsedAt: partnerApiKeys.lastUsedAt,
        expiresAt: partnerApiKeys.expiresAt,
        isRevoked: partnerApiKeys.isRevoked,
        revokedAt: partnerApiKeys.revokedAt,
        createdAt: partnerApiKeys.createdAt,
      })
      .from(partnerApiKeys)
      .where(eq(partnerApiKeys.partnerId, partnerId))
      .orderBy(desc(partnerApiKeys.createdAt));

    return apiKeys;
  });

export type ApiKeysGetManyOutput = Awaited<ReturnType<typeof apiKeysGetMany>>;

export default apiKeysGetMany;
