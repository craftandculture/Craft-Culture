import { TRPCError } from '@trpc/server';
import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { logisticsShipmentItems, logisticsShipments } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

import resolveFxToUsd from '../utils/resolveFxToUsd';

/**
 * Price a shipment's goods in USD at one agreed rate
 *
 * A supplier invoice is settled at a single rate, so it converts at a single
 * rate. Doing it per line is what turns a 163-line invoice into 163 manual
 * calculations, which is how this shipment was being handled.
 *
 * The rate is either stated — the one actually agreed with the supplier, which
 * is the figure the money moved at — or taken from today's market. Either way
 * it is recorded with its source and date, because a landed cost that cannot
 * be explained six months later is a number nobody can defend.
 *
 * Re-running recomputes from the amounts the document stated rather than from
 * the last conversion, so correcting a rate never compounds. That is the whole
 * reason the source currency and price are kept on the line.
 */
const adminSetShipmentFx = adminProcedure
  .input(
    z.object({
      shipmentId: z.string().uuid(),
      /** Leave unset to take today's rate for the shipment's own currency */
      agreedRate: z.number().positive().max(1000).optional(),
      /** Override the currency read off the document */
      currency: z.string().min(3).max(3).optional(),
    }),
  )
  .mutation(async ({ input }) => {
    const { shipmentId, agreedRate } = input;

    const [shipment] = await db
      .select({
        id: logisticsShipments.id,
        sourceCurrency: logisticsShipments.sourceCurrency,
      })
      .from(logisticsShipments)
      .where(eq(logisticsShipments.id, shipmentId))
      .limit(1);

    if (!shipment) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Shipment not found' });
    }

    // The document's own currency wins unless someone says otherwise: the
    // items carry whatever the supplier billed in.
    const [sample] = await db
      .select({ currency: logisticsShipmentItems.sourceCurrency })
      .from(logisticsShipmentItems)
      .where(eq(logisticsShipmentItems.shipmentId, shipmentId))
      .limit(1);

    const currency = (
      input.currency ??
      shipment.sourceCurrency ??
      sample?.currency ??
      'USD'
    ).toUpperCase();

    const resolved = agreedRate
      ? { rate: agreedRate, source: 'agreed' as const }
      : await resolveFxToUsd(currency);

    if (resolved.source === 'unresolved') {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message:
          `No rate could be found for ${currency}. Enter the agreed rate rather ` +
          `than leaving the goods priced in the wrong currency.`,
      });
    }

    const today = new Date().toISOString().slice(0, 10);

    await db
      .update(logisticsShipments)
      .set({
        sourceCurrency: currency,
        fxRateToUsd: resolved.rate,
        fxRateDate: today,
        fxRateSource: resolved.source,
      })
      .where(eq(logisticsShipments.id, shipmentId));

    // Always from the source amounts, never from the last USD figure, so a
    // second run corrects rather than compounds.
    const updated = await db
      .update(logisticsShipmentItems)
      .set({
        productCostPerBottle: sql`ROUND((${logisticsShipmentItems.sourceUnitPrice} * ${resolved.rate})::numeric, 4)`,
        declaredValueUsd: sql`ROUND((${logisticsShipmentItems.sourceTotal} * ${resolved.rate})::numeric, 2)`,
      })
      .where(
        sql`${logisticsShipmentItems.shipmentId} = ${shipmentId}
            AND ${logisticsShipmentItems.sourceUnitPrice} IS NOT NULL`,
      )
      .returning({ id: logisticsShipmentItems.id });

    return {
      currency,
      rate: resolved.rate,
      rateSource: resolved.source,
      rateDate: today,
      itemsPriced: updated.length,
    };
  });

export default adminSetShipmentFx;
