import { createTRPCRouter } from '@/lib/trpc/trpc';

import sheetsCreate from './controller/sheetsCreate';
import sheetsDelete from './controller/sheetsDelete';
import sheetsGetMany from './controller/sheetsGetMany';

const sheetsRouter = createTRPCRouter({
  getMany: sheetsGetMany,
  create: sheetsCreate,
  delete: sheetsDelete,
});

export default sheetsRouter;
