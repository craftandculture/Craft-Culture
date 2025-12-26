import { createTRPCRouter } from '@/lib/trpc/trpc';

import quotesAcceptAlternative from './controller/quotesAcceptAlternative';
import quotesConfirm from './controller/quotesConfirm';
import quotesConfirmPO from './controller/quotesConfirmPO';
import quotesDelete from './controller/quotesDelete';
import quotesDeleteAdmin from './controller/quotesDeleteAdmin';
import quotesGet from './controller/quotesGet';
import quotesGetMany from './controller/quotesGetMany';
import quotesGetManyAdmin from './controller/quotesGetManyAdmin';
import quotesGetOne from './controller/quotesGetOne';
import quotesMarkAsDelivered from './controller/quotesMarkAsDelivered';
import quotesMarkAsPaid from './controller/quotesMarkAsPaid';
import quotesRemoveLineItem from './controller/quotesRemoveLineItem';
import quotesRequestRevision from './controller/quotesRequestRevision';
import quotesSave from './controller/quotesSave';
import quotesStartCCReview from './controller/quotesStartCCReview';
import quotesSubmitBuyRequest from './controller/quotesSubmitBuyRequest';
import quotesSubmitPaymentProof from './controller/quotesSubmitPaymentProof';
import quotesSubmitPO from './controller/quotesSubmitPO';
import quotesUpdate from './controller/quotesUpdate';
import quotesUploadPaymentProof from './controller/quotesUploadPaymentProof';
import quotesUploadPODocument from './controller/quotesUploadPODocument';

const quotesRouter = createTRPCRouter({
  get: quotesGet,
  save: quotesSave,
  getMany: quotesGetMany,
  getManyAdmin: quotesGetManyAdmin,
  getOne: quotesGetOne,
  update: quotesUpdate,
  delete: quotesDelete,
  deleteAdmin: quotesDeleteAdmin,
  // Workflow endpoints
  submitBuyRequest: quotesSubmitBuyRequest,
  startCCReview: quotesStartCCReview,
  confirm: quotesConfirm,
  requestRevision: quotesRequestRevision,
  submitPO: quotesSubmitPO,
  confirmPO: quotesConfirmPO,
  uploadPODocument: quotesUploadPODocument,
  uploadPaymentProof: quotesUploadPaymentProof,
  submitPaymentProof: quotesSubmitPaymentProof,
  acceptAlternative: quotesAcceptAlternative,
  removeLineItem: quotesRemoveLineItem,
  markAsPaid: quotesMarkAsPaid,
  markAsDelivered: quotesMarkAsDelivered,
});

export default quotesRouter;
