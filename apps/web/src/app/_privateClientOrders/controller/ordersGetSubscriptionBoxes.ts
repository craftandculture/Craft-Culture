import { winePartnerProcedure } from '@/lib/trpc/procedures';

import getSubscriptionBoxes from '../data/getSubscriptionBoxes';

/**
 * Subscription boxes in use on the partner's own orders, with order counts
 */
const ordersGetSubscriptionBoxes = winePartnerProcedure.query(({ ctx }) =>
  getSubscriptionBoxes(ctx.partnerId),
);

export default ordersGetSubscriptionBoxes;
