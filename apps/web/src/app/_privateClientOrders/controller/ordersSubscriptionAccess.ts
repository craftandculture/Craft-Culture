import { winePartnerProcedure } from '@/lib/trpc/procedures';

/**
 * Whether this partner runs a subscription club, which opens the box tag and
 * the clone tool on its orders
 */
const ordersSubscriptionAccess = winePartnerProcedure.query(({ ctx }) => ({
  enabled: ctx.partner.subscriptionsEnabled,
}));

export default ordersSubscriptionAccess;
