import { z } from 'zod';

import { client } from '@/database/client';
import { adminProcedure } from '@/lib/trpc/procedures';

export interface TriSkuAliasRow {
  id: string;
  source: string;
  aliasCode: string;
  aliasName: string | null;
}

export interface TriSkuRow {
  id: string;
  wCode: string;
  lwin18: string | null;
  productName: string;
  producer: string | null;
  vintage: number | null;
  bottleSize: string | null;
  caseConfig: number;
  isActive: boolean;
  notes: string | null;
  aliases: TriSkuAliasRow[];
}

/**
 * List the canonical W code SKUs with the external codes mapped to each
 *
 * Aliases come back nested so the Mapping tab can show, at a glance, which
 * SKUs City Drinks can already be reconciled against and which still need a
 * CD code attached.
 */
const adminGetSkus = adminProcedure
  .input(
    z.object({
      search: z.string().max(200).optional(),
      limit: z.number().int().positive().max(2000).default(500),
    }),
  )
  .query(async ({ input }) => {
    const { search, limit } = input;
    const term = search?.trim() ? `%${search.trim()}%` : null;

    const rows = await client<TriSkuRow[]>`
      SELECT
        s.id,
        s.w_code AS "wCode",
        s.lwin18,
        s.product_name AS "productName",
        s.producer,
        s.vintage,
        s.bottle_size AS "bottleSize",
        s.case_config AS "caseConfig",
        s.is_active AS "isActive",
        s.notes,
        COALESCE(
          (
            SELECT JSON_AGG(
              JSON_BUILD_OBJECT(
                'id', a.id,
                'source', a.source,
                'aliasCode', a.alias_code,
                'aliasName', a.alias_name
              )
              ORDER BY a.source, a.alias_code
            )
            FROM tri_sku_aliases a
            WHERE a.sku_id = s.id
          ),
          '[]'::json
        ) AS aliases
      FROM tri_skus s
      ${
        term
          ? client`WHERE s.w_code ILIKE ${term}
              OR s.product_name ILIKE ${term}
              OR s.producer ILIKE ${term}
              OR s.lwin18 ILIKE ${term}
              OR EXISTS (
                SELECT 1 FROM tri_sku_aliases a2
                WHERE a2.sku_id = s.id AND a2.alias_code ILIKE ${term}
              )`
          : client``
      }
      ORDER BY s.product_name, s.vintage
      LIMIT ${limit}
    `;

    return rows;
  });

export default adminGetSkus;
