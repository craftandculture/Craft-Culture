import userPricingModelsAssign from '@/app/_pricingModels/controller/userPricingModelsAssign';
import usersGetManyWithPricingModels from '@/app/_pricingModels/controller/usersGetManyWithPricingModels';
import { createTRPCRouter } from '@/lib/trpc/trpc';

import usersGetMe from './controllers/usersGetMe';
import usersUpdate from './controllers/usersUpdate';

const usersRouter = createTRPCRouter({
  getMe: usersGetMe,
  update: usersUpdate,
  getManyWithPricingModels: usersGetManyWithPricingModels,
  assignPricingModel: userPricingModelsAssign,
});

export default usersRouter;
