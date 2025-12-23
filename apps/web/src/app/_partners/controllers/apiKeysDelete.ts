import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import z from 'zod';

import db from '@/database/client';
import { partnerApiKeys } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

/**
 * Permanently delete an API key
 *
 * Admin-only endpoint. This permanently removes the API key from the database.
 * Use with caution - this action cannot be undone.
 */
const apiKeysDelete = adminProcedure
  .input(z.object({ apiKeyId: z.string().uuid() }))
  .mutation(async ({ input }) => {
    const { apiKeyId } = input;

    // Check if API key exists
    const [existingKey] = await db
      .select({
        id: partnerApiKeys.id,
        name: partnerApiKeys.name,
      })
      .from(partnerApiKeys)
      .where(eq(partnerApiKeys.id, apiKeyId));

    if (!existingKey) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'API key not found',
      });
    }

    // Delete the key
    await db
      .delete(partnerApiKeys)
      .where(eq(partnerApiKeys.id, apiKeyId));

    return { success: true, deletedKeyId: apiKeyId };
  });

export default apiKeysDelete;
