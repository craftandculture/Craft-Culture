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
import ordersCreate from './controller/ordersCreate';
import ordersGetMany from './controller/ordersGetMany';
import ordersGetOne from './controller/ordersGetOne';

const privateClientOrdersRouter = createTRPCRouter({
  // Order CRUD (wine partner)
  create: ordersCreate,
  getMany: ordersGetMany,
  getOne: ordersGetOne,

  // Line item management (wine partner)
  addItem: itemsAdd,

  // Document management
  uploadDocument: documentsUpload,
  getDocuments: documentsGetMany,
  deleteDocument: documentsDelete,
  extractDocument: documentsExtract,

  // Admin procedures
  adminCreate,
  adminAddItem,
  adminGetMany,
  adminGetOne,
  adminUpdateStatus,

  // Distributor procedures
  distributorGetMany,
  distributorGetOne,
  distributorUpdateStatus,
});

export default privateClientOrdersRouter;
