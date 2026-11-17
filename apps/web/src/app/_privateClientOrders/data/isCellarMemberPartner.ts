import { eq } from 'drizzle-orm';

import db from '@/database/client';
import { partners } from '@/database/schema';

/**
 * Whether an order's partner is a Private Cellar member
 *
 * A member is the partner on their own orders, but they are a private
 * collector, not a trade partner: C&C runs the order for them. So trade-partner
 * steps and notices never go to them. There is nobody to answer "is your
 * client verified" (C&C verifies on their behalf), and a notice such as
 * "your client's order was delivered" makes no sense to the member, who is
 * the client. Members hear about their deliveries from the cellar's own
 * messages.
 *
 * @example
 *   if (await isCellarMemberPartner(order.partnerId)) return;
 *
 * @param partnerId - The order's partner
 * @returns True when the partner is a Private Cellar member
 */
const isCellarMemberPartner = async (partnerId: string | null | undefined) => {
  if (!partnerId) return false;

  const [partner] = await db
    .select({ type: partners.type })
    .from(partners)
    .where(eq(partners.id, partnerId))
    .limit(1);

  return partner?.type === 'private_collector';
};

export default isCellarMemberPartner;
