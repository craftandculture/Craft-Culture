import { protectedProcedure } from '@/lib/trpc/procedures';

const usersGetMe = protectedProcedure.query(async (ctx) => {
  return ctx.ctx.user;
});

export default usersGetMe;
