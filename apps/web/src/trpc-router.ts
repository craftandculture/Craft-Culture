import usersRouter from '@/app/_auth/router';

import { createTRPCRouter } from './lib/trpc/trpc';

export const appRouter = createTRPCRouter({
  users: usersRouter,
});

export type AppRouter = typeof appRouter;
