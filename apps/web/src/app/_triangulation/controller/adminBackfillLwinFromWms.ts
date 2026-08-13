import normalizeLwin18 from '@/app/_wms/utils/normalizeLwin18';
import { client } from '@/database/client';
import { adminProcedure } from '@/lib/trpc/procedures';

import { autoMapSchema } from '../schemas/triangulationSchemas';
import tokenizeMatch from '../utils/tokenizeMatch';
import wineIdentity from '../utils/wineIdentity';

interface WmsCandidate {
  supplierSku: string | null;
  lwin18: string;
  productName: string | null;
  vintage: number | null;
}

/**
 * Give every SKU the dashed LWIN the WMS already holds for it
 *
 * Seeding the registry from the WMS inserts what is missing and leaves what
 * exists alone — `ON CONFLICT (w_code) DO NOTHING` — which is right for names
 * and pack sizes someone has since corrected by hand. The cost is that a SKU
 * created any other way never receives its LWIN, and almost all of them were.
 *
 * That empty column is what blocks the Zoho clean-up: without a dashed LWIN
 * there is no target to rename an item to, so every wine reads "no LWIN on the
 * SKU" and the worklist has nothing to say.
 *
 * Matched on the W code first, since that is what the WMS files stock under.
 * Where no W code matches, the wine's identity is tried — same name once
 * vintage and bottle size are stripped, with neither contradicting — because a
 * SKU that came from an invoice rather than the warehouse often carries a
 * different code but the same wine. Only SKUs with no LWIN are touched; an
 * existing one is left alone whether or not the WMS agrees, since overwriting
 * a correction with the thing it corrected is how quiet damage gets done.
 */
const adminBackfillLwinFromWms = adminProcedure
  .input(autoMapSchema)
  .mutation(async ({ input }) => {
    const { dryRun } = input;

    const skus = await client<
      {
        id: string;
        wCode: string;
        productName: string;
        vintage: number | null;
        bottleSize: string | null;
      }[]
    >`
      SELECT id, w_code AS "wCode", product_name AS "productName",
             vintage, bottle_size AS "bottleSize"
      FROM tri_skus
      WHERE lwin18 IS NULL OR TRIM(lwin18) = ''
    `;

    if (skus.length === 0) {
      return { dryRun, filled: 0, remaining: 0, examples: [] };
    }

    const candidates = await client<WmsCandidate[]>`
      SELECT DISTINCT ON (s.lwin18)
        s.supplier_sku AS "supplierSku",
        s.lwin18,
        s.product_name AS "productName",
        s.vintage
      FROM wms_stock s
      WHERE s.lwin18 IS NOT NULL
        AND TRIM(s.lwin18) <> ''
        AND NOT EXISTS (
          SELECT 1 FROM UNNEST(${tokenizeMatch('Crurated')}::text[]) AS t(tok)
          WHERE POSITION(
            tok IN REGEXP_REPLACE(UPPER(COALESCE(s.owner_name, '')), '[^A-Z0-9]', '', 'g')
          ) = 0
        )
      ORDER BY s.lwin18, s.received_at DESC NULLS LAST
    `;

    const normalize = (value: string) =>
      value.toUpperCase().replace(/[^A-Z0-9]/g, '');

    const byCode = new Map<string, string>();
    const byIdentity = new Map<string, string[]>();

    for (const candidate of candidates) {
      const lwin = normalizeLwin18(candidate.lwin18.trim());

      if (candidate.supplierSku?.trim()) {
        byCode.set(normalize(candidate.supplierSku), lwin);
      }

      if (candidate.productName) {
        const key = wineIdentity(
          candidate.productName,
          candidate.vintage,
          null,
        ).base;

        if (key) {
          byIdentity.set(key, [...(byIdentity.get(key) ?? []), lwin]);
        }
      }
    }

    const filled: { wCode: string; lwin18: string; how: string }[] = [];

    for (const sku of skus) {
      const fromCode = byCode.get(normalize(sku.wCode));

      // Only when exactly one wine in the WMS has that identity: two means a
      // guess, and a wrong LWIN here renames a Zoho item to another wine.
      const identity = wineIdentity(
        sku.productName,
        sku.vintage,
        sku.bottleSize,
      ).base;
      const matches = identity ? (byIdentity.get(identity) ?? []) : [];
      const unique = [...new Set(matches)];
      const fromIdentity = unique.length === 1 ? unique[0] : undefined;

      const lwin = fromCode ?? fromIdentity;

      if (!lwin) continue;

      filled.push({
        wCode: sku.wCode,
        lwin18: lwin,
        how: fromCode ? 'W code' : 'wine name',
      });

      if (!dryRun) {
        await client`
          UPDATE tri_skus SET lwin18 = ${lwin}, updated_at = NOW()
          WHERE id = ${sku.id}
        `;
      }
    }

    return {
      dryRun,
      filled: filled.length,
      remaining: skus.length - filled.length,
      byCode: filled.filter((entry) => entry.how === 'W code').length,
      byName: filled.filter((entry) => entry.how === 'wine name').length,
      examples: filled.slice(0, 8),
    };
  });

export default adminBackfillLwinFromWms;
