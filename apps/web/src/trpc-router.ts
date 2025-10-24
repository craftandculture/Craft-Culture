import usersRouter from '@/app/_auth/router';
import pricingModelsRouter from '@/app/_pricingModels/router';
import quotesRouter from '@/app/_quotes/router';
import sheetsRouter from '@/app/_sheets/router';

import productsRouter from './app/_products/router';
import { createTRPCRouter } from './lib/trpc/trpc';

export const appRouter = createTRPCRouter({
  users: usersRouter,
  products: productsRouter,
  quotes: quotesRouter,
  pricingModels: pricingModelsRouter,
  sheets: sheetsRouter,
});

export type AppRouter = typeof appRouter;
