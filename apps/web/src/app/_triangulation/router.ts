import { createTRPCRouter } from '@/lib/trpc/trpc';

import adminCommitImport from './controller/adminCommitImport';
import adminCreateImport from './controller/adminCreateImport';
import adminCreatePeriod from './controller/adminCreatePeriod';
import adminDeleteAlias from './controller/adminDeleteAlias';
import adminDeleteImport from './controller/adminDeleteImport';
import adminGetImports from './controller/adminGetImports';
import adminGetPeriods from './controller/adminGetPeriods';
import adminGetSkuLedger from './controller/adminGetSkuLedger';
import adminGetSkus from './controller/adminGetSkus';
import adminGetTriangulation from './controller/adminGetTriangulation';
import adminGetUnmapped from './controller/adminGetUnmapped';
import adminMapAlias from './controller/adminMapAlias';
import adminSeedSkusFromWms from './controller/adminSeedSkusFromWms';
import adminSetPeriodStatus from './controller/adminSetPeriodStatus';
import adminUpsertSku from './controller/adminUpsertSku';

/**
 * Stock triangulation router
 *
 * Reconciles owner stock (initially Crurated) across the two parties that
 * hold it: Craft & Culture in the warehouse, and City Drinks on their site.
 */
const triangulationRouter = createTRPCRouter({
  admin: createTRPCRouter({
    getPeriods: adminGetPeriods,
    createPeriod: adminCreatePeriod,
    setPeriodStatus: adminSetPeriodStatus,
    getImports: adminGetImports,
    createImport: adminCreateImport,
    commitImport: adminCommitImport,
    deleteImport: adminDeleteImport,
    getSkus: adminGetSkus,
    upsertSku: adminUpsertSku,
    seedSkusFromWms: adminSeedSkusFromWms,
    getUnmapped: adminGetUnmapped,
    mapAlias: adminMapAlias,
    deleteAlias: adminDeleteAlias,
    getTriangulation: adminGetTriangulation,
    getSkuLedger: adminGetSkuLedger,
  }),
});

export default triangulationRouter;
