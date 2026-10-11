import { adminProcedure } from '@/lib/trpc/procedures';

import loadCleanupInputs from '../data/loadCleanupInputs';
import planSkuCleanup from '../utils/planSkuCleanup';

/**
 * The Zoho code cleanup plan, read live
 *
 * Reads every Zoho item and matches it to Stock Explorer. Nothing is written.
 */
const adminGetPlan = adminProcedure.query(async () => {
  const { items, ctx } = await loadCleanupInputs();
  const actions = planSkuCleanup(items, ctx);
  return {
    checkedAt: new Date(),
    activeItems: items.filter((i) => i.status === 'active').length,
    actions,
  };
});

export default adminGetPlan;
