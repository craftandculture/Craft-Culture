import { createTRPCRouter } from '@/lib/trpc/trpc';

import adminDeriveSold from './controller/adminDeriveSold';
import adminGetBalances from './controller/adminGetBalances';
import adminGetOwed from './controller/adminGetOwed';
import adminGetSetup from './controller/adminGetSetup';
import adminGetStatement from './controller/adminGetStatement';
import adminImportOutletSales from './controller/adminImportOutletSales';
import adminPullOutletStock from './controller/adminPullOutletStock';
import adminSyncBills from './controller/adminSyncBills';
import adminSyncOutFromZoho from './controller/adminSyncOutFromZoho';

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
    deriveSold: adminDeriveSold,
    getBalances: adminGetBalances,
    importOutletSales: adminImportOutletSales,
    getOwed: adminGetOwed,
    getSetup: adminGetSetup,
    getStatement: adminGetStatement,
    pullOutletStock: adminPullOutletStock,
    syncBills: adminSyncBills,
    syncOutFromZoho: adminSyncOutFromZoho,
  }),
});

export default distributionRouter;
