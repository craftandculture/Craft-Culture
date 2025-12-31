import { createTRPCRouter } from '@/lib/trpc/trpc';

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
  delete: deleteContact,
});

export default privateClientContactsRouter;
