import { and, eq, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { logisticsShipmentItems, logisticsShipments } from '@/database/schema';
import { wmsOperatorProcedure } from '@/lib/trpc/procedures';

/**
 * Mark in-transit lines for sale, or hold them for their owner
 *
 * A consignment is rarely all one thing. Ihab Toma's shipment is mostly wine
 * being delivered to him with a few lines we are selling, so the shipment-wide
 * "hold for owner" is right for the shipment and wrong for those few — and the
 * only way to say so was to open Logistics, find the shipment, and edit each
 * line's Availability by hand.
 *
 * Which is the step that quietly defeats everything else: a line held for its
 * owner cannot reach a price list however it is priced or released, so
 * releasing it looks like it does nothing.
 *
 * Null hands the line back to the shipment's own setting rather than pinning it
 * either way.
 *
 * @example
 *   await trpcClient.wms.admin.stock.pricing.setInboundAvailability.mutate({
 *     lines: [{ shipmentNumber: 'SHP-2026-0012', lwin18: '1104653-2021-02-00750' }],
 *     notForSale: false,
 *   });
 */
const adminSetInboundAvailability = wmsOperatorProcedure
  .input(
    z.object({
      lines: z
        .array(
          z.object({
            shipmentNumber: z.string().min(1),
            /** The LWIN, or the product name where the wine is not mapped */
            lwin18: z.string().min(1),
          }),
        )
        .min(1)
        .max(500),
      /** false = for sale, true = held, null = inherit the shipment */
      notForSale: z.boolean().nullable(),
    }),
  )
  .mutation(async ({ input }) => {
    const { lines, notForSale } = input;

    let updated = 0;

    // Grouped by shipment so one statement covers a consignment's worth of
    // lines rather than one round trip each.
    const byShipment = new Map<string, string[]>();

    for (const line of lines) {
      byShipment.set(line.shipmentNumber, [
        ...(byShipment.get(line.shipmentNumber) ?? []),
        line.lwin18,
      ]);
    }

    for (const [shipmentNumber, keys] of byShipment) {
      const rows = await db
        .update(logisticsShipmentItems)
        .set({ notForSale })
        .where(
          and(
            inArray(
              logisticsShipmentItems.shipmentId,
              db
                .select({ id: logisticsShipments.id })
                .from(logisticsShipments)
                .where(eq(logisticsShipments.shipmentNumber, shipmentNumber)),
            ),
            /*
              Matched the way an in-transit line names itself: its LWIN, or its
              product name where the wine has not been mapped. Most of this
              stock arrives from a supplier's spreadsheet with no LWIN, so
              keying on the code alone would miss exactly the lines that need
              this most.
            */
            sql`COALESCE(${logisticsShipmentItems.lwin}, ${logisticsShipmentItems.productName}) IN ${keys}`,
          ),
        )
        .returning({ id: logisticsShipmentItems.id });

      updated += rows.length;
    }

    return { updated, notForSale };
  });

export default adminSetInboundAvailability;
