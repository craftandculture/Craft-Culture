import { createTRPCRouter } from '@/lib/trpc/trpc';

import adminAddItem from './controller/adminAddItem';
import adminAutoSelectBest from './controller/adminAutoSelectBest';
import adminBulkSelectQuotes from './controller/adminBulkSelectQuotes';
import adminCreateRfq from './controller/adminCreateRfq';
import adminDeleteItem from './controller/adminDeleteItem';
import adminDeleteRfq from './controller/adminDeleteRfq';
import adminFinalizeRfq from './controller/adminFinalizeRfq';
import adminGenerateFinalQuote from './controller/adminGenerateFinalQuote';
import adminGeneratePurchaseOrders from './controller/adminGeneratePurchaseOrders';
import adminGetManyRfqs from './controller/adminGetManyRfqs';
import adminGetOneRfq from './controller/adminGetOneRfq';
import adminGetPurchaseOrders from './controller/adminGetPurchaseOrders';
import adminParseInput from './controller/adminParseInput';
import adminSearchLwin from './controller/adminSearchLwin';
import adminSelectQuote from './controller/adminSelectQuote';
import adminSendPurchaseOrder from './controller/adminSendPurchaseOrder';
import adminSendToPartners from './controller/adminSendToPartners';
import adminUpdateItem from './controller/adminUpdateItem';
import adminUpdateRfq from './controller/adminUpdateRfq';
import partnerConfirmPurchaseOrder from './controller/partnerConfirmPurchaseOrder';
import partnerDeclineRfq from './controller/partnerDeclineRfq';
import partnerGetManyRfqs from './controller/partnerGetManyRfqs';
import partnerGetOnePurchaseOrder from './controller/partnerGetOnePurchaseOrder';
import partnerGetOneRfq from './controller/partnerGetOneRfq';
import partnerGetPurchaseOrders from './controller/partnerGetPurchaseOrders';
import partnerSubmitQuotes from './controller/partnerSubmitQuotes';
import partnerUpdateDeliveryStatus from './controller/partnerUpdateDeliveryStatus';

const adminRouter = createTRPCRouter({
  create: adminCreateRfq,
  getMany: adminGetManyRfqs,
  getOne: adminGetOneRfq,
  update: adminUpdateRfq,
  delete: adminDeleteRfq,
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
  // Purchase Order endpoints
  finalize: adminFinalizeRfq,
  generatePurchaseOrders: adminGeneratePurchaseOrders,
  sendPurchaseOrder: adminSendPurchaseOrder,
  getPurchaseOrders: adminGetPurchaseOrders,
});

const partnerRouter = createTRPCRouter({
  getMany: partnerGetManyRfqs,
  getOne: partnerGetOneRfq,
  submitQuotes: partnerSubmitQuotes,
  decline: partnerDeclineRfq,
  // Purchase Order endpoints
  getPurchaseOrders: partnerGetPurchaseOrders,
  getOnePurchaseOrder: partnerGetOnePurchaseOrder,
  confirmPurchaseOrder: partnerConfirmPurchaseOrder,
  updateDeliveryStatus: partnerUpdateDeliveryStatus,
});

const sourceRouter = createTRPCRouter({
  admin: adminRouter,
  partner: partnerRouter,
});

export default sourceRouter;
