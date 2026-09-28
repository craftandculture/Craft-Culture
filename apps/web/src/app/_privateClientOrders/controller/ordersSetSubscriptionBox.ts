import { winePartnerProcedure } from '@/lib/trpc/procedures';

import subscriptionBoxSchema from '../schemas/subscriptionBoxSchema';
import assertSubscriptionsEnabled from '../utils/assertSubscriptionsEnabled';
import setSubscriptionBox from '../utils/setSubscriptionBox';

/**
 * Tag one of the partner's own orders as a subscription box, or clear the tag
 */
const ordersSetSubscriptionBox = winePartnerProcedure
  .input(subscriptionBoxSchema)
  .mutation(({ input, ctx }) => {
    assertSubscriptionsEnabled(ctx.partner);
    return setSubscriptionBox(input, { partnerId: ctx.partnerId });
  });

export default ordersSetSubscriptionBox;
