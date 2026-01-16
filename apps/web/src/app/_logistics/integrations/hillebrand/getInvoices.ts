import { hillebrandFetch } from './client';

interface HillebrandShipmentRef {
  id: number;
  shipmentReference?: string;
}

interface HillebrandInvoice {
  id: number;
  invoiceNumber: string;
  invoiceStatus: 'open' | 'paid' | 'overdue';
  invoiceDate: string;
  paymentDueDate?: string;
  currencyCode: string;
  totalAmount: number;
  openAmount: number;
  shipmentReferences?: HillebrandShipmentRef[];
}

interface InvoicesResponse {
  invoices: HillebrandInvoice[];
  total?: number;
  page?: number;
  pageSize?: number;
}

interface InvoiceLine {
  id: number;
  description?: string;
  quantity?: number;
  unitPrice?: number;
  amount?: number;
}

interface InvoiceLinesResponse {
  lines: InvoiceLine[];
}

interface GetInvoicesOptions {
  page?: number;
  pageSize?: number;
  status?: 'open' | 'paid' | 'overdue';
}

/**
 * Get invoices from Hillebrand API
 *
 * @example
 *   const invoices = await getHillebrandInvoices();
 *   console.log(invoices.length); // 13
 */
const getHillebrandInvoices = async (options: GetInvoicesOptions = {}) => {
  const { page = 1, pageSize = 50, status } = options;

  const params = new URLSearchParams({
    page: page.toString(),
    pageSize: pageSize.toString(),
  });

  if (status) {
    params.set('status', status);
  }

  const response = await hillebrandFetch<InvoicesResponse>(`/v1/invoices?${params.toString()}`);

  return response.invoices ?? [];
};

/**
 * Get a single invoice by ID
 */
const getHillebrandInvoice = async (invoiceId: number) => {
  return hillebrandFetch<HillebrandInvoice>(`/v1/invoices/${invoiceId}`);
};

/**
 * Get line items for an invoice
 */
const getHillebrandInvoiceLines = async (invoiceId: number) => {
  const response = await hillebrandFetch<InvoiceLinesResponse>(`/v1/invoices/${invoiceId}/lines`);
  return response.lines ?? [];
};

export { getHillebrandInvoice, getHillebrandInvoiceLines, getHillebrandInvoices };

export type { HillebrandInvoice };
