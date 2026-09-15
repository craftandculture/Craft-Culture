import { and, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';

import { lwinPakKeyOf } from '@/app/_wms/utils/lwinPakKey';
import db from '@/database/client';
import {
  wmsStock,
} from '@/database/schema';
import { stockOwnerProcedure } from '@/lib/trpc/procedures';

import getCostPerBottle from '../data/getCostPerBottle';
import computeReleaseQuote from '../utils/computeReleaseQuote';

/**
 * What a basket would cost to bring out of bond
 *
 * An estimate, run against the member's own rate card, so they can see the
 * shape of the cost before committing to ask. Asking for a figure and waiting
 * a day to learn it is how a member ends up submitting a request they would
 * never have made — and how we end up quoting requests nobody wanted.
 *
 * Returns one number and nothing else. The breakdown is ours; what the member
 * needs is whether this is a two hundred dollar decision or a two thousand
 * dollar one.
 *
 * It is explicitly not a quote. Nothing is reserved, no rate is locked, and
 * the figure that matters is still the one an admin sends.
 */
const memberEstimateRelease = stockOwnerProcedure
  .input(
    z.object({
      lines: z
        .array(
          z.object({
            stockId: z.string().uuid(),
            bottles: z.number().int().min(1),
          }),
        )
        .max(200),
    }),
  )
  .query(async ({ ctx, input }) => {
    if (input.lines.length === 0) return { priced: false, totalUsd: 0 };

    /*
      Scoped to the member's own stock. An estimate is cheap to ask for and
      would otherwise be a way to price wine belonging to somebody else.
    */
    const owned = await db
      .select({
        id: wmsStock.id,
        lwin18: wmsStock.lwin18,
        caseConfig: wmsStock.caseConfig,
      })
      .from(wmsStock)
      .where(
        and(
          inArray(
            wmsStock.id,
            input.lines.map((line) => line.stockId),
          ),
          eq(wmsStock.ownerId, ctx.partner.id),
        ),
      );

    if (owned.length === 0) return { priced: false, totalUsd: 0 };

    const lwins = [...new Set(owned.map((row) => row.lwin18))];

    const costByLwin = await getCostPerBottle(lwins);

    const quote = await computeReleaseQuote(
      ctx.partner.id,
      input.lines.flatMap((line) => {
        const stock = owned.find((row) => row.id === line.stockId);

        if (!stock) return [];

        return [
          {
            bottles: line.bottles,
            caseConfig: stock.caseConfig,
            costPerBottle:
              costByLwin.get(lwinPakKeyOf(stock.lwin18)) ?? null,
          },
        ];
      }),
    );

    return { priced: quote.priced, totalUsd: quote.totalUsd };
  });

export default memberEstimateRelease;
