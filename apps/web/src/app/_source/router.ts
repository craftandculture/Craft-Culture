import { createTRPCRouter } from '@/lib/trpc/trpc';

import adminAddCustomerPoItem from './controller/adminAddCustomerPoItem';
import adminAddItem from './controller/adminAddItem';
import adminAddPartners from './controller/adminAddPartners';
import adminAutoMatchCustomerPo from './controller/adminAutoMatchCustomerPo';
import adminAutoSelectBest from './controller/adminAutoSelectBest';
import adminBulkChangeSupplier from './controller/adminBulkChangeSupplier';
import adminBulkSelectQuotes from './controller/adminBulkSelectQuotes';
import adminCancelRfq from './controller/adminCancelRfq';
import adminCreateCustomerPo from './controller/adminCreateCustomerPo';
import adminCreateRfq from './controller/adminCreateRfq';
import adminDeleteCustomerPoItem from './controller/adminDeleteCustomerPoItem';
import adminDeleteItem from './controller/adminDeleteItem';
import adminDeleteRfq from './controller/adminDeleteRfq';
import adminExportSupplierOrderExcel from './controller/adminExportSupplierOrderExcel';
import adminFinalizeRfq from './controller/adminFinalizeRfq';
import adminGenerateFinalQuote from './controller/adminGenerateFinalQuote';
import adminGenerateSupplierOrders from './controller/adminGenerateSupplierOrders';
import adminGetAvailableSuppliers from './controller/adminGetAvailableSuppliers';
import adminGetManyCustomerPos from './controller/adminGetManyCustomerPos';
import adminGetManyRfqs from './controller/adminGetManyRfqs';
import adminGetOneCustomerPo from './controller/adminGetOneCustomerPo';
import adminGetOneRfq from './controller/adminGetOneRfq';
import adminGetSupplierOrder from './controller/adminGetSupplierOrder';
import adminImportLwinWines from './controller/adminImportLwinWines';
import adminMarkClientApproved from './controller/adminMarkClientApproved';
import adminParseCustomerPoDocument from './controller/adminParseCustomerPoDocument';
import adminParseInput from './controller/adminParseInput';
import adminParseQuoteExcel from './controller/adminParseQuoteExcel';
import adminReopenRfqForChanges from './controller/adminReopenRfqForChanges';
import adminRequestConfirmations from './controller/adminRequestConfirmations';
import adminSearchLwin from './controller/adminSearchLwin';
import adminSelectQuote from './controller/adminSelectQuote';
import adminSendSupplierOrder from './controller/adminSendSupplierOrder';
import adminSendToPartners from './controller/adminSendToPartners';
import adminSubmitQuotesOnBehalf from './controller/adminSubmitQuotesOnBehalf';
import adminUpdateCustomerPoItem from './controller/adminUpdateCustomerPoItem';
import adminUpdateItem from './controller/adminUpdateItem';
import adminUpdateRfq from './controller/adminUpdateRfq';
import partnerConfirmQuote from './controller/partnerConfirmQuote';
import partnerConfirmSupplierOrder from './controller/partnerConfirmSupplierOrder';
import partnerDeclineRfq from './controller/partnerDeclineRfq';
import partnerDownloadQuoteTemplate from './controller/partnerDownloadQuoteTemplate';
import partnerDownloadSupplierOrderExcel from './controller/partnerDownloadSupplierOrderExcel';
import partnerGetConfirmationRequests from './controller/partnerGetConfirmationRequests';
import partnerGetManyRfqs from './controller/partnerGetManyRfqs';
import partnerGetManySupplierOrders from './controller/partnerGetManySupplierOrders';
import partnerGetOneRfq from './controller/partnerGetOneRfq';
import partnerGetOneSupplierOrder from './controller/partnerGetOneSupplierOrder';
import partnerParseQuoteExcel from './controller/partnerParseQuoteExcel';
import partnerSubmitQuotes from './controller/partnerSubmitQuotes';

// Customer PO management router
const customerPoRouter = createTRPCRouter({
  create: adminCreateCustomerPo,
  getMany: adminGetManyCustomerPos,
  getOne: adminGetOneCustomerPo,
  addItem: adminAddCustomerPoItem,
  updateItem: adminUpdateCustomerPoItem,
  deleteItem: adminDeleteCustomerPoItem,
  // AI parsing and auto-matching
  parseDocument: adminParseCustomerPoDocument,
  autoMatch: adminAutoMatchCustomerPo,
  // Manual supplier override
  getAvailableSuppliers: adminGetAvailableSuppliers,
  bulkChangeSupplier: adminBulkChangeSupplier,
  // Supplier order operations
  generateSupplierOrders: adminGenerateSupplierOrders,
  sendSupplierOrder: adminSendSupplierOrder,
  getSupplierOrder: adminGetSupplierOrder,
  exportSupplierOrderExcel: adminExportSupplierOrderExcel,
});

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
  addPartners: adminAddPartners,
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
  reopenForChanges: adminReopenRfqForChanges,
  // Customer PO management
  customerPo: customerPoRouter,
});

// Partner supplier order router
const partnerSupplierOrderRouter = createTRPCRouter({
  getMany: partnerGetManySupplierOrders,
  getOne: partnerGetOneSupplierOrder,
  confirm: partnerConfirmSupplierOrder,
  downloadExcel: partnerDownloadSupplierOrderExcel,
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
  // Supplier orders
  supplierOrders: partnerSupplierOrderRouter,
});

const sourceRouter = createTRPCRouter({
  admin: adminRouter,
  partner: partnerRouter,
});

export default sourceRouter;
