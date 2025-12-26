import { eq } from 'drizzle-orm';

import db from '@/database/client';
import { users } from '@/database/schema';
import { protectedProcedure } from '@/lib/trpc/procedures';

import updatePersonalDetailsSchema from '../schemas/updatePersonalDetailsSchema';

/**
 * Update user's personal details and bank information
 * Used by B2C users for commission payout setup
 */
const personalDetailsUpdate = protectedProcedure
  .input(updatePersonalDetailsSchema)
  .mutation(async ({ input, ctx: { user } }) => {
    const [updatedUser] = await db
      .update(users)
      .set({
        addressLine1: input.addressLine1 || null,
        addressLine2: input.addressLine2 || null,
        city: input.city || null,
        stateProvince: input.stateProvince || null,
        postalCode: input.postalCode || null,
        country: input.country || null,
        phone: input.phone || null,
        bankDetails: input.bankDetails || null,
      })
      .where(eq(users.id, user.id))
      .returning();

    if (!updatedUser) {
      throw new Error('Failed to update personal details');
    }

    return {
      success: true,
      addressLine1: updatedUser.addressLine1,
      addressLine2: updatedUser.addressLine2,
      city: updatedUser.city,
      stateProvince: updatedUser.stateProvince,
      postalCode: updatedUser.postalCode,
      country: updatedUser.country,
      phone: updatedUser.phone,
      bankDetails: updatedUser.bankDetails,
    };
  });

export default personalDetailsUpdate;
