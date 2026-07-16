import { TRPCError } from '@trpc/server';

import { adminProcedure } from '@/lib/trpc/procedures';

import { calculateShipmentGroupSchema } from '../schemas/shipmentGroupSchemas';
import recalcGroupLandedCost from '../utils/recalcGroupLandedCost';

/**
 * Allocate a group's logistics cost ledger across every bottle and write the
 * landed cost per bottle onto each item (the manual "Calculate & apply"
 * action). The allocation itself lives in `recalcGroupLandedCost`, which also
 * runs automatically whenever a group cost line is added, edited, or removed.
 */
const adminCalculateShipmentGroup = adminProcedure
  .input(calculateShipmentGroupSchema)
  .mutation(async ({ input }) => {
    const result = await recalcGroupLandedCost(input.id);

    if (!result) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message:
          'Nothing to allocate — add shipments with items to this group first.',
      });
    }

    return result;
  });

export default adminCalculateShipmentGroup;
