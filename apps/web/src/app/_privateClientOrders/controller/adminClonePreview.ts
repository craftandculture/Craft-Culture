import { TRPCError } from '@trpc/server';
import { eq, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { privateClientOrderItems, wmsStock } from '@/database/schema';
import { wmsOperatorProcedure } from '@/lib/trpc/procedures';

import { lwinPakKeyOf } from '../../_wms/utils/lwinPakKey';

/**
 * What cloning an order would take out of the warehouse
 *
 * Before a box is copied for the whole membership, the operator sees each line
 * in bottles — per box and for the batch — beside the bottles on hand. It is
 * the check that a box is really 3 or 6 bottles, and that there is enough of
 * each wine for everyone on it, made once before any order exists.
 *
 * Stock is counted in bottles across every pack of the wine (a six and two
 * loose bottles are eight bottles of it), and does not subtract other open
 * orders: it is on-hand stock, not stock promised to nobody.
 */
const adminClonePreview = wmsOperatorProcedure
  .input(
    z.object({
      orderId: z.string().uuid(),
      copies: z.number().int().min(0).max(60),
    }),
  )
  .query(async ({ input }) => {
    const items = await db
      .select()
      .from(privateClientOrderItems)
      .where(eq(privateClientOrderItems.orderId, input.orderId));

    if (items.length === 0) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'This order has no lines to copy',
      });
    }

    const lwins = [...new Set(items.flatMap((i) => (i.lwin ? [i.lwin] : [])))];

    // Every pack of the same wine counts: group on the pack-agnostic key
    const stockRows = lwins.length
      ? await db
          .select({
            lwin18: wmsStock.lwin18,
            bottles: sql<number>`SUM(${wmsStock.availableCases} * COALESCE(${wmsStock.caseConfig}, 1))::int`,
          })
          .from(wmsStock)
          .where(
            inArray(
              sql`split_part(${wmsStock.lwin18}, '-', 1) || '-' || split_part(${wmsStock.lwin18}, '-', 2) || '-' || split_part(${wmsStock.lwin18}, '-', 4)`,
              lwins.map(lwinPakKeyOf),
            ),
          )
          .groupBy(wmsStock.lwin18)
      : [];

    const onHand = new Map<string, number>();
    for (const row of stockRows) {
      const key = lwinPakKeyOf(row.lwin18);
      onHand.set(key, (onHand.get(key) ?? 0) + (row.bottles ?? 0));
    }

    // The source order ships too, so the batch is the clones plus one
    const boxes = input.copies + 1;

    const lines = items.map((item) => {
      const bottlesPerBox = item.quantity * (item.caseConfig ?? 1);
      const available = item.lwin ? (onHand.get(lwinPakKeyOf(item.lwin)) ?? 0) : null;

      return {
        id: item.id,
        productName: item.productName,
        vintage: item.vintage,
        lwin: item.lwin,
        bottlesPerBox,
        bottlesNeeded: bottlesPerBox * boxes,
        available,
        pricePerCaseUsd: item.pricePerCaseUsd,
        totalUsd: item.totalUsd,
      };
    });

    return {
      boxes,
      bottlesPerBox: lines.reduce((sum, l) => sum + l.bottlesPerBox, 0),
      boxTotalUsd: lines.reduce((sum, l) => sum + l.totalUsd, 0),
      lines,
    };
  });

export default adminClonePreview;
