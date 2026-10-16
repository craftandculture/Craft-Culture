import { and, notInArray, sql } from 'drizzle-orm';
import { z } from 'zod';

import db from '@/database/client';
import { logisticsShipmentItems, logisticsShipments } from '@/database/schema';
import { adminProcedure } from '@/lib/trpc/procedures';

/** Months shown on the report, ending with the current month */
const MONTHS_SHOWN = 12;

/** An inbound shipment is on time when it arrives within this many days of its ETA */
const ON_TIME_GRACE_DAYS = 2;

const DAY_MS = 24 * 60 * 60 * 1000;

const reportInputSchema = z
  .object({
    /** Month to report on, as YYYY-MM; defaults to the current month */
    month: z
      .string()
      .regex(/^\d{4}-\d{2}$/)
      .optional(),
  })
  .optional();

type ShipmentType = 'inbound' | 'outbound' | 're_export' | 'mainland_transfer';

interface VolumeBucket {
  bottles: number;
  cases: number;
  shipments: number;
}

interface LateShipment {
  id: string;
  shipmentNumber: string;
  name: string | null;
  carrierName: string | null;
  originCountry: string | null;
  eta: Date;
  arrivedAt: Date;
  daysLate: number;
}

/**
 * Month key (YYYY-MM) for a date, in Dubai time, which is where the team works
 *
 * @example
 *   monthKey(new Date('2026-09-30T22:00:00Z')); // '2026-10'
 *
 * @param date - The date to bucket
 * @returns The month key
 */
const monthKey = (date: Date) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Dubai',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(date);
  const year = parts.find((p) => p.type === 'year')?.value ?? '0000';
  const month = parts.find((p) => p.type === 'month')?.value ?? '01';
  return `${year}-${month}`;
};

/**
 * Step a YYYY-MM key by a number of months
 *
 * @example
 *   shiftMonth('2026-01', -1); // '2025-12'
 *
 * @param key - The month key
 * @param delta - Months to move (negative for earlier)
 * @returns The shifted month key
 */
const shiftMonth = (key: string, delta: number) => {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
};

/**
 * Monthly logistics report: volume, freight cost per bottle and inbound
 * on-time performance, for the selected month and the 12 months to date.
 *
 * Date rule — each shipment is counted in the month it physically moved:
 * - Inbound: actual arrival (ATA), else delivered date, else created date.
 * - Outbound, re-export and mainland transfer: actual departure (ATD), else
 *   delivered date, else created date.
 * Drafts and cancelled shipments are left out: nothing has moved.
 *
 * Bottles and cases come from line items (authoritative), falling back to the
 * shipment header counters only when a shipment has no items yet.
 *
 * Freight is the shipment's own freight cost; for a shipment in a
 * consolidation group it is the share of the group's logistics ledger
 * allocated to its items. Freight per bottle uses only imports that have a
 * freight figure, so part-costed months are not flattered; the number of
 * imports still without freight is returned alongside.
 *
 * On time (inbound only): arrival (ATA, else delivered date) is no later than
 * ETA plus two days. Inbound shipments that have not arrived, or have no ETA,
 * are not rated; those without an ETA are counted separately.
 */
