import { eq } from 'drizzle-orm';

import db from '@/database/client';
import { users } from '@/database/schema';
import { protectedProcedure } from '@/lib/trpc/procedures';

import updateCompanyNameSchema from '../schemas/updateCompanyNameSchema';

/**
 * Update user's company name
 */
const settingsUpdate = protectedProcedure
  .input(updateCompanyNameSchema)
  .mutation(async ({ input: { companyName }, ctx: { user } }) => {
    const [updatedUser] = await db
      .update(users)
      .set({ companyName })
      .where(eq(users.id, user.id))
      .returning();

    if (!updatedUser) {
      throw new Error('Failed to update company name');
    }

    return {
      success: true,
      companyName: updatedUser.companyName,
    };
  });

export default settingsUpdate;
