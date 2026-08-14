import { client } from '@/database/client';
import { adminProcedure } from '@/lib/trpc/procedures';

import lwinDifferences from '../utils/lwinDifferences';
import wineIdentity from '../utils/wineIdentity';

export interface ZohoCodeUse {
  /** The item code as Zoho holds it */
  code: string | null;
  normalizedCode: string;
  description: string | null;
  lines: number;
  bottles: number;
  /** This is the dashed C&C LWIN — the one item that should stay active */
  isStandard: boolean;
  /** Invoices riding on it, so a change can be checked against the paper */
  docRefs: string[];
  /** What this code gets wrong, field by field, against the keeper */
  differs: string[];
  /**
   * A different wine altogether, not a legacy code for this one.
   *
   * A differing seven-digit stem names another wine — but only when the
   * invoice text agrees. Zoho holds the right wine under a wrong LWIN7 often
   * enough that the stem alone convicts the innocent: Etienne Calsac Les
   * Revenants sat under 1186465 against a registry saying 2024996, on an
   * invoice line reading Etienne Calsac Les Revenants. That is a bad code, and
   * its bottles belong here.
   *
   * So both have to disagree. When they do it is a mapping error — someone
   * else's bottles counted here — and retiring the Zoho item would destroy a
   * live product to hide it.
   */
  isDifferentWine: boolean;
}

export interface ZohoCleanupWine {
  skuId: string;
  wCode: string;
  productName: string;
  vintage: number | null;
  /** The dashed C&C LWIN every future invoice should carry */
  targetLwin18: string | null;
  /**
   * Every code this wine legitimately needs, one per pack format sold.
   *
   * LWIN-18 encodes the pack, so a wine sold in sixes and twelves is two
   * codes and two live Zoho items — not one keeper and one thing to retire.
   * Read from the packs the invoices actually state.
   */
  targets: { lwin18: string; pack: number; bottles: number }[];
  codes: ZohoCodeUse[];
  lines: number;
  bottles: number;
  /** An item already carrying the dashed LWIN exists in Zoho */
  hasStandard: boolean;
  /** Codes to make inactive once the standard item is in place */
  legacyCodes: number;
}

/**
 * Zoho's item codes for the Crurated wines, gathered per wine
 *
 * Framed around the wine rather than the code, because the safe way through
 * this is per wine: make sure one item carries the dashed C&C LWIN, then make
 * the rest inactive. Editing an item that historical invoices point at is the
 * thing to avoid — deactivating one changes nothing that was already issued,
 * and the alias table goes on resolving the old codes, so the reconciliation
 * keeps reading history correctly throughout.
 *
 * Scoped to wines in the triangulation registry. The invoices to City Drinks
 * carry other wines too, and those are somebody else's clean-up.
 */
