import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { cellarIntakes, logisticsShipments } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import advanceShipmentIntakes from '../data/advanceShipmentIntakes';

/**
 * Link a member's transfer to the inbound shipment carrying it, or unlink it
 *
 * From then on the member's tracker follows the shipment, and the card lists
 * the wines on it that are theirs. Linking a shipment already under way moves
 * the transfer forward at once, and tells the member.
 *
 * @example
 *   await trpcClient.onboarding.admin.linkIntakeShipment.mutate({ intakeId, shipmentId });
 */
const adminLinkIntakeShipment = adminProcedure
  .input(
    z.object({
      intakeId: z.string().uuid(),
      shipmentId: z.string().uuid().nullable(),
    }),
  )
  .mutation(async ({ input }) => {
    if (input.shipmentId) {
      const [shipment] = await db
        .select({ type: logisticsShipments.type })
        .from(logisticsShipments)
        .where(eq(logisticsShipments.id, input.shipmentId))
        .limit(1);

      if (!shipment) throw new TRPCError({ code: 'NOT_FOUND', message: 'Shipment not found' });
      if (shipment.type !== 'inbound') {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Only an inbound shipment can bring wine into a cellar' });
      }
    }

    const [intake] = await db
      .update(cellarIntakes)
      .set({ shipmentId: input.shipmentId })
      .where(eq(cellarIntakes.id, input.intakeId))
      .returning({ id: cellarIntakes.id });

    if (!intake) throw new TRPCError({ code: 'NOT_FOUND', message: 'Transfer not found' });
    if (input.shipmentId) await advanceShipmentIntakes(input.shipmentId);

    return { linked: Boolean(input.shipmentId) };
  });

export default adminLinkIntakeShipment;
