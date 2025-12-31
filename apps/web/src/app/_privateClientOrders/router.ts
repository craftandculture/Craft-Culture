import { createTRPCRouter } from '@/lib/trpc/trpc';

import itemsAdd from './controller/itemsAdd';
import ordersCreate from './controller/ordersCreate';
import ordersGetMany from './controller/ordersGetMany';
import ordersGetOne from './controller/ordersGetOne';

const privateClientOrdersRouter = createTRPCRouter({
  // Order CRUD
  create: ordersCreate,
  getMany: ordersGetMany,
  getOne: ordersGetOne,

  // Line item management
  addItem: itemsAdd,
});

export default privateClientOrdersRouter;
