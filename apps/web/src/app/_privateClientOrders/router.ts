import { createTRPCRouter } from '@/lib/trpc/trpc';

import adminGetMany from './controller/adminGetMany';
import adminGetOne from './controller/adminGetOne';
import adminUpdateStatus from './controller/adminUpdateStatus';
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

  // Admin procedures
  adminGetMany,
  adminGetOne,
  adminUpdateStatus,
});

export default privateClientOrdersRouter;
