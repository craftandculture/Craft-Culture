import { and, asc, eq, isNotNull } from 'drizzle-orm';

import db from '@/database/client';
import { partners, privateClientOrderActivityLogs } from '@/database/schema';

import getPartnerUsers from './getPartnerUsers';

/**
 * The people at a partner or distributor who receive an order's emails
 *
 * A distributor: its users and its business address, each address once.
 *
 * A wine partner, given the order: its business address and the person on
 * the account who placed the order, not everyone on the account. With
 * neither, the account's owner.
 *
 * @param partnerId - The wine partner or distributor
 * @param orderId - The order, for a wine partner
 * @returns Addresses with the name to greet
 */
const getOrderEmailRecipients = async (partnerId: string, orderId?: string) => {
  const [people, [business], [placedBy]] = await Promise.all([
    getPartnerUsers(partnerId),
    db
      .select({ name: partners.businessName, email: partners.businessEmail, ownerId: partners.userId })
      .from(partners)
      .where(eq(partners.id, partnerId))
      .limit(1),
    orderId
      ? db
          .select({ userId: privateClientOrderActivityLogs.userId })
          .from(privateClientOrderActivityLogs)
          .where(
            and(
              eq(privateClientOrderActivityLogs.orderId, orderId),
              eq(privateClientOrderActivityLogs.partnerId, partnerId),
              isNotNull(privateClientOrderActivityLogs.userId),
            ),
          )
          .orderBy(asc(privateClientOrderActivityLogs.createdAt))
          .limit(1)
      : [],
  ]);

  // Still on the account: someone who has left it hears nothing more
  const chosen = orderId ? people.filter((person) => person.id === placedBy?.userId) : people;

  const byEmail = new Map<string, { email: string; name: string }>();
  const add = (email: string | null | undefined, name: string) => {
    const key = email?.trim().toLowerCase();
    if (key && !byEmail.has(key)) byEmail.set(key, { email: email!.trim(), name });
  };

  for (const person of chosen) add(person.email, person.name || business?.name || '');
  add(business?.email, business?.name ?? '');

  if (byEmail.size === 0 && orderId) {
    const owner = people.find((person) => person.id === business?.ownerId);
    add(owner?.email, owner?.name || business?.name || '');
  }

  return [...byEmail.values()];
};

export default getOrderEmailRecipients;
