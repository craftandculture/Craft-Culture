import { createTRPCRouter } from '@/lib/trpc/trpc';

import configGet from './controller/configGet';
import configUpdate from './controller/configUpdate';
import orderOverrideCreate from './controller/orderOverrideCreate';

const pricingRouter = createTRPCRouter({
  getConfig: configGet,
  updateConfig: configUpdate,
  createOrderOverride: orderOverrideCreate,
});

export default pricingRouter;
