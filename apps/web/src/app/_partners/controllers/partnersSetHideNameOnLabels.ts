import { TRPCError } from '@trpc/server';
import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';

import ensureClientCode from '@/app/_cellar/data/ensureClientCode';
import db from '@/database/client';
import { partners } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

/**
 * Print a partner's reference instead of their name on warehouse labels
 *
 * Private collectors are always hidden; this is for anyone else who asks for
 * discreet labels. Switching it on issues their reference straight away, so
 * the next label printed carries a code rather than PRIVATE CLIENT.
 *
 * Kept in `metadata` so it needs no migration.
 */
const partnersSetHideNameOnLabels = adminProcedure
  .input(z.object({ partnerId: z.string().uuid(), hide: z.boolean() }))
  .mutation(async ({ input }) => {
    const [updated] = await db
      .update(partners)
      .set({
        metadata: sql`coalesce(${partners.metadata}, '{}'::jsonb) || jsonb_build_object('hideNameOnLabels', ${input.hide}::boolean)`,
        updatedAt: new Date(),
      })
      .where(eq(partners.id, input.partnerId))
      .returning({ id: partners.id });

    if (!updated) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Partner not found' });
    }

    const code = input.hide ? await ensureClientCode(input.partnerId) : null;

    return { hide: input.hide, code };
  });

export default partnersSetHideNameOnLabels;
