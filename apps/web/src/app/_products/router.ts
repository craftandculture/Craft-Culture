import { createTRPCRouter } from '@/lib/trpc/trpc';

import localInventorySyncManual from './controller/localInventorySyncManual';
import productsGetFilterOptions from './controller/productsGetFilterOptions';
import productsGetLastUpdate from './controller/productsGetLastUpdate';
import productsGetMany from './controller/productsGetMany';
import productsGetVintagesByProduct from './controller/productsGetVintagesByProduct';

const productsRouter = createTRPCRouter({
  getMany: productsGetMany,
  getFilterOptions: productsGetFilterOptions,
  getLastUpdate: productsGetLastUpdate,
  getVintagesByProduct: productsGetVintagesByProduct,
  localInventorySyncManual: localInventorySyncManual,
});

export default productsRouter;
