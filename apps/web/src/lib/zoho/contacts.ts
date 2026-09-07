/**
 * Zoho Books Contacts API
 *
 * Create and manage contacts (customers and vendors) in Zoho Books.
 * Partners are synced as customers for invoicing and vendors for bill payments.
 */

import { zohoFetch } from './client';
import type {
  ZohoContact,
  ZohoContactResponse,
  ZohoCreateContactRequest,
} from './types';

/**
 * Create a new contact in Zoho Books
 *
 * @param data - Contact creation data
 * @returns The created contact
 */
const createContact = async (data: ZohoCreateContactRequest) => {
  const response = await zohoFetch<ZohoContactResponse>('/contacts', {
    method: 'POST',
    body: JSON.stringify(data),
  });

  return response.contact;
};

/**
 * Get a contact by ID
 *
 * @param contactId - Zoho contact ID
 * @returns The contact details
 */
const getContact = async (contactId: string) => {
  const response = await zohoFetch<ZohoContactResponse>(
    `/contacts/${contactId}`,
  );

  return response.contact;
};

/**
 * Update an existing contact
 *
 * @param contactId - Zoho contact ID
 * @param data - Contact update data
 * @returns The updated contact
 */
const updateContact = async (
  contactId: string,
  data: Partial<ZohoCreateContactRequest>,
) => {
  const response = await zohoFetch<ZohoContactResponse>(
    `/contacts/${contactId}`,
    {
      method: 'PUT',
      body: JSON.stringify(data),
    },
  );

  return response.contact;
};

/**
 * Search contacts by email or name
 *
 * @param searchTerm - Email or company name to search
 * @returns List of matching contacts
 */
const searchContacts = async (searchTerm: string) => {
  const response = await zohoFetch<{
    code: number;
    message: string;
    contacts: ZohoContact[];
  }>(`/contacts?search_text=${encodeURIComponent(searchTerm)}`);

  return response.contacts;
};

/**
 * List the customers Zoho holds
 *
 * `searchContacts` needs something to search on, which is no use to a picker
 * that has to show its options before anyone has typed. This asks for
 * customers only — vendors and the freight forwarders among them are not who
 * an order is raised for.
 *
 * @param limit - How many to take, newest first as Zoho orders them
 * @returns The customer contacts
 */
const listCustomerContacts = async (limit = 200) => {
  const response = await zohoFetch<{
    code: number;
    message: string;
    contacts: ZohoContact[];
  }>(`/contacts?contact_type=customer&per_page=${Math.min(limit, 200)}`);

  return response.contacts;
};

/**
 * Create or update a contact based on email match
 *
 * @param data - Contact data
 * @returns The created or updated contact
 */
const upsertContactByEmail = async (data: ZohoCreateContactRequest) => {
  if (!data.email) {
    return createContact(data);
  }

  // Search for existing contact
  const existing = await searchContacts(data.email);
  const match = existing.find((c) => c.email === data.email);

  if (match) {
    return updateContact(match.contact_id, data);
  }

  return createContact(data);
};

export {
  createContact,
  getContact,
  listCustomerContacts,
  searchContacts,
  updateContact,
  upsertContactByEmail,
};
