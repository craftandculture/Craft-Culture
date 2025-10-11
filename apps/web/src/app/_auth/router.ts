import { createTRPCRouter } from '@/lib/trpc/trpc';

import usersGetMe from './controllers/usersGetMe';
import usersUpdate from './controllers/usersUpdate';

const usersRouter = createTRPCRouter({
  getMe: usersGetMe,
  update: usersUpdate,
});

export default usersRouter;
