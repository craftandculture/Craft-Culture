import { client } from '@/database/client';
import { adminProcedure } from '@/lib/trpc/procedures';

import { searchLwinReferenceSchema } from '../schemas/triangulationSchemas';
import wineIdentity from '../utils/wineIdentity';

export interface LwinReferenceResult {
  lwin7: string;
  displayName: string;
  producerName: string | null;
  region: string | null;
  country: string | null;
  /** The stem completed with this SKU's vintage, pack and bottle size */
  lwin18: string;
}

/**
 * Search the published LWIN list by name, for one SKU
 *
 * The automatic suggestions only reach wines whose names resemble the SKU's,
 * and the names here have been through three systems and a mis-decoded upload.
 * Someone who knows the wine can find it in one search where no amount of
 * fuzzy matching will; without this, a wine nothing happens to match has no
 * route forward at all, which is the state that stops the work.
 *
 * Results come back as whole codes rather than seven-digit stems, completed
 * with the SKU's own vintage, pack and bottle size, so what is chosen is what
 * gets stored.
 */
const adminSearchLwinReference = adminProcedure
  .input(searchLwinReferenceSchema)
  .query(async ({ input }) => {
    const { skuId, query } = input;

    const [sku] = await client<
      {
        productName: string;
        vintage: number | null;
        bottleSize: string | null;
        caseConfig: number;
        packFromInvoice: number | null;
      }[]
    >`
      SELECT
        k.product_name AS "productName",
        k.vintage,
        k.bottle_size AS "bottleSize",
        k.case_config AS "caseConfig",
        (
          SELECT MAX(NULLIF(SUBSTRING(l.raw_description FROM '(\\d+)\\s*[xX]\\s*\\d'), '')::int)
          FROM tri_import_lines l
          WHERE l.sku_id = k.id AND l.raw_description IS NOT NULL
        ) AS "packFromInvoice"
      FROM tri_skus k WHERE k.id = ${skuId} LIMIT 1
    `;

    if (!sku) return [];

    const rows = await client<
      {
        lwin7: string;
        displayName: string;
        producerName: string | null;
        region: string | null;
        country: string | null;
      }[]
    >`
      SELECT
        w.lwin AS "lwin7",
        w.display_name AS "displayName",
        w.producer_name AS "producerName",
        w.region,
        w.country
      FROM lwin_wines w
      WHERE w.status = 'live'
        AND w.display_name ILIKE ${`%${query.trim()}%`}
      ORDER BY LENGTH(w.display_name), w.display_name
      LIMIT 20
    `;

    const identity = wineIdentity(sku.productName, sku.vintage, sku.bottleSize);
    // 1000 is the reference list's own marker for a wine without a vintage.
    const vintage = identity.vintage
      ? String(identity.vintage).padStart(4, '0')
      : '1000';
    const pack = sku.packFromInvoice ?? sku.caseConfig ?? 6;
    const size = identity.sizeMl ?? 750;

    return rows.map((row) => ({
      ...row,
      lwin18: `${row.lwin7}-${vintage}-${String(pack).padStart(2, '0')}-${String(size).padStart(5, '0')}`,
    })) satisfies LwinReferenceResult[];
  });

export default adminSearchLwinReference;
