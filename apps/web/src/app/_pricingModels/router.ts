import { createTRPCRouter } from '@/lib/trpc/trpc';

import pricingModelsCreate from './controller/pricingModelsCreate';
import pricingModelsDelete from './controller/pricingModelsDelete';
import pricingModelsGetMany from './controller/pricingModelsGetMany';

const pricingModelsRouter = createTRPCRouter({
  getMany: pricingModelsGetMany,
  create: pricingModelsCreate,
  delete: pricingModelsDelete,
});

export default pricingModelsRouter;
