import userPricingModelsAssign from '@/app/_pricingModels/controller/userPricingModelsAssign';
import usersGetManyWithPricingModels from '@/app/_pricingModels/controller/usersGetManyWithPricingModels';
import { protectedProcedure } from '@/lib/trpc/procedures';
import { createTRPCRouter } from '@/lib/trpc/trpc';

import signOutController from './controllers/signOut';
import usersGetMe from './controllers/usersGetMe';
import usersUpdate from './controllers/usersUpdate';

const usersRouter = createTRPCRouter({
  getMe: usersGetMe,
  update: usersUpdate,
  signOut: protectedProcedure.mutation(async ({ ctx }) => {
    return await signOutController({ user: ctx.user });
  }),
  getManyWithPricingModels: usersGetManyWithPricingModels,
  assignPricingModel: userPricingModelsAssign,
});

export default usersRouter;
