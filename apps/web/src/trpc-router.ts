import adminRouter from '@/app/_admin/router';
import usersRouter from '@/app/_auth/router';
import commissionsRouter from '@/app/_commissions/router';
import logisticsRouter from '@/app/_logistics/router';
import notificationsRouter from '@/app/_notifications/router';
import partnersRouter from '@/app/_partners/router';
import passkeysRouter from '@/app/_passkeys/router';
import pricingRouter from '@/app/_pricing/router';
import pricingCalcRouter from '@/app/_pricingCalculator/router';
import privateClientContactsRouter from '@/app/_privateClientContacts/router';
import privateClientOrdersRouter from '@/app/_privateClientOrders/router';
import quotesRouter from '@/app/_quotes/router';
import settingsRouter from '@/app/_settings/router';
import sourceRouter from '@/app/_source/router';
import warehouseRouter from '@/app/_warehouse/router';
import wmsRouter from '@/app/_wms/router';
import zohoImportRouter from '@/app/_zohoImport/router';

import productsRouter from './app/_products/router';
import { createTRPCRouter } from './lib/trpc/trpc';

export const appRouter = createTRPCRouter({
  admin: adminRouter,
  commissions: commissionsRouter,
  logistics: logisticsRouter,
  users: usersRouter,
  notifications: notificationsRouter,
  partners: partnersRouter,
  passkeys: passkeysRouter,
  pricing: pricingRouter,
  pricingCalc: pricingCalcRouter,
  privateClientContacts: privateClientContactsRouter,
  privateClientOrders: privateClientOrdersRouter,
  products: productsRouter,
  quotes: quotesRouter,
  source: sourceRouter,
  warehouse: warehouseRouter,
  wms: wmsRouter,
  settings: settingsRouter,
  zohoImport: zohoImportRouter,
});

export type AppRouter = typeof appRouter;
