import { desc, sql } from 'drizzle-orm';

import db from '@/database/client';
import { exportConsigneeProfiles, zohoInvoices } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

/**
 * Customers an export invoice can be made for
 *
 * Every customer invoiced in the last six months, with those that already have
 * an export profile first. One document goes to one consignee, so this is the
 * first choice made.
 */
const adminListConsignees = adminProcedure.query(async () => {
  const [customers, profiles] = await Promise.all([
    db
      .select({
        zohoCustomerId: zohoInvoices.zohoCustomerId,
        customerName: sql<string>`max(${zohoInvoices.customerName})`,
        lastInvoiceDate: sql<string>`max(${zohoInvoices.invoiceDate})`,
      })
      .from(zohoInvoices)
      .where(sql`${zohoInvoices.invoiceDate} > now() - interval '180 days'`)
      .groupBy(zohoInvoices.zohoCustomerId)
      .orderBy(desc(sql`max(${zohoInvoices.invoiceDate})`)),
    db.select().from(exportConsigneeProfiles),
  ]);

  const profileIds = new Set(profiles.map((p) => p.zohoCustomerId));
  return customers
    .map((c) => ({
      ...c,
      hasProfile: profileIds.has(c.zohoCustomerId),
      displayName:
        profiles.find((p) => p.zohoCustomerId === c.zohoCustomerId)?.displayName ?? c.customerName,
    }))
    .sort((a, b) => Number(b.hasProfile) - Number(a.hasProfile));
});

export default adminListConsignees;
