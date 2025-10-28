import { createTRPCRouter } from '@/lib/trpc/trpc';

import quotesDelete from './controller/quotesDelete';
import quotesGet from './controller/quotesGet';
import quotesGetMany from './controller/quotesGetMany';
import quotesGetOne from './controller/quotesGetOne';
import quotesSave from './controller/quotesSave';
import quotesUpdate from './controller/quotesUpdate';

const quotesRouter = createTRPCRouter({
  get: quotesGet,
  save: quotesSave,
  getMany: quotesGetMany,
  getOne: quotesGetOne,
  update: quotesUpdate,
  delete: quotesDelete,
});

export default quotesRouter;
