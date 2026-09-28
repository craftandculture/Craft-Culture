import { z } from 'zod';

import { wmsOperatorProcedure } from '@/lib/trpc/procedures';

import setDistributorSku from '../utils/setDistributorSku';

/**
 * C&C records or corrects the distributor's bundle SKU on any order
 */
const adminSetDistributorSku = wmsOperatorProcedure
  .input(z.object({ orderId: z.string().uuid(), sku: z.string().nullable() }))
  .mutation(({ input, ctx }) =>
    setDistributorSku(input, { userId: ctx.user.id, source: 'admin' }),
  );

export default adminSetDistributorSku;
