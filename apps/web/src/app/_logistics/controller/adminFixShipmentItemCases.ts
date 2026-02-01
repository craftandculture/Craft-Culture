import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { logisticsShipmentItems, logisticsShipments } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';
import logger from '@/utils/logger';

/**
 * Fix shipment item case counts
 *
 * Use this to correct extraction errors where bottles were incorrectly put in the cases field.
 * Recalculates cases from totalBottles and bottlesPerCase.
 */
const adminFixShipmentItemCases = adminProcedure
  .input(
    z.object({
      shipmentId: z.string().uuid(),
      recalculateFromBottles: z.boolean().default(true),
    }),
  )
  .mutation(async ({ input }) => {
    const { shipmentId, recalculateFromBottles } = input;

    // Get shipment
    const [shipment] = await db
      .select()
      .from(logisticsShipments)
      .where(eq(logisticsShipments.id, shipmentId));

    if (!shipment) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Shipment not found',
      });
    }

    // Get all items
    const items = await db
      .select()
      .from(logisticsShipmentItems)
      .where(eq(logisticsShipmentItems.shipmentId, shipmentId));

    logger.info('[FixShipmentItemCases] Current state:', {
      shipmentNumber: shipment.shipmentNumber,
      itemCount: items.length,
      items: items.map((i) => ({
        name: i.productName,
        cases: i.cases,
        bottlesPerCase: i.bottlesPerCase,
        totalBottles: i.totalBottles,
      })),
    });

    if (!recalculateFromBottles) {
      return {
        success: true,
        message: 'Dry run - no changes made',
        items: items.map((i) => ({
          id: i.id,
          productName: i.productName,
          currentCases: i.cases,
          bottlesPerCase: i.bottlesPerCase,
          totalBottles: i.totalBottles,
          calculatedCases: i.totalBottles && i.bottlesPerCase ? Math.floor(i.totalBottles / i.bottlesPerCase) : null,
        })),
      };
    }

    // Fix each item
    // The bug: extraction put "Number of bottles" into "cases" field instead of "Number of cases"
    // So the current "cases" value is actually the bottle count
    // Fix: correctCases = wrongCases / bottlesPerCase
    const updates: Array<{ id: string; productName: string; oldCases: number; newCases: number }> = [];

    for (const item of items) {
      if (item.bottlesPerCase && item.bottlesPerCase > 0) {
        // Check if current cases looks like it's actually the bottle count
        // (i.e., it's divisible by bottlesPerCase and results in a reasonable case count)
        const possibleCases = item.cases / item.bottlesPerCase;

        if (possibleCases >= 1 && Number.isInteger(possibleCases) && possibleCases < item.cases) {
          // This looks like the bottle count was put in cases
          const correctCases = possibleCases;

          await db
            .update(logisticsShipmentItems)
            .set({
              cases: correctCases,
              totalBottles: item.cases, // The old "cases" value was actually the bottle count
            })
            .where(eq(logisticsShipmentItems.id, item.id));

          updates.push({
            id: item.id,
            productName: item.productName,
            oldCases: item.cases,
            newCases: correctCases,
          });
        }
      }
    }

    logger.info('[FixShipmentItemCases] Updates applied:', {
      shipmentNumber: shipment.shipmentNumber,
      updatesCount: updates.length,
      updates,
    });

    return {
      success: true,
      message: `Fixed ${updates.length} items`,
      updates,
    };
  });

export default adminFixShipmentItemCases;
