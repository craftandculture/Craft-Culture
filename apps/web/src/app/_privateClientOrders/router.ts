import { createTRPCRouter } from '@/lib/trpc/trpc';

import adminAddItem from './controller/adminAddItem';
import adminAddNote from './controller/adminAddNote';
import adminCloneOrder from './controller/adminCloneOrder';
import adminClonePreview from './controller/adminClonePreview';
import adminCreate from './controller/adminCreate';
import adminCreateZohoSalesOrder from './controller/adminCreateZohoSalesOrder';
import adminDashboard from './controller/adminDashboard';
import adminDelete from './controller/adminDelete';
import adminGetMany from './controller/adminGetMany';
import adminGetOne from './controller/adminGetOne';
import adminGetSubscriptionBoxes from './controller/adminGetSubscriptionBoxes';
import adminGetWmsStockForOrder from './controller/adminGetWmsStockForOrder';
import adminMarkPartnerPaid from './controller/adminMarkPartnerPaid';
import adminMarkPayment from './controller/adminMarkPayment';
import adminMatchStockLwins from './controller/adminMatchStockLwins';
import adminPreviewZohoSalesOrder from './controller/adminPreviewZohoSalesOrder';
import adminRemoveItem from './controller/adminRemoveItem';
import adminSetDistributorSku from './controller/adminSetDistributorSku';
import adminSetSubscriptionBox from './controller/adminSetSubscriptionBox';
import adminUnlinkZohoSalesOrder from './controller/adminUnlinkZohoSalesOrder';
import adminUpdateItem from './controller/adminUpdateItem';
import adminUpdateStatus from './controller/adminUpdateStatus';
import checkLocalStock from './controller/checkLocalStock';
import distributorAddNote from './controller/distributorAddNote';
import distributorConfirmStockReceipt from './controller/distributorConfirmStockReceipt';
import distributorDashboard from './controller/distributorDashboard';
import distributorGetMany from './controller/distributorGetMany';
import distributorGetOne from './controller/distributorGetOne';
import distributorResendProformaInvoice from './controller/distributorResendProformaInvoice';
import distributorSetSku from './controller/distributorSetSku';
import distributorUpdateStatus from './controller/distributorUpdateStatus';
import distributorUploadDeliveryPhoto from './controller/distributorUploadDeliveryPhoto';
import documentsDelete from './controller/documentsDelete';
import documentsExtract from './controller/documentsExtract';
import documentsExtractInline from './controller/documentsExtractInline';
import documentsGetMany from './controller/documentsGetMany';
import documentsUpload from './controller/documentsUpload';
import getPartnerWmsStock from './controller/getPartnerWmsStock';
import itemsAdd from './controller/itemsAdd';
import itemsBulkUpdateStockStatus from './controller/itemsBulkUpdateStockStatus';
import itemsRemove from './controller/itemsRemove';
import itemsUpdate from './controller/itemsUpdate';
import itemsUpdateStockStatus from './controller/itemsUpdateStockStatus';
import matchExtractedToLocalStock from './controller/matchExtractedToLocalStock';
import ordersAddNote from './controller/ordersAddNote';
import ordersAdminResetVerification from './controller/ordersAdminResetVerification';
import ordersApprove from './controller/ordersApprove';
import ordersApproveRevisions from './controller/ordersApproveRevisions';
import ordersAssignDistributor from './controller/ordersAssignDistributor';
import ordersCancel from './controller/ordersCancel';
import ordersClone from './controller/ordersClone';
import ordersClonePreview from './controller/ordersClonePreview';
import ordersCreate from './controller/ordersCreate';
import ordersDistributorPaymentVerification from './controller/ordersDistributorPaymentVerification';
import ordersDistributorUnlockSuspended from './controller/ordersDistributorUnlockSuspended';
import ordersDistributorVerification from './controller/ordersDistributorVerification';
import ordersGetMany from './controller/ordersGetMany';
import ordersGetOne from './controller/ordersGetOne';
import ordersGetSubscriptionBoxes from './controller/ordersGetSubscriptionBoxes';
import ordersLogContactAttempt from './controller/ordersLogContactAttempt';
import ordersMarkDelivered from './controller/ordersMarkDelivered';
import ordersMarkInTransit from './controller/ordersMarkInTransit';
import ordersPartnerAcknowledgeInvoice from './controller/ordersPartnerAcknowledgeInvoice';
import ordersPartnerReinitiateVerification from './controller/ordersPartnerReinitiateVerification';
import ordersPartnerVerification from './controller/ordersPartnerVerification';
import ordersRequestRevision from './controller/ordersRequestRevision';
import ordersScheduleDelivery from './controller/ordersScheduleDelivery';
import ordersSetSubscriptionBox from './controller/ordersSetSubscriptionBox';
import ordersSubmit from './controller/ordersSubmit';
import ordersSubscriptionAccess from './controller/ordersSubscriptionAccess';
import partnerDashboard from './controller/partnerDashboard';
import partnerGetStockSource from './controller/partnerGetStockSource';
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

  // Notes on the timeline, for the other parties
  addNote: ordersAddNote,

  // Subscription boxes (partners running a club)
  subscriptionAccess: ordersSubscriptionAccess,
  clone: ordersClone,
  clonePreview: ordersClonePreview,
  setSubscriptionBox: ordersSetSubscriptionBox,
  getSubscriptionBoxes: ordersGetSubscriptionBoxes,

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
  partnerGetStockSource,
  partnerWmsStock: getPartnerWmsStock,

  // Admin procedures
  adminDashboard,
  adminCreate,
  adminCloneOrder,
  adminClonePreview,
  adminSetSubscriptionBox,
  adminSetDistributorSku,
  adminGetSubscriptionBoxes,
  adminAddItem,
  adminAddNote,
  adminMatchStockLwins,
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
  adminMarkPartnerPaid,
  adminMarkPayment,
  itemsUpdateStockStatus,
  itemsBulkUpdateStockStatus,
  checkLocalStock,
  adminWmsStock: adminGetWmsStockForOrder,

  // PCO → Zoho sales order
  adminPreviewZohoSalesOrder,
  adminCreateZohoSalesOrder,
  adminUnlinkZohoSalesOrder,

  // Distributor procedures
  distributorDashboard,
  distributorGetMany,
  distributorGetOne,
  distributorUpdateStatus,
  distributorVerification: ordersDistributorVerification,
  distributorPaymentVerification: ordersDistributorPaymentVerification,
  distributorUnlockSuspended: ordersDistributorUnlockSuspended,
  distributorConfirmStockReceipt,
  distributorUploadDeliveryPhoto,
  distributorResendProformaInvoice,
  distributorSetSku,
  distributorAddNote,

  // Delivery workflow (distributor)
  logContactAttempt: ordersLogContactAttempt,
  scheduleDelivery: ordersScheduleDelivery,
  markInTransit: ordersMarkInTransit,
  markDelivered: ordersMarkDelivered,
});

export default privateClientOrdersRouter;
