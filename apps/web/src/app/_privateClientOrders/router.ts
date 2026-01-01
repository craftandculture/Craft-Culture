import { createTRPCRouter } from '@/lib/trpc/trpc';

import adminAddItem from './controller/adminAddItem';
import adminCreate from './controller/adminCreate';
import adminGetMany from './controller/adminGetMany';
import adminGetOne from './controller/adminGetOne';
import adminUpdateStatus from './controller/adminUpdateStatus';
import distributorGetMany from './controller/distributorGetMany';
import distributorGetOne from './controller/distributorGetOne';
import distributorUpdateStatus from './controller/distributorUpdateStatus';
import documentsDelete from './controller/documentsDelete';
import documentsExtract from './controller/documentsExtract';
import documentsGetMany from './controller/documentsGetMany';
import documentsUpload from './controller/documentsUpload';
import itemsAdd from './controller/itemsAdd';
import itemsRemove from './controller/itemsRemove';
import itemsUpdate from './controller/itemsUpdate';
import ordersApprove from './controller/ordersApprove';
import ordersAssignDistributor from './controller/ordersAssignDistributor';
import ordersCancel from './controller/ordersCancel';
import ordersCreate from './controller/ordersCreate';
import ordersGetMany from './controller/ordersGetMany';
import ordersGetOne from './controller/ordersGetOne';
import ordersRequestRevision from './controller/ordersRequestRevision';
import ordersSubmit from './controller/ordersSubmit';
import paymentsConfirm from './controller/paymentsConfirm';

const privateClientOrdersRouter = createTRPCRouter({
  // Order CRUD (wine partner)
  create: ordersCreate,
  getMany: ordersGetMany,
  getOne: ordersGetOne,
  submit: ordersSubmit,
  cancel: ordersCancel,

  // Line item management (wine partner)
  addItem: itemsAdd,
  updateItem: itemsUpdate,
  removeItem: itemsRemove,

  // Document management
  uploadDocument: documentsUpload,
  getDocuments: documentsGetMany,
  deleteDocument: documentsDelete,
  extractDocument: documentsExtract,

  // Payment management
  confirmPayment: paymentsConfirm,

  // Admin procedures
  adminCreate,
  adminAddItem,
  adminGetMany,
  adminGetOne,
  adminUpdateStatus,
  adminApprove: ordersApprove,
  adminRequestRevision: ordersRequestRevision,
  adminAssignDistributor: ordersAssignDistributor,

  // Distributor procedures
  distributorGetMany,
  distributorGetOne,
  distributorUpdateStatus,
});

export default privateClientOrdersRouter;
