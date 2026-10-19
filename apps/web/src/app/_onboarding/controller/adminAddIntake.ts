import { TRPCError } from '@trpc/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { cellarIntakes, logisticsShipments, partners } from '@/database/schema';
import { staffAdminProcedure } from '@/lib/trpc/procedures';

import { WINE_SOURCE_VALUES } from '../constants/wineSources';
import advanceShipmentIntakes from '../data/advanceShipmentIntakes';

/**
 * Record wine coming into a member's cellar on their behalf
 *
 * Until now only the member could create a transfer, from their application or
 * Bring your wine in. A member whose wine was already on its way when we
 * invited them (Michael Humphreys-Davies, BBR, 19 October 2026) then had no
 * tracker until they signed in and told us what we already knew. Staff
 * recording it means the "wine on its way" card is there the first time they
 * open their cellar.
 *
 * Unlike the member's own request, it does not need the membership active:
 * recording a transfer is not the member acting, so it starts no billing.
 * Linking the shipment here moves the tracker to the shipment's stage at once.
 *
 * @example
 *   await trpcClient.onboarding.admin.addIntake.mutate({
 *     partnerId,
 *     source: 'uk_eu_cellar',
 *     holderName: 'Berry Bros. & Rudd',
 *     shipmentId,
 *   });
 */
const adminAddIntake = staffAdminProcedure
  .input(
    z.object({
      partnerId: z.string().uuid(),
      source: z.enum(WINE_SOURCE_VALUES),
      holderName: z.string().trim().max(200).optional(),
      approxCases: z.number().int().min(0).max(100_000).optional(),
      note: z.string().trim().max(2000).optional(),
      shipmentId: z.string().uuid().optional(),
    }),
  )
  .mutation(async ({ input }) => {
    const [member] = await db
      .select({ id: partners.id })
      .from(partners)
      .where(
        and(
          eq(partners.id, input.partnerId),
          eq(partners.type, 'private_collector'),
        ),
      )
      .limit(1);

    if (!member) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'That cellar member could not be found.',
      });
    }

    if (input.shipmentId) {
      const [shipment] = await db
        .select({ type: logisticsShipments.type })
        .from(logisticsShipments)
        .where(eq(logisticsShipments.id, input.shipmentId))
        .limit(1);

      if (!shipment)
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Shipment not found',
        });
      if (shipment.type !== 'inbound') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Only an inbound shipment can bring wine into a cellar',
        });
      }
    }

    const [intake] = await db
      .insert(cellarIntakes)
      .values({
        partnerId: input.partnerId,
        source: input.source,
        holderName: input.holderName || (input.source === 'lcb' ? 'LCB' : null),
        approxCases: input.approxCases ?? null,
        note: input.note || null,
        shipmentId: input.shipmentId ?? null,
      })
      .returning({ id: cellarIntakes.id });

    if (input.shipmentId) await advanceShipmentIntakes(input.shipmentId);

    return { intakeId: intake!.id };
  });

export default adminAddIntake;
