import { createTRPCRouter } from '@/lib/trpc/trpc';

import adminCheckDocument from './controller/adminCheckDocument';
import adminCheckDrafts from './controller/adminCheckDrafts';
import adminListOrderChecks from './controller/adminListOrderChecks';
import adminMatchOrder from './controller/adminMatchOrder';
import adminSignOffOrder from './controller/adminSignOffOrder';

const orderChecksRouter = createTRPCRouter({
  // One document by number: SO, invoice or PCO
  check: adminCheckDocument,
  // Every draft SO and invoice waiting in Zoho
  drafts: adminCheckDrafts,
  // An order's paperwork as a set: client LPO, sales order, invoices
  match: adminMatchOrder,
  // Orders checked recently, with where each stands
  list: adminListOrderChecks,
  // A person records that they reviewed the order
  signOff: adminSignOffOrder,
});

export default orderChecksRouter;
