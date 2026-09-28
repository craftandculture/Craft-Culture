import { wmsOperatorProcedure } from '@/lib/trpc/procedures';

import subscriptionBoxSchema from '../schemas/subscriptionBoxSchema';
import setSubscriptionBox from '../utils/setSubscriptionBox';

/**
 * Tag any partner's order as a subscription box, or clear the tag (C&C)
 */
const adminSetSubscriptionBox = wmsOperatorProcedure
  .input(subscriptionBoxSchema)
  .mutation(({ input }) => setSubscriptionBox(input));

export default adminSetSubscriptionBox;
