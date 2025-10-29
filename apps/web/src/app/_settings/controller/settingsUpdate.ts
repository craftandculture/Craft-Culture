import { eq } from 'drizzle-orm';

import db from '@/database/client';
import { users } from '@/database/schema';
import { protectedProcedure } from '@/lib/trpc/procedures';

import updateCompanyNameSchema from '../schemas/updateCompanyNameSchema';

/**
 * Update user's company information
 */
const settingsUpdate = protectedProcedure
  .input(updateCompanyNameSchema)
  .mutation(async ({ input, ctx: { user } }) => {
    const [updatedUser] = await db
      .update(users)
      .set({
        companyName: input.companyName,
        companyAddress: input.companyAddress || null,
        companyPhone: input.companyPhone || null,
        companyEmail: input.companyEmail || null,
        companyWebsite: input.companyWebsite || null,
        companyVatNumber: input.companyVatNumber || null,
      })
      .where(eq(users.id, user.id))
      .returning();

    if (!updatedUser) {
      throw new Error('Failed to update company information');
    }

    return {
      success: true,
      companyName: updatedUser.companyName,
      companyAddress: updatedUser.companyAddress,
      companyPhone: updatedUser.companyPhone,
      companyEmail: updatedUser.companyEmail,
      companyWebsite: updatedUser.companyWebsite,
      companyVatNumber: updatedUser.companyVatNumber,
    };
  });

export default settingsUpdate;
