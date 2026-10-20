/**
 * Zoho Sales Orders Router
 *
 * tRPC router for managing synced Zoho Books sales orders.
 */

import { createTRPCRouter } from '@/lib/trpc/trpc';

import adminApproveSalesOrders from './controller/adminApproveSalesOrders';
import adminCreatePickListFromSalesOrder from './controller/adminCreatePickListFromSalesOrder';
import adminDismissDeletedSalesOrder from './controller/adminDismissDeletedSalesOrder';
import { adminListDraftHolds, adminRefreshDraftHold, adminReleaseDraftHold } from './controller/adminDraftHolds';
import adminGetCustomerInvoiceTotals from './controller/adminGetCustomerInvoiceTotals';
import adminGetOutstandingOrders from './controller/adminGetOutstandingOrders';
import adminGetPickedOrdersForDispatch from './controller/adminGetPickedOrdersForDispatch';
import adminGetSalesOrder from './controller/adminGetSalesOrder';
import adminHoldDraft from './controller/adminHoldDraft';
import adminListSalesOrders from './controller/adminListSalesOrders';
import adminReleaseToPick from './controller/adminReleaseToPick';
import adminSyncSalesOrders from './controller/adminSyncSalesOrders';
import adminSyncZohoInvoices from './controller/adminSyncZohoInvoices';
import adminTestPaymentAlerts from './controller/adminTestPaymentAlerts';
import adminWhereIsOrder from './controller/adminWhereIsOrder';

const zohoSalesOrdersRouter = createTRPCRouter({
  list: adminListSalesOrders,
  get: adminGetSalesOrder,
  approve: adminApproveSalesOrders,
  createPickList: adminCreatePickListFromSalesOrder,
  releaseToPick: adminReleaseToPick,
  // Hold a draft SO's wine while the client finishes it
  holdDraft: adminHoldDraft,
  draftHolds: adminListDraftHolds,
  refreshDraftHold: adminRefreshDraftHold,
  releaseDraftHold: adminReleaseDraftHold,
  dismissDeleted: adminDismissDeletedSalesOrder,
  sync: adminSyncSalesOrders,
  syncInvoices: adminSyncZohoInvoices,
  // Send a test message to #payments-received
  testPaymentAlerts: adminTestPaymentAlerts,
  getPickedForDispatch: adminGetPickedOrdersForDispatch,
  // Orders picked, then amended in Zoho — what is still owed
  outstanding: adminGetOutstandingOrders,
  // What a customer has been invoiced, by their Zoho record and by currency
  customerInvoiceTotals: adminGetCustomerInvoiceTotals,
  whereIs: adminWhereIsOrder,
});

export default zohoSalesOrdersRouter;
