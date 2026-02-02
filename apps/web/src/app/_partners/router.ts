import { createTRPCRouter } from '@/lib/trpc/trpc';

import apiKeysCreate from './controllers/apiKeysCreate';
import apiKeysDelete from './controllers/apiKeysDelete';
import apiKeysGetMany from './controllers/apiKeysGetMany';
import apiKeysRevoke from './controllers/apiKeysRevoke';
import contactsCreate from './controllers/contactsCreate';
import contactsDelete from './controllers/contactsDelete';
import contactsGetMany from './controllers/contactsGetMany';
import contactsUpdate from './controllers/contactsUpdate';
import partnersCreate from './controllers/partnersCreate';
import partnersDelete from './controllers/partnersDelete';
import partnersGetMany from './controllers/partnersGetMany';
import partnersGetOne from './controllers/partnersGetOne';
import partnersGetPublicInfo from './controllers/partnersGetPublicInfo';
import partnersListSimple from './controllers/partnersListSimple';
import partnersUpdate from './controllers/partnersUpdate';

const apiKeysRouter = createTRPCRouter({
  create: apiKeysCreate,
  delete: apiKeysDelete,
  getMany: apiKeysGetMany,
  revoke: apiKeysRevoke,
});

const contactsRouter = createTRPCRouter({
  create: contactsCreate,
  delete: contactsDelete,
  getMany: contactsGetMany,
  update: contactsUpdate,
});

const partnersRouter = createTRPCRouter({
  create: partnersCreate,
  delete: partnersDelete,
  getMany: partnersGetMany,
  getOne: partnersGetOne,
  getPublicInfo: partnersGetPublicInfo,
  list: partnersListSimple,
  update: partnersUpdate,
  apiKeys: apiKeysRouter,
  contacts: contactsRouter,
});

export default partnersRouter;
