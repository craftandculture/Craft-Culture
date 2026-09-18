/**
 * Zoho Books Bills API
 *
 * Create and manage bills (vendor invoices) in Zoho Books.
 * Used to create bills for consignment settlements - paying product owners.
 */

import { zohoFetch } from './client';
import type {
  ZohoBill,
  ZohoBillResponse,
  ZohoBillsListResponse,
  ZohoCreateBillRequest,
} from './types';

/**
 * Create a new bill in Zoho Books
 *
 * @param data - Bill creation data
 * @returns The created bill
 */
const createBill = async (data: ZohoCreateBillRequest) => {
  const response = await zohoFetch<ZohoBillResponse>('/bills', {
    method: 'POST',
    body: JSON.stringify(data),
  });

  return response.bill;
};

/**
 * Get a bill by ID
 *
 * @param billId - Zoho bill ID
 * @returns The bill details
 */
/**
 * List bills
 *
 * A bill is an owner invoicing us — for consigned wine that sold, or for wine
 * we bought outright. Which of the two it is cannot be told from the bill
 * alone, so the caller decides; booking a purchase as a settlement would
 * understate what an owner is still owed wine for.
 *
 * @param options - Vendor, status and paging
 * @returns The bills and the page context
 */
const listBills = async (options?: {
  vendorId?: string;
  status?: ZohoBill['status'];
  page?: number;
  perPage?: number;
}) => {
  const params = new URLSearchParams();

  if (options?.vendorId) params.set('vendor_id', options.vendorId);
  if (options?.status) params.set('status', options.status);
  if (options?.page) params.set('page', String(options.page));
  if (options?.perPage) params.set('per_page', String(options.perPage));

  const query = params.toString();
  const response = await zohoFetch<ZohoBillsListResponse>(
    query ? `/bills?${query}` : '/bills',
  );

  return {
    bills: response.bills ?? [],
    pageContext: response.page_context,
  };
};

const getBill = async (billId: string) => {
  const response = await zohoFetch<ZohoBillResponse>(`/bills/${billId}`);

  return response.bill;
};

/**
 * Update an existing bill
 *
 * @param billId - Zoho bill ID
 * @param data - Bill update data
 * @returns The updated bill
 */
const updateBill = async (
  billId: string,
  data: Partial<ZohoCreateBillRequest>,
) => {
  const response = await zohoFetch<ZohoBillResponse>(`/bills/${billId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });

  return response.bill;
};

/**
 * Mark a bill as open (ready for payment)
 *
 * @param billId - Zoho bill ID
 */
const markBillAsOpen = async (billId: string) => {
  await zohoFetch(`/bills/${billId}/status/open`, {
    method: 'POST',
  });
};

/**
 * Void a bill
 *
 * @param billId - Zoho bill ID
 */
const voidBill = async (billId: string) => {
  await zohoFetch(`/bills/${billId}/status/void`, {
    method: 'POST',
  });
};

export { createBill, getBill, listBills, markBillAsOpen, updateBill, voidBill };
