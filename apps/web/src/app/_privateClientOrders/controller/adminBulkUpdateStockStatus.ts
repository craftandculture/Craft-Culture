import { z } from 'zod';

import { wmsOperatorProcedure } from '@/lib/trpc/procedures';

import stockStatusUpdateSchema from '../schemas/stockStatusUpdateSchema';
import runForEachOrder from '../utils/runForEachOrder';
import updateOrderStockStatus from '../utils/updateOrderStockStatus';

/**
 * Set the stock status of every line on many orders at once (C&C)
 *
 * The per-order bulk update, repeated across orders: each order is logged and
 * its partner (and, where relevant, distributor) notified as before.
 */
const adminBulkUpdateStockStatus = wmsOperatorProcedure
  .input(
    z.object({
      orderIds: z.array(z.string().uuid()).min(1).max(100),
      stockStatus: stockStatusUpdateSchema.shape.stockStatus,
    }),
  )
  .mutation(({ input, ctx }) =>
    runForEachOrder(input.orderIds, (orderId) =>
      updateOrderStockStatus({ orderId, stockStatus: input.stockStatus }, ctx.user),
    ),
  );

export default adminBulkUpdateStockStatus;
