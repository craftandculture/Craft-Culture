import { createTRPCRouter } from '@/lib/trpc/trpc';

import adminGetMorningView from './controller/adminGetMorningView';

/**
 * Morning View router — admin home dashboard data
 */
const morningViewRouter = createTRPCRouter({
  get: adminGetMorningView,
});

export default morningViewRouter;
