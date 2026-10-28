import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { logisticsShipmentActivityLogs, logisticsShipments } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import setShipmentStatus from '../data/setShipmentStatus';
import { SHIPMENT_STATUS_KEYS } from '../utils/shipmentStatuses';

/**
 * Log news on a shipment in one go: status, ETA, next action, owner and a line
 *
 * The quick update the logistics team keeps the board current with. A status
 * change goes through the same path as the status dropdown, so its alerts and
 * Slack posts still fire. Each save adds one dated line to the shipment's
 * activity log and restarts its "no news" clock. Fields left out are kept.
 *
 * @example
 *   await trpcClient.logistics.admin.logUpdate.mutate({
 *     id: 'uuid',
 *     status: 'in_transit',
 *     eta: '2026-11-04',
 *     etaConfirmed: true,
 *     nextAction: 'Book RAK clearance',
 *     nextActionOwnerId: 'uuid',
 *     note: 'Hillebrand confirmed the flight; lands 04 Nov.',
 *   });
 */
const adminLogUpdate = adminProcedure
  .input(
    z.object({
      id: z.string().uuid(),
      status: z.enum(SHIPMENT_STATUS_KEYS).optional(),
      /** A calendar date, YYYY-MM-DD; null clears it */
      eta: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .nullable()
        .optional(),
      etaConfirmed: z.boolean().optional(),
      nextAction: z.string().trim().max(300).nullable().optional(),
      nextActionOwnerId: z.string().uuid().nullable().optional(),
      note: z.string().trim().max(1000).optional(),
    }),
  )
  .mutation(async ({ input, ctx: { user } }) => {
    const [existing] = await db
      .select()
      .from(logisticsShipments)
      .where(eq(logisticsShipments.id, input.id));

    if (!existing) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Shipment not found' });
    }

    const note = input.note || undefined;

    if (input.status && input.status !== existing.status) {
      await setShipmentStatus({ id: input.id, status: input.status, notes: note, userId: user.id });
    }

    // Noon UTC, so the date reads the same in Dubai and London
    const eta =
      input.eta === undefined ? undefined : input.eta === null ? null : new Date(`${input.eta}T12:00:00Z`);

    const changes = {
      ...(eta !== undefined && { eta }),
      ...(input.etaConfirmed !== undefined && { etaConfirmed: eta === null ? false : input.etaConfirmed }),
      ...(input.nextAction !== undefined && { nextAction: input.nextAction || null }),
      ...(input.nextActionOwnerId !== undefined && { nextActionOwnerId: input.nextActionOwnerId }),
    };

    const [shipment] = await db
      .update(logisticsShipments)
      .set({ ...changes, lastUpdateAt: new Date() })
      .where(eq(logisticsShipments.id, input.id))
      .returning();

    await db.insert(logisticsShipmentActivityLogs).values({
      shipmentId: input.id,
      userId: user.id,
      action: 'update_logged',
      notes: note,
      metadata: {
        ...(eta !== undefined && { eta: eta ? eta.toISOString().slice(0, 10) : null }),
        ...(changes.etaConfirmed !== undefined && { etaConfirmed: changes.etaConfirmed }),
        ...(changes.nextAction !== undefined && { nextAction: changes.nextAction }),
        ...(changes.nextActionOwnerId !== undefined && { nextActionOwnerId: changes.nextActionOwnerId }),
      },
    });

    return { id: input.id, lastUpdateAt: shipment?.lastUpdateAt ?? null };
  });

export default adminLogUpdate;
