import { createTRPCRouter } from '@/lib/trpc/trpc';

import adminDraftNow from './controller/adminDraftNow';
import adminList from './controller/adminList';
import adminSave from './controller/adminSave';
import adminSetEnabled from './controller/adminSetEnabled';
import adminSetStatus from './controller/adminSetStatus';
import listForMe from './controller/listForMe';
import markSeen from './controller/markSeen';
import unseenCount from './controller/unseenCount';

const productUpdatesRouter = createTRPCRouter({
  // Members: their audience's published updates, and the menu dot
  listForMe,
  unseenCount,
  markSeen,
  // Staff: AI drafts are reviewed here; nothing reaches a member unpublished
  adminList,
  adminSave,
  adminSetStatus,
  adminDraftNow,
  adminSetEnabled,
});

export default productUpdatesRouter;
