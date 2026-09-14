import { desc, eq, inArray } from 'drizzle-orm';

import db from '@/database/client';
import { saleMandateLots, saleMandates } from '@/database/schema';
import { stockOwnerProcedure } from '@/lib/trpc/procedures';

import { commissionPctFor } from '../constants/commissionRates';

/**
 * A member's own offers, newest first
 *
 * The listed price is returned alongside the ask, because the member is shown
 * what their wine sells for — the margin is disclosed where they can see it
 * rather than discovered later on a price list.
 */
const memberGetMandates = stockOwnerProcedure.query(async ({ ctx }) => {
  const mandates = await db
    .select()
    .from(saleMandates)
    .where(eq(saleMandates.ownerId, ctx.partner.id))
    .orderBy(desc(saleMandates.createdAt))
    .limit(100);

  if (mandates.length === 0) return { mandates: [] };

  /*
    Scoped to this member's own mandates. Selecting every lot and filtering in
    memory would work and would also hand one member's cellar to another the
    first time somebody edited the filter.
  */
  const lots = await db
    .select()
    .from(saleMandateLots)
    .where(
      inArray(
        saleMandateLots.mandateId,
        mandates.map((mandate) => mandate.id),
      ),
    );

  const byMandate = new Map<string, typeof lots>();

  for (const lot of lots) {
    byMandate.set(lot.mandateId, [...(byMandate.get(lot.mandateId) ?? []), lot]);
  }

  return {
    mandates: mandates.map((mandate) => {
      const commissionPct = commissionPctFor('collector');

      return {
        ...mandate,
        /*
          What a buyer pays. The ask is the member's net, so the shelf price is
          the ask with commission added on top — not the ask with commission
          taken out of it, which is the reading that makes a member feel
          short-changed by a number they chose themselves.
        */
        listedPerBottleUsd:
          commissionPct >= 100
            ? mandate.askPerBottleUsd
            : Math.round(
                (mandate.askPerBottleUsd / (1 - commissionPct / 100)) * 100,
              ) / 100,
        commissionPct,
        lots: byMandate.get(mandate.id) ?? [],
      };
    }),
  };
});

export default memberGetMandates;
