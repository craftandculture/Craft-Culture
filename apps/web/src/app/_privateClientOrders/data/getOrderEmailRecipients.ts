import { and, asc, desc, eq, gte, isNotNull } from 'drizzle-orm';

import db from '@/database/client';
import { partnerContacts, partners, privateClientOrderActivityLogs } from '@/database/schema';

import getPartnerUsers from './getPartnerUsers';
import contactDepartment from '../utils/contactDepartment';
import type { OrderEmailDepartment } from '../utils/orderEmailDepartments';

/** How far back a distributor's recent order work counts, for a new order */
const RECENT_DAYS = 60;

/** At most this many people at a distributor hear about a new order */
const RECENT_PEOPLE = 3;

/**
 * The people at a partner or distributor who receive an order's emails
 *
 * Never everyone on the account. City Drinks has more than a dozen logins,
 * and one new order went to all of them.
 *
 * A wine partner: its business address and the person on the account who
 * placed the order.
 *
 * A distributor: its business address and the people there who have worked
 * this order. On an order nobody there has touched yet, the few who worked
 * the distributor's orders most recently.
 *
 * With nobody found, the account's owner. Anyone who has left the account
 * hears nothing more.
 *
 * A distributor that lists Purchasing or Finance contacts (Partners > Contacts,
 * by role) has each email sent to the team it is meant for, and only to them:
 * City Drinks asked that client verification go to Purchasing and payment
 * collection to Finance. A team with no contacts listed falls back to the above.
 *
 * @param partnerId - The wine partner or distributor
 * @param orderId - The order
 * @param audience - Which side they are on
 * @param departments - For a distributor, the teams the email is meant for
 * @returns Addresses with the name to greet
 */
const getOrderEmailRecipients = async (
  partnerId: string,
  orderId: string,
  audience: 'partner' | 'distributor' = 'partner',
  departments: OrderEmailDepartment[] = [],
) => {
  if (audience === 'distributor' && departments.length) {
    const contacts = await db
      .select({ name: partnerContacts.name, email: partnerContacts.email, role: partnerContacts.role })
      .from(partnerContacts)
      .where(eq(partnerContacts.partnerId, partnerId));

    const routed = new Map<string, { email: string; name: string }>();
    for (const contact of contacts) {
      const team = contactDepartment(contact.role);
      const key = contact.email?.trim().toLowerCase();
      if (!team || !departments.includes(team) || !key || routed.has(key)) continue;
      routed.set(key, { email: contact.email.trim(), name: contact.name.trim() });
    }

    if (routed.size) return [...routed.values()];
  }

  const since = new Date(Date.now() - RECENT_DAYS * 24 * 60 * 60 * 1000);
  const actedBy = and(
    eq(privateClientOrderActivityLogs.partnerId, partnerId),
    isNotNull(privateClientOrderActivityLogs.userId),
  );

  const [people, [business], onOrder, recent] = await Promise.all([
    getPartnerUsers(partnerId),
    db
      .select({ name: partners.businessName, email: partners.businessEmail, ownerId: partners.userId })
      .from(partners)
      .where(eq(partners.id, partnerId))
      .limit(1),
    db
      .select({ userId: privateClientOrderActivityLogs.userId })
      .from(privateClientOrderActivityLogs)
      .where(and(eq(privateClientOrderActivityLogs.orderId, orderId), actedBy))
      .orderBy(asc(privateClientOrderActivityLogs.createdAt)),
    audience === 'distributor'
      ? db
          .select({ userId: privateClientOrderActivityLogs.userId })
          .from(privateClientOrderActivityLogs)
          .where(and(actedBy, gte(privateClientOrderActivityLogs.createdAt, since)))
          .orderBy(desc(privateClientOrderActivityLogs.createdAt))
          .limit(200)
      : [],
  ]);

  const onAccount = (ids: (string | null)[]) => {
    const wanted = [...new Set(ids.filter((id): id is string => Boolean(id)))];
    return wanted.flatMap((id) => people.filter((person) => person.id === id).slice(0, 1));
  };

  // A partner: who placed it. A distributor: who worked it, else who works its orders
  const chosen =
    audience === 'partner'
      ? onAccount(onOrder.slice(0, 1).map((row) => row.userId))
      : onOrder.length
        ? onAccount(onOrder.map((row) => row.userId))
        : onAccount(recent.map((row) => row.userId)).slice(0, RECENT_PEOPLE);

  const byEmail = new Map<string, { email: string; name: string }>();
  const add = (email: string | null | undefined, name: string) => {
    const key = email?.trim().toLowerCase();
    // Names are stored as typed: "Jude " greeted City Drinks as "Dear Jude ,"
    if (key && !byEmail.has(key)) byEmail.set(key, { email: email!.trim(), name: name.trim() });
  };

  for (const person of chosen) add(person.email, person.name?.trim() || business?.name || '');
  add(business?.email, business?.name ?? '');

  if (byEmail.size === 0) {
    const owner = people.find((person) => person.id === business?.ownerId);
    add(owner?.email, owner?.name?.trim() || business?.name || '');
  }

  return [...byEmail.values()];
};

export default getOrderEmailRecipients;
