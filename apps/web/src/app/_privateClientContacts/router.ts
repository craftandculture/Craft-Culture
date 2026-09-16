import { createTRPCRouter } from '@/lib/trpc/trpc';

import adminBackfillOrderClients from './controller/adminBackfillOrderClients';
import adminCreateForPartner from './controller/adminCreateForPartner';
import adminGetAll from './controller/adminGetAll';
import adminGetManyForPartner from './controller/adminGetManyForPartner';
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
  // Admins belong to no wine partner, so `update` and `getMany` are closed
  // to them — these take the partner from the form instead
  adminCreateForPartner,
  adminGetAll,
  adminGetManyForPartner,
  adminUpdate,
  // The flag ordersAssignDistributor reads to skip the verification steps
  adminSetVerified,
  // Orders raised without a client record have nothing to edit or verify
  adminLinkOrCreateForOrder,
  // The same, for every order raised before the create paths kept the client
  adminBackfillOrderClients,
  delete: deleteContact,
});

export default privateClientContactsRouter;
