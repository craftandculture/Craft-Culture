import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { partners } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

/**
 * Delete a partner permanently
 *
 * Admin-only endpoint. This will:
 * - Cascade delete all associated API keys
 * - Set any quote licensedPartnerId references to null
 * - Set any API log partnerId references to null
 */
const partnersDelete = adminProcedure
  .input(z.object({ partnerId: z.string().uuid() }))
  .mutation(async ({ input }) => {
    const { partnerId } = input;

    // Check if partner exists
    const [existingPartner] = await db
      .select({ id: partners.id, businessName: partners.businessName })
      .from(partners)
      .where(eq(partners.id, partnerId));

    if (!existingPartner) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Partner not found',
      });
    }

    // Delete the partner (cascades and nullifies references per schema)
    await db.delete(partners).where(eq(partners.id, partnerId));

    return { success: true, deletedPartner: existingPartner };
  });

export default partnersDelete;
