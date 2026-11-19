import { eq } from 'drizzle-orm';

import contactDepartment from '@/app/_privateClientOrders/utils/contactDepartment';
import db from '@/database/client';
import { partnerContacts, partners } from '@/database/schema';

import isLogisticsRole from '../utils/isLogisticsRole';

/**
 * Who at a distributor receives warehouse updates
 *
 * Their Logistics (Warehouse, Receiving) contacts; with none listed, their
 * Purchasing contacts, who set up the orders; with none, the business email.
 * Finance never receives them.
 *
 * @param partnerId - The distributor
 * @returns Addresses with the name to greet, at most once each
 */
const getWarehouseUpdateRecipients = async (partnerId: string) => {
  const contacts = await db
    .select({ name: partnerContacts.name, email: partnerContacts.email, role: partnerContacts.role })
    .from(partnerContacts)
    .where(eq(partnerContacts.partnerId, partnerId));

  const unique = (list: typeof contacts) => {
    const byEmail = new Map<string, { email: string; name: string }>();
    for (const contact of list) {
      const key = contact.email?.trim().toLowerCase();
      if (key && !byEmail.has(key)) byEmail.set(key, { email: contact.email.trim(), name: contact.name.trim() });
    }
    return [...byEmail.values()];
  };

  const logistics = unique(contacts.filter((contact) => isLogisticsRole(contact.role)));
  if (logistics.length) return logistics;

  const purchasing = unique(contacts.filter((contact) => contactDepartment(contact.role) === 'purchasing'));
  if (purchasing.length) return purchasing;

  const [business] = await db
    .select({ name: partners.businessName, email: partners.businessEmail })
    .from(partners)
    .where(eq(partners.id, partnerId))
    .limit(1);
  return business?.email?.trim() ? [{ email: business.email.trim(), name: business.name.trim() }] : [];
};

export default getWarehouseUpdateRecipients;
