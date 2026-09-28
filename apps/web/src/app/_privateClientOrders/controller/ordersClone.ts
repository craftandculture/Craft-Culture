import { winePartnerProcedure } from '@/lib/trpc/procedures';

import cloneOrderSchema from '../schemas/cloneOrderSchema';
import assertSubscriptionsEnabled from '../utils/assertSubscriptionsEnabled';
import cloneOrderForClients from '../utils/cloneOrderForClients';

/**
 * Clone one of the partner's own orders for a list of its clients
 *
 * The partner keys a month of subscription boxes itself: one checked order per
 * box, cloned for every member. Clones are drafts the partner then submits, so
 * C&C review still stands between them and the warehouse.
 */
const ordersClone = winePartnerProcedure
  .input(cloneOrderSchema)
  .mutation(({ input, ctx }) => {
    assertSubscriptionsEnabled(ctx.partner);
    return cloneOrderForClients(input, { partnerId: ctx.partnerId });
  });

export default ordersClone;
