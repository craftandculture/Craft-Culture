import { createTRPCRouter } from '@/lib/trpc/trpc';

import configGet from './controller/configGet';
import configUpdate from './controller/configUpdate';
import fetchLatestExchangeRates from './controller/fetchLatestExchangeRates';
import orderOverrideCreate from './controller/orderOverrideCreate';

const pricingRouter = createTRPCRouter({
  getConfig: configGet,
  updateConfig: configUpdate,
  fetchLatestExchangeRates,
  createOrderOverride: orderOverrideCreate,
});

export default pricingRouter;
