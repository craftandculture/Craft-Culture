import adminRouter from '@/app/_admin/router';
import usersRouter from '@/app/_auth/router';
import pricingModelsRouter from '@/app/_pricingModels/router';
import quotesRouter from '@/app/_quotes/router';
import sheetsRouter from '@/app/_sheets/router';
import warehouseRouter from '@/app/_warehouse/router';

import productsRouter from './app/_products/router';
import { createTRPCRouter } from './lib/trpc/trpc';

export const appRouter = createTRPCRouter({
  admin: adminRouter,
  users: usersRouter,
  products: productsRouter,
  quotes: quotesRouter,
  pricingModels: pricingModelsRouter,
  sheets: sheetsRouter,
  warehouse: warehouseRouter,
});

export type AppRouter = typeof appRouter;
