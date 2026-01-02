import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { partnerMembers } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

const inputSchema = z.object({
  userId: z.string().uuid(),
});

/**
 * Remove a user from their partner (distributor)
 *
 * Deletes the partnerMembers record linking the user to a partner.
 */
const usersRemovePartner = adminProcedure
  .input(inputSchema)
  .mutation(async ({ input }) => {
    const { userId } = input;

    await db
      .delete(partnerMembers)
      .where(eq(partnerMembers.userId, userId));

    return { success: true };
  });

export default usersRemovePartner;
