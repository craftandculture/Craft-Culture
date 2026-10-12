import { eq } from 'drizzle-orm';

import db from '@/database/client';
import { cellarMemberships } from '@/database/schema';
import { type ZohoBillingSubscription, membershipStatusFromZoho } from '@/lib/zoho/billing';

/**
 * Record what Zoho says about a member's subscription
 *
 * The one place membership status is written from Zoho — the hosted page
 * return, the webhook and the Refresh buttons all come through here.
 *
 * @param membershipId - Our membership row
 * @param subscription - The subscription as Zoho returned it
 * @returns The status now held
 */
const applyZohoSubscription = async (membershipId: string, subscription: ZohoBillingSubscription) => {
  const status = membershipStatusFromZoho(subscription.status);
  const nextBilling = subscription.next_billing_at ?? subscription.current_term_ends_at;

  const [updated] = await db
    .update(cellarMemberships)
    .set({
      status,
      zohoSubscriptionId: subscription.subscription_id,
      zohoCustomerId: subscription.customer_id,
      cardLast4: subscription.card?.last_four_digits ?? undefined,
      nextBillingAt: nextBilling ? new Date(nextBilling) : null,
      ...(status === 'cancelled' && { cancelledAt: new Date() }),
    })
    .where(eq(cellarMemberships.id, membershipId))
    .returning();

  // First time active: the subscription — and billing — started now
  if (status === 'active' && updated && !updated.activatedAt) {
    await db
      .update(cellarMemberships)
      .set({ activatedAt: new Date() })
      .where(eq(cellarMemberships.id, membershipId));
  }

  return status;
};

export default applyZohoSubscription;
