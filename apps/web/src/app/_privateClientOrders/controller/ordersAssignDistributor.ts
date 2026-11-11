import { z } from 'zod';

import { adminProcedure } from '@/lib/trpc/procedures';

import assignDistributorToOrder from '../utils/assignDistributorToOrder';

const assignDistributorSchema = z.object({
  orderId: z.string().uuid(),
  distributorId: z.string().uuid(),
  notes: z.string().optional(),
});

/**
 * Assign a distributor to one order (C&C)
 */
const ordersAssignDistributor = adminProcedure
  .input(assignDistributorSchema)
  .mutation(({ input, ctx }) => assignDistributorToOrder(input, ctx.user));

export default ordersAssignDistributor;
