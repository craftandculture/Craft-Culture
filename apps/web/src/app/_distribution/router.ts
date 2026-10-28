import { createTRPCRouter } from '@/lib/trpc/trpc';

import adminAutoLinkCodes from './controller/adminAutoLinkCodes';
import adminDeriveSold from './controller/adminDeriveSold';
import adminExportStatement from './controller/adminExportStatement';
import adminGetBalances from './controller/adminGetBalances';
import adminGetCodeSuggestions from './controller/adminGetCodeSuggestions';
import adminGetDuplicateWines from './controller/adminGetDuplicateWines';
import adminGetMonthSummary from './controller/adminGetMonthSummary';
import adminGetOwed from './controller/adminGetOwed';
import adminGetSetup from './controller/adminGetSetup';
import adminGetStatement from './controller/adminGetStatement';
import adminGetUnmatchedLines from './controller/adminGetUnmatchedLines';
import adminImportOutletSales from './controller/adminImportOutletSales';
import adminLinkCode from './controller/adminLinkCode';
import adminPullOutletStock from './controller/adminPullOutletStock';
import adminSearchWines from './controller/adminSearchWines';
import adminSetInvoiceOwner from './controller/adminSetInvoiceOwner';
import adminSetOwnerPartner from './controller/adminSetOwnerPartner';
import adminSetWineBought from './controller/adminSetWineBought';
import adminSetWineClosed from './controller/adminSetWineClosed';
import adminSetWineLanded from './controller/adminSetWineLanded';
import adminSetWineOwner from './controller/adminSetWineOwner';
import adminSyncBills from './controller/adminSyncBills';
import adminSyncOutFromZoho from './controller/adminSyncOutFromZoho';
import staffGetDailySales from './controller/staffGetDailySales';
import staffSendDailySales from './controller/staffSendDailySales';

/**
 * Distribution — our wine placed with a retail outlet, and whose it is
 *
 * Four positions per wine: what went Out to the outlet, what they still Hold,
 * what they Sold, and what the owner has Billed us. The unit carrying the rules
 * is the arrangement — this owner's wine, at this outlet, on these terms —
 * because Crurated are open-ended at City Drinks and 90 days at The Bottle
 * Store.
 *
 * Named for distribution rather than consignment because `_consignment` is
 * already the cellar programme: wine taken from private clients to sell on
 * their behalf. Both are consignment in the trade sense and they are opposite
 * directions of it, so the names have to separate them.
 *
 * Separate from `triangulation`, which reconciles Crurated's warehouse stock
 * and stays in service until this is proven against real months.
 */
const distributionRouter = createTRPCRouter({
  admin: createTRPCRouter({
    autoLinkCodes: adminAutoLinkCodes,
    deriveSold: adminDeriveSold,
    exportStatement: adminExportStatement,
    getBalances: adminGetBalances,
    getCodeSuggestions: adminGetCodeSuggestions,
    linkCode: adminLinkCode,
    importOutletSales: adminImportOutletSales,
    getDuplicateWines: adminGetDuplicateWines,
    getMonthSummary: adminGetMonthSummary,
    getOwed: adminGetOwed,
    getUnmatchedLines: adminGetUnmatchedLines,
    getSetup: adminGetSetup,
    getStatement: adminGetStatement,
    pullOutletStock: adminPullOutletStock,
    searchWines: adminSearchWines,
    setInvoiceOwner: adminSetInvoiceOwner,
    setWineBought: adminSetWineBought,
    setWineLanded: adminSetWineLanded,
    setWineClosed: adminSetWineClosed,
    setWineOwner: adminSetWineOwner,
    setOwnerPartner: adminSetOwnerPartner,
    syncBills: adminSyncBills,
    syncOutFromZoho: adminSyncOutFromZoho,
  }),
  /* C&C staff only, not every admin: see utils/isStaff */
  staff: createTRPCRouter({
    getDailySales: staffGetDailySales,
    sendDailySales: staffSendDailySales,
  }),
});

export default distributionRouter;
