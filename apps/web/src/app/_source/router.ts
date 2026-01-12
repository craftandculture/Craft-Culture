import { createTRPCRouter } from '@/lib/trpc/trpc';

import adminAddItem from './controller/adminAddItem';
import adminAutoSelectBest from './controller/adminAutoSelectBest';
import adminBulkSelectQuotes from './controller/adminBulkSelectQuotes';
import adminCancelRfq from './controller/adminCancelRfq';
import adminCreateRfq from './controller/adminCreateRfq';
import adminDeleteItem from './controller/adminDeleteItem';
import adminDeleteRfq from './controller/adminDeleteRfq';
import adminFinalizeRfq from './controller/adminFinalizeRfq';
import adminGenerateFinalQuote from './controller/adminGenerateFinalQuote';
import adminGetManyRfqs from './controller/adminGetManyRfqs';
import adminGetOneRfq from './controller/adminGetOneRfq';
import adminImportLwinWines from './controller/adminImportLwinWines';
import adminMarkClientApproved from './controller/adminMarkClientApproved';
import adminParseInput from './controller/adminParseInput';
import adminParseQuoteExcel from './controller/adminParseQuoteExcel';
import adminRequestConfirmations from './controller/adminRequestConfirmations';
import adminSearchLwin from './controller/adminSearchLwin';
import adminSelectQuote from './controller/adminSelectQuote';
import adminSendToPartners from './controller/adminSendToPartners';
import adminSubmitQuotesOnBehalf from './controller/adminSubmitQuotesOnBehalf';
import adminUpdateItem from './controller/adminUpdateItem';
import adminUpdateRfq from './controller/adminUpdateRfq';
import partnerConfirmQuote from './controller/partnerConfirmQuote';
import partnerDeclineRfq from './controller/partnerDeclineRfq';
import partnerDownloadQuoteTemplate from './controller/partnerDownloadQuoteTemplate';
import partnerGetConfirmationRequests from './controller/partnerGetConfirmationRequests';
import partnerGetManyRfqs from './controller/partnerGetManyRfqs';
import partnerGetOneRfq from './controller/partnerGetOneRfq';
import partnerParseQuoteExcel from './controller/partnerParseQuoteExcel';
import partnerSubmitQuotes from './controller/partnerSubmitQuotes';

const adminRouter = createTRPCRouter({
  create: adminCreateRfq,
  getMany: adminGetManyRfqs,
  getOne: adminGetOneRfq,
  update: adminUpdateRfq,
  delete: adminDeleteRfq,
  cancel: adminCancelRfq,
  addItem: adminAddItem,
  updateItem: adminUpdateItem,
  deleteItem: adminDeleteItem,
  sendToPartners: adminSendToPartners,
  selectQuote: adminSelectQuote,
  bulkSelectQuotes: adminBulkSelectQuotes,
  autoSelectBest: adminAutoSelectBest,
  generateFinalQuote: adminGenerateFinalQuote,
  parseInput: adminParseInput,
  searchLwin: adminSearchLwin,
  importLwinWines: adminImportLwinWines,
  finalize: adminFinalizeRfq,
  // Excel quote upload endpoints
  parseQuoteExcel: adminParseQuoteExcel,
  submitQuotesOnBehalf: adminSubmitQuotesOnBehalf,
  // Client approval and partner confirmation
  markClientApproved: adminMarkClientApproved,
  requestConfirmations: adminRequestConfirmations,
});

const partnerRouter = createTRPCRouter({
  getMany: partnerGetManyRfqs,
  getOne: partnerGetOneRfq,
  submitQuotes: partnerSubmitQuotes,
  decline: partnerDeclineRfq,
  // Excel quote upload endpoints
  downloadQuoteTemplate: partnerDownloadQuoteTemplate,
  parseQuoteExcel: partnerParseQuoteExcel,
  // Quote confirmation
  getConfirmationRequests: partnerGetConfirmationRequests,
  confirmQuotes: partnerConfirmQuote,
});

const sourceRouter = createTRPCRouter({
  admin: adminRouter,
  partner: partnerRouter,
});

export default sourceRouter;
