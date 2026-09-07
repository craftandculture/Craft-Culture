import { z } from 'zod';

import { adminProcedure } from '@/lib/trpc/procedures';
import { isZohoConfigured } from '@/lib/zoho/client';
import { listCustomerContacts, searchContacts } from '@/lib/zoho/contacts';
import logger from '@/utils/logger';

/**
 * The customers an order can be raised for, for choosing rather than guessing
 *
 * The client used to be read off the purchase order and matched to Zoho by
 * name. That fails in both directions and neither is rare: a template that
 * labels the buyer differently from the last one is read as the wrong party
 * altogether, and a name that is right — "Craft & Culture Dubai" against Zoho's
 * "Craft and Culture FZE" — still does not match on letters.
 *
 * A name typed on a client's document is not an identifier. The contact id is,
 * so it is picked from what Zoho actually holds and passed straight through.
 *
 * @returns Customers matching the term, or the first page of them when blank
 */
const adminSearchZohoCustomers = adminProcedure
  .input(z.object({ term: z.string().default('') }))
  .query(async ({ input }) => {
    if (!isZohoConfigured()) return { configured: false, customers: [] };

    const term = input.term.trim();

    try {
      const contacts =
        term.length >= 2
          ? await searchContacts(term)
          : await listCustomerContacts();

      const customers = contacts
        .filter((contact) => contact.contact_id)
        /*
          Vendors are contacts too, and a search on a name finds them. An order
          raised for a freight forwarder is a plausible-looking mistake, so
          anything explicitly not a customer is dropped — while a contact that
          states no type is kept, since Zoho leaves it off older records.
        */
        .filter((contact) => contact.contact_type !== 'vendor')
        .map((contact) => ({
          contactId: contact.contact_id,
          contactName: contact.contact_name,
          companyName: contact.company_name ?? null,
          currencyCode: contact.currency_code ?? null,
        }))
        .sort((a, b) => a.contactName.localeCompare(b.contactName));

      return { configured: true, customers };
    } catch (error) {
      logger.error('Could not read customers from Zoho', { error, term });

      return { configured: true, customers: [] };
    }
  });

export default adminSearchZohoCustomers;
