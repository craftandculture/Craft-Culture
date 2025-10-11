import usersRouter from '@/app/_auth/router';
import quotesRouter from '@/app/_quotes/router';

import productsRouter from './app/_products/router';
import { createTRPCRouter } from './lib/trpc/trpc';

export const appRouter = createTRPCRouter({
  users: usersRouter,
  products: productsRouter,
  quotes: quotesRouter,
});

export type AppRouter = typeof appRouter;
