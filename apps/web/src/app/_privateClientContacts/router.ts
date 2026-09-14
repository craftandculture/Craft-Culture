import { createTRPCRouter } from '@/lib/trpc/trpc';

import adminLinkOrCreateForOrder from './controller/adminLinkOrCreateForOrder';
import adminSetVerified from './controller/adminSetVerified';
import adminUpdate from './controller/adminUpdate';
import create from './controller/create';
import deleteContact from './controller/delete';
import getMany from './controller/getMany';
import getOne from './controller/getOne';
import update from './controller/update';

const privateClientContactsRouter = createTRPCRouter({
  getMany,
  getOne,
  create,
  update,
  // Admins belong to no wine partner, so `update` is closed to them
  adminUpdate,
  // The flag ordersAssignDistributor reads to skip the verification steps
  adminSetVerified,
  // Orders raised without a client record have nothing to edit or verify
  adminLinkOrCreateForOrder,
  delete: deleteContact,
});

export default privateClientContactsRouter;
