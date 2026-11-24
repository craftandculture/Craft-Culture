import { client } from '@/database/client';

import buildMonthSettlement from './buildMonthSettlement';
import buildOutrightSales from './buildOutrightSales';
import tableReady from '../utils/tableReady';

const round2 = (value: number) => Math.round(value * 100) / 100;

/**
 * One statement per partner for a month: consignment sales at the outlet and
 * outright sales to customers, side by side, and the total owed
 *
 * Every bottle from a partner's lot sold that month counts, whoever bought it
 * (Sophie, 24 Nov 2026). Consignment is owed on the City Drinks sale, or on
 * dispatch to City Drinks for the owners paid that way (Strasky, Alain).
 *
 * Both halves are built by the functions the rest of the page reads, so a
 * partner's statement always agrees with the month's settlement and with the
 * outright list beneath it.
 *
 * @example
 *   const statements = await buildPartnerStatements({ outletId, month: '2026-10' });
 *
 * @param input - The consignment outlet and the month (YYYY-MM)
 * @returns A row per partner, the outright lines, and what still needs confirming
 */
const buildPartnerStatements = async (input: {
  outletId: string;
  month: string;
}) => {
  const [settlement, outright, adjustments] = await Promise.all([
    buildMonthSettlement(input),
    buildOutrightSales(input.month),
    (async () =>
      (await tableReady('cons_partner_adjustments'))
        ? client<
            {
              id: string;
              payee: string;
              partnerId: string | null;
              description: string;
              amount: number;
            }[]
          >`
            SELECT id, payee, partner_id AS "partnerId", description, amount::float8 AS amount
            FROM cons_partner_adjustments WHERE month = ${input.month}
            ORDER BY created_at
          `
        : [])(),
  ]);

  const partners = new Map<
    string,
    {
      partnerId: string | null;
      name: string;
      consignmentBottles: number;
      consignmentOwed: number;
      outrightBottles: number;
      outrightOwed: number;
      /** One-off lines on the statement this month */
      adjustments: number;
      withoutCost: number;
      toConfirm: number;
    }
  >();

  const rowFor = (partnerId: string | null, name: string) => {
    const key = partnerId ?? `name:${name}`;
    const existing = partners.get(key);

    if (existing) return existing;

    const created = {
      partnerId,
      name,
      consignmentBottles: 0,
      consignmentOwed: 0,
      outrightBottles: 0,
      outrightOwed: 0,
      adjustments: 0,
      withoutCost: 0,
      toConfirm: 0,
    };

    partners.set(key, created);

    return created;
  };

  for (const owner of settlement.payouts) {
    const row = rowFor(owner.partnerId, owner.ownerName);

    row.consignmentBottles += owner.bottles;
    row.consignmentOwed += owner.dueToOwner;
    row.withoutCost += owner.withoutCost;
  }

  for (const line of outright.lines) {
    const row = rowFor(line.ownerPartnerId, line.ownerName ?? 'Owner unknown');

    /* Consignment owed on dispatch sits with the partner's consignment */
    if (line.basis === 'dispatch') {
      row.consignmentBottles += line.bottles;
      row.consignmentOwed += line.owed ?? 0;
    } else {
      row.outrightBottles += line.bottles;
      row.outrightOwed += line.owed ?? 0;
    }

    if (line.owed === null) row.withoutCost += 1;
    if (line.needsConfirm) row.toConfirm += 1;
  }

  /* One-off lines, on the partner's row when it is one, else by name */
  for (const adjustment of adjustments) {
    const byName = [...partners.values()].find(
      (row) => row.name.toLowerCase() === adjustment.payee.toLowerCase(),
    );
    const row = adjustment.partnerId
      ? rowFor(adjustment.partnerId, byName?.name ?? adjustment.payee)
      : (byName ?? rowFor(null, adjustment.payee));

    row.adjustments += adjustment.amount;
  }

  const rows = [...partners.values()]
    .map((row) => ({
      ...row,
      consignmentOwed: round2(row.consignmentOwed),
      outrightOwed: round2(row.outrightOwed),
      adjustments: round2(row.adjustments),
      totalOwed: round2(row.consignmentOwed + row.outrightOwed + row.adjustments),
    }))
    .sort((a, b) => b.totalOwed - a.totalOwed);

  return {
    month: input.month,
    rows,
    outright: outright.lines,
    payouts: settlement.payouts,
    adjustments,
    totals: {
      consignmentOwed: round2(rows.reduce((sum, row) => sum + row.consignmentOwed, 0)),
      outrightOwed: round2(rows.reduce((sum, row) => sum + row.outrightOwed, 0)),
      adjustments: round2(rows.reduce((sum, row) => sum + row.adjustments, 0)),
      totalOwed: round2(rows.reduce((sum, row) => sum + row.totalOwed, 0)),
      toConfirm: outright.lines.filter((line) => line.needsConfirm).length,
      withoutCost: rows.reduce((sum, row) => sum + row.withoutCost, 0),
    },
  };
};

export default buildPartnerStatements;
