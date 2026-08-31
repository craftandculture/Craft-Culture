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


export interface CreateSalesOrderLine {
  item_id: string;
  /** Cases, or bottles where the wine is sold loose */
  quantity: number;
  /** Price for one of whatever `quantity` counts */
  rate: number;
  description?: string;
}

export interface CreateSalesOrderInput {
  customer_id: string;
  /** The client's own PO number, so their paperwork and ours agree */
  reference_number?: string;
  date?: string;
  shipment_date?: string;
  line_items: CreateSalesOrderLine[];
  notes?: string;
  terms?: string;
  /** Zoho's own SO number; omit to let Zoho allocate one */
  salesorder_number?: string;
}

/**
 * Create a sales order in Zoho, as a draft
 *
 * Deliberately a draft. This is built from a client's PDF — a parse, a set of
 * catalogue matches and a price comparison — and every one of those is a
 * judgement that can be wrong. A draft is a thing someone opens and confirms;
 * an open order is a commitment made by a machine reading a PDF.
 *
 * The client's own PO number goes on as the reference so their paperwork and
 * ours can be reconciled without anyone remembering which is which.
 *
 * @param input - Customer, lines and the order's own references
 * @returns The created sales order
 */
const createSalesOrder = async (input: CreateSalesOrderInput) => {
  const response = await zohoFetch<ZohoSalesOrderResponse>('/salesorders', {
    method: 'POST',
    body: JSON.stringify(input),
  });

  return response.salesorder;
};

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
 * List all sales orders with a given status, paginating through all pages
 *
 * @param status - Zoho sales order status to filter by
 * @returns All sales orders matching the status
 */
const listAllSalesOrdersByStatus = async (status: ZohoSalesOrder['status']) => {
  const allOrders: ZohoSalesOrder[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const { salesOrders, pageContext } = await listSalesOrders({
      status,
      page,
      perPage: 200,
    });

    allOrders.push(...salesOrders);
    hasMore = pageContext.has_more_page;
    page++;

    // Safety limit to prevent infinite loops
    if (page > 50) {
      break;
    }
  }

  return allOrders;
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
  createSalesOrder,
  getSalesOrder,
  getSalesOrdersModifiedSince,
  listAllSalesOrdersByStatus,
  listOpenSalesOrders,
  listSalesOrders,
  markSalesOrderAsOpen,
  voidSalesOrder,
};
