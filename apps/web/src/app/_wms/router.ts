import { createTRPCRouter } from '@/lib/trpc/trpc';

import adminBatchCreateLocations from './controller/adminBatchCreateLocations';
import adminCreateLocation from './controller/adminCreateLocation';
import adminCreateSpecialLocation from './controller/adminCreateSpecialLocation';
import adminGetLocation from './controller/adminGetLocation';
import adminGetLocations from './controller/adminGetLocations';
import adminUpdateLocation from './controller/adminUpdateLocation';

const locationsRouter = createTRPCRouter({
  create: adminCreateLocation,
  createSpecial: adminCreateSpecialLocation,
  batchCreate: adminBatchCreateLocations,
  getMany: adminGetLocations,
  getOne: adminGetLocation,
  update: adminUpdateLocation,
});

const adminRouter = createTRPCRouter({
  locations: locationsRouter,
});

const wmsRouter = createTRPCRouter({
  admin: adminRouter,
});

export default wmsRouter;
