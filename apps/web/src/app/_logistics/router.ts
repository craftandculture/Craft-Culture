import { createTRPCRouter } from '@/lib/trpc/trpc';

import adminAddItem from './controller/adminAddItem';
import adminCalculateLandedCost from './controller/adminCalculateLandedCost';
import adminCreate from './controller/adminCreate';
import adminDeleteDocument from './controller/adminDeleteDocument';
import adminGetMany from './controller/adminGetMany';
import adminGetOne from './controller/adminGetOne';
import adminRemoveItem from './controller/adminRemoveItem';
import adminUpdate from './controller/adminUpdate';
import adminUpdateStatus from './controller/adminUpdateStatus';
import adminUploadDocument from './controller/adminUploadDocument';

const adminRouter = createTRPCRouter({
  // Shipment CRUD
  create: adminCreate,
  getMany: adminGetMany,
  getOne: adminGetOne,
  update: adminUpdate,
  updateStatus: adminUpdateStatus,

  // Items
  addItem: adminAddItem,
  removeItem: adminRemoveItem,

  // Documents
  uploadDocument: adminUploadDocument,
  deleteDocument: adminDeleteDocument,

  // Landed cost
  calculateLandedCost: adminCalculateLandedCost,
});

const logisticsRouter = createTRPCRouter({
  admin: adminRouter,
});

export default logisticsRouter;
