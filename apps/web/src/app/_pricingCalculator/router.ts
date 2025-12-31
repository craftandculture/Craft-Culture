import { createTRPCRouter } from '@/lib/trpc/trpc';

import sessionCreate from './controller/sessionCreate';
import sessionDelete from './controller/sessionDelete';
import sessionGetMany from './controller/sessionGetMany';
import sessionGetOne from './controller/sessionGetOne';

/**
 * Pricing calculator router
 *
 * Provides endpoints for managing pricing sessions, LWIN lookup,
 * and Wine-Searcher market price comparison
 */
const pricingCalcRouter = createTRPCRouter({
  session: createTRPCRouter({
    create: sessionCreate,
    getMany: sessionGetMany,
    getOne: sessionGetOne,
    delete: sessionDelete,
  }),
});

export default pricingCalcRouter;
