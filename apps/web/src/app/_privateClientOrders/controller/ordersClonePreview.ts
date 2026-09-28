import { z } from 'zod';

import { winePartnerProcedure } from '@/lib/trpc/procedures';

import assertSubscriptionsEnabled from '../utils/assertSubscriptionsEnabled';
import buildClonePreview from '../utils/buildClonePreview';

/**
 * What cloning one of the partner's own orders would need, before it is cloned
 */
const ordersClonePreview = winePartnerProcedure
  .input(
    z.object({
      orderId: z.string().uuid(),
      copies: z.number().int().min(0).max(60),
    }),
  )
  .query(({ input, ctx }) => {
    assertSubscriptionsEnabled(ctx.partner);
    return buildClonePreview(input.orderId, input.copies, {
      partnerId: ctx.partnerId,
    });
  });

export default ordersClonePreview;
