/**
 * Zoho Books Bills API
 *
 * Create and manage bills (vendor invoices) in Zoho Books.
 * Used to create bills for consignment settlements - paying product owners.
 */

import { zohoFetch } from './client';
import type { ZohoBillResponse, ZohoCreateBillRequest } from './types';

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

export { createBill, getBill, markBillAsOpen, updateBill, voidBill };
