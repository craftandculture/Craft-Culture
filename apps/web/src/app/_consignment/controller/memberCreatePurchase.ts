import { TRPCError } from '@trpc/server';
import { and, count, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';

import assertActivated from '@/app/_onboarding/data/assertActivated';
import db from '@/database/client';
import { cellarPurchases } from '@/database/schema';
import { stockOwnerProcedure } from '@/lib/trpc/procedures';

import getCatalogueRowFor from '../data/getCatalogueRowFor';
import placeCellarPurchase from '../data/placeCellarPurchase';

/**
 * Open purchases a member may hold at once
 *
 * Each one takes wine off the list for everybody else, and one marked paid is
 * never lapsed automatically, so an unlimited number would let one member
 * freeze the catalogue.
 */
const MAX_OPEN_PURCHASES = 5;

/**
 * A member buys wine that stays in bond
 *
 * Nothing physically moves and no duty is triggered; what changes is who holds
 * the beneficial interest. Ownership does not move here either — this reserves
 * the parcels and starts the clock. The wine becomes theirs when the money is
 * confirmed, because C&C does not front money on anybody's behalf.
 *
 * Prices are re-read from the catalogue rather than trusted from the browser,
 * which is the difference between a price list and a price the customer types.
 *
 * Whole cases only. The transfer primitive works in cases, and a part case
 * bought in bond would have to be expressed as a fraction of a stock row.
 */
const memberCreatePurchase = stockOwnerProcedure
  .input(
    z.object({
      lines: z
        .array(
          z.object({
            lwin18: z.string().min(1).max(40),
            cases: z.number().int().min(1).max(500),
          }),
        )
        .min(1, 'Choose at least one wine')
        .max(50),
      notes: z.string().max(1000).optional(),
    }),
  )
  .mutation(async ({ ctx, input }) => {
    await assertActivated(ctx.partner.id);

    const [open] = await db
      .select({ value: count() })
      .from(cellarPurchases)
      .where(
        and(
          eq(cellarPurchases.buyerPartnerId, ctx.partner.id),
          inArray(cellarPurchases.status, ['reserved', 'payment_claimed']),
        ),
      );

    if ((open?.value ?? 0) >= MAX_OPEN_PURCHASES) {
      throw new TRPCError({
        code: 'CONFLICT',
        message:
          'You have several purchases waiting to be settled. Please complete or cancel one of those first, or contact us and we will help.',
      });
    }

    /*
      Prices first, outside the transaction: the catalogue read is heavy and
      the price does not need the rows locked.
    */
    const priced: {
      lwin18: string;
      cases: number;
      product: string;
      pricePerBottleUsd: number;
    }[] = [];

    for (const line of input.lines) {
      const row = await getCatalogueRowFor(line.lwin18);

      if (!row) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'That wine is no longer available.',
        });
      }

      priced.push({
        lwin18: line.lwin18,
        cases: line.cases,
        product: row.product,
        pricePerBottleUsd: row.ibPerBottle,
      });
    }

    return placeCellarPurchase({
      partnerId: ctx.partner.id,
      partnerName: ctx.partner.businessName,
      userId: ctx.user.id,
      priced,
      notes: input.notes,
    });
  });

export default memberCreatePurchase;
