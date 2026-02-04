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

const zohoSalesOrdersRouter = createTRPCRouter({
  list: adminListSalesOrders,
  get: adminGetSalesOrder,
  approve: adminApproveSalesOrders,
  createPickList: adminCreatePickListFromSalesOrder,
});

export default zohoSalesOrdersRouter;
