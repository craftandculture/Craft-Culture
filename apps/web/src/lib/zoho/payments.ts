/**
 * Zoho Books Payments API
 *
 * Read the payments recorded in Zoho: money received from customers against
 * invoices, and money paid to vendors against bills. Read-only.
 */

import { zohoFetch } from './client';

/** A customer payment as Zoho's list returns it */
export interface ZohoCustomerPayment {
  payment_id: string;
  payment_number?: string;
  customer_name?: string;
  date?: string;
  amount?: number;
  currency_code?: string;
  reference_number?: string;
  payment_mode?: string;
  invoice_numbers?: string;
  account_name?: string;
  created_time?: string;
}

/** A vendor payment as Zoho's list returns it */
export interface ZohoVendorPayment {
  payment_id: string;
  payment_number?: string;
  vendor_name?: string;
  date?: string;
  amount?: number;
  currency_code?: string;
  reference_number?: string;
  payment_mode?: string;
  bill_numbers?: string;
  paid_through_account_name?: string;
  created_time?: string;
}

/**
 * The most recently recorded customer payments, newest first
 *
 * Sorted on payment date, which both Zoho lists accept. A payment entered
 * late still falls well inside the 200 most recent unless it is backdated by
 * months.
 *
 * @param perPage - How many to return (Zoho allows up to 200)
 */
const listRecentCustomerPayments = async (perPage = 200) => {
  const response = await zohoFetch<{ customerpayments?: ZohoCustomerPayment[] }>(
    `/customerpayments?sort_column=date&sort_order=D&per_page=${perPage}`,
  );

  return response.customerpayments ?? [];
};

/**
 * The most recently recorded vendor payments, newest first
 *
 * @param perPage - How many to return (Zoho allows up to 200)
 */
const listRecentVendorPayments = async (perPage = 200) => {
  const response = await zohoFetch<{ vendorpayments?: ZohoVendorPayment[] }>(
    `/vendorpayments?sort_column=date&sort_order=D&per_page=${perPage}`,
  );

  return response.vendorpayments ?? [];
};

export { listRecentCustomerPayments, listRecentVendorPayments };
