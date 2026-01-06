import adminRouter from '@/app/_admin/router';
import usersRouter from '@/app/_auth/router';
import commissionsRouter from '@/app/_commissions/router';
import notificationsRouter from '@/app/_notifications/router';
import partnersRouter from '@/app/_partners/router';
import pricingRouter from '@/app/_pricing/router';
import pricingCalcRouter from '@/app/_pricingCalculator/router';
import privateClientContactsRouter from '@/app/_privateClientContacts/router';
import privateClientOrdersRouter from '@/app/_privateClientOrders/router';
import quotesRouter from '@/app/_quotes/router';
import settingsRouter from '@/app/_settings/router';
import sourceRouter from '@/app/_source/router';
import warehouseRouter from '@/app/_warehouse/router';

import productsRouter from './app/_products/router';
import { createTRPCRouter } from './lib/trpc/trpc';

export const appRouter = createTRPCRouter({
  admin: adminRouter,
  commissions: commissionsRouter,
  users: usersRouter,
  notifications: notificationsRouter,
  partners: partnersRouter,
  pricing: pricingRouter,
  pricingCalc: pricingCalcRouter,
  privateClientContacts: privateClientContactsRouter,
  privateClientOrders: privateClientOrdersRouter,
  products: productsRouter,
  quotes: quotesRouter,
  source: sourceRouter,
  warehouse: warehouseRouter,
  settings: settingsRouter,
});

export type AppRouter = typeof appRouter;
