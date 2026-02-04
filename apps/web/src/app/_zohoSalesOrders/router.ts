/**
 * Zoho Sales Orders Router
 *
 * tRPC router for managing synced Zoho Books sales orders.
 */

import { createTRPCRouter } from '@/lib/trpc/trpc';

import adminApproveSalesOrders from './controller/adminApproveSalesOrders';
import adminCreatePickListFromSalesOrder from './controller/adminCreatePickListFromSalesOrder';
import adminGetSalesOrder from './controller/adminGetSalesOrder';
import adminListSalesOrders from './controller/adminListSalesOrders';
import adminSyncSalesOrders from './controller/adminSyncSalesOrders';

const zohoSalesOrdersRouter = createTRPCRouter({
  list: adminListSalesOrders,
  get: adminGetSalesOrder,
  approve: adminApproveSalesOrders,
  createPickList: adminCreatePickListFromSalesOrder,
  sync: adminSyncSalesOrders,
});

export default zohoSalesOrdersRouter;
