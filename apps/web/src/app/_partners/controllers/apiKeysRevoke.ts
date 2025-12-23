import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import z from 'zod';

import db from '@/database/client';
import { partnerApiKeys } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

/**
 * Revoke an API key
 *
 * Admin-only endpoint. Revoked keys cannot be used for authentication.
 */
const apiKeysRevoke = adminProcedure
  .input(z.object({ apiKeyId: z.string().uuid() }))
  .mutation(async ({ input, ctx }) => {
    const { apiKeyId } = input;

    // Check if API key exists and is not already revoked
    const [existingKey] = await db
      .select({
        id: partnerApiKeys.id,
        isRevoked: partnerApiKeys.isRevoked,
      })
      .from(partnerApiKeys)
      .where(eq(partnerApiKeys.id, apiKeyId));

    if (!existingKey) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'API key not found',
      });
    }

    if (existingKey.isRevoked) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'API key is already revoked',
      });
    }

    // Revoke the key
    const [revokedKey] = await db
      .update(partnerApiKeys)
      .set({
        isRevoked: true,
        revokedAt: new Date(),
        revokedBy: ctx.user.id,
      })
      .where(eq(partnerApiKeys.id, apiKeyId))
      .returning({
        id: partnerApiKeys.id,
        name: partnerApiKeys.name,
        keyPrefix: partnerApiKeys.keyPrefix,
        isRevoked: partnerApiKeys.isRevoked,
        revokedAt: partnerApiKeys.revokedAt,
      });

    return revokedKey;
  });

export default apiKeysRevoke;
