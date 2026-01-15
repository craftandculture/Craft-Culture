import { createTRPCRouter } from '@/lib/trpc/trpc';

import adminCreate from './controller/adminCreate';
import adminGetMany from './controller/adminGetMany';
import adminGetOne from './controller/adminGetOne';
import adminUpdate from './controller/adminUpdate';
import adminUpdateStatus from './controller/adminUpdateStatus';

const adminRouter = createTRPCRouter({
  create: adminCreate,
  getMany: adminGetMany,
  getOne: adminGetOne,
  update: adminUpdate,
  updateStatus: adminUpdateStatus,
});

const logisticsRouter = createTRPCRouter({
  admin: adminRouter,
});

export default logisticsRouter;
