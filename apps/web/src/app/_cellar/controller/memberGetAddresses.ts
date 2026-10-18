import { stockOwnerProcedure } from '@/lib/trpc/procedures';

import getDeliveryAddresses from '../data/getDeliveryAddresses';

/**
 * The member's saved delivery addresses, default first
 *
 * @example
 *   const { addresses } = await trpcClient.cellar.member.getAddresses.query();
 */
const memberGetAddresses = stockOwnerProcedure.query(async ({ ctx }) =>
  getDeliveryAddresses(ctx.partner.id),
);

export default memberGetAddresses;
