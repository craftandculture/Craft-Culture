/**
 * Zoho Books Integration
 *
 * Provides API client and operations for Zoho Books accounting integration.
 *
 * @example
 *   import { zoho } from '@/lib/zoho';
 *
 *   // Create a customer contact
 *   const contact = await zoho.contacts.createContact({
 *     contact_name: 'Acme Corp',
 *     email: 'billing@acme.com',
 *     contact_type: 'customer',
 *   });
 *
 *   // Create an invoice
 *   const invoice = await zoho.invoices.createInvoice({
 *     customer_id: contact.contact_id,
 *     line_items: [{ name: 'Wine Case', rate: 100, quantity: 10 }],
 *   });
 */

export { isZohoConfigured, zohoFetch } from './client';

export * as bills from './bills';
export * as contacts from './contacts';
export * as invoices from './invoices';
export * as salesOrders from './salesOrders';

export type * from './types';
