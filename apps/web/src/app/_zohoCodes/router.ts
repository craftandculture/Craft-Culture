import { createTRPCRouter } from '@/lib/trpc/trpc';

import adminApplyActions from './controller/adminApplyActions';
import adminGetBatches from './controller/adminGetBatches';
import adminGetPlan from './controller/adminGetPlan';
import adminUndoBatch from './controller/adminUndoBatch';

const zohoCodesRouter = createTRPCRouter({
  // Every Zoho item matched to Stock Explorer, with the change each needs
  plan: adminGetPlan,
  // Write a slice of the plan to Zoho, logged for undo
  apply: adminApplyActions,
  batches: adminGetBatches,
  undo: adminUndoBatch,
});

export default zohoCodesRouter;
