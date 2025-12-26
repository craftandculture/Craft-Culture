import adminRouter from '@/app/_admin/router';
import usersRouter from '@/app/_auth/router';
import commissionsRouter from '@/app/_commissions/router';
import notificationsRouter from '@/app/_notifications/router';
import partnersRouter from '@/app/_partners/router';
import pricingModelsRouter from '@/app/_pricingModels/router';
import quotesRouter from '@/app/_quotes/router';
import settingsRouter from '@/app/_settings/router';
import sheetsRouter from '@/app/_sheets/router';
import warehouseRouter from '@/app/_warehouse/router';

import productsRouter from './app/_products/router';
import { createTRPCRouter } from './lib/trpc/trpc';

export const appRouter = createTRPCRouter({
  admin: adminRouter,
  commissions: commissionsRouter,
  users: usersRouter,
  notifications: notificationsRouter,
  partners: partnersRouter,
  products: productsRouter,
  quotes: quotesRouter,
  pricingModels: pricingModelsRouter,
  sheets: sheetsRouter,
  warehouse: warehouseRouter,
  settings: settingsRouter,
});

export type AppRouter = typeof appRouter;
