import { createTRPCRouter } from '@/lib/trpc/trpc';

import productsGetFilterOptions from './controller/productsGetFilterOptions';
import productsGetMany from './controller/productsGetMany';

const productsRouter = createTRPCRouter({
  getMany: productsGetMany,
  getFilterOptions: productsGetFilterOptions,
});

export default productsRouter;
