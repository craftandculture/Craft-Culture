import { z } from 'zod';

import { client } from '@/database/client';
import { adminProcedure } from '@/lib/trpc/procedures';

import buildOwnerStatement from '../data/buildOwnerStatement';

/**
 * The month across every partner, and the one figure the outlet is invoiced
 *
 * The per-owner statement answers "what do we pay Crurated". This answers the
 * question that pays the bills: what City Drinks owe us for the month, which
 * is every partner's billed total added up, and what we owe each partner out
 * of it.
 *
 * Built by summing the same `buildOwnerStatement` the per-owner screen shows,
 * rather than by a second aggregate query. Two queries would be two FIFOs, and
 * a month would settle to one figure on one screen and another on the next.
 *
 * Margin is stated per partner because it is the number that gets questioned,
 * and a partner whose wines have no landed cost is reported rather than
 * averaged away — their margin is unknown, not large.
 *
 * @param outletId - The distributor
 * @param month - The month, as YYYY-MM
 * @returns A row per partner, and the totals beneath them
 */
const adminGetMonthSummary = adminProcedure
  .input(
    z.object({
      outletId: z.string().uuid(),
      month: z.string().regex(/^\d{4}-\d{2}$/, 'Expected a YYYY-MM month'),
    }),
  )
  .query(async ({ input }) => {
    const owners = await client<{ id: string; name: string }[]>`
      SELECT DISTINCT ow.id, ow.name
      FROM cons_arrangements a
      JOIN cons_owners ow ON ow.id = a.owner_id
      WHERE a.outlet_id = ${input.outletId} AND a.is_active
      ORDER BY ow.name
    `;

    const rows = await Promise.all(
      owners.map(async (owner) => {
        const statement = await buildOwnerStatement({
          ownerId: owner.id,
          outletId: input.outletId,
          month: input.month,
        });

        return {
          ownerId: owner.id,
          ownerName: owner.name,
          wines: statement.summary?.wines ?? 0,
          bottles: statement.summary?.bottles ?? 0,
          /** What we pay this partner */
          dueToOwner: statement.summary?.dueToOwner ?? 0,
          /** What City Drinks owe us for this partner's bottles */
          billedToOutlet: statement.summary?.billedToOutlet ?? 0,
          margin: statement.summary?.margin ?? 0,
          /** Wines with no landed cost — owed is understated by these */
          withoutCost: statement.summary?.withoutCost ?? 0,
          /** Bottles sold with no invoice layer left to bill them against */
          shortBottles: statement.summary?.shortBottles ?? 0,
          currency: statement.lines[0]?.currency ?? null,
        };
      }),
    );

    const selling = rows.filter((row) => row.bottles > 0);

    const totals = selling.reduce(
      (sum, row) => ({
        wines: sum.wines + row.wines,
        bottles: sum.bottles + row.bottles,
        dueToOwner: sum.dueToOwner + row.dueToOwner,
        billedToOutlet: sum.billedToOutlet + row.billedToOutlet,
        margin: sum.margin + row.margin,
        withoutCost: sum.withoutCost + row.withoutCost,
        shortBottles: sum.shortBottles + row.shortBottles,
      }),
      {
        wines: 0,
        bottles: 0,
        dueToOwner: 0,
        billedToOutlet: 0,
        margin: 0,
        withoutCost: 0,
        shortBottles: 0,
      },
    );

    return {
      month: input.month,
      /* Partners who sold nothing are not rows; they are not owed anything */
      rows: selling,
      totals,
      /*
        What we invoice City Drinks for the month. Named rather than left to be
        inferred from a column, because it is the one figure on this page that
        leaves the building as a demand for money.
      */
      invoiceToOutlet: totals.billedToOutlet,
    };
  });

export default adminGetMonthSummary;
