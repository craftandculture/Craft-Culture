import { createTRPCRouter } from '@/lib/trpc/trpc';

import adminAutoMapSuggestions from './controller/adminAutoMapSuggestions';
import adminBackfillLwinFromWms from './controller/adminBackfillLwinFromWms';
import adminCommitImport from './controller/adminCommitImport';
import adminCreateImport from './controller/adminCreateImport';
import adminCreatePeriod from './controller/adminCreatePeriod';
import adminCreateProgramme from './controller/adminCreateProgramme';
import adminDeleteAlias from './controller/adminDeleteAlias';
import adminDeleteImport from './controller/adminDeleteImport';
import adminDeriveLwins from './controller/adminDeriveLwins';
import adminExtractPackingList from './controller/adminExtractPackingList';
import adminFindDoubleCounts from './controller/adminFindDoubleCounts';
import adminFindMismatchedLines from './controller/adminFindMismatchedLines';
import adminFindSplitSkus from './controller/adminFindSplitSkus';
import adminFixZohoItem from './controller/adminFixZohoItem';
import adminGetAssumedPacks from './controller/adminGetAssumedPacks';
import adminGetDuplicateWarnings from './controller/adminGetDuplicateWarnings';
import adminGetImports from './controller/adminGetImports';
import adminGetOrdersForSku from './controller/adminGetOrdersForSku';
import adminGetPeriods from './controller/adminGetPeriods';
import adminGetProgrammes from './controller/adminGetProgrammes';
import adminGetSalesCoverage from './controller/adminGetSalesCoverage';
import adminGetSkuLedger from './controller/adminGetSkuLedger';
import adminGetSkus from './controller/adminGetSkus';
import adminGetTriangulation from './controller/adminGetTriangulation';
import adminGetUnmapped from './controller/adminGetUnmapped';
import adminGetZohoCleanup from './controller/adminGetZohoCleanup';
import adminGetZohoItems from './controller/adminGetZohoItems';
import adminGetZohoLinesForSku from './controller/adminGetZohoLinesForSku';
import adminMapAlias from './controller/adminMapAlias';
import adminMergeSkus from './controller/adminMergeSkus';
import adminMoveCodeToSku from './controller/adminMoveCodeToSku';
import adminRepairEncoding from './controller/adminRepairEncoding';
import adminRepairPackSizes from './controller/adminRepairPackSizes';
import adminSearchLwinReference from './controller/adminSearchLwinReference';
import adminSeedSkusFromWms from './controller/adminSeedSkusFromWms';
import adminSetCodeIgnored from './controller/adminSetCodeIgnored';
import adminSetPeriodStatus from './controller/adminSetPeriodStatus';
import adminSetSkuLwin from './controller/adminSetSkuLwin';
import adminSetZohoCleaned from './controller/adminSetZohoCleaned';
import adminSuggestLwinFromWms from './controller/adminSuggestLwinFromWms';
import adminSyncCountFromWms from './controller/adminSyncCountFromWms';
import adminSyncCycleCountFromWms from './controller/adminSyncCycleCountFromWms';
import adminSyncReceiptsFromWms from './controller/adminSyncReceiptsFromWms';
import adminSyncSalesFromInvoices from './controller/adminSyncSalesFromInvoices';
import adminSyncSalesFromZoho from './controller/adminSyncSalesFromZoho';
import adminUnmapCode from './controller/adminUnmapCode';
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
    getProgrammes: adminGetProgrammes,
    createProgramme: adminCreateProgramme,
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
    findSplitSkus: adminFindSplitSkus,
    findMismatchedLines: adminFindMismatchedLines,
    unmapCode: adminUnmapCode,
    mergeSkus: adminMergeSkus,
    upsertSku: adminUpsertSku,
    seedSkusFromWms: adminSeedSkusFromWms,
    repairPackSizes: adminRepairPackSizes,
    getAssumedPacks: adminGetAssumedPacks,
    findDoubleCounts: adminFindDoubleCounts,
    moveCodeToSku: adminMoveCodeToSku,
    getZohoLinesForSku: adminGetZohoLinesForSku,
    getOrdersForSku: adminGetOrdersForSku,
    getZohoCleanup: adminGetZohoCleanup,
    getZohoItems: adminGetZohoItems,
    fixZohoItem: adminFixZohoItem,
    backfillLwinFromWms: adminBackfillLwinFromWms,
    suggestLwinFromWms: adminSuggestLwinFromWms,
    searchLwinReference: adminSearchLwinReference,
    deriveLwins: adminDeriveLwins,
    setSkuLwin: adminSetSkuLwin,
    setZohoCleaned: adminSetZohoCleaned,
    repairEncoding: adminRepairEncoding,
    syncCountFromWms: adminSyncCountFromWms,
    syncCycleCountFromWms: adminSyncCycleCountFromWms,
    syncReceiptsFromWms: adminSyncReceiptsFromWms,
    syncSalesFromZoho: adminSyncSalesFromZoho,
    syncSalesFromInvoices: adminSyncSalesFromInvoices,
    getSalesCoverage: adminGetSalesCoverage,
    getUnmapped: adminGetUnmapped,
    mapAlias: adminMapAlias,
    setCodeIgnored: adminSetCodeIgnored,
    autoMapSuggestions: adminAutoMapSuggestions,
    deleteAlias: adminDeleteAlias,
    getTriangulation: adminGetTriangulation,
    getSkuLedger: adminGetSkuLedger,
  }),
});

export default triangulationRouter;
