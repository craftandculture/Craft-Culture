import { and, asc, eq, sql } from 'drizzle-orm';

import db from '@/database/client';
import { partners } from '@/database/schema';

/**
 * The partner an order is raised under, given the one it was raised for
 *
 * A Private Cellar member is a private collector, and C&C is the partner on
 * every one of their orders: C&C holds the account, invoices it and stands
 * behind it with the distributor. Raising the order under the member's own
 * record showed the member as their own partner on every order list, and
 * when a distributor was assigned the order waited for "partner
 * verification" — from the member, of themselves — because the auto-pass
 * only recognises C&C.
 *
 * Whose wine is moved on a member's delivery is read from the release
 * request, never from the order's partner, so picking and statements are
 * unaffected.
 *
 * C&C is found by name, the same rule distributor assignment uses, and only
 * the active record counts: a merged duplicate is retired as
 * "Craft & Culture (merged into …)" and must never be chosen.
 *
 * @example
 *   await resolveOrderPartnerId(ihabTomaCollectorId); // C&C's partner id
 *   await resolveOrderPartnerId(cruWineId); // cruWineId, unchanged
 *
 * @param partnerId - The partner chosen for the order
 * @returns The partner the order should be raised under
 */
const resolveOrderPartnerId = async (partnerId: string) => {
  const [chosen] = await db
    .select({ type: partners.type })
    .from(partners)
    .where(eq(partners.id, partnerId))
    .limit(1);

  if (chosen?.type !== 'private_collector') return partnerId;

  const [craftCulture] = await db
    .select({ id: partners.id })
    .from(partners)
    .where(
      and(
        sql`lower(trim(${partners.businessName})) = 'craft & culture'`,
        eq(partners.status, 'active'),
      ),
    )
    .orderBy(asc(partners.createdAt))
    .limit(1);

  // Without a C&C record the order still needs a partner; keep the one chosen
  return craftCulture?.id ?? partnerId;
};

export default resolveOrderPartnerId;
