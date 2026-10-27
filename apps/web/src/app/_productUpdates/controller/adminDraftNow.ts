import { staffAdminProcedure } from '@/lib/trpc/procedures';

import draftPendingUpdates from '../data/draftPendingUpdates';

/** Read the changelog items waiting, now, rather than at the next scheduled run */
const adminDraftNow = staffAdminProcedure.mutation(async () => {
  return draftPendingUpdates({ maxItems: 40 });
});

export default adminDraftNow;
