import { and, eq } from 'drizzle-orm';

import db from '@/database/client';
import { cellarReleaseRates, partners } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

/**
 * List all partner pricing overrides
 *
 * Returns every partner with bespoke PCO pricing, with the partner's name for
 * display. Private Cellar members are listed automatically, one row each,
 * priced at their cellar rate card: their own where it has been keyed in the
 * Rates section of their cellar, otherwise the house tariff. Those rows are
 * read-only here, because the cellar's Rates section is where they are set,
 * and any older row typed into this table for a member is no longer used.
 */
const partnerOverridesList = adminProcedure.query(async () => {
  const [overrides, members, rateCards] = await Promise.all([
    db.query.partnerPricingOverrides.findMany({
      with: {
        partner: true,
      },
      orderBy: (table, { asc }) => asc(table.createdAt),
    }),
    db
      .select({ id: partners.id, businessName: partners.businessName })
      .from(partners)
      .where(
        and(
          eq(partners.type, 'private_collector'),
          eq(partners.status, 'active'),
        ),
      )
      .orderBy(partners.businessName),
    db.select().from(cellarReleaseRates),
  ]);

  const manual = overrides
    .filter((override) => override.partner.type !== 'private_collector')
    .map((override) => ({
      id: override.id,
      partnerId: override.partnerId,
      partnerName: override.partner.businessName,
      partnerType: override.partner.type,
      source: 'manual' as 'manual' | 'cellar_house' | 'cellar_bespoke',
      ccMarginPercent: override.ccMarginPercent,
      importDutyPercent: override.importDutyPercent,
      transferCostPercent: override.transferCostPercent,
      distributorMarginPercent: override.distributorMarginPercent,
      vatPercent: override.vatPercent,
      handlingPerBottleUsd: null as number | null,
      effectiveFrom: override.effectiveFrom,
      effectiveUntil: override.effectiveUntil,
      notes: override.notes,
      createdAt: override.createdAt,
      updatedAt: override.updatedAt,
    }));

  const house = rateCards.find((card) => card.partnerId === null);

  const cellar = members.flatMap((member) => {
    const own = rateCards.find((card) => card.partnerId === member.id);
    const card = own ?? house;

    if (!card) return [];

    return [
      {
        id: `cellar-${member.id}`,
        partnerId: member.id,
        partnerName: member.businessName,
        partnerType: 'private_collector' as const,
        source: own ? ('cellar_bespoke' as const) : ('cellar_house' as const),
        ccMarginPercent: card.ccMarginPct as number | null,
        importDutyPercent: card.dutyPct as number | null,
        transferCostPercent: 0 as number | null,
        distributorMarginPercent: card.distributorMarginPct as number | null,
        vatPercent: card.vatPct as number | null,
        handlingPerBottleUsd: card.transferPerBottle as number | null,
        effectiveFrom: null,
        effectiveUntil: null,
        notes: own
          ? `Own Private Cellar rates (${card.version})`
          : `House tariff (${card.version})`,
        createdAt: card.createdAt,
        updatedAt: card.updatedAt,
      },
    ];
  });

  return [...manual, ...cellar];
});

export default partnerOverridesList;
