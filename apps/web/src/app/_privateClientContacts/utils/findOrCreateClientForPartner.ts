import { and, eq, sql } from 'drizzle-orm';

import db from '@/database/client';
import { privateClientContacts } from '@/database/schema';

export interface ClientDetails {
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
}

/**
 * Get the partner's client record for these details, creating it if needed.
 *
 * Orders could be raised by typing the client's details straight onto them, and
 * nothing kept the client afterwards — so the same person was retyped every
 * time, and the order had no record to correct, mark verified, or count as a
 * relationship. Over half the orders on file are in that state.
 *
 * Matching is on trimmed, case-insensitive name **within the partner**, which
 * is the scope their client list is presented in. Names are not matched across
 * partners: two partners may each hold a client of the same name, and they are
 * not the same relationship.
 *
 * Details are only used when creating. An existing record is never overwritten
 * from an order — the record is the better source, and a half-filled order form
 * would otherwise blank a phone number somebody had carefully corrected.
 *
 * @param partnerId - The partner who owns the client relationship
 * @param details - The client as the order states them
 * @returns The client's id and whether this call created it
 */
const findOrCreateClientForPartner = async (
  partnerId: string,
  details: ClientDetails,
) => {
  const name = details.name.trim();
  if (!name) return null;

  const [existing] = await db
    .select({ id: privateClientContacts.id })
    .from(privateClientContacts)
    .where(
      and(
        eq(privateClientContacts.partnerId, partnerId),
        sql`LOWER(TRIM(${privateClientContacts.name})) = LOWER(${name})`,
      ),
    )
    .limit(1);

  if (existing) return { clientId: existing.id, created: false };

  const [inserted] = await db
    .insert(privateClientContacts)
    .values({
      partnerId,
      name,
      email: details.email || null,
      phone: details.phone || null,
      // An order holds one address line; it is kept whole rather than guessed
      // apart into city, postcode and country.
      addressLine1: details.address || null,
    })
    .returning({ id: privateClientContacts.id });

  return inserted ? { clientId: inserted.id, created: true } : null;
};

export default findOrCreateClientForPartner;
