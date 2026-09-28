import { z } from 'zod';

import { wmsOperatorProcedure } from '@/lib/trpc/procedures';

import assignDistributorToOrder from '../utils/assignDistributorToOrder';

const assignDistributorSchema = z.object({
  orderId: z.string().uuid(),
  distributorId: z.string().uuid(),
  notes: z.string().optional(),
});

/**
 * Assign a distributor to one order (C&C)
 */
const ordersAssignDistributor = wmsOperatorProcedure
  .input(assignDistributorSchema)
  .mutation(({ input, ctx }) => assignDistributorToOrder(input, ctx.user));

export default ordersAssignDistributor;
