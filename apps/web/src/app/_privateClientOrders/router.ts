import { createTRPCRouter } from '@/lib/trpc/trpc';

import adminAddItem from './controller/adminAddItem';
import adminCreate from './controller/adminCreate';
import adminDashboard from './controller/adminDashboard';
import adminDelete from './controller/adminDelete';
import adminGetMany from './controller/adminGetMany';
import adminGetOne from './controller/adminGetOne';
import adminRemoveItem from './controller/adminRemoveItem';
import adminUpdateItem from './controller/adminUpdateItem';
import adminUpdateStatus from './controller/adminUpdateStatus';
import checkLocalStock from './controller/checkLocalStock';
import distributorDashboard from './controller/distributorDashboard';
import distributorGetMany from './controller/distributorGetMany';
import distributorGetOne from './controller/distributorGetOne';
import distributorUpdateStatus from './controller/distributorUpdateStatus';
import documentsDelete from './controller/documentsDelete';
import documentsExtract from './controller/documentsExtract';
import documentsExtractInline from './controller/documentsExtractInline';
import documentsGetMany from './controller/documentsGetMany';
import documentsUpload from './controller/documentsUpload';
import itemsAdd from './controller/itemsAdd';
import itemsBulkUpdateStockStatus from './controller/itemsBulkUpdateStockStatus';
import itemsRemove from './controller/itemsRemove';
import itemsUpdate from './controller/itemsUpdate';
import itemsUpdateStockStatus from './controller/itemsUpdateStockStatus';
import matchExtractedToLocalStock from './controller/matchExtractedToLocalStock';
import ordersAdminResetVerification from './controller/ordersAdminResetVerification';
import ordersApprove from './controller/ordersApprove';
import ordersApproveRevisions from './controller/ordersApproveRevisions';
import ordersAssignDistributor from './controller/ordersAssignDistributor';
import ordersCancel from './controller/ordersCancel';
import ordersCreate from './controller/ordersCreate';
import ordersDistributorPaymentVerification from './controller/ordersDistributorPaymentVerification';
import ordersDistributorUnlockSuspended from './controller/ordersDistributorUnlockSuspended';
import ordersDistributorVerification from './controller/ordersDistributorVerification';
import ordersGetMany from './controller/ordersGetMany';
import ordersGetOne from './controller/ordersGetOne';
import ordersLogContactAttempt from './controller/ordersLogContactAttempt';
import ordersMarkDelivered from './controller/ordersMarkDelivered';
import ordersMarkInTransit from './controller/ordersMarkInTransit';
import ordersPartnerAcknowledgeInvoice from './controller/ordersPartnerAcknowledgeInvoice';
import ordersPartnerReinitiateVerification from './controller/ordersPartnerReinitiateVerification';
import ordersPartnerVerification from './controller/ordersPartnerVerification';
import ordersRequestRevision from './controller/ordersRequestRevision';
import ordersScheduleDelivery from './controller/ordersScheduleDelivery';
import ordersSubmit from './controller/ordersSubmit';
import partnerDashboard from './controller/partnerDashboard';
import paymentsConfirm from './controller/paymentsConfirm';

const privateClientOrdersRouter = createTRPCRouter({
  // Order CRUD (wine partner)
  create: ordersCreate,
  getMany: ordersGetMany,
  getOne: ordersGetOne,
  submit: ordersSubmit,
  cancel: ordersCancel,
  approveRevisions: ordersApproveRevisions,
  partnerVerification: ordersPartnerVerification,
  partnerReinitiateVerification: ordersPartnerReinitiateVerification,
  partnerAcknowledgeInvoice: ordersPartnerAcknowledgeInvoice,

  // Line item management (wine partner)
  addItem: itemsAdd,
  updateItem: itemsUpdate,
  removeItem: itemsRemove,

  // Document management
  uploadDocument: documentsUpload,
  getDocuments: documentsGetMany,
  deleteDocument: documentsDelete,
  extractDocument: documentsExtract,
  extractDocumentInline: documentsExtractInline,
  matchExtractedToLocalStock,

  // Payment management
  confirmPayment: paymentsConfirm,

  // Partner dashboard
  partnerDashboard,

  // Admin procedures
  adminDashboard,
  adminCreate,
  adminAddItem,
  adminUpdateItem,
  adminRemoveItem,
  adminGetMany,
  adminGetOne,
  adminUpdateStatus,
  adminDelete,
  adminApprove: ordersApprove,
  adminRequestRevision: ordersRequestRevision,
  adminAssignDistributor: ordersAssignDistributor,
  adminResetVerification: ordersAdminResetVerification,
  itemsUpdateStockStatus,
  itemsBulkUpdateStockStatus,
  checkLocalStock,

  // Distributor procedures
  distributorDashboard,
  distributorGetMany,
  distributorGetOne,
  distributorUpdateStatus,
  distributorVerification: ordersDistributorVerification,
  distributorPaymentVerification: ordersDistributorPaymentVerification,
  distributorUnlockSuspended: ordersDistributorUnlockSuspended,

  // Delivery workflow (distributor)
  logContactAttempt: ordersLogContactAttempt,
  scheduleDelivery: ordersScheduleDelivery,
  markInTransit: ordersMarkInTransit,
  markDelivered: ordersMarkDelivered,
});

export default privateClientOrdersRouter;
