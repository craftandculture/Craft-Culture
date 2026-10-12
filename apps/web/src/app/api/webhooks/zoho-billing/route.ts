import { timingSafeEqual } from 'node:crypto';

import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import applyZohoSubscription from '@/app/_onboarding/data/applyZohoSubscription';
import findSubscriptionId from '@/app/_onboarding/utils/findSubscriptionId';
import db from '@/database/client';
import { cellarMemberships } from '@/database/schema';
import { getSubscription } from '@/lib/zoho/billing';
import serverConfig from '@/server.config';
import logger from '@/utils/logger';

/**
 * Zoho Billing webhook: a payment succeeded or failed, or a subscription
 * changed state
 *
 * Authenticated by a shared secret Zoho sends as `?secret=` (set on the
 * webhook in Zoho). The payload only says which subscription to look at;
 * its status is read back from Zoho, so a forged body cannot activate
 * anyone. Unknown subscriptions are acknowledged and ignored.
 */
export const POST = async (request: Request) => {
  const expected = serverConfig.zohoBillingWebhookSecret;
  const given = new URL(request.url).searchParams.get('secret') ?? request.headers.get('x-cc-webhook-secret') ?? '';

  if (
    !expected ||
    given.length !== expected.length ||
    !timingSafeEqual(Buffer.from(given), Buffer.from(expected))
  ) {
    return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
  }

  const payload = await request.json().catch(() => null);
  const subscriptionId = findSubscriptionId(payload);
  if (!subscriptionId) return NextResponse.json({ ignored: 'no subscription' });

  try {
    const subscription = await getSubscription(subscriptionId);

    const [membership] = await db
      .select({ id: cellarMemberships.id })
      .from(cellarMemberships)
      .where(
        subscription.reference_id && /^[0-9a-f-]{36}$/i.test(subscription.reference_id)
          ? eq(cellarMemberships.id, subscription.reference_id)
          : eq(cellarMemberships.zohoSubscriptionId, subscriptionId),
      )
      .limit(1);

    if (!membership) return NextResponse.json({ ignored: 'not a cellar membership' });

    const status = await applyZohoSubscription(membership.id, subscription);
    return NextResponse.json({ status });
  } catch (error) {
    logger.error('Zoho Billing webhook failed', { error, subscriptionId });
    return NextResponse.json({ error: 'failed' }, { status: 500 });
  }
};
