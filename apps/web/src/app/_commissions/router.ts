import { createTRPCRouter } from '@/lib/trpc/trpc';

import commissionsGetDetails from './controller/commissionsGetDetails';
import commissionsGetPending from './controller/commissionsGetPending';
import commissionsGetSummary from './controller/commissionsGetSummary';
import commissionsMarkPaid from './controller/commissionsMarkPaid';

const commissionsRouter = createTRPCRouter({
  getSummary: commissionsGetSummary,
  getDetails: commissionsGetDetails,
  getPending: commissionsGetPending,
  markPaid: commissionsMarkPaid,
});

export default commissionsRouter;
