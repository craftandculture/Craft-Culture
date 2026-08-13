import { client } from '@/database/client';
import { adminProcedure } from '@/lib/trpc/procedures';

import { autoMapSchema } from '../schemas/triangulationSchemas';
import deriveLwinFromCodes from '../utils/deriveLwinFromCodes';
import wineIdentity from '../utils/wineIdentity';

/**
 * Give every SKU the LWIN its own Zoho codes already imply
 *
 * The warehouse can only suggest a code for stock it has held, which leaves
 * the wines that were invoiced and never received stuck with nothing offered.
 * But those wines have codes of their own, and the codes are usually right —
 * a champagne carried `2665483-1000-66-00750` against `2665483-1000-06-00750`
 * for the same wine, where 66 is a typed 06 and nobody sells 66 to a case.
 *
 * The wine, vintage and bottle size agree across every code, so the only
 * question is the pack, and the invoice states it: "(6x75cl)".
 *
 * Stronger evidence than any name search, since these codes were written
 * against the very invoices being reconciled rather than resembling them.
 */
const adminDeriveLwins = adminProcedure
  .input(autoMapSchema)
  .mutation(async ({ input }) => {
    const { dryRun } = input;

    const rows = await client<
      {
        id: string;
        wCode: string;
        productName: string;
        vintage: number | null;
        bottleSize: string | null;
        packFromInvoice: number | null;
        codes: { code: string; bottles: number }[];
      }[]
    >`
      SELECT
        k.id,
        k.w_code AS "wCode",
        k.product_name AS "productName",
        k.vintage,
        k.bottle_size AS "bottleSize",
        (
          SELECT MAX(NULLIF(SUBSTRING(l.raw_description FROM '(\d+)\s*[xX]\s*\d'), '')::int)
          FROM tri_import_lines l
          WHERE l.sku_id = k.id AND l.raw_description IS NOT NULL
        ) AS "packFromInvoice",
        COALESCE((
          SELECT JSON_AGG(JSON_BUILD_OBJECT('code', c.code, 'bottles', c.bottles))
          FROM (
            SELECT
              MIN(l.raw_code) AS code,
              COALESCE(SUM(l.quantity_bottles), 0)::float8 AS bottles
            FROM tri_import_lines l
            WHERE l.sku_id = k.id AND COALESCE(l.raw_code, '') <> ''
            GROUP BY l.normalized_code
          ) c
        ), '[]'::json) AS codes
      FROM tri_skus k
      WHERE k.lwin18 IS NULL OR TRIM(k.lwin18) = ''
    `;

    const derived: { wCode: string; lwin18: string; reason: string }[] = [];

    for (const row of rows) {
      const identity = wineIdentity(
        row.productName,
        row.vintage,
        row.bottleSize,
      );
      const result = deriveLwinFromCodes(
        row.codes,
        row.packFromInvoice,
        identity.vintage,
        identity.sizeMl,
      );

      if (!result) continue;

      derived.push({
        wCode: row.wCode,
        lwin18: result.lwin18,
        reason: result.reason,
      });

      if (!dryRun) {
        await client`
          UPDATE tri_skus
          SET lwin18 = ${result.lwin18}, updated_at = NOW()
          WHERE id = ${row.id}
        `;
      }
    }

    return {
      dryRun,
      derived: derived.length,
      remaining: rows.length - derived.length,
      examples: derived.slice(0, 8),
    };
  });

export default adminDeriveLwins;
