import { z } from 'zod';

import { wmsOperatorProcedure } from '@/lib/trpc/procedures';

import stockStatusUpdateSchema from '../schemas/stockStatusUpdateSchema';
import updateOrderStockStatus from '../utils/updateOrderStockStatus';

/**
 * Bulk update stock status for multiple line items of one order
 *
 * Admin procedure to update stock status for multiple items at once.
 * Useful for marking entire shipments as arrived or ready.
 */
const itemsBulkUpdateStockStatus = wmsOperatorProcedure
  .input(stockStatusUpdateSchema.extend({ itemIds: z.array(z.string().uuid()).min(1) }))
  .mutation(({ input, ctx }) => updateOrderStockStatus(input, ctx.user));

export default itemsBulkUpdateStockStatus;
