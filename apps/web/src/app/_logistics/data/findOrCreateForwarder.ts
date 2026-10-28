import { eq, sql } from 'drizzle-orm';

import db from '@/database/client';
import { logisticsForwarders } from '@/database/schema';
import logger from '@/utils/logger';

import forwarderEmailDomain from '../utils/forwarderEmailDomain';

/**
 * Find the forwarder a quote or contact belongs to, adding it if it is new
 *
 * Matched by its email domain first (anyone at hillebrand.com is Hillebrand),
 * then by name ignoring case. A forwarder that matches neither is added, so
 * the list builds itself from the quotes people save.
 *
 * An existing forwarder's contacts change only when a staff member typed the
 * address (`addedBy` is given) and it is at one of the forwarder's own email
 * domains, so nobody can slip an outside address onto a forwarder that then
 * receives every future price request. Other new addresses are left off and
 * logged; staff add them on the forwarder's page. A forwarder created here
 * takes the address and domain it was created with.
 *
 * @example
 *   await findOrCreateForwarder({ name: 'Hillebrand', email: 'anna@hillebrand.com' });
 *
 * @param input - The name as typed or read, and an email address if there is one
 * @returns The forwarder on file
 */
const findOrCreateForwarder = async (input: {
  name: string;
  email?: string | null;
  contactName?: string | null;
  /** The staff member who typed the address; without it no contact is added to an existing forwarder */
  addedBy?: string | null;
}) => {
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

  const existing = byName;
  const forwarder =
    existing ??
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

  // A forwarder that already existed only gains a contact a staff member typed, at a domain it already uses
  const isNew = !existing || (existing.contacts.length === 0 && existing.emailDomains.length === 0);
  const domainIsTheirs = !!domain && forwarder.emailDomains.includes(domain);
  const mayAdd = isNew || (!!input.addedBy && domainIsTheirs);

  if (!mayAdd) {
    logger.info('Forwarder contact not added: the address is not at one of its domains or was not typed by staff', {
      forwarderId: forwarder.id,
      forwarderName: forwarder.name,
      emailDomain: domain,
      addedBy: input.addedBy ?? null,
    });
    return forwarder;
  }

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

  logger.info('Forwarder contact added', {
    forwarderId: forwarder.id,
    forwarderName: forwarder.name,
    emailDomain: domain,
    addedBy: input.addedBy ?? null,
  });

  return updated ?? forwarder;
};

export default findOrCreateForwarder;
