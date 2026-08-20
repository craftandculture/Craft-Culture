import { z } from 'zod';

import { client } from '@/database/client';
import { adminProcedure } from '@/lib/trpc/procedures';

import mapImportLines from '../data/mapImportLines';
import type { TriAliasSource } from '../schemas/triangulationSchemas';
import resolveProgrammeId, { uuidLike } from '../utils/programmeId';

interface SeedCandidate {
  normalizedCode: string;
  rawCode: string | null;
  rawDescription: string | null;
  rawVintage: string | null;
  caseConfig: number | null;
}

/** A dashed LWIN18, which is a wine's real identity rather than a house code */
const LWIN18 = /^[0-9]{7}-[0-9]{4}-[0-9]{2}-[0-9]{5}$/;

/**
 * Build a client's wine registry out of the documents they sent
 *
 * Crurated's registry came from the warehouse: we hold their stock, so
 * `wms_stock` already knew every wine. A consignment client is the opposite —
 * we never touch the bottles, so the only place their wines are named is the
 * invoices themselves.
 *
 * Without this a new client is stuck at the first step. Every line lands
 * unmapped, and mapping needs a SKU to map *to*, so the queue offers hundreds
 * of codes and nothing to resolve them against. One wine at a time through
 * "New SKU" is not a route through several hundred.
 *
 * Only codes that resolve to nothing are considered, so it is safe to re-run as
 * more invoices arrive: wines already in the registry keep the names, vintages
 * and pack sizes anyone has corrected by hand.
 *
 * Each wine is inserted with its own alias in the same step rather than the
 * whole set being matched up afterwards on product name — two codes can share
 * a description, and pairing them by name would attach one wine's code to
 * another wine's SKU.
 */
const adminSeedSkusFromImports = adminProcedure
  .input(
    z.object({
      programmeId: uuidLike.optional().nullable(),
      /** Confine it to one upload rather than everything outstanding */
      importId: z.string().uuid().optional().nullable(),
    }),
  )
  .mutation(async ({ input }) => {
    const programmeId = resolveProgrammeId(input.programmeId);
    const { importId } = input;

    // DISTINCT ON keeps one row per code — the same wine appears on every
    // invoice that sold it, and each occurrence would otherwise become its own
    // SKU, splitting the wine's history across duplicates.
    const candidates = await client<SeedCandidate[]>`
      SELECT DISTINCT ON (l.normalized_code)
        l.normalized_code AS "normalizedCode",
        l.raw_code AS "rawCode",
        NULLIF(TRIM(l.raw_description), '') AS "rawDescription",
        l.raw_vintage AS "rawVintage",
        l.case_config AS "caseConfig"
      FROM tri_import_lines l
      JOIN tri_imports i ON i.id = l.import_id
      WHERE i.programme_id = ${programmeId}
        AND l.status = 'unmapped'
        AND NULLIF(TRIM(l.normalized_code), '') IS NOT NULL
        ${importId ? client`AND l.import_id = ${importId}` : client``}
        AND NOT EXISTS (
          SELECT 1 FROM tri_sku_aliases a
          WHERE a.programme_id = ${programmeId}
            AND a.normalized_code = l.normalized_code
        )
      ORDER BY l.normalized_code, l.id
    `;

    let skusCreated = 0;

    for (const candidate of candidates) {
      const productName =
        candidate.rawDescription ??
        candidate.rawCode ??
        candidate.normalizedCode;

      const lwin18 =
        candidate.rawCode && LWIN18.test(candidate.rawCode.trim())
          ? candidate.rawCode.trim()
          : null;

      const vintageDigits = (candidate.rawVintage ?? '').replace(/[^0-9]/g, '');
      const vintage = vintageDigits.length === 4 ? Number(vintageDigits) : null;

      // The line is trusted for the pack, as the invoice feed is, because the
      // money on the document already agrees with it.
      const fromDescription = /([0-9]+)\s*[xX×]/.exec(
        candidate.rawDescription ?? '',
      )?.[1];
      const caseConfig =
        candidate.caseConfig ??
        (fromDescription ? Number(fromDescription) : null) ??
        6;

      const [sku] = await client<{ id: string }[]>`
        INSERT INTO tri_skus (
          programme_id, w_code, lwin18, product_name, vintage, case_config, notes
        )
        VALUES (
          ${programmeId}, NULL, ${lwin18}, ${productName}, ${vintage},
          ${caseConfig > 0 && caseConfig <= 24 ? caseConfig : 6},
          ${'Created from an imported document.'}
        )
        RETURNING id
      `;

      if (!sku) continue;

      await client`
        INSERT INTO tri_sku_aliases (
          programme_id, sku_id, source, alias_code, normalized_code, alias_name
        )
        VALUES (
          ${programmeId}, ${sku.id}, 'zoho',
          ${candidate.rawCode ?? candidate.normalizedCode},
          ${candidate.normalizedCode}, ${productName}
        )
        ON CONFLICT (programme_id, source, normalized_code) DO NOTHING
      `;

      skusCreated += 1;
    }

    // Replay the mapping so the bottles land in the figures straight away
    // rather than after someone works out that a second step is needed.
    const imports = await client<{ id: string; aliasSource: string }[]>`
      SELECT id, alias_source AS "aliasSource"
      FROM tri_imports
      WHERE programme_id = ${programmeId}
        ${importId ? client`AND id = ${importId}` : client``}
    `;

    let mappedRowCount = 0;

    for (const row of imports) {
      const result = await mapImportLines(
        row.id,
        row.aliasSource as TriAliasSource,
      );

      mappedRowCount += result.mappedRowCount;
    }

    return {
      skusCreated,
      importsRemapped: imports.length,
      mappedRowCount,
    };
  });

export default adminSeedSkusFromImports;
