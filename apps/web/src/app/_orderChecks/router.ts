import { createTRPCRouter } from '@/lib/trpc/trpc';

import adminCheckDocument from './controller/adminCheckDocument';
import adminCheckDrafts from './controller/adminCheckDrafts';

const orderChecksRouter = createTRPCRouter({
  // One document by number: SO, invoice or PCO
  check: adminCheckDocument,
  // Every draft SO and invoice waiting in Zoho
  drafts: adminCheckDrafts,
});

export default orderChecksRouter;
