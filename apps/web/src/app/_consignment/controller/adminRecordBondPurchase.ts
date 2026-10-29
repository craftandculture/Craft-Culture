import { TRPCError } from '@trpc/server';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

import withNumberRetry from '@/app/_cellar/utils/withNumberRetry';
import db from '@/database/client';
import { poolSales, saleMandates } from '@/database/schema';
import { staffAdminProcedure } from '@/lib/trpc/procedures';

import generateSaleNumber from '../utils/generateSaleNumber';
import writeConsignmentSettlement from '../utils/writeConsignmentSettlement';

/**
 * Record wine C&C bought from a member in bond, before it reached our warehouse
 *
 * Bought in bond there is no Zoho invoice and no warehouse movement, so
 * nothing put it on the member's statement or their payout: Ihab Toma's two
 * Closiot C de Sec, found by Laraine on 29 Oct 2026. It is recorded as a sale
 * through C&C at the member's agreed price for that wine (no commission: C&C
 * is the buyer), with its settlement, so the statement lists it and the next
 * payout includes it. Stock is not touched.
 *
 * The agreed offer is the member's price, and is left as it is: it may
 * already read sold for bottles that left the warehouse.
 *
 * Preview first (`dryRun`), then save.
 *
 * @example
 *   await trpcClient.consignment.admin.recordBondPurchase.mutate({
 *     mandateNumber: 'MND-2026-0012', bottles: 2, soldOn: '2026-10-24',
 *     productName: 'Chateau Closiot, Bordeaux Blanc C de Sec 2023', dryRun: true,
 *   });
 */
const adminRecordBondPurchase = staffAdminProcedure
  .input(
    z.object({
      /** The member's agreed offer for this wine, which sets the price */
      mandateNumber: z.string().trim().min(5),
      bottles: z.number().int().min(1).max(1000),
      soldOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      /** Where the wine differs from the offer's name (one code, two cuvées) */
      productName: z.string().trim().min(3).max(200).optional(),
      note: z.string().trim().max(300).optional(),
      dryRun: z.boolean().default(true),
    }),
  )
  .mutation(async ({ input, ctx }) => {
    const [mandate] = await db
      .select()
      .from(saleMandates)
      .where(and(eq(saleMandates.mandateNumber, input.mandateNumber)));
    if (!mandate) throw new TRPCError({ code: 'NOT_FOUND', message: `${input.mandateNumber} not found` });

    // Midday in Dubai, as take-outs are dated
    const soldAt = new Date(`${input.soldOn}T12:00:00+04:00`);
    if (soldAt.getTime() > Date.now()) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'The purchase date cannot be in the future.' });
    }

    const owedToOwnerUsd = Math.round(mandate.askPerBottleUsd * input.bottles * 100) / 100;
    const preview = {
      owner: mandate.ownerName,
      mandateNumber: mandate.mandateNumber,
      productName: input.productName ?? mandate.productName,
      bottles: input.bottles,
      perBottleUsd: mandate.askPerBottleUsd,
      owedToOwnerUsd,
      soldAt,
    };
    if (input.dryRun) return { saved: false, ...preview };

    const sale = await db.transaction(async (tx) => {
      const row = await withNumberRetry((attempt) =>
        tx.transaction(async (savepoint) => {
          const [inserted] = await savepoint
            .insert(poolSales)
            .values({
              saleNumber: await generateSaleNumber(savepoint, attempt),
              mandateId: mandate.id,
              ownerId: mandate.ownerId,
              ownerName: mandate.ownerName,
              buyerName: 'Craft & Culture',
              buyerAudience: 'trade',
              lwin18: mandate.lwin18,
              productName: preview.productName,
              bottles: input.bottles,
              caseConfig: mandate.caseConfig,
              salePricePerBottleUsd: mandate.askPerBottleUsd,
              saleTotalUsd: owedToOwnerUsd,
              askPerBottleUsd: mandate.askPerBottleUsd,
              owedToOwnerUsd,
              commissionPct: 0,
              commissionUsd: 0,
              source: 'manual',
              soldAt,
              recordedBy: ctx.user.id,
              notes: input.note ?? 'Bought by C&C in bond: no invoice and no warehouse movement',
            })
            .returning();
          return inserted;
        }),
      );
      if (!row) throw new Error('Could not record the purchase');
      // C&C is the buyer, so the money is in
      await writeConsignmentSettlement({ tx, sale: row, paidAt: soldAt });
      return row;
    });

    return { saved: true, saleNumber: sale.saleNumber, ...preview };
  });

export default adminRecordBondPurchase;
