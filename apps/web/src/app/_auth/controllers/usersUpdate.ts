import { eq } from 'drizzle-orm';

import db from '@/database/client';
import { users } from '@/database/schema';
import { protectedProcedure } from '@/lib/trpc/procedures';

import updateUserSchema from '../schemas/updateUserSchema';

const usersUpdate = protectedProcedure
  .input(updateUserSchema)
  .mutation(async ({ ctx, input }) => {
    await db
      .update(users)
      .set(input)
      .where(eq(users.id, ctx.user.id))
      .returning();
  });

export default usersUpdate;
