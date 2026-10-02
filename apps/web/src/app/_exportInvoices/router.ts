import { createTRPCRouter } from '@/lib/trpc/trpc';

import adminApplyOps from './controller/adminApplyOps';
import adminCreateDraft from './controller/adminCreateDraft';
import adminDeleteDraft from './controller/adminDeleteDraft';
import adminGetMany from './controller/adminGetMany';
import adminGetOne from './controller/adminGetOne';
import adminIssue from './controller/adminIssue';
import adminListConsignees from './controller/adminListConsignees';
import adminListInvoicesForConsignee from './controller/adminListInvoicesForConsignee';
import adminRequestChange from './controller/adminRequestChange';
import adminSaveRule from './controller/adminSaveRule';

const exportInvoicesRouter = createTRPCRouter({
  admin: createTRPCRouter({
    getMany: adminGetMany,
    getOne: adminGetOne,
    consignees: adminListConsignees,
    invoicesForConsignee: adminListInvoicesForConsignee,
    createDraft: adminCreateDraft,
    // Every edit, typed or requested, is an op applied here and versioned
    applyOps: adminApplyOps,
    // Plain words in, proposed ops out; nothing is saved until accepted
    requestChange: adminRequestChange,
    saveRule: adminSaveRule,
    issue: adminIssue,
    deleteDraft: adminDeleteDraft,
  }),
});

export default exportInvoicesRouter;
