import { and, eq, isNull } from 'drizzle-orm';

import db from '@/database/client';
import { privateClientContacts } from '@/database/schema';

/**
 * Ensure a client contact is marked as City Drinks verified
 *
 * Called when an order reaches "delivered" status. If the linked client
 * contact does not yet have a `cityDrinksVerifiedAt` timestamp, this sets
 * it to now. Idempotent — does nothing if already verified or if no
 * clientId is provided.
 *
 * @param clientId - The client contact ID from the order (may be null)
 */
const ensureClientVerified = async (clientId: string | null | undefined) => {
  if (!clientId) return;

  await db
    .update(privateClientContacts)
    .set({ cityDrinksVerifiedAt: new Date() })
    .where(
      and(
        eq(privateClientContacts.id, clientId),
        isNull(privateClientContacts.cityDrinksVerifiedAt),
      ),
    );
};

export default ensureClientVerified;
