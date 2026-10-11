import { createTRPCRouter } from '@/lib/trpc/trpc';

import adminApplyActions from './controller/adminApplyActions';
import adminGetBatchChanges from './controller/adminGetBatchChanges';
import adminGetBatches from './controller/adminGetBatches';
import adminGetPlan from './controller/adminGetPlan';
import adminUndoBatch from './controller/adminUndoBatch';

const zohoCodesRouter = createTRPCRouter({
  // Every Zoho item matched to Stock Explorer, with the change each needs
  plan: adminGetPlan,
  // Write a slice of the plan to Zoho, logged for undo
  applyChanges: adminApplyActions,
  batches: adminGetBatches,
  // What one batch did, item by item, with the reason for each skip
  batchChanges: adminGetBatchChanges,
  undo: adminUndoBatch,
});

export default zohoCodesRouter;
