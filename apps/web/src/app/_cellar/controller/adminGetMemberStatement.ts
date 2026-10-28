import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { partners } from '@/database/schema';
import { staffAdminProcedure } from '@/lib/trpc/procedures';

import buildMemberStatement from '../data/buildMemberStatement';

/**
 * A member's statement as staff see it: the same figures the member sees,
 * plus the line-by-line working behind "Owed to you"
 *
 * @example
 *   await trpcClient.cellar.admin.getMemberStatement.query({ partnerId, month: '2026-10' });
 */
const adminGetMemberStatement = staffAdminProcedure
  .input(
    z.object({
      partnerId: z.string().uuid(),
      /** Calendar month, `YYYY-MM` */
      month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
    }),
  )
  .query(async ({ input }) => {
    const [partner] = await db
      .select({ id: partners.id, type: partners.type, businessName: partners.businessName })
      .from(partners)
      .where(eq(partners.id, input.partnerId));

    if (!partner) throw new TRPCError({ code: 'NOT_FOUND', message: 'No such member' });

    return buildMemberStatement({ partner, month: input.month });
  });

export default adminGetMemberStatement;
