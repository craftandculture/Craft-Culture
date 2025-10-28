import type { User } from '@/database/schema';
import { protectedProcedure } from '@/lib/trpc/procedures';

const usersGetMe = protectedProcedure.query(async ({ ctx }): Promise<User & { firstName: string | null; lastName: string | null }> => {
  return ctx.user;
});

export default usersGetMe;
