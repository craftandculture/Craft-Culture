import { eq } from 'drizzle-orm';

import db from '@/database/client';
import { users } from '@/database/schema';
import { protectedProcedure } from '@/lib/trpc/procedures';

/**
 * Remove user's company logo
 */
const logoRemove = protectedProcedure.mutation(async ({ ctx: { user } }) => {
  // TODO: Delete blob from Vercel Blob storage
  // This requires the del() function from @vercel/blob
  // For now, we'll just update the database

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
