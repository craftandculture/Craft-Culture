import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { exportConsigneeProfiles } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import { exportOpSchema } from '../schemas/exportOpSchema';

/** Ops that name a line only make sense on the document they were made on */
const LINE_OPS = new Set(['setLine', 'setComponent', 'setLineBoe', 'overrideLine', 'splitLine', 'moveWineBetweenCases', 'setColumnValues', 'setSectionNote']);

/**
 * Keep a change as a standing rule for the consignee
 *
 * Replayed on every new draft for them, so a request customs make once — a
 * column, a note, a declaration — is not made again. Only document-wide ops
 * can be kept; a change to a particular line belongs to that document.
 */
const adminSaveRule = adminProcedure
  .input(
    z.object({
      zohoCustomerId: z.string(),
      consigneeName: z.string(),
      text: z.string().min(3).max(500),
      ops: z.array(exportOpSchema).min(1),
    }),
  )
  .mutation(async ({ input }) => {
    const kept = input.ops.filter((op) => !LINE_OPS.has(op.op));
    if (kept.length === 0) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'That change is to particular lines, so it cannot become a rule for every document.',
      });
    }

    const [profile] = await db
      .select()
      .from(exportConsigneeProfiles)
      .where(eq(exportConsigneeProfiles.zohoCustomerId, input.zohoCustomerId))
      .limit(1);
    const rule = { text: input.text, ops: kept };

    if (profile) {
      await db
        .update(exportConsigneeProfiles)
        .set({ standingRules: [...profile.standingRules, rule], updatedAt: new Date() })
        .where(eq(exportConsigneeProfiles.id, profile.id));
    } else {
      await db.insert(exportConsigneeProfiles).values({
        zohoCustomerId: input.zohoCustomerId,
        displayName: input.consigneeName,
        standingRules: [rule],
      });
    }

    return { saved: kept.length, dropped: input.ops.length - kept.length };
  });

export default adminSaveRule;
