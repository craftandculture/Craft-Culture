import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import {
  cellarUkMoveItems,
  cellarUkMoves,
  logisticsShipmentItems,
  logisticsShipments,
} from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import item75clEquivalents from '../utils/item75clEquivalents';
import itemBottles from '../utils/itemBottles';

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Start a quote request from a shipment or a UK move
 *
 * Returns the route and cargo the request form opens with, counted from the
 * source's own lines, so nobody types what the Index already knows. Nothing
 * is saved; the form saves it once it has been checked.
 *
 * @example
 *   await trpcClient.logistics.admin.requests.draftFromSource.query({ sourceType: 'uk_move', sourceId });
 */
const adminGetQuoteRequestDraft = adminProcedure
  .input(z.object({ sourceType: z.enum(['shipment', 'uk_move']), sourceId: z.string().uuid() }))
  .query(async ({ input }) => {
    if (input.sourceType === 'shipment') {
      const [shipment] = await db
        .select()
        .from(logisticsShipments)
        .where(eq(logisticsShipments.id, input.sourceId))
        .limit(1);

      if (!shipment) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Shipment not found' });
      }

      const items = await db
        .select({
          cases: logisticsShipmentItems.cases,
          bottlesPerCase: logisticsShipmentItems.bottlesPerCase,
          bottleSizeMl: logisticsShipmentItems.bottleSizeMl,
          totalBottles: logisticsShipmentItems.totalBottles,
        })
        .from(logisticsShipmentItems)
        .where(eq(logisticsShipmentItems.shipmentId, shipment.id));

      const cases = items.reduce((s, i) => s + i.cases, 0);
      const bottles = items.reduce((s, i) => s + itemBottles(i), 0);
      const equivalents = items.reduce((s, i) => s + item75clEquivalents(i), 0);

      return {
        sourceType: input.sourceType,
        sourceId: shipment.id,
        sourceLabel: shipment.shipmentNumber,
        originCountry: shipment.originCountry ?? '',
        originCity: shipment.originCity ?? '',
        originWarehouse: shipment.originWarehouse ?? '',
        destinationCountry: shipment.destinationCountry ?? '',
        destinationCity: shipment.destinationCity ?? '',
        destinationWarehouse: shipment.destinationWarehouse ?? '',
        transportMode: shipment.transportMode,
        totalCases: cases || shipment.totalCases || null,
        totalBottles: bottles || shipment.totalBottles || null,
        total75clEquivalents: equivalents ? round1(equivalents) : null,
        totalPallets: shipment.totalPallets ?? null,
        totalWeightKg: shipment.totalWeightKg ?? null,
        totalVolumeM3: shipment.totalVolumeM3 ?? null,
      };
    }

    const [move] = await db
      .select({ id: cellarUkMoves.id, moveNumber: cellarUkMoves.moveNumber })
      .from(cellarUkMoves)
      .where(eq(cellarUkMoves.id, input.sourceId))
      .limit(1);

    if (!move) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'UK move not found' });
    }

    const items = await db
      .select({
        cases: cellarUkMoveItems.cases,
        singles: cellarUkMoveItems.singles,
        totalBottles: cellarUkMoveItems.totalBottles,
        bottleSizeLitres: cellarUkMoveItems.bottleSizeLitres,
      })
      .from(cellarUkMoveItems)
      .where(eq(cellarUkMoveItems.moveId, move.id));

    // LCB counts loose bottles separately; a line of only loose bottles still travels as a carton
    const cases = items.reduce((s, i) => s + i.cases + (i.cases === 0 && i.singles > 0 ? 1 : 0), 0);
    const bottles = items.reduce((s, i) => s + i.totalBottles, 0);
    const equivalents = items.reduce((s, i) => s + (i.totalBottles * (i.bottleSizeLitres ?? 0.75)) / 0.75, 0);

    return {
      sourceType: input.sourceType,
      sourceId: move.id,
      sourceLabel: move.moveNumber,
      originCountry: 'United Kingdom',
      originCity: 'Burton upon Trent',
      originWarehouse: 'LCB Burton Gateway',
      destinationCountry: 'United Arab Emirates',
      destinationCity: 'Ras Al Khaimah',
      destinationWarehouse: 'C&C bonded warehouse',
      transportMode: null,
      totalCases: cases || null,
      totalBottles: bottles || null,
      total75clEquivalents: equivalents ? round1(equivalents) : null,
      totalPallets: null,
      totalWeightKg: null,
      totalVolumeM3: null,
    };
  });

export default adminGetQuoteRequestDraft;
