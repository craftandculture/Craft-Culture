import { sql } from 'drizzle-orm';

import db from '@/database/client';
import { adminProcedure } from '@/lib/trpc/procedures';

import normalisePartnerName from '../utils/normalisePartnerName';
import partnerReferenceColumns from '../utils/partnerReferenceColumns';

export interface DuplicatePartnerRecord {
  id: string;
  businessName: string;
  type: string;
  status: string;
  createdAt: Date | null;
  /** How much each record is actually carrying, to decide which one survives */
  stockRows: number;
  stockCases: number;
  shipments: number;
  hasPricingSettings: boolean;
}

export interface DuplicatePartnerGroup {
  /** The name they share, as one of them writes it */
  businessName: string;
  records: DuplicatePartnerRecord[];
}

/**
 * Find businesses recorded under more than one partner record
 *
 * Two records for one business is not a cosmetic duplicate. Owner pricing
 * settings are keyed on the partner id, so a margin set against one record does
 * not reach stock owned by the other — the screen shows the rate as configured
 * and half the wine prices as though it were not. The same split shows one
 * owner twice in every filter, each holding part of the total.
 *
 * The names are compared with the same rule that now refuses to create a
 * duplicate in the first place, so what this finds and what creation blocks
 * cannot drift apart.
 *
 * Read-only. Merging is a separate, deliberate act.
 *
 * @returns One entry per name held by more than one partner record
 */
const partnersFindDuplicates = adminProcedure.query(async () => {
  const rows = await db.execute<{
    id: string;
    business_name: string;
    type: string;
    status: string;
    created_at: Date | null;
    stock_rows: number;
    stock_cases: number;
    shipments: number;
    has_pricing: boolean;
  }>(sql`
    SELECT p.id, p.business_name, p.type::text AS type, p.status::text AS status,
           p.created_at,
           COALESCE(s.rows, 0)::int       AS stock_rows,
           COALESCE(s.cases, 0)::int      AS stock_cases,
           COALESCE(sh.shipments, 0)::int AS shipments,
           (op.owner_id IS NOT NULL)      AS has_pricing
      FROM partners p
      LEFT JOIN (
        SELECT owner_id, COUNT(*) AS rows, SUM(quantity_cases) AS cases
          FROM wms_stock GROUP BY owner_id
      ) s ON s.owner_id = p.id
      LEFT JOIN (
        SELECT partner_id, COUNT(*) AS shipments
          FROM logistics_shipments GROUP BY partner_id
      ) sh ON sh.partner_id = p.id
      LEFT JOIN wms_owner_pricing_settings op ON op.owner_id = p.id
  `);

  /*
    Grouped here rather than in SQL so the comparison is the shared rule, not a
    second copy of it written in Postgres. There are dozens of partners, not
    thousands, so the work is trivial and the agreement is guaranteed.
  */
  const groups = new Map<string, DuplicatePartnerGroup>();

  for (const row of rows) {
    const key = normalisePartnerName(row.business_name);

    if (!key) continue;

    const group = groups.get(key) ?? {
      businessName: row.business_name,
      records: [],
    };

    group.records.push({
      id: row.id,
      businessName: row.business_name,
      type: row.type,
      status: row.status,
      createdAt: row.created_at,
      stockRows: Number(row.stock_rows),
      stockCases: Number(row.stock_cases),
      shipments: Number(row.shipments),
      hasPricingSettings: Boolean(row.has_pricing),
    });

    groups.set(key, group);
  }

  const candidates = [...groups.values()].filter(
    (group) => group.records.length > 1,
  );

  /*
    A retired record that still holds nothing is history, not a duplicate.

    It has to be asked of the data, not inferred from the name or the status:
    the case this exists for is a record retired by an earlier merge that has
    since had something attached to it again — an order raised against the old
    id — and that is precisely the thing worth surfacing. Counting is cheap
    because it only runs for names that already collide, which is normally none.
  */
  const retired = candidates
    .flatMap((group) => group.records)
    .filter((record) => record.status !== 'active');

  const emptyRetired = new Set<string>();

  if (retired.length > 0) {
    const targets = await partnerReferenceColumns();

    for (const record of retired) {
      let held = 0;

      for (const target of targets) {
        const [row] = await db.execute<{ n: number }>(sql`
          SELECT COUNT(*)::int AS n
            FROM ${sql.raw(`"${target.table}"`)}
           WHERE ${sql.raw(`"${target.column}"`)} = ${record.id}
        `);

        held += Number(row?.n ?? 0);

        if (held > 0) break;
      }

      if (held === 0) emptyRetired.add(record.id);
    }
  }

  return {
    groups: candidates
      .map((group) => ({
        ...group,
        records: group.records
          .filter((record) => !emptyRetired.has(record.id))
          // The biggest holding first: it is the one most likely to be the keeper
          .sort((a, b) => b.stockCases - a.stockCases),
      }))
      .filter((group) => group.records.length > 1),
  };
});

export default partnersFindDuplicates;
