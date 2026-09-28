import { z } from 'zod';

import { distributorProcedure } from '@/lib/trpc/procedures';

import setDistributorSku from '../utils/setDistributorSku';

/**
 * The distributor records its bundle SKU for one of its orders
 *
 * City Drinks creates a product for each PCO when it receives the order and
 * types that product's SKU here. Editable until the client has paid.
 */
const distributorSetSku = distributorProcedure
  .input(z.object({ orderId: z.string().uuid(), sku: z.string().nullable() }))
  .mutation(({ input, ctx }) =>
    setDistributorSku(input, {
      userId: ctx.user.id,
      source: 'distributor',
      distributorId: ctx.partnerId,
    }),
  );

export default distributorSetSku;
