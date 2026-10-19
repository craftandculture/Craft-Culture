import { eq } from 'drizzle-orm';

import db from '@/database/client';
import { partners } from '@/database/schema';

/**
 * The Zoho Books customer a member is billed as, or null if not linked yet
 *
 * Read from the partner row and nowhere else. Never matched by name: two
 * collectors called the same thing, or a duplicate customer in Zoho, would put
 * one member's invoices in front of another.
 *
 * @param partnerId - The member's partner id
 * @returns The Zoho contact id, or null
 */
const getMemberZohoCustomer = async (partnerId: string) => {
  const [row] = await db
    .select({ zohoContactId: partners.zohoContactId })
    .from(partners)
    .where(eq(partners.id, partnerId))
    .limit(1);

  return row?.zohoContactId ?? null;
};

export default getMemberZohoCustomer;