const adminGetZohoCleanup = adminProcedure.query(async () => {
  const rows = await client<
    {
      skuId: string;
      wCode: string;
      productName: string;
      vintage: number | null;
      targetLwin18: string | null;
      codes: ZohoCodeUse[];
    }[]
  >`
    WITH uses AS (
      SELECT
        l.sku_id,
        l.normalized_code,
        MIN(l.raw_code) AS raw_code,
        MIN(l.raw_description) AS description,
        COUNT(*)::int AS lines,
        COALESCE(SUM(l.quantity_bottles), 0)::float8 AS bottles,
        ARRAY_REMOVE(ARRAY_AGG(DISTINCT l.doc_ref), NULL) AS doc_refs
      FROM tri_import_lines l
      JOIN tri_imports i ON i.id = l.import_id
      WHERE i.kind = 'cc_sales_to_cd'
        AND i.alias_source = 'zoho'
        AND l.sku_id IS NOT NULL
        AND COALESCE(l.normalized_code, '') <> ''
      GROUP BY l.sku_id, l.normalized_code
    )
    SELECT
      s.id AS "skuId",
      s.w_code AS "wCode",
      s.product_name AS "productName",
      s.vintage,
      s.lwin18 AS "targetLwin18",
      JSON_AGG(
        JSON_BUILD_OBJECT(
          'pack', NULLIF(SUBSTRING(u.description FROM '(\d+)\s*[xX]\s*\d'), '')::int,
          'code', u.raw_code,
          'normalizedCode', u.normalized_code,
          'description', u.description,
          'lines', u.lines,
          'bottles', u.bottles,
          -- Compared with punctuation stripped, so a dashless copy of the
          -- right LWIN counts as standard: it needs its dashes back, not a
          -- new item.
          'isStandard', (
            s.lwin18 IS NOT NULL
            AND UPPER(REGEXP_REPLACE(s.lwin18, '[^A-Za-z0-9]', '', 'g'))
              = u.normalized_code
          ),
          'docRefs', u.doc_refs
        )
        ORDER BY u.bottles DESC
      ) AS codes
    FROM uses u
    JOIN tri_skus s ON s.id = u.sku_id
    GROUP BY s.id, s.w_code, s.product_name, s.vintage, s.lwin18
    ORDER BY SUM(u.bottles) DESC
    LIMIT 500
  `;

  /**
   * Whether a code belongs to a different wine, on the evidence of both the
   * code and the words printed beside it on the invoice.
   */
  const isAnotherWine = (
    code: { code: string | null; description: string | null },
    row: { productName: string; vintage: number | null; targetLwin18: string | null },
  ) => {
    const stemDiffers = lwinDifferences(code.code, row.targetLwin18).some(
      (note) => note.startsWith('wine '),
    );

    if (!stemDiffers) return false;

    // The invoice text is the second opinion. Without a description there is
    // only the stem, and convicting on that alone is what put Calsac's own
    // bottles up for removal.
    if (!code.description) return false;

    const wine = wineIdentity(row.productName, row.vintage, null);
    const line = wineIdentity(code.description, null, null);

    if (!wine.base || !line.base) return false;

    return wine.base !== line.base;
  };

  /**
   * The codes a wine actually needs, one per pack format its invoices state.
   *
   * Assuming a single keeper turned a legitimate second format into something
   * to deactivate: Lafouge Auxey-Duresses sells in sixes and in twelves, and
   * both are real products with codes of their own.
   */
  const targetsFor = (row: {
    targetLwin18: string | null;
    codes: (ZohoCodeUse & { pack?: number | null })[];
  }) => {
    if (!row.targetLwin18) return [];

    const shape = /^(.+)-(\d{4})-(\d{2})-(\d{5})$/.exec(row.targetLwin18);

    if (!shape) return [{ lwin18: row.targetLwin18, pack: 0, bottles: 0 }];

    const packs = new Map<number, number>();

    for (const code of row.codes) {
      // Only a pack the invoice states in words. The digits inside a code are
      // exactly what is under suspicion here.
      const pack = code.pack ?? null;

      if (!pack || pack < 1 || pack > 24) continue;

      packs.set(pack, (packs.get(pack) ?? 0) + code.bottles);
    }

    if (packs.size === 0) {
      return [{ lwin18: row.targetLwin18, pack: Number(shape[3]), bottles: 0 }];
    }

    return [...packs.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([pack, bottles]) => ({
        lwin18: `${shape[1]}-${shape[2]}-${String(pack).padStart(2, '0')}-${shape[4]}`,
        pack,
        bottles,
      }));
  };

  const wines: ZohoCleanupWine[] = rows.map((row) => ({
    ...row,
    targets: targetsFor(row),
    codes: row.codes.map((code) => ({
      ...code,
      differs: code.isStandard
        ? []
        : lwinDifferences(code.code, row.targetLwin18),
      isDifferentWine: !code.isStandard && isAnotherWine(code, row),
    })),
    lines: row.codes.reduce((total, code) => total + code.lines, 0),
    bottles: row.codes.reduce((total, code) => total + code.bottles, 0),
    hasStandard: row.codes.some((code) => code.isStandard),

    legacyCodes: row.codes.filter(
      (code) => !code.isStandard && !isAnotherWine(code, row),
    ).length,
  }));

  return {
    wines,
    summary: {
      total: wines.length,
      /** One item carries the dashed LWIN and nothing else is in use */
      clean: wines.filter((wine) => wine.hasStandard && wine.legacyCodes === 0)
        .length,
      /** The right item exists; the others need deactivating */
      deactivateOnly: wines.filter(
        (wine) => wine.hasStandard && wine.legacyCodes > 0,
      ).length,
      /** No item carries the LWIN yet, so one has to be put right first */
      needsStandard: wines.filter(
        (wine) => !wine.hasStandard && wine.targetLwin18,
      ).length,
      /** No LWIN on the SKU at all, so there is no target to work towards */
      noLwin: wines.filter((wine) => !wine.targetLwin18).length,
      legacyCodes: wines.reduce((total, wine) => total + wine.legacyCodes, 0),
    },
  };
});

export default adminGetZohoCleanup;
