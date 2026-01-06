import { z } from 'zod';

import { protectedProcedure } from '@/lib/trpc/procedures';
import { createTRPCRouter } from '@/lib/trpc/trpc';

import passkeysDeleteController from './controllers/passkeysDeleteController';
import passkeysListController from './controllers/passkeysListController';

const passkeysRouter = createTRPCRouter({
  list: protectedProcedure.query(async ({ ctx }) => {
    return await passkeysListController({ userId: ctx.user.id });
  }),

  delete: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      return await passkeysDeleteController({
        id: input.id,
        userId: ctx.user.id,
      });
    }),
});

export default passkeysRouter;
