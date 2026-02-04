/**
 * Zoho Books Sales Orders API
 *
 * Fetch and manage sales orders from Zoho Books.
 * Used to sync traditional B2B sales into the WMS for picking.
 */

import { zohoFetch } from './client';
import type {
  ZohoSalesOrder,
  ZohoSalesOrderResponse,
  ZohoSalesOrdersListResponse,
} from './types';

/**
 * Get a sales order by ID
 *
 * @param salesOrderId - Zoho sales order ID
 * @returns The sales order details
 */
const getSalesOrder = async (salesOrderId: string) => {
  const response = await zohoFetch<ZohoSalesOrderResponse>(
    `/salesorders/${salesOrderId}`,
  );

  return response.salesorder;
};

/**
 * List sales orders with optional filters
 *
 * @param options - Filter options
 * @returns List of sales orders
 */
const listSalesOrders = async (options?: {
  customerId?: string;
  status?: ZohoSalesOrder['status'];
  salesorderNumber?: string;
  referenceNumber?: string;
  lastModifiedTime?: string;
  page?: number;
  perPage?: number;
}) => {
  const params = new URLSearchParams();

  if (options?.customerId) {
    params.set('customer_id', options.customerId);
  }
  if (options?.status) {
    params.set('status', options.status);
  }
  if (options?.salesorderNumber) {
    params.set('salesorder_number', options.salesorderNumber);
  }
  if (options?.referenceNumber) {
    params.set('reference_number', options.referenceNumber);
  }
  if (options?.lastModifiedTime) {
    params.set('last_modified_time', options.lastModifiedTime);
  }
  if (options?.page) {
    params.set('page', String(options.page));
  }
  if (options?.perPage) {
    params.set('per_page', String(options.perPage));
  }

  const query = params.toString();
  const endpoint = query ? `/salesorders?${query}` : '/salesorders';

  const response = await zohoFetch<ZohoSalesOrdersListResponse>(endpoint);

  return {
    salesOrders: response.salesorders,
    pageContext: response.page_context,
  };
};

/**
 * List sales orders that are open/confirmed (ready for fulfillment)
 *
 * @returns Sales orders ready for picking
 */
const listOpenSalesOrders = async () => {
  return listSalesOrders({ status: 'open' });
};

/**
 * Update sales order status to void
 *
 * @param salesOrderId - Zoho sales order ID
 */
const voidSalesOrder = async (salesOrderId: string) => {
  await zohoFetch(`/salesorders/${salesOrderId}/status/void`, {
    method: 'POST',
  });
};

/**
 * Mark sales order as open (confirmed)
 *
 * @param salesOrderId - Zoho sales order ID
 */
const markSalesOrderAsOpen = async (salesOrderId: string) => {
  await zohoFetch(`/salesorders/${salesOrderId}/status/open`, {
    method: 'POST',
  });
};

/**
 * Get sales orders modified after a specific time
 * Used for incremental sync
 *
 * @param sinceTime - ISO timestamp to fetch orders modified after
 * @returns Sales orders modified since the given time
 */
const getSalesOrdersModifiedSince = async (sinceTime: string) => {
  const allOrders: ZohoSalesOrder[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const { salesOrders, pageContext } = await listSalesOrders({
      lastModifiedTime: sinceTime,
      page,
      perPage: 100,
    });

    allOrders.push(...salesOrders);
    hasMore = pageContext.has_more_page;
    page++;
  }

  return allOrders;
};

export {
  getSalesOrder,
  getSalesOrdersModifiedSince,
  listOpenSalesOrders,
  listSalesOrders,
  markSalesOrderAsOpen,
  voidSalesOrder,
};
