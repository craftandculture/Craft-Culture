import { sql } from 'drizzle-orm';

import db from '@/database/client';
import { adminProcedure } from '@/lib/trpc/procedures';

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
 * Find partners recorded twice under the same name
 *
 * Two records for one business is not a cosmetic duplicate. Owner pricing
 * settings are keyed on the partner id, so a margin set against one record does
 * not reach stock owned by the other — the screen shows the rate as configured
 * and half the wine prices as though it were not. The same split shows up as
 * one owner appearing twice in every filter, each holding part of the total.
 *
 * Names are compared with punctuation, spacing, case and the usual company
 * suffixes stripped, because that is how the pairs actually differ: "Craft &
 * Culture" against "Craft and Culture FZE".
 *
 * Read-only. Merging is a separate, deliberate act.
 *
 * @returns One entry per name held by more than one partner record
 */
const partnersFindDuplicates = adminProcedure.query(async () => {
  /*
    Normalised in SQL so the grouping and the counting agree. `&` becomes
    "and", punctuation goes, and the suffixes a business is registered under
    but rarely called by are dropped.
  */
  const normalised = sql`
    TRIM(REGEXP_REPLACE(
      REGEXP_REPLACE(
        LOWER(REGEXP_REPLACE(REPLACE(p.business_name, '&', ' and '), '[^a-zA-Z0-9 ]', ' ', 'g')),
        '\\s+(fze|fzc|fzco|llc|ltd|limited|inc|gmbh|sa|srl|bv|aps|as|ab|plc|co|company|trading|group|holdings)\\s*$',
        '', 'g'
      ),
      '\\s+', ' ', 'g'
    ))`;

  const rows = await db.execute<{
    id: string;
    business_name: string;
    type: string;
    status: string;
    created_at: Date | null;
    norm: string;
    stock_rows: number;
    stock_cases: number;
    shipments: number;
    has_pricing: boolean;
  }>(sql`
    WITH normalised AS (
      SELECT p.id, p.business_name, p.type::text AS type, p.status::text AS status,
             p.created_at, ${normalised} AS norm
        FROM partners p
    ),
    dupes AS (
      SELECT norm FROM normalised WHERE norm <> '' GROUP BY norm HAVING COUNT(*) > 1
    )
    SELECT n.id, n.business_name, n.type, n.status, n.created_at, n.norm,
           COALESCE(s.rows, 0)::int      AS stock_rows,
           COALESCE(s.cases, 0)::int     AS stock_cases,
           COALESCE(sh.shipments, 0)::int AS shipments,
           (op.owner_id IS NOT NULL)      AS has_pricing
      FROM normalised n
      JOIN dupes d ON d.norm = n.norm
      LEFT JOIN (
        SELECT owner_id, COUNT(*) AS rows, SUM(quantity_cases) AS cases
          FROM wms_stock GROUP BY owner_id
      ) s ON s.owner_id = n.id
      LEFT JOIN (
        SELECT partner_id, COUNT(*) AS shipments
          FROM logistics_shipments GROUP BY partner_id
      ) sh ON sh.partner_id = n.id
      LEFT JOIN wms_owner_pricing_settings op ON op.owner_id = n.id
     ORDER BY n.norm, s.cases DESC NULLS LAST, n.created_at ASC
  `);

  const groups = new Map<string, DuplicatePartnerGroup>();

  for (const row of rows) {
    const group = groups.get(row.norm) ?? {
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

    groups.set(row.norm, group);
  }

  return { groups: [...groups.values()] };
});

export default partnersFindDuplicates;
