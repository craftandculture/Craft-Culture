import { eq } from 'drizzle-orm';

import db from '@/database/client';
import { users } from '@/database/schema';
import { protectedProcedure } from '@/lib/trpc/procedures';

/**
 * Remove user's company logo
 */
const logoRemove = protectedProcedure.mutation(async ({ ctx: { user } }) => {
  const [updatedUser] = await db
    .update(users)
    .set({ companyLogo: null })
    .where(eq(users.id, user.id))
    .returning();

  if (!updatedUser) {
    throw new Error('Failed to remove logo');
  }

  return {
    success: true,
  };
});

export default logoRemove;
