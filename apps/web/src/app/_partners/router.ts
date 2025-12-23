import { createTRPCRouter } from '@/lib/trpc/trpc';

import apiKeysCreate from './controllers/apiKeysCreate';
import apiKeysDelete from './controllers/apiKeysDelete';
import apiKeysGetMany from './controllers/apiKeysGetMany';
import apiKeysRevoke from './controllers/apiKeysRevoke';
import partnersCreate from './controllers/partnersCreate';
import partnersGetMany from './controllers/partnersGetMany';
import partnersGetOne from './controllers/partnersGetOne';
import partnersGetPublicInfo from './controllers/partnersGetPublicInfo';
import partnersUpdate from './controllers/partnersUpdate';

const apiKeysRouter = createTRPCRouter({
  create: apiKeysCreate,
  delete: apiKeysDelete,
  getMany: apiKeysGetMany,
  revoke: apiKeysRevoke,
});

const partnersRouter = createTRPCRouter({
  create: partnersCreate,
  getMany: partnersGetMany,
  getOne: partnersGetOne,
  getPublicInfo: partnersGetPublicInfo,
  update: partnersUpdate,
  apiKeys: apiKeysRouter,
});

export default partnersRouter;
