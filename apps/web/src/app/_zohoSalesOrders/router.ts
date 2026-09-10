/**
 * Zoho Sales Orders Router
 *
 * tRPC router for managing synced Zoho Books sales orders.
 */

import { createTRPCRouter } from '@/lib/trpc/trpc';

import adminApproveSalesOrders from './controller/adminApproveSalesOrders';
import adminCreatePickListFromSalesOrder from './controller/adminCreatePickListFromSalesOrder';
import adminGetCustomerInvoiceTotals from './controller/adminGetCustomerInvoiceTotals';
import adminGetPickedOrdersForDispatch from './controller/adminGetPickedOrdersForDispatch';
import adminGetSalesOrder from './controller/adminGetSalesOrder';
import adminListSalesOrders from './controller/adminListSalesOrders';
import adminReleaseToPick from './controller/adminReleaseToPick';
import adminSyncSalesOrders from './controller/adminSyncSalesOrders';
import adminSyncZohoInvoices from './controller/adminSyncZohoInvoices';

const zohoSalesOrdersRouter = createTRPCRouter({
  list: adminListSalesOrders,
  get: adminGetSalesOrder,
  approve: adminApproveSalesOrders,
  createPickList: adminCreatePickListFromSalesOrder,
  releaseToPick: adminReleaseToPick,
  sync: adminSyncSalesOrders,
  syncInvoices: adminSyncZohoInvoices,
  getPickedForDispatch: adminGetPickedOrdersForDispatch,
  // What a customer has been invoiced, by their Zoho record and by currency
  customerInvoiceTotals: adminGetCustomerInvoiceTotals,
});

export default zohoSalesOrdersRouter;
