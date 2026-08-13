import { createTRPCRouter } from '@/lib/trpc/trpc';

import adminAutoMapSuggestions from './controller/adminAutoMapSuggestions';
import adminCommitImport from './controller/adminCommitImport';
import adminCreateImport from './controller/adminCreateImport';
import adminCreatePeriod from './controller/adminCreatePeriod';
import adminDeleteAlias from './controller/adminDeleteAlias';
import adminDeleteImport from './controller/adminDeleteImport';
import adminExtractPackingList from './controller/adminExtractPackingList';
import adminGetDuplicateWarnings from './controller/adminGetDuplicateWarnings';
import adminGetImports from './controller/adminGetImports';
import adminGetPeriods from './controller/adminGetPeriods';
import adminGetSkuLedger from './controller/adminGetSkuLedger';
import adminGetSkus from './controller/adminGetSkus';
import adminGetTriangulation from './controller/adminGetTriangulation';
import adminGetUnmapped from './controller/adminGetUnmapped';
import adminMapAlias from './controller/adminMapAlias';
import adminSeedSkusFromWms from './controller/adminSeedSkusFromWms';
import adminSetPeriodStatus from './controller/adminSetPeriodStatus';
import adminSyncCountFromWms from './controller/adminSyncCountFromWms';
import adminSyncCycleCountFromWms from './controller/adminSyncCycleCountFromWms';
import adminSyncReceiptsFromWms from './controller/adminSyncReceiptsFromWms';
import adminSyncSalesFromZoho from './controller/adminSyncSalesFromZoho';
import adminUpdateImport from './controller/adminUpdateImport';
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
    getDuplicateWarnings: adminGetDuplicateWarnings,
    createImport: adminCreateImport,
    commitImport: adminCommitImport,
    updateImport: adminUpdateImport,
    deleteImport: adminDeleteImport,
    extractPackingList: adminExtractPackingList,
    getSkus: adminGetSkus,
    upsertSku: adminUpsertSku,
    seedSkusFromWms: adminSeedSkusFromWms,
    syncCountFromWms: adminSyncCountFromWms,
    syncCycleCountFromWms: adminSyncCycleCountFromWms,
    syncReceiptsFromWms: adminSyncReceiptsFromWms,
    syncSalesFromZoho: adminSyncSalesFromZoho,
    getUnmapped: adminGetUnmapped,
    mapAlias: adminMapAlias,
    autoMapSuggestions: adminAutoMapSuggestions,
    deleteAlias: adminDeleteAlias,
    getTriangulation: adminGetTriangulation,
    getSkuLedger: adminGetSkuLedger,
  }),
});

export default triangulationRouter;
