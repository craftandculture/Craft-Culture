import { createTRPCRouter } from '@/lib/trpc/trpc';

import productsGetFilterOptions from './controller/productsGetFilterOptions';
import productsGetLastUpdate from './controller/productsGetLastUpdate';
import productsGetMany from './controller/productsGetMany';

const productsRouter = createTRPCRouter({
  getMany: productsGetMany,
  getFilterOptions: productsGetFilterOptions,
  getLastUpdate: productsGetLastUpdate,
});

export default productsRouter;
