import { TRPCError } from '@trpc/server';

/**
 * Refuse subscription tools to a partner that does not run a club
 *
 * @param partner - The partner on the request
 * @throws TRPCError FORBIDDEN when the partner's subscriptions are off
 */
const assertSubscriptionsEnabled = (partner: { subscriptionsEnabled: boolean }) => {
  if (!partner.subscriptionsEnabled) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Subscription tools are not enabled for your account',
    });
  }
};

export default assertSubscriptionsEnabled;
