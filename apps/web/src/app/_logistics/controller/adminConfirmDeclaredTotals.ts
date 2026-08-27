import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { logisticsShipments } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

/**
 * Record that someone has reconciled a shipment against its own paperwork
 *
 * The check is a person setting two columns side by side, so what is stored is
 * that a person did it — who, and when. Nothing is recalculated here and no
 * figure is changed.
 *
 * A mismatch does not block the confirmation. Cases and cartons legitimately
 * differ where loose bottles are consolidated into a mixed box, and a rule
 * that refused those would be switched off within a week. What matters is that
 * the difference was seen rather than never shown.
 *
 * Editing the declared figures is allowed for the same reason: a totals row is
 * read off a spreadsheet and can be read wrongly, and correcting the reading
 * is not the same as overwriting the document.
 */
const adminConfirmDeclaredTotals = adminProcedure
  .input(
    z.object({
      shipmentId: z.string().uuid(),
      /** Corrections to what was read off the document, where it was misread */
      declaredCases: z.number().int().min(0).nullable().optional(),
      declaredBottles: z.number().int().min(0).nullable().optional(),
      declaredCartons: z.number().int().min(0).nullable().optional(),
      declaredPallets: z.number().int().min(0).nullable().optional(),
    }),
  )
  .mutation(async ({ input, ctx }) => {
    const { shipmentId, ...corrections } = input;

    const [shipment] = await db
      .select({ id: logisticsShipments.id })
      .from(logisticsShipments)
      .where(eq(logisticsShipments.id, shipmentId))
      .limit(1);

    if (!shipment) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Shipment not found' });
    }

    // Only the fields actually sent are touched; an omitted one keeps what the
    // document said rather than being cleared by a partial edit.
    const stated = Object.fromEntries(
      Object.entries(corrections).filter(([, value]) => value !== undefined),
    );

    const [updated] = await db
      .update(logisticsShipments)
      .set({
        ...stated,
        declaredConfirmedAt: new Date(),
        declaredConfirmedBy: ctx.user.id,
      })
      .where(eq(logisticsShipments.id, shipmentId))
      .returning({
        declaredCases: logisticsShipments.declaredCases,
        declaredBottles: logisticsShipments.declaredBottles,
        declaredCartons: logisticsShipments.declaredCartons,
        declaredPallets: logisticsShipments.declaredPallets,
        declaredConfirmedAt: logisticsShipments.declaredConfirmedAt,
      });

    return { success: true, shipment: updated };
  });

export default adminConfirmDeclaredTotals;
