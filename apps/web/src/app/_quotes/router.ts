import { createTRPCRouter } from '@/lib/trpc/trpc';

import quotesConfirm from './controller/quotesConfirm';
import quotesConfirmPO from './controller/quotesConfirmPO';
import quotesDelete from './controller/quotesDelete';
import quotesGet from './controller/quotesGet';
import quotesGetMany from './controller/quotesGetMany';
import quotesGetOne from './controller/quotesGetOne';
import quotesRequestRevision from './controller/quotesRequestRevision';
import quotesSave from './controller/quotesSave';
import quotesStartCCReview from './controller/quotesStartCCReview';
import quotesSubmitBuyRequest from './controller/quotesSubmitBuyRequest';
import quotesSubmitPO from './controller/quotesSubmitPO';
import quotesUpdate from './controller/quotesUpdate';

const quotesRouter = createTRPCRouter({
  get: quotesGet,
  save: quotesSave,
  getMany: quotesGetMany,
  getOne: quotesGetOne,
  update: quotesUpdate,
  delete: quotesDelete,
  // Workflow endpoints
  submitBuyRequest: quotesSubmitBuyRequest,
  startCCReview: quotesStartCCReview,
  confirm: quotesConfirm,
  requestRevision: quotesRequestRevision,
  submitPO: quotesSubmitPO,
  confirmPO: quotesConfirmPO,
});

export default quotesRouter;
