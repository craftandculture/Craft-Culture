import userPricingModelsAssign from '@/app/_pricingModels/controller/userPricingModelsAssign';
import usersGetManyWithPricingModels from '@/app/_pricingModels/controller/usersGetManyWithPricingModels';
import { protectedProcedure } from '@/lib/trpc/procedures';
import { createTRPCRouter } from '@/lib/trpc/trpc';

import partnersGetDistributors from './controllers/partnersGetDistributors';
import partnersGetWinePartners from './controllers/partnersGetWinePartners';
import signOutController from './controllers/signOut';
import usersAdminCreate from './controllers/usersAdminCreate';
import usersAdminUpdate from './controllers/usersAdminUpdate';
import usersApprove from './controllers/usersApprove';
import usersAssignPartner from './controllers/usersAssignPartner';
import usersDelete from './controllers/usersDelete';
import usersGetMe from './controllers/usersGetMe';
import usersGetPaginated from './controllers/usersGetPaginated';
import usersGetPartnerMembership from './controllers/usersGetPartnerMembership';
import usersGetPendingCount from './controllers/usersGetPendingCount';
import usersReject from './controllers/usersReject';
import usersRemovePartner from './controllers/usersRemovePartner';
import usersUpdate from './controllers/usersUpdate';

const usersRouter = createTRPCRouter({
  getMe: usersGetMe,
  update: usersUpdate,
  adminUpdate: usersAdminUpdate,
  signOut: protectedProcedure.mutation(async ({ ctx }) => {
    return await signOutController({ user: ctx.user });
  }),
  getManyWithPricingModels: usersGetManyWithPricingModels,
  assignPricingModel: userPricingModelsAssign,
  getPaginated: usersGetPaginated,
  getPendingCount: usersGetPendingCount,
  adminCreate: usersAdminCreate,
  approve: usersApprove,
  reject: usersReject,
  delete: usersDelete,
  // Partner membership management
  getPartnerMembership: usersGetPartnerMembership,
  assignPartner: usersAssignPartner,
  removePartner: usersRemovePartner,
  getDistributors: partnersGetDistributors,
  getWinePartners: partnersGetWinePartners,
});

export default usersRouter;
