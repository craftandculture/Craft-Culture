import { desc, sql } from 'drizzle-orm';

import db from '@/database/client';
import { exportConsigneeProfiles, zohoInvoices } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';
import { isZohoConfigured } from '@/lib/zoho/client';
import { listCustomerContacts } from '@/lib/zoho/contacts';
import logger from '@/utils/logger';

/**
 * Customers an export invoice can be made for
 *
 * Every customer invoiced in the last six months comes first — those with an
 * export profile at the top — then every other customer Zoho holds, so a new
 * consignee can be chosen before their first shipment rather than only after
 * it. One document goes to one consignee, so this is the first choice made.
 *
 * Zoho is read live for the rest; if it cannot be reached the recent
 * customers are still returned, since they are the ones nearly always wanted.
 */
const adminListConsignees = adminProcedure.query(async () => {
  const [customers, profiles, contacts] = await Promise.all([
    db
      .select({
        zohoCustomerId: zohoInvoices.zohoCustomerId,
        customerName: sql<string>`max(${zohoInvoices.customerName})`,
        lastInvoiceDate: sql<string | null>`max(${zohoInvoices.invoiceDate})`,
      })
      .from(zohoInvoices)
      .where(sql`${zohoInvoices.invoiceDate} > now() - interval '180 days'`)
      .groupBy(zohoInvoices.zohoCustomerId)
      .orderBy(desc(sql`max(${zohoInvoices.invoiceDate})`)),
    db.select().from(exportConsigneeProfiles),
    isZohoConfigured()
      ? listCustomerContacts().catch((error: unknown) => {
          logger.error('Could not list Zoho customers for export consignees', {
            error,
          });
          return [];
        })
      : Promise.resolve([]),
  ]);

  const profileIds = new Set(profiles.map((p) => p.zohoCustomerId));
  const displayNameOf = (id: string, fallback: string) =>
    profiles.find((p) => p.zohoCustomerId === id)?.displayName ?? fallback;

  const recent = customers
    .map((c) => ({
      ...c,
      hasProfile: profileIds.has(c.zohoCustomerId),
      recentlyInvoiced: true,
      displayName: displayNameOf(c.zohoCustomerId, c.customerName),
    }))
    .sort((a, b) => Number(b.hasProfile) - Number(a.hasProfile));

  const seen = new Set(recent.map((c) => c.zohoCustomerId));

  const others = contacts
    .filter((contact) => contact.contact_id && !seen.has(contact.contact_id))
    .filter((contact) => contact.contact_type !== 'vendor')
    .map((contact) => ({
      zohoCustomerId: contact.contact_id,
      customerName: contact.contact_name,
      lastInvoiceDate: null,
      hasProfile: profileIds.has(contact.contact_id),
      recentlyInvoiced: false,
      displayName: displayNameOf(contact.contact_id, contact.contact_name),
    }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));

  return [...recent, ...others];
});

export default adminListConsignees;
