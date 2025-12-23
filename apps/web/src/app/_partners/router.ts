import { createTRPCRouter } from '@/lib/trpc/trpc';

import apiKeysCreate from './controllers/apiKeysCreate';
import apiKeysGetMany from './controllers/apiKeysGetMany';
import apiKeysRevoke from './controllers/apiKeysRevoke';
import partnersCreate from './controllers/partnersCreate';
import partnersGetMany from './controllers/partnersGetMany';
import partnersGetOne from './controllers/partnersGetOne';
import partnersUpdate from './controllers/partnersUpdate';

const apiKeysRouter = createTRPCRouter({
  create: apiKeysCreate,
  getMany: apiKeysGetMany,
  revoke: apiKeysRevoke,
});

const partnersRouter = createTRPCRouter({
  create: partnersCreate,
  getMany: partnersGetMany,
  getOne: partnersGetOne,
  update: partnersUpdate,
  apiKeys: apiKeysRouter,
});

export default partnersRouter;
