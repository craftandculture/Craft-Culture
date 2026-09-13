import { eq } from 'drizzle-orm';

import db from '@/database/client';
import { partners } from '@/database/schema';
import { stockOwnerProcedure } from '@/lib/trpc/procedures';

/**
 * The member's own account details
 *
 * Only what the cellar needs: where deliveries go and what we should know
 * about getting in. Held on the account rather than typed into each request,
 * because an address retyped every time is an address spelled four ways.
 */
const memberGetProfile = stockOwnerProcedure.query(async ({ ctx }) => {
  const [partner] = await db
    .select({
      name: partners.businessName,
      deliveryAddress: partners.deliveryAddress,
      deliveryInstructions: partners.deliveryInstructions,
    })
    .from(partners)
    .where(eq(partners.id, ctx.partner.id))
    .limit(1);

  return {
    name: partner?.name ?? null,
    deliveryAddress: partner?.deliveryAddress ?? null,
    deliveryInstructions: partner?.deliveryInstructions ?? null,
  };
});

export default memberGetProfile;
