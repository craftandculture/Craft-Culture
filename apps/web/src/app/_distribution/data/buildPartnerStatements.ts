import buildMonthSettlement from './buildMonthSettlement';
import buildOutrightSales from './buildOutrightSales';

const round2 = (value: number) => Math.round(value * 100) / 100;

/**
 * One statement per partner for a month: consignment sales at the outlet and
 * outright sales to customers, side by side, and the total owed
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
  const [settlement, outright] = await Promise.all([
    buildMonthSettlement(input),
    buildOutrightSales(input.month),
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

    row.outrightBottles += line.bottles;
    row.outrightOwed += line.owed ?? 0;
    if (line.owed === null) row.withoutCost += 1;
    if (line.needsConfirm) row.toConfirm += 1;
  }

  const rows = [...partners.values()]
    .map((row) => ({
      ...row,
      consignmentOwed: round2(row.consignmentOwed),
      outrightOwed: round2(row.outrightOwed),
      totalOwed: round2(row.consignmentOwed + row.outrightOwed),
    }))
    .sort((a, b) => b.totalOwed - a.totalOwed);

  return {
    month: input.month,
    rows,
    outright: outright.lines,
    payouts: settlement.payouts,
    totals: {
      consignmentOwed: round2(rows.reduce((sum, row) => sum + row.consignmentOwed, 0)),
      outrightOwed: round2(rows.reduce((sum, row) => sum + row.outrightOwed, 0)),
      totalOwed: round2(rows.reduce((sum, row) => sum + row.totalOwed, 0)),
      toConfirm: outright.lines.filter((line) => line.needsConfirm).length,
      withoutCost: rows.reduce((sum, row) => sum + row.withoutCost, 0),
    },
  };
};

export default buildPartnerStatements;