const adminGetReportMetrics = adminProcedure.input(reportInputSchema).query(async ({ input }) => {
  const currentMonth = monthKey(new Date());
  const months = Array.from({ length: MONTHS_SHOWN }, (_, i) =>
    shiftMonth(currentMonth, i - (MONTHS_SHOWN - 1)),
  );
  const selectedMonth =
    input?.month && months.includes(input.month) ? input.month : currentMonth;
  const previousMonth = shiftMonth(selectedMonth, -1);

  // One month earlier than shown so the oldest month still has a comparison;
  // a day's slack covers the Dubai offset from UTC.
  const [firstYear, firstMonth] = shiftMonth(months[0] ?? currentMonth, -1)
    .split('-')
    .map(Number);
  const windowStart = new Date(Date.UTC(firstYear ?? 1970, (firstMonth ?? 1) - 1, 1) - DAY_MS);

  const movedAtSql = sql`CASE WHEN ${logisticsShipments.type} = 'inbound'
    THEN COALESCE(${logisticsShipments.ata}, ${logisticsShipments.deliveredAt}, ${logisticsShipments.createdAt})
    ELSE COALESCE(${logisticsShipments.atd}, ${logisticsShipments.deliveredAt}, ${logisticsShipments.createdAt})
  END`;

  const rows = await db
    .select({
      id: logisticsShipments.id,
      shipmentNumber: logisticsShipments.shipmentNumber,
      name: logisticsShipments.name,
      type: logisticsShipments.type,
      carrierName: logisticsShipments.carrierName,
      originCountry: logisticsShipments.originCountry,
      eta: logisticsShipments.eta,
      ata: logisticsShipments.ata,
      atd: logisticsShipments.atd,
      deliveredAt: logisticsShipments.deliveredAt,
      createdAt: logisticsShipments.createdAt,
      totalCases: sql<number>`COALESCE((
        SELECT SUM(${logisticsShipmentItems.cases})
        FROM ${logisticsShipmentItems}
        WHERE ${logisticsShipmentItems.shipmentId} = ${logisticsShipments.id}
      ), ${logisticsShipments.totalCases}, 0)`,
      totalBottles: sql<number>`COALESCE((
        SELECT SUM(COALESCE(
          ${logisticsShipmentItems.totalBottles},
          ${logisticsShipmentItems.cases} * COALESCE(${logisticsShipmentItems.bottlesPerCase}, 12)
        ))
        FROM ${logisticsShipmentItems}
        WHERE ${logisticsShipmentItems.shipmentId} = ${logisticsShipments.id}
      ), ${logisticsShipments.totalBottles}, 0)`,
      freightUsd: sql<number | null>`CASE WHEN ${logisticsShipments.groupId} IS NOT NULL
        THEN (
          SELECT SUM(${logisticsShipmentItems.freightAllocated})
          FROM ${logisticsShipmentItems}
          WHERE ${logisticsShipmentItems.shipmentId} = ${logisticsShipments.id}
        )
        ELSE ${logisticsShipments.freightCostUsd}
      END`,
    })
    .from(logisticsShipments)
    .where(
      and(
        notInArray(logisticsShipments.status, ['draft', 'cancelled']),
        sql`${movedAtSql} >= ${windowStart.toISOString()}::timestamp`,
      ),
    );

  const seriesMonths = [shiftMonth(months[0] ?? currentMonth, -1), ...months];
  const emptyVolume = (): VolumeBucket => ({ bottles: 0, cases: 0, shipments: 0 });
  const byMonth = new Map(
    seriesMonths.map((m) => [
      m,
      {
        volume: {
          inbound: emptyVolume(),
          outbound: emptyVolume(),
          re_export: emptyVolume(),
          mainland_transfer: emptyVolume(),
        } as Record<ShipmentType, VolumeBucket>,
        freightUsd: 0,
        freightedBottles: 0,
        importsWithoutFreight: 0,
        rated: 0,
        onTime: 0,
        noEta: 0,
        late: [] as LateShipment[],
      },
    ]),
  );

  for (const row of rows) {
    const bottles = Number(row.totalBottles) || 0;
    const cases = Number(row.totalCases) || 0;
    // Same rule as the SQL window above, applied to the mapped dates
    const movedAt =
      row.type === 'inbound'
        ? (row.ata ?? row.deliveredAt ?? row.createdAt)
        : (row.atd ?? row.deliveredAt ?? row.createdAt);
    const moved = byMonth.get(monthKey(movedAt));

    if (moved) {
      const bucket = moved.volume[row.type];
      bucket.bottles += bottles;
      bucket.cases += cases;
      bucket.shipments += 1;

      if (row.type === 'inbound') {
        const freight = row.freightUsd === null ? null : Number(row.freightUsd);
        if (freight && freight > 0 && bottles > 0) {
          moved.freightUsd += freight;
          moved.freightedBottles += bottles;
        } else {
          moved.importsWithoutFreight += 1;
        }
      }
    }

    // On-time is rated in the month the shipment actually arrived
    if (row.type !== 'inbound') continue;
    const arrivedAt = row.ata ?? row.deliveredAt;
    if (!arrivedAt) continue;
    const arrived = byMonth.get(monthKey(arrivedAt));
    if (!arrived) continue;
    if (!row.eta) {
      arrived.noEta += 1;
      continue;
    }
    arrived.rated += 1;
    const lateMs = arrivedAt.getTime() - row.eta.getTime();
    if (lateMs <= ON_TIME_GRACE_DAYS * DAY_MS) {
      arrived.onTime += 1;
    } else {
      arrived.late.push({
        id: row.id,
        shipmentNumber: row.shipmentNumber,
        name: row.name,
        carrierName: row.carrierName,
        originCountry: row.originCountry,
        eta: row.eta,
        arrivedAt,
        daysLate: Math.ceil(lateMs / DAY_MS),
      });
    }
  }

  const summarise = (key: string) => {
    const m = byMonth.get(key);
    if (!m) return null;
    const outbound = (['outbound', 're_export', 'mainland_transfer'] as const).reduce(
      (s, t) => s + m.volume[t].bottles,
      0,
    );
    return {
      month: key,
      volume: m.volume,
      bottlesIn: m.volume.inbound.bottles,
      bottlesOut: outbound,
      freightUsd: Math.round(m.freightUsd * 100) / 100,
      freightPerBottleUsd:
        m.freightedBottles > 0 ? Math.round((m.freightUsd / m.freightedBottles) * 100) / 100 : null,
      importsWithoutFreight: m.importsWithoutFreight,
      onTime: {
        rated: m.rated,
        onTime: m.onTime,
        late: m.late.length,
        noEta: m.noEta,
        rate: m.rated > 0 ? Math.round((m.onTime / m.rated) * 100) : null,
      },
    };
  };

  const series = months.map((m) => summarise(m)).filter((m) => m !== null);

  return {
    months,
    selectedMonth,
    selected: summarise(selectedMonth),
    previous: summarise(previousMonth),
    lateShipments: (byMonth.get(selectedMonth)?.late ?? []).sort((a, b) => b.daysLate - a.daysLate),
    series,
    onTimeGraceDays: ON_TIME_GRACE_DAYS,
  };
});

export default adminGetReportMetrics;
