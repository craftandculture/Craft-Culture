/**
 * Zoho Books Invoices API
 *
 * Create and manage invoices in Zoho Books.
 * Used to create invoices when orders are confirmed and track payment status.
 */

import { zohoFetch } from './client';
import type {
  ZohoCreateInvoiceRequest,
  ZohoInvoice,
  ZohoInvoiceResponse,
  ZohoInvoicesListResponse,
} from './types';

/**
 * Create a new invoice in Zoho Books
 *
 * @param data - Invoice creation data
 * @returns The created invoice
 */
const createInvoice = async (data: ZohoCreateInvoiceRequest) => {
  const response = await zohoFetch<ZohoInvoiceResponse>('/invoices', {
    method: 'POST',
    body: JSON.stringify(data),
  });

  return response.invoice;
};

/**
 * Get an invoice by ID
 *
 * @param invoiceId - Zoho invoice ID
 * @returns The invoice details
 */
const getInvoice = async (invoiceId: string) => {
  const response = await zohoFetch<ZohoInvoiceResponse>(
    `/invoices/${invoiceId}`,
  );

  return response.invoice;
};

/**
 * Update an existing invoice
 *
 * @param invoiceId - Zoho invoice ID
 * @param data - Invoice update data
 * @returns The updated invoice
 */
const updateInvoice = async (
  invoiceId: string,
  data: Partial<ZohoCreateInvoiceRequest>,
) => {
  const response = await zohoFetch<ZohoInvoiceResponse>(
    `/invoices/${invoiceId}`,
    {
      method: 'PUT',
      body: JSON.stringify(data),
    },
  );

  return response.invoice;
};

/**
 * List invoices with optional filters
 *
 * @param options - Filter options
 * @returns List of invoices
 */
const listInvoices = async (options?: {
  customerId?: string;
  status?: ZohoInvoice['status'];
  referenceNumber?: string;
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
  if (options?.referenceNumber) {
    params.set('reference_number', options.referenceNumber);
  }
  if (options?.page) {
    params.set('page', String(options.page));
  }
  if (options?.perPage) {
    params.set('per_page', String(options.perPage));
  }

  const query = params.toString();
  const endpoint = query ? `/invoices?${query}` : '/invoices';

  const response = await zohoFetch<ZohoInvoicesListResponse>(endpoint);

  return {
    invoices: response.invoices,
    pageContext: response.page_context,
  };
};

/**
 * Mark an invoice as sent
 *
 * @param invoiceId - Zoho invoice ID
 */
const markInvoiceAsSent = async (invoiceId: string) => {
  await zohoFetch(`/invoices/${invoiceId}/status/sent`, {
    method: 'POST',
  });
};

/**
 * Void an invoice
 *
 * @param invoiceId - Zoho invoice ID
 */
const voidInvoice = async (invoiceId: string) => {
  await zohoFetch(`/invoices/${invoiceId}/status/void`, {
    method: 'POST',
  });
};

/**
 * Get invoices that need payment status sync
 *
 * @param invoiceIds - List of Zoho invoice IDs to check
 * @returns Map of invoice ID to current status
 */
const getInvoiceStatuses = async (invoiceIds: string[]) => {
  const statuses = new Map<string, ZohoInvoice['status']>();

  // Fetch each invoice to get current status
  // Note: Zoho doesn't have a bulk get endpoint, so we fetch individually
  await Promise.all(
    invoiceIds.map(async (id) => {
      try {
        const invoice = await getInvoice(id);
        statuses.set(id, invoice.status);
      } catch (error) {
        // Log but don't fail the whole batch
        console.error(`Failed to get invoice ${id}:`, error);
      }
    }),
  );

  return statuses;
};

export {
  createInvoice,
  getInvoice,
  getInvoiceStatuses,
  listInvoices,
  markInvoiceAsSent,
  updateInvoice,
  voidInvoice,
};
