import { eq, sql } from 'drizzle-orm';

import db from '@/database/client';
import { logisticsForwarders } from '@/database/schema';

import forwarderEmailDomain from '../utils/forwarderEmailDomain';

/**
 * Find the forwarder a quote or contact belongs to, adding it if it is new
 *
 * Matched by its email domain first (anyone at hillebrand.com is Hillebrand),
 * then by name ignoring case. A forwarder that matches neither is added, so
 * the list builds itself from the quotes people save. A new email address is
 * added to the forwarder's contacts, and its domain to its domains.
 *
 * @example
 *   await findOrCreateForwarder({ name: 'Hillebrand', email: 'anna@hillebrand.com' });
 *
 * @param input - The name as typed or read, and an email address if there is one
 * @returns The forwarder on file
 */
const findOrCreateForwarder = async (input: { name: string; email?: string | null; contactName?: string | null }) => {
  const name = input.name.trim();
  const email = input.email?.trim().toLowerCase() || null;
  const domain = forwarderEmailDomain(email);

  const [byDomain] = domain
    ? await db
        .select()
        .from(logisticsForwarders)
        .where(sql`${domain} = ANY(${logisticsForwarders.emailDomains})`)
        .limit(1)
    : [];
  const [byName] = byDomain
    ? [byDomain]
    : await db
        .select()
        .from(logisticsForwarders)
        .where(sql`lower(${logisticsForwarders.name}) = lower(${name})`)
        .limit(1);

  const forwarder =
    byName ??
    (
      await db
        .insert(logisticsForwarders)
        .values({ name })
        .onConflictDoUpdate({ target: logisticsForwarders.name, set: { updatedAt: new Date() } })
        .returning()
    )[0];

  if (!forwarder) {
    throw new Error(`Could not add forwarder ${name}`);
  }

  const knowsEmail = !email || forwarder.contacts.some((c) => c.email.toLowerCase() === email);
  const knowsDomain = !domain || forwarder.emailDomains.includes(domain);

  if (knowsEmail && knowsDomain) return forwarder;

  const [updated] = await db
    .update(logisticsForwarders)
    .set({
      contacts: knowsEmail
        ? forwarder.contacts
        : [...forwarder.contacts, { email: email!, ...(input.contactName ? { name: input.contactName } : {}) }],
      emailDomains: knowsDomain ? forwarder.emailDomains : [...forwarder.emailDomains, domain!],
      updatedAt: new Date(),
    })
    .where(eq(logisticsForwarders.id, forwarder.id))
    .returning();

  return updated ?? forwarder;
};

export default findOrCreateForwarder;
