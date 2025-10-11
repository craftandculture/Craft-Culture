import { createTRPCRouter } from '@/lib/trpc/trpc';

import quotesGet from './controller/quotesGet';

const quotesRouter = createTRPCRouter({
  get: quotesGet,
});

export default quotesRouter;
