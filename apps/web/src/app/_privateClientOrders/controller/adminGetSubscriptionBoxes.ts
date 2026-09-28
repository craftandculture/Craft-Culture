import { wmsOperatorProcedure } from '@/lib/trpc/procedures';

import getSubscriptionBoxes from '../data/getSubscriptionBoxes';

/**
 * Subscription boxes in use across all partners, with order counts (C&C)
 */
const adminGetSubscriptionBoxes = wmsOperatorProcedure.query(() =>
  getSubscriptionBoxes(),
);

export default adminGetSubscriptionBoxes;
