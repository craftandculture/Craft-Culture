/**
 * Zoho Books API Types
 *
 * @see https://www.zoho.com/books/api/v3/
 */

/**
 * OAuth token response from Zoho
 */
export interface ZohoTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  api_domain: string;
}

/**
 * Standard Zoho API response wrapper
 */
export interface ZohoApiResponse<T> {
  code: number;
  message: string;
  data?: T;
}

/**
 * Zoho contact address
 */
export interface ZohoAddress {
  attention?: string;
  address?: string;
  street2?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  phone?: string;
  fax?: string;
}

/**
 * Zoho contact (customer/vendor)
 */
export interface ZohoContact {
  contact_id: string;
  contact_name: string;
  company_name?: string;
  contact_type: 'customer' | 'vendor';
  status: 'active' | 'inactive';
  email?: string;
  phone?: string;
  billing_address?: ZohoAddress;
  shipping_address?: ZohoAddress;
  currency_code?: string;
  outstanding_receivable_amount?: number;
  outstanding_payable_amount?: number;
  created_time?: string;
  last_modified_time?: string;
}

/**
 * Create contact request
 */
export interface ZohoCreateContactRequest {
  contact_name: string;
  company_name?: string;
  contact_type?: 'customer' | 'vendor';
  email?: string;
  phone?: string;
  billing_address?: ZohoAddress;
  shipping_address?: ZohoAddress;
  currency_code?: string;
  notes?: string;
}

/**
 * Contact response
 */
export interface ZohoContactResponse {
  code: number;
  message: string;
  contact: ZohoContact;
}

/**
 * Invoice line item
 */
export interface ZohoLineItem {
  item_id?: string;
  name: string;
  description?: string;
  rate: number;
  quantity: number;
  unit?: string;
  discount?: number;
  tax_id?: string;
  item_total?: number;
}

/**
 * Zoho invoice
 */
export interface ZohoInvoice {
  invoice_id: string;
  invoice_number: string;
  customer_id: string;
  customer_name: string;
  status:
    | 'draft'
    | 'sent'
    | 'viewed'
    | 'overdue'
    | 'paid'
    | 'partially_paid'
    | 'void';
  date: string;
  due_date: string;
  reference_number?: string;
  line_items: ZohoLineItem[];
  sub_total: number;
  total: number;
  balance: number;
  currency_code: string;
  notes?: string;
  terms?: string;
  created_time?: string;
  last_modified_time?: string;
}

/**
 * Create invoice request
 */
export interface ZohoCreateInvoiceRequest {
  customer_id: string;
  invoice_number?: string;
  reference_number?: string;
  date?: string;
  due_date?: string;
  line_items: ZohoLineItem[];
  notes?: string;
  terms?: string;
  discount?: number;
  is_discount_before_tax?: boolean;
}

/**
 * Invoice response
 */
export interface ZohoInvoiceResponse {
  code: number;
  message: string;
  invoice: ZohoInvoice;
}

/**
 * List invoices response
 */
export interface ZohoInvoicesListResponse {
  code: number;
  message: string;
  invoices: ZohoInvoice[];
  page_context: {
    page: number;
    per_page: number;
    has_more_page: boolean;
    total: number;
  };
}

/**
 * Zoho bill (vendor invoice)
 */
export interface ZohoBill {
  bill_id: string;
  bill_number: string;
  vendor_id: string;
  vendor_name: string;
  status: 'draft' | 'open' | 'overdue' | 'paid' | 'partially_paid' | 'void';
  date: string;
  due_date: string;
  reference_number?: string;
  line_items: ZohoLineItem[];
  sub_total: number;
  total: number;
  balance: number;
  currency_code: string;
  notes?: string;
  created_time?: string;
  last_modified_time?: string;
}

/**
 * Create bill request
 */
export interface ZohoCreateBillRequest {
  vendor_id: string;
  bill_number?: string;
  reference_number?: string;
  date?: string;
  due_date?: string;
  line_items: ZohoLineItem[];
  notes?: string;
}

/**
 * Bill response
 */
export interface ZohoBillResponse {
  code: number;
  message: string;
  bill: ZohoBill;
}
