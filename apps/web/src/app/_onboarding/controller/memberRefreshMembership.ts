import { eq } from 'drizzle-orm';

import db from '@/database/client';
import { cellarMemberships } from '@/database/schema';
import { stockOwnerProcedure } from '@/lib/trpc/procedures';
import { getSubscription } from '@/lib/zoho/billing';
import logger from '@/utils/logger';

import applyZohoSubscription from '../data/applyZohoSubscription';

/**
 * Re-read the member's subscription from Zoho
 *
 * The webhook normally keeps status current; this is the fallback when the
 * member comes back from updating a card, so nothing waits on a job.
 */
const memberRefreshMembership = stockOwnerProcedure.mutation(async ({ ctx }) => {
  const [membership] = await db
    .select()
    .from(cellarMemberships)
    .where(eq(cellarMemberships.partnerId, ctx.partner.id))
    .limit(1);

  if (!membership?.zohoSubscriptionId) return { status: membership?.status ?? null };

  try {
    const subscription = await getSubscription(membership.zohoSubscriptionId);
    return { status: await applyZohoSubscription(membership.id, subscription) };
  } catch (error) {
    logger.error('Could not refresh membership from Zoho', { error, membershipId: membership.id });
    return { status: membership.status };
  }
});

export default memberRefreshMembership;
