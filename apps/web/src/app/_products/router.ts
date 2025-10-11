import { createTRPCRouter } from '@/lib/trpc/trpc';

import productsGetMany from './controller/productsGetMany';

const productsRouter = createTRPCRouter({
  getMany: productsGetMany,
});

export default productsRouter;
