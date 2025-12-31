import { createTRPCRouter } from '@/lib/trpc/trpc';

import sessionCalculate from './controller/sessionCalculate';
import sessionCreate from './controller/sessionCreate';
import sessionDelete from './controller/sessionDelete';
import sessionGetMany from './controller/sessionGetMany';
import sessionGetOne from './controller/sessionGetOne';
import sessionUpdateVariables from './controller/sessionUpdateVariables';

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
    updateVariables: sessionUpdateVariables,
    calculate: sessionCalculate,
  }),
});

export default pricingCalcRouter;
