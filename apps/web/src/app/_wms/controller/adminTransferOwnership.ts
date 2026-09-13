import db from '@/database/client';
import { wmsOperatorProcedure } from '@/lib/trpc/procedures';

import { transferOwnershipSchema } from '../schemas/ownershipSchema';
import transferStockOwnership from '../utils/transferStockOwnership';

/**
 * Transfer stock ownership from one partner to another
 *
 * A thin wrapper. The work lives in `transferStockOwnership`, which is the only
 * code permitted to mutate `wmsStock.ownerId` — the exchange moves ownership
 * through the same function, so a book transfer and an admin correction cannot
 * drift apart in their guards or their audit trail.
 *
 * @example
 *   await trpcClient.wms.admin.ownership.transfer.mutate({
 *     stockId: 'uuid',
 *     newOwnerId: 'uuid',
 *     quantityCases: 10,
 *     salesArrangement: 'consignment',
 *   });
 */
const adminTransferOwnership = wmsOperatorProcedure
  .input(transferOwnershipSchema)
  .mutation(async ({ input, ctx }) => {
    const result = await db.transaction(async (tx) =>
      transferStockOwnership({
        tx,
        stockId: input.stockId,
        newOwnerId: input.newOwnerId,
        quantityCases: input.quantityCases,
        salesArrangement: input.salesArrangement,
        consignmentCommissionPercent: input.consignmentCommissionPercent,
        notes: input.notes,
        allowReservedTransfer: input.allowReservedTransfer,
        performedBy: ctx.user.id,
      }),
    );

    return {
      success: true,
      movement: result.movement,
      message: `Transferred ${input.quantityCases} cases from ${result.sourceStock.ownerName} to ${result.newOwner.businessName}`,
    };
  });

export default adminTransferOwnership;
