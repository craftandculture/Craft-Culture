import { eq, isNotNull } from 'drizzle-orm';

import resolveFxToUsd from '@/app/_logistics/utils/resolveFxToUsd';
import db from '@/database/client';
import { cellarUkHoldings, cellarUkRotations, partners } from '@/database/schema';
import { staffAdminProcedure } from '@/lib/trpc/procedures';
import logger from '@/utils/logger';

import getUkRates from '../data/getUkRates';
import countChargeableCases from '../utils/countChargeableCases';
import ukStorageCharge, { toMemberPrice } from '../utils/ukRateCharge';

/** The dirham is pegged to the dollar */
const AED_PER_USD = 3.6725;

/**
 * This month's UK storage for every member with wine at LCB
 *
 * Wine is charged where it is held (Kevin, 19 October 2026): UK units under
 * the UK rate card, at LCB's cost plus our recharge, with no allowance; UAE
 * wine under the membership. Units are counted by the same rule as the UAE,
 * from LCB's latest report. Never throws: without a report or a rate card the
 * figures are simply absent.
 *
 * @example
 *   const { rows, rates } = await trpcClient.cellar.admin.getUkStorage.query();
 */
const adminGetUkStorage = staffAdminProcedure.query(async () => {
  const { current: rates } = await getUkRates();

  try {
    const lines = await db
      .select({
        partnerId: cellarUkRotations.partnerId,
        name: partners.businessName,
        cases: cellarUkHoldings.cases,
        singles: cellarUkHoldings.singles,
        bottlesPerCase: cellarUkHoldings.bottlesPerCase,
        bottleSizeLitres: cellarUkHoldings.bottleSizeLitres,
        totalBottles: cellarUkHoldings.totalBottles,
      })
      .from(cellarUkHoldings)
      .innerJoin(cellarUkRotations, eq(cellarUkHoldings.rotation, cellarUkRotations.rotation))
      .innerJoin(partners, eq(partners.id, cellarUkRotations.partnerId))
      .where(isNotNull(cellarUkRotations.partnerId));

    const byMember = new Map<string, { name: string; lines: typeof lines }>();
    for (const line of lines) {
      if (!line.partnerId) continue;
      const entry = byMember.get(line.partnerId) ?? { name: line.name, lines: [] };
      entry.lines.push(line);
      byMember.set(line.partnerId, entry);
    }

    const gbp = await resolveFxToUsd('GBP');
    const gbpToAed = gbp.source === 'unresolved' ? null : gbp.rate * AED_PER_USD;

    const rows = [...byMember.entries()]
      .map(([partnerId, { name, lines: held }]) => {
        const units = countChargeableCases(
          held.map((line) => ({
            quantityCases: line.cases,
            openBottles: line.singles,
            caseConfig: line.bottlesPerCase,
            bottleSize: line.bottleSizeLitres ? `${Math.round(line.bottleSizeLitres * 100)}cl` : '75cl',
          })),
        );
        const charge = rates ? ukStorageCharge(units, rates) : null;

        return {
          partnerId,
          name,
          cases: held.reduce((sum, line) => sum + line.cases, 0),
          bottles: held.reduce((sum, line) => sum + line.totalBottles, 0),
          units,
          costGbp: charge?.costGbp ?? null,
          chargedGbp: charge?.chargedGbp ?? null,
          chargedAed: charge && gbpToAed ? Math.round(charge.chargedGbp * gbpToAed * 100) / 100 : null,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    return {
      rates: rates
        ? {
            ...rates,
            storagePerUnitMonthMemberGbp: toMemberPrice(rates.storagePerUnitMonthGbp),
          }
        : null,
      gbpToAed,
      rows,
    };
  } catch (error) {
    logger.error('Could not work out UK storage', { error });
    return { rates: null, gbpToAed: null, rows: [] };
  }
});

export default adminGetUkStorage;
