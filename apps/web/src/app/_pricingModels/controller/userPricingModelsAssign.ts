import { eq } from 'drizzle-orm';

import db from '@/database/client';
import { users } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import assignUserPricingModelSchema from '../schemas/assignUserPricingModelSchema';

const userPricingModelsAssign = adminProcedure
  .input(assignUserPricingModelSchema)
  .mutation(async ({ input: { userId, pricingModelId } }) => {
    await db
      .update(users)
      .set({ pricingModelId })
      .where(eq(users.id, userId));

    return { success: true };
  });

export default userPricingModelsAssign;
