import { TRPCError } from '@trpc/server';
import { z } from 'zod';

import { adminProcedure } from '@/lib/trpc/procedures';

import priceShipmentInUsd from '../utils/priceShipmentInUsd';

/**
 * Price a shipment's goods in USD at one agreed rate
 *
 * A supplier invoice is settled at a single rate, so it converts at a single
 * rate. Doing it per line is what turns a 165-line invoice into 165 manual
 * calculations, which is how this shipment was being handled.
 *
 * The rate is either stated — the one actually agreed with the supplier, which
 * is the figure the money moved at — or taken from today's market. Either way
 * it is recorded with its source and date, because a landed cost that cannot
 * be explained six months later is a number nobody can defend.
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
    const result = await priceShipmentInUsd(input.shipmentId, {
      agreedRate: input.agreedRate,
      currency: input.currency,
    });

    if (result.rateSource === 'unresolved') {
      throw new TRPCError({
        code: 'PRECONDITION_FAILED',
        message:
          `No rate could be found for ${result.currency}. Enter the agreed rate ` +
          `rather than leaving the goods priced in the wrong currency.`,
      });
    }

    return result;
  });

export default adminSetShipmentFx;
