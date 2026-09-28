import { z } from 'zod';

import { wmsOperatorProcedure } from '@/lib/trpc/procedures';

import assignDistributorToOrder from '../utils/assignDistributorToOrder';
import runForEachOrder from '../utils/runForEachOrder';

/**
 * Assign one distributor to many orders at once (C&C)
 *
 * The single-order assignment, repeated: each order moves on (verification or
 * awaiting payment), is logged and its distributor notified exactly as if it
 * were assigned by hand. Orders that cannot take a distributor are reported,
 * not assigned.
 */
const adminBulkAssignDistributor = wmsOperatorProcedure
  .input(
    z.object({
      orderIds: z.array(z.string().uuid()).min(1).max(100),
      distributorId: z.string().uuid(),
    }),
  )
  .mutation(({ input, ctx }) =>
    runForEachOrder(input.orderIds, (orderId) =>
      assignDistributorToOrder(
        { orderId, distributorId: input.distributorId },
        ctx.user,
      ),
    ),
  );

export default adminBulkAssignDistributor;
