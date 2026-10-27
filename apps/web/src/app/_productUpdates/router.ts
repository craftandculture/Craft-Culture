import { createTRPCRouter } from '@/lib/trpc/trpc';

import adminDraftNow from './controller/adminDraftNow';
import adminList from './controller/adminList';
import adminPublishReady from './controller/adminPublishReady';
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
  // Staff: AI drafts publish themselves after a hold unless the copy check flags them
  adminList,
  adminSave,
  adminSetStatus,
  adminPublishReady,
  adminDraftNow,
  adminSetEnabled,
});

export default productUpdatesRouter;
